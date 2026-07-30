import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import openaiProvider from "./providers/openai-provider.mjs";
import geminiProvider from "./providers/gemini-provider.mjs";
import deepseekProvider from "./providers/deepseek-provider.mjs";

const providers = { openai: openaiProvider, gemini: geminiProvider, deepseek: deepseekProvider };
const providerKeys = { openai: "OPENAI_API_KEY", gemini: "GEMINI_API_KEY", deepseek: "DEEPSEEK_API_KEY" };
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

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
    if (!this.adapters[provider].supportsTextGeneration(model)) return false;
    if ((this.policy.blockedModels || []).some((name) => model === name || model.startsWith(`${name}-`))) return false;
    if ((this.policy.deprecatedModels || []).some((name) => model === name || model.startsWith(`${name}-`))) return false;
    return state.allowHighCost || this.costTier(provider, model) !== "high";
  }

  rankModels(provider, models, state) {
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

  async ensureReady(provider) {
    const state = this.state.providers[provider];
    if (!state) throw errorWithStatus("Unknown provider.", 400);
    const usable = state.lastKnownGoodModel || state.primaryModel;
    if (usable) return;
    await this.refresh(provider);
    if (!this.state.providers[provider].lastKnownGoodModel && !this.state.providers[provider].primaryModel) {
      throw errorWithStatus(this.state.providers[provider].lastError || "No verified model is available. Check the API key and run model detection.", 503);
    }
  }

  orderedTranslationModels(provider) {
    const state = this.state.providers[provider];
    return [...new Set([state.lastKnownGoodModel, state.primaryModel, ...state.fallbackModels])]
      .filter(Boolean)
      .filter((model) => !state.unavailableUntil[model] || state.unavailableUntil[model] <= Date.now())
      .slice(0, translationModelLimit);
  }

  async translate({ provider, text, instructions }) {
    if (!this.loaded) await this.initialize();
    await this.ensureReady(provider);
    const state = this.state.providers[provider];
    const apiKey = this.getApiKey(provider);
    const candidates = this.orderedTranslationModels(provider);
    let lastError;
    for (const model of candidates) {
      try {
        const result = await this.translateWithRetry(provider, apiKey, model, text, instructions);
        state.lastKnownGoodModel = model;
        state.primaryModel = model;
        state.modelHealth[model] = { ...(state.modelHealth[model] || {}), status: "healthy", checkedAt: new Date().toISOString(), latencyMs: result.latencyMs, failureCount: 0 };
        state.lastError = "";
        await this.persist();
        console.info(JSON.stringify({ event: "translation", provider, model, latencyMs: result.latencyMs, usage: normalizedUsage(result.usage), success: true }));
        return result;
      } catch (error) {
        lastError = error;
        if (error.status === 401 || error.status === 403) {
          console.info(JSON.stringify({ event: "translation", provider, model, success: false, status: error.status }));
          throw errorWithStatus("The API key is invalid or does not have permission to use this provider.", error.status);
        }
        state.failureCount[model] = (state.failureCount[model] || 0) + 1;
        state.modelHealth[model] = { ...(state.modelHealth[model] || {}), status: "unhealthy", checkedAt: new Date().toISOString(), failureCount: state.failureCount[model] };
        if (isInvalidModelError(error)) state.unavailableUntil[model] = Date.now() + unavailableDurationMs;
        console.info(JSON.stringify({ event: "translation", provider, model, success: false, status: error.status || 0, retryNextModel: true }));
      }
    }
    state.status = "degraded";
    state.lastError = "All verified translation models failed. Run model detection and try again.";
    await this.persist();
    throw errorWithStatus(state.lastError, lastError?.status || 503);
  }

  async translateWithRetry(provider, apiKey, model, text, instructions) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.adapters[provider].translate(apiKey, model, text, instructions);
      } catch (error) {
        lastError = error;
        if (!isTransientError(error) || attempt === 2) throw error;
        await sleep((attempt + 1) * 1000);
      }
    }
    throw lastError;
  }
}

export const modelManager = new ModelManager();
