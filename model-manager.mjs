import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import openaiProvider from "./providers/openai-provider.mjs";
import geminiProvider from "./providers/gemini-provider.mjs";
import groqProvider, { groqError } from './providers/groq-provider.mjs';
import deepseekProvider from "./providers/deepseek-provider.mjs";
import {geminiCatalogEntry,geminiModelChoices,GEMINI_CATALOG_CHECKED_AT,GEMINI_CATALOG_SOURCES} from './gemini-model-catalog.mjs';
import {GROQ_FREE_MODELS,groqModelChoices,GROQ_CATALOG_SOURCES} from './groq-model-catalog.mjs';
import {
  createTranslationError,
  normalizeTranslationError,
  TRANSLATION_ERROR_CODES
} from "./translation-diagnostics.mjs";

const providers = { openai: openaiProvider, gemini: geminiProvider, deepseek: deepseekProvider, groq: groqProvider };
const providerKeys = { openai: "OPENAI_API_KEY", gemini: "GEMINI_API_KEY", deepseek: "DEEPSEEK_API_KEY", groq: "GROQ_API_KEY" };
const providerIds = Object.keys(providers);
const cacheDurationMs = 24 * 60 * 60 * 1000;
const unavailableDurationMs = 60 * 60 * 1000;
const healthCheckLimit = 3;
const translationModelLimit = 3;

function createProviderState() {
  return {
    models: [], candidates: [], primaryModel: "", fallbackModels: [], lastKnownGoodModel: "", manualOverride: "", status: "not_checked", lastDetectedAt: "", lastHealthCheckAt: "", lastError: "", cacheUntil: "", unavailableUntil: {}, failureCount: {}, modelHealth: {}, allowHighCost: false
  };
}

function createState() {
  return { version: 1, providers: Object.fromEntries(providerIds.map((provider) => [provider, createProviderState()])) };
}

function sleep(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(createTranslationError(TRANSLATION_ERROR_CODES.REQUEST_CANCELLED, { message: "The translation request was cancelled.", status: 499, stage: "request_cancelled" }));
    }, { once: true });
  });
}

function errorWithStatus(message, status, code = "") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function isInvalidModelError(error) {
  return error.status === 404 || /(invalid model|model.*not found|deprecated|does not exist|not available)/i.test(error.message || "");
}

function isTransientError(error) {
  return [429, 502, 503, 504].includes(error.status);
}

function normalizedUsage(usage) {
  if (!usage) return null;
  return {
    inputTokens: usage.input_tokens ?? usage.prompt_tokens ?? usage.promptTokenCount ?? null,
    outputTokens: usage.output_tokens ?? usage.completion_tokens ?? usage.candidatesTokenCount ?? null
  };
}

export class ModelManager {
  constructor({ configurationDirectory = process.cwd(), adapters = providers, fetchImpl = fetch } = {}) {
    this.configurationDirectory = configurationDirectory;
    this.adapters = adapters;
    this.fetchImpl = fetchImpl;
    this.state = createState();
    this.policy = null;
    this.loaded = false;
    this.geminiSelectionRevision = 0;
    this.groqSelectionRevision = 0;
  }

  get statePath() { return join(this.configurationDirectory, "model-state.json"); }

  async initialize({ configurationDirectory } = {}) {
    if (configurationDirectory) this.configurationDirectory = configurationDirectory;
    const policyPath = join(dirname(fileURLToPath(import.meta.url)), "model-policy.json");
    this.policy = JSON.parse(await readFile(policyPath, "utf8"));
    try {
      const saved = JSON.parse(await readFile(this.statePath, "utf8"));
      this.state = { ...createState(), ...saved, providers: Object.fromEntries(providerIds.map((provider) => [provider, { ...createProviderState(), ...(saved.providers?.[provider] || {}) }])) };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const groq=this.state.providers.groq;
    const recommended=groqModelChoices(groq.models,groq.modelHealth)[0]?.id;
    if(!groq.manualOverride&&recommended&&groq.selectedModel!==recommended){
      groq.selectedModel=recommended;groq.primaryModel=groq.modelHealth[recommended]?.status==='healthy'?recommended:'';
      groq.lastKnownGoodModel=groq.primaryModel;groq.status=groq.primaryModel?'ready':'not_checked';
    }
    this.loaded = true;
    return this.getStatus();
  }

  async persist() {
    await mkdir(this.configurationDirectory, { recursive: true });
    await writeFile(this.statePath, `${JSON.stringify(this.state, null, 2)}\n`, "utf8");
  }

  getApiKey(provider) {
    return (process.env[providerKeys[provider]] || "").trim();
  }

  getStatus(provider) {
    const summarize = (item) => ({
      provider: item.provider,
      ...(item.provider === "groq" ? { models: item.models.filter(m => this.adapters.groq.supportsTextGeneration(m)),modelChoices:groqModelChoices(item.models,item.modelHealth),selectedModel:item.manualOverride||item.selectedModel||GROQ_FREE_MODELS[0],catalogCheckedAt:'2026-10-20',catalogSources:GROQ_CATALOG_SOURCES,errorCode: item.errorCode || "" } : {}),
      ...(item.provider === 'gemini' ? {modelChoices:geminiModelChoices(item.models,item.modelHealth),selectedModel:item.manualOverride||item.primaryModel||'',selectionErrorCode:item.selectionErrorCode||'',catalogCheckedAt:GEMINI_CATALOG_CHECKED_AT,catalogSources:GEMINI_CATALOG_SOURCES} : {}),
      status: item.status,
      primaryModel: item.primaryModel,
      fallbackModels: item.fallbackModels,
      lastKnownGoodModel: item.lastKnownGoodModel,
      manualOverride: item.manualOverride,
      modelStatus: item.primaryModel ? (item.modelHealth[item.primaryModel]?.status || "unknown") : "not_selected",
      lastDetectedAt: item.lastDetectedAt,
      lastHealthCheckAt: item.lastHealthCheckAt,
      cacheUntil: item.cacheUntil,
      lastError: item.lastError,
      automatic: !item.manualOverride,
      allowHighCost: item.allowHighCost
    });
    const entries = provider ? [[provider, this.state.providers[provider]]] : Object.entries(this.state.providers);
    if (provider && !this.state.providers[provider]) throw errorWithStatus("Unknown provider.", 400);
    return Object.fromEntries(entries.map(([id, item]) => [id, summarize({ provider: id, ...item })]));
  }

  costTier(provider, model) {
    const tiers = this.policy.costTiers?.[provider] || {};
    for (const tier of ["low", "medium", "high"]) {
      if ((tiers[tier] || []).some((name) => model === name || model.startsWith(`${name}-`))) return tier;
    }
    return "unknown";
  }

  preferenceIndex(provider, model) {
    const patterns = this.policy.preferredPatterns?.[provider] || [];
    const index = patterns.findIndex((name) => model === name || model.startsWith(`${name}-`));
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  }

  isAllowed(provider, model, state) {
    if (provider === 'gemini') return Boolean(geminiCatalogEntry(model)) && this.adapters.gemini.supportsTextGeneration(model);
    if (!this.adapters[provider].supportsTextGeneration(model)) return false;
    if ((this.policy.blockedModels || []).some((name) => model === name || model.startsWith(`${name}-`))) return false;
    if ((this.policy.deprecatedModels || []).some((name) => model === name || model.startsWith(`${name}-`))) return false;
    return state.allowHighCost || this.costTier(provider, model) !== "high";
  }

  rankModels(provider, models, state) {
    if (provider === 'gemini') return geminiModelChoices(models,state.modelHealth).map(m=>m.id).filter(id=>this.isAllowed(provider,id,state));
    const tierWeight = { low: 0, medium: 1, unknown: 2, high: 3 };
    const now = Date.now();
    return [...new Set(models)]
      .filter((model) => this.isAllowed(provider, model, state))
      .filter((model) => !state.unavailableUntil[model] || state.unavailableUntil[model] <= now)
      .sort((left, right) => {
        const leftHealth = state.modelHealth[left] || {};
        const rightHealth = state.modelHealth[right] || {};
        return (tierWeight[this.costTier(provider, left)] - tierWeight[this.costTier(provider, right)])
          || (this.preferenceIndex(provider, left) - this.preferenceIndex(provider, right))
          || ((leftHealth.failureCount || 0) - (rightHealth.failureCount || 0))
          || ((leftHealth.latencyMs || Number.MAX_SAFE_INTEGER) - (rightHealth.latencyMs || Number.MAX_SAFE_INTEGER))
          || left.localeCompare(right);
      });
  }

  async setManualOverride(provider, model, { allowHighCost } = {}) {
    if (provider === 'gemini') return this.selectGeminiModel(model);
    if (!this.state.providers[provider]) throw errorWithStatus("Unknown provider.", 400);
    const state = this.state.providers[provider];
    state.manualOverride = String(model || "").trim();
    if (typeof allowHighCost === "boolean") state.allowHighCost = allowHighCost;
    await this.persist();
    return this.refresh(provider, { force: true });
  }

  async refreshAll({ force = false } = {}) {
    const results = await Promise.allSettled(providerIds.filter((provider) => this.getApiKey(provider)).map((provider) => this.refresh(provider, { force })));
    return { status: this.getStatus(), results: results.map((result) => result.status === "rejected" ? { error: result.reason.message } : { ok: true }) };
  }

  async refresh(provider, { force = false } = {}) {
    if (!this.loaded) await this.initialize();
    if (provider === "groq") return this.refreshGroq({ force });
    if (provider === 'gemini') return this.refreshGemini({force});
    if (!this.adapters[provider]) throw errorWithStatus("Unknown provider.", 400);
    const state = this.state.providers[provider];
    const apiKey = this.getApiKey(provider);
    if (!apiKey) {
      state.status = "missing_key";
      state.lastError = "API key is not configured.";
      await this.persist();
      return this.getStatus(provider);
    }
    if (!force && state.cacheUntil && Date.parse(state.cacheUntil) > Date.now() && state.primaryModel) return this.getStatus(provider);

    let models;
    try {
      models = await this.adapters[provider].discoverModels(apiKey);
    } catch (error) {
      state.status = error.status === 401 || error.status === 403 ? "key_error" : "cache_only";
      state.lastError = error.status === 401 || error.status === 403 ? "API key or account permission was rejected." : "Model discovery failed; using the last verified model only.";
      await this.persist();
      return this.getStatus(provider);
    }

    state.models = models;
    state.lastDetectedAt = new Date().toISOString();
    state.cacheUntil = new Date(Date.now() + cacheDurationMs).toISOString();
    const ranked = this.rankModels(provider, models, state);
    const manual = state.manualOverride;
    if (manual && (!models.includes(manual) || (!state.allowHighCost && this.costTier(provider, manual) === "high"))) {
      state.status = "manual_override_invalid";
      state.lastError = "The manual model is unavailable or requires enabling high-cost models. Restore automatic selection.";
      state.primaryModel = "";
      state.fallbackModels = [];
      await this.persist();
      return this.getStatus(provider);
    }
    const candidates = manual ? [manual] : ranked;
    state.candidates = candidates;
    const checked = [];
    for (const model of candidates.slice(0, healthCheckLimit)) {
      const startedAt = Date.now();
      try {
        const health = await this.adapters[provider].healthCheck(apiKey, model);
        state.modelHealth[model] = { status: "healthy", checkedAt: new Date().toISOString(), latencyMs: health.latencyMs || Date.now() - startedAt, failureCount: 0 };
        checked.push(model);
      } catch (error) {
        state.modelHealth[model] = { status: "unhealthy", checkedAt: new Date().toISOString(), latencyMs: Date.now() - startedAt, failureCount: (state.modelHealth[model]?.failureCount || 0) + 1, httpStatus: error.status || 0, error: error.status === 401 || error.status === 403 ? "API key or permission rejected." : error.status === 429 ? "Provider quota or rate limit was reached." : "Health check failed." };
        if (isInvalidModelError(error)) state.unavailableUntil[model] = Date.now() + unavailableDurationMs;
        if (error.status === 401 || error.status === 403) break;
      }
    }
    state.primaryModel = checked[0] || "";
    state.fallbackModels = checked.slice(1);
    if (state.primaryModel) state.lastKnownGoodModel = state.primaryModel;
    const firstFailure = state.modelHealth[candidates[0]];
    state.status = state.primaryModel ? "ready" : firstFailure?.httpStatus === 401 || firstFailure?.httpStatus === 403 ? "key_error" : firstFailure?.httpStatus === 429 ? "quota_error" : "no_compatible_model";
    state.lastError = state.primaryModel ? "" : (firstFailure?.error || "No verified low- or medium-cost text model is available.");
    state.lastHealthCheckAt = new Date().toISOString();
    await this.persist();
    console.info(JSON.stringify({ event: "model_refresh", provider, discovered: models.length, verified: checked.length, selected: state.primaryModel || null, status: state.status }));
    return this.getStatus(provider);
  }

  geminiFailure(state, error) {
    const failure=[401,403].includes(error.status)?createTranslationError(error.status===401?'INVALID_API_KEY':'PERMISSION_DENIED',{status:error.status,provider:'gemini',stage:'model_selection'}):normalizeTranslationError(error,{provider:'gemini',stage:'model_selection'});
    state.selectionErrorCode=failure.internalCode;
    state.status=error.status===401||error.status===403?'key_error':error.status===429?'quota_error':failure.internalCode==='PROVIDER_NETWORK_ERROR'?'cache_only':'no_compatible_model';
    state.lastError=error.status===401||error.status===403?'Google rejected the API key or account permission.':error.status===429?'Google quota or rate limit reached.':'Google could not verify the selected free-tier model. Check models again.';
    return failure;
  }

  async probeGemini(model) {
    const state=this.state.providers.gemini,started=Date.now();
    try {
      const result=await this.adapters.gemini.healthCheck(this.getApiKey('gemini'),model);
      const checkedAt=new Date().toISOString();
      state.modelHealth[model]={status:'healthy',checkedAt,probeCheckedAt:checkedAt,probeLatencyMs:result.latencyMs||Date.now()-started,latencyMs:result.latencyMs||Date.now()-started,failureCount:0};
      delete state.unavailableUntil[model];
      return {model,ok:true};
    } catch(error) {
      const failure=normalizeTranslationError(error,{provider:'gemini',model,stage:'model_selection'});
      state.modelHealth[model]={...state.modelHealth[model],status:'unhealthy',checkedAt:new Date().toISOString(),httpStatus:error.status||failure.status,errorCode:failure.internalCode};
      if(isInvalidModelError(error))state.unavailableUntil[model]=Date.now()+unavailableDurationMs;
      return {model,ok:false,error};
    }
  }

  async refreshGemini({force=false}={}) {
    const state=this.state.providers.gemini,revision=this.geminiSelectionRevision;
    if(!this.getApiKey('gemini')){state.status='missing_key';state.lastError='API key is not configured.';state.selectionErrorCode='INVALID_API_KEY';await this.persist();return this.getStatus('gemini');}
    if(!force&&Date.parse(state.cacheUntil)>Date.now()&&state.status==='ready'&&this.isAllowed('gemini',state.manualOverride||state.primaryModel,state))return this.getStatus('gemini');
    try {
      const discovered=await this.adapters.gemini.discoverModels(this.getApiKey('gemini'));
      if(revision!==this.geminiSelectionRevision)return this.getStatus('gemini');
      state.models=discovered;
      state.lastDetectedAt=new Date().toISOString();state.cacheUntil=new Date(Date.now()+cacheDurationMs).toISOString();
    } catch(error) {if(revision!==this.geminiSelectionRevision)return this.getStatus('gemini');this.geminiFailure(state,error);await this.persist();return this.getStatus('gemini');}
    if(revision!==this.geminiSelectionRevision)return this.getStatus('gemini');
    const manual=state.manualOverride;
    if(manual&&(!state.models.includes(manual)||!this.isAllowed('gemini',manual,state))){
      state.primaryModel='';state.fallbackModels=[];state.status='manual_override_invalid';state.selectionErrorCode='MODEL_NOT_FOUND';state.lastError='The saved Google model is not an available stable free-tier text model. Choose another model.';await this.persist();return this.getStatus('gemini');
    }
    // A refresh is bounded to three comparable probes. Remaining discovered
    // eligible models are explicitly untested until selected, never fabricated.
    const ranked=geminiModelChoices(state.models,{},{}).map(m=>m.id);
    state.candidates=manual?[manual]:ranked;
    const results=await Promise.all(state.candidates.slice(0,healthCheckLimit).map(id=>this.probeGemini(id)));
    if(revision!==this.geminiSelectionRevision)return this.getStatus('gemini');
    const verified=geminiModelChoices(state.models,state.modelHealth).filter(m=>m.health==='healthy').map(m=>m.id);
    state.primaryModel=manual?(results[0]?.ok?manual:''):(verified[0]||'');
    state.fallbackModels=manual?[]:verified.filter(id=>id!==state.primaryModel).slice(0,translationModelLimit-1);
    if(state.primaryModel){state.lastKnownGoodModel=state.primaryModel;state.status='ready';state.selectionErrorCode='';state.lastError='';}
    else this.geminiFailure(state,results.find(r=>r.error)?.error||errorWithStatus('No compatible Google model',404));
    state.lastHealthCheckAt=new Date().toISOString();await this.persist();return this.getStatus('gemini');
  }

  async selectGeminiModel(model) {
    if(!this.loaded)await this.initialize();
    if(typeof model!=='string'||model.length>120)throw errorWithStatus('Invalid Google model selection.',400);
    const selected=model.trim(),state=this.state.providers.gemini;
    if(selected&&(!geminiCatalogEntry(selected)||!state.models.includes(selected)))throw createTranslationError(TRANSLATION_ERROR_CODES.MODEL_NOT_FOUND,{status:400,provider:'gemini',message:'Choose a detected stable Google text model with official free-tier support.',stage:'model_selection'});
    this.geminiSelectionRevision++;
    state.manualOverride=selected;state.allowHighCost=false;state.primaryModel='';state.fallbackModels=[];state.selectionErrorCode='';
    await this.persist();
    if(!selected)return this.refreshGemini({force:false});
    if(!this.getApiKey('gemini')){state.status='missing_key';state.selectionErrorCode='INVALID_API_KEY';state.lastError='API key is not configured.';await this.persist();return this.getStatus('gemini');}
    const checked=state.modelHealth[selected];
    const result=checked?.status==='healthy'&&Date.now()-Date.parse(checked.checkedAt)<cacheDurationMs?{ok:true}:await this.probeGemini(selected);
    if(state.manualOverride!==selected)return this.getStatus('gemini');
    if(result.ok){state.primaryModel=selected;state.lastKnownGoodModel=selected;state.status='ready';state.lastError='';}
    else this.geminiFailure(state,result.error);
    state.lastHealthCheckAt=new Date().toISOString();await this.persist();return this.getStatus('gemini');
  }

  async refreshGroq({ force = false } = {}) {
    const state = this.state.providers.groq;
    const revision=this.groqSelectionRevision;
    const apiKey = this.getApiKey('groq');
    if (!force && state.status === 'ready' && Date.parse(state.cacheUntil) > Date.now()) return this.getStatus('groq');
    let selected = state.manualOverride || state.selectedModel || GROQ_FREE_MODELS[0];
    state.selectedModel = selected;
    state.primaryModel = ''; state.lastKnownGoodModel = ''; state.fallbackModels = [];
    try {
      if (!apiKey) throw groqError(401);
      const discovered=await this.adapters.groq.discoverModels(apiKey);
      if(revision!==this.groqSelectionRevision)return this.getStatus('groq');
      state.models=discovered;
      if(!state.manualOverride)selected=GROQ_FREE_MODELS.find(id=>state.models.includes(id))||selected;
      state.selectedModel=selected;
      state.lastDetectedAt = new Date().toISOString();
      if (!state.models.includes(selected) || !this.adapters.groq.supportsTextGeneration(selected)) throw groqError(404);
      const candidates=state.manualOverride?[selected]:GROQ_FREE_MODELS.filter(id=>state.models.includes(id));
      const checked=await Promise.all(candidates.map(async model=>{
        try {const health=await this.adapters.groq.healthCheck(apiKey,model);return {model,ok:true,health};}
        catch(error){return {model,ok:false,error};}
      }));
      if(revision!==this.groqSelectionRevision)return this.getStatus('groq');
      for(const result of checked)state.modelHealth[result.model]={...state.modelHealth[result.model],status:result.ok?'healthy':'unhealthy',checkedAt:new Date().toISOString(),...(result.ok?{probeLatencyMs:result.health.latencyMs||null}:{httpStatus:result.error.status||0,errorCode:result.error.internalCode})};
      const available=checked.find(result=>result.ok);
      if(!available)throw checked[0]?.error||groqError(404);
      selected=available.model;state.selectedModel=selected;
      state.primaryModel = selected; state.lastKnownGoodModel = selected;
      state.status = 'ready'; state.lastError = ''; state.errorCode = '';
      state.cacheUntil = new Date(Date.now() + cacheDurationMs).toISOString();
    } catch (error) {
      if(revision!==this.groqSelectionRevision)return this.getStatus('groq');
      const failure = normalizeTranslationError(error, { provider: 'groq' });
      state.errorCode = failure.internalCode;
      state.lastError = failure.message;
      state.status = !apiKey ? 'missing_key' : failure.status === 401 || failure.status === 403 ? 'key_error' : failure.internalCode === 'PROVIDER_RATE_LIMIT' ? 'rate_limited' : failure.status === 429 ? 'quota_error' : 'no_compatible_model';
    }
    state.lastHealthCheckAt = new Date().toISOString();
    await this.persist();
    return this.getStatus('groq');
  }

  async selectGroqModel(model){
    if(typeof model!=='string'||model.length>120)throw errorWithStatus('Invalid Groq model.',400);
    const state=this.state.providers.groq,selected=model.trim();
    if(selected&&(!GROQ_FREE_MODELS.includes(selected)||!state.models.includes(selected)))throw groqError(404);
    this.groqSelectionRevision++;
    state.manualOverride=selected;state.selectedModel=selected||GROQ_FREE_MODELS.find(id=>state.models.includes(id))||GROQ_FREE_MODELS[0];
    await this.persist();return this.refreshGroq({force:true});
  }

  async ensureReady(provider) {
    const state = this.state.providers[provider];
    if (!state) throw errorWithStatus("Unknown provider.", 400);
    if(provider==='gemini'){
      if(!this.getApiKey('gemini'))throw createTranslationError(TRANSLATION_ERROR_CODES.INVALID_API_KEY,{status:401,provider,message:'Google API key is not configured.',stage:'model_selection'});
      if(state.manualOverride){
        if(!this.isAllowed(provider,state.manualOverride,state)||state.models.length&&!state.models.includes(state.manualOverride))throw createTranslationError(TRANSLATION_ERROR_CODES.MODEL_NOT_FOUND,{status:404,provider,model:state.manualOverride,message:'The selected Google model is unavailable. Choose another free-tier model.',stage:'model_selection'});
        return;
      }
      if(this.orderedTranslationModels(provider).length)return;
      await this.refreshGemini();
      if(!this.orderedTranslationModels(provider).length)throw createTranslationError(state.selectionErrorCode||TRANSLATION_ERROR_CODES.MODEL_NOT_FOUND,{status:state.status==='quota_error'?429:503,provider,message:state.lastError||'No available Google free-tier text model.',stage:'model_selection'});
      return;
    }
    if (provider === 'groq') {
      if (!this.getApiKey(provider)) throw groqError(401);
      const model = state.manualOverride || state.selectedModel || GROQ_FREE_MODELS[0];
      if (!this.adapters.groq.supportsTextGeneration(model)) throw groqError(404);
      // No discovery/health calls inside translation: the one selected model uses the existing budget.
      state.selectedModel = model;
      return;
    }
    const usable = state.lastKnownGoodModel || state.primaryModel;
    if (usable) return;
    await this.refresh(provider);
    if (!this.state.providers[provider].lastKnownGoodModel && !this.state.providers[provider].primaryModel) {
      throw errorWithStatus(this.state.providers[provider].lastError || "No verified model is available. Check the API key and run model detection.", 503);
    }
  }

  orderedTranslationModels(provider) {
    const state = this.state.providers[provider];
    if(provider==='gemini')return (state.manualOverride?[state.manualOverride]:[...new Set([state.primaryModel,state.lastKnownGoodModel,...state.fallbackModels])])
      .filter(id=>id&&this.isAllowed(provider,id,state)&&(!state.models.length||state.models.includes(id)))
      .filter(id=>state.manualOverride||!state.unavailableUntil[id]||state.unavailableUntil[id]<=Date.now()).slice(0,translationModelLimit);
    if (provider === 'groq') return [state.manualOverride || state.selectedModel || GROQ_FREE_MODELS[0]];
    return [...new Set([state.lastKnownGoodModel, state.primaryModel, ...state.fallbackModels])]
      .filter(Boolean)
      .filter((model) => !state.unavailableUntil[model] || state.unavailableUntil[model] <= Date.now())
      .slice(0, translationModelLimit);
  }

  async translate({ provider, text, instructions, diagnostics, signal, maxOutputTokens }) {
    if (!this.loaded) await this.initialize();
    try {
      await this.ensureReady(provider);
    } catch (error) {
      const normalized = normalizeTranslationError(error, { provider, stage: "model_selection" });
      diagnostics?.record({
        event: "translation_stage_failed",
        stage: "model_selection",
        internalCode: normalized.internalCode,
        httpStatus: normalized.status,
        providerErrorCode: normalized.providerErrorCode,
        success: false
      });
      throw normalized;
    }
    const state = this.state.providers[provider];
    const apiKey = this.getApiKey(provider);
    const candidates = this.orderedTranslationModels(provider);
    let lastError;
    for (let modelIndex = 0; modelIndex < candidates.length; modelIndex += 1) {
      const model = candidates[modelIndex];
      try {
        const result = await this.translateWithRetry(provider, apiKey, model, text, instructions, { diagnostics, modelSwitched: modelIndex > 0, hasFallback: modelIndex < candidates.length - 1, allowSameModelRetry: modelIndex === candidates.length - 1, signal,maxOutputTokens });
        state.lastKnownGoodModel = model;
        state.primaryModel = model;
        state.modelHealth[model] = { ...(state.modelHealth[model] || {}), status: "healthy", checkedAt: new Date().toISOString(), latencyMs: result.latencyMs, failureCount: 0 };
        if(provider==='gemini'){state.selectionErrorCode='';state.status='ready';}
        state.lastError = "";
        if (provider === "groq") { state.errorCode = ""; state.status = "ready"; }
        await this.persist();
        if (!diagnostics) console.info(JSON.stringify({ event: "translation", provider, model, latencyMs: result.latencyMs, usage: normalizedUsage(result.usage), success: true }));
        return { ...result, model };
      } catch (error) {
        lastError = normalizeTranslationError(error, { provider, model, stage: "provider_request" });
        if (provider === "groq") {
          state.failureCount[model] = (state.failureCount[model] || 0) + 1;
          state.modelHealth[model] = { ...(state.modelHealth[model] || {}), status: "unhealthy", checkedAt: new Date().toISOString(), httpStatus: lastError.status, errorCode: lastError.internalCode, failureCount: state.failureCount[model] };
          state.status = [401, 403].includes(lastError.status) ? "key_error" : lastError.status === 429 ? lastError.internalCode === "PROVIDER_RATE_LIMIT" ? "rate_limited" : "quota_error" : "degraded";
          state.lastError = lastError.message; state.errorCode = lastError.internalCode;
          await this.persist(); throw lastError;
        }
        if (lastError.status === 401 || lastError.status === 403) {
          if (provider === "gemini") {
            state.failureCount[model] = (state.failureCount[model] || 0) + 1;
            state.modelHealth[model] = { ...(state.modelHealth[model] || {}), status: "unhealthy", checkedAt: new Date().toISOString(), httpStatus: lastError.status, errorCode: lastError.internalCode, failureCount: state.failureCount[model] };
            state.status = "key_error"; state.selectionErrorCode = lastError.internalCode;
            state.lastError = "Google rejected the API key or account permission.";
            await this.persist();
          }
          throw createTranslationError(provider==='gemini'?(lastError.status===401?'INVALID_API_KEY':'PERMISSION_DENIED'):TRANSLATION_ERROR_CODES.PROVIDER_UNAVAILABLE, {
            message: "The API key is invalid or does not have permission to use this provider.",
            status: lastError.status,
            providerErrorCode: lastError.providerErrorCode,
            provider,
            model,
            stage: "provider_authentication",
            cause: lastError
          });
        }
        if (lastError.internalCode === TRANSLATION_ERROR_CODES.REQUEST_CANCELLED || lastError.stage === "attempt_budget") throw lastError;
        state.failureCount[model] = (state.failureCount[model] || 0) + 1;
        state.modelHealth[model] = { ...(state.modelHealth[model] || {}), status: "unhealthy", checkedAt: new Date().toISOString(), failureCount: state.failureCount[model] };
        if(provider==='gemini'){state.modelHealth[model].httpStatus=lastError.status;state.modelHealth[model].errorCode=lastError.internalCode;state.selectionErrorCode=lastError.internalCode;}
        if (lastError.internalCode === TRANSLATION_ERROR_CODES.MODEL_NOT_FOUND || isInvalidModelError(lastError)) state.unavailableUntil[model] = Date.now() + unavailableDurationMs;
        if (!diagnostics) console.info(JSON.stringify({ event: "translation", provider, model, success: false, status: lastError.status || 0, retryNextModel: modelIndex < candidates.length - 1 }));
      }
    }
    state.status = provider === "gemini" && lastError?.status === 429 ? lastError.internalCode === "PROVIDER_RATE_LIMIT" ? "rate_limited" : "quota_error" : "degraded";
    state.lastError = provider === "gemini" && lastError?.status === 429 ? "Google quota or rate limit reached." : "All verified translation models failed. Run model detection and try again.";
    await this.persist();
    throw lastError || createTranslationError(TRANSLATION_ERROR_CODES.MODEL_NOT_FOUND, {
      message: state.lastError,
      status: 503,
      provider,
      stage: "model_selection"
    });
  }

  async translateWithRetry(provider, apiKey, model, text, instructions, { diagnostics, modelSwitched = false, hasFallback = false, allowSameModelRetry = true, signal,maxOutputTokens } = {}) {
    let lastError;
    for (let retryIndex = 0; retryIndex < 2; retryIndex += 1) {
      if (signal?.aborted) throw createTranslationError(TRANSLATION_ERROR_CODES.REQUEST_CANCELLED, { message: "The translation request was cancelled.", status: 499, provider, model, stage: "request_cancelled" });
      const attempt = diagnostics?.nextAttempt() || retryIndex + 1;
      const startedAt = Date.now();
      const controller = new AbortController();
      let timedOut = false;
      const onAbort = () => controller.abort();
      signal?.addEventListener("abort", onAbort, { once: true });
      const remainingMs = diagnostics?.remainingMs() || 30000;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, Math.max(1, remainingMs));
      try {
        const result = await this.adapters[provider].translate(apiKey, model, text, instructions, { signal: controller.signal,maxOutputTokens });
        diagnostics?.record({
          event: "translation_attempt",
          attempt,
          provider,
          model,
          result: "success",
          stage: "provider_request",
          httpStatus: result.httpStatus || 200,
          providerErrorCode: "",
          latencyMs: result.latencyMs || Date.now() - startedAt,
          modelSwitched: modelSwitched && retryIndex === 0,
          willRetry: false,
          success: true
        });
        return result;
      } catch (error) {
        if (signal?.aborted) {
          lastError = createTranslationError(TRANSLATION_ERROR_CODES.REQUEST_CANCELLED, { message: "The translation request was cancelled.", status: 499, provider, model, stage: "request_cancelled", cause: error });
        } else if (timedOut) {
          lastError = createTranslationError(TRANSLATION_ERROR_CODES.PROVIDER_NETWORK_ERROR, { message: "The provider request exceeded the translation timeout budget.", status: 504, providerErrorCode: "REQUEST_TIMEOUT", provider, model, stage: "provider_request", cause: error });
        } else if(provider==='gemini'&&[400,401,403].includes(error.status)) {
          lastError=normalizeTranslationError(createTranslationError(error.internalCode||({400:'PROVIDER_PARAMETER_ERROR',401:'INVALID_API_KEY',403:'PERMISSION_DENIED'}[error.status]),{status:error.status,provider,model,stage:'provider_request'}));
        } else {
          lastError = normalizeTranslationError(error, { provider, model, stage: "provider_request" });
        }
        const retryableSameModel = lastError.internalCode === TRANSLATION_ERROR_CODES.PROVIDER_NETWORK_ERROR || [502, 503, 504].includes(lastError.status);
        const willRetry = retryableSameModel && allowSameModelRetry && retryIndex === 0 && (diagnostics?.canAttempt() ?? true) && !signal?.aborted;
        const canFallback = hasFallback && ![401, 403].includes(lastError.status) && lastError.internalCode !== TRANSLATION_ERROR_CODES.REQUEST_CANCELLED;
        diagnostics?.record({
          event: "translation_attempt",
          attempt,
          provider,
          model,
          result: "failed",
          stage: "provider_request",
          internalCode: lastError.internalCode,
          httpStatus: lastError.status,
          providerErrorCode: lastError.providerErrorCode,
          latencyMs: Date.now() - startedAt,
          modelSwitched: modelSwitched && retryIndex === 0,
          willRetry,
          retryReason: willRetry ? lastError.internalCode : canFallback ? "model_fallback" : "",
          success: false
        });
        if (!willRetry) throw lastError;
        await sleep(Math.min(750, diagnostics?.remainingMs() || 750), signal);
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    }
    throw lastError;
  }
}

export const modelManager = new ModelManager();
