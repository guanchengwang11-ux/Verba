import {usesEmailSchema,geminiEmailSchema,translationTokenBudget} from './email-schema.mjs';
import {geminiCatalogEntry} from '../gemini-model-catalog.mjs';
const outputSchema = {
  type: "OBJECT",
  properties: {
    englishMeaning: { type: "STRING" },
    translation: { type: "STRING" }
  },
  required: ["translation", "englishMeaning"],
  propertyOrdering: ["englishMeaning", "translation"]
};

function providerError(response, data) {
  const error = new Error(data?.error?.message || "Gemini could not complete the request.");
  error.status = response.status;
  error.code = data?.error?.status || "";
  const reason=(data?.error?.details||[]).find(detail=>detail.reason)?.reason||'';
  if(response.status===401||reason==='API_KEY_INVALID')error.internalCode='INVALID_API_KEY';
  else if(response.status===403)error.internalCode='PERMISSION_DENIED';
  else if(response.status===400)error.internalCode='PROVIDER_PARAMETER_ERROR';
  return error;
}

function requestBody(text, instructions, maxOutputTokens,model='') {
  return {
    systemInstruction: { parts: [{ text: instructions }] },
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: usesEmailSchema(instructions)?geminiEmailSchema:outputSchema, maxOutputTokens,...(model==='gemini-3.8-flash'?{thinkingConfig:{thinkingLevel:'low'}}:{}) }
  };
}

function verifyJsonOutput(data) {
  const rawOutput = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  try {
    const parsed = JSON.parse(rawOutput.trim());
    if (typeof parsed.translation === "string" && typeof parsed.englishMeaning === "string") return;
  } catch {}
  throw providerError({ status: 422 }, { error: { message: "Model did not return the required JSON output." } });
}

export default {
  id: "gemini",
  async discoverModels(apiKey) {
    const models=[];let pageToken='';const seen=new Set();
    do {
      const url=new URL('https://generativelanguage.googleapis.com/v1beta/models');url.searchParams.set('pageSize','1000');if(pageToken)url.searchParams.set('pageToken',pageToken);
      const response=await fetch(url,{headers:{'x-goog-api-key':apiKey},signal:AbortSignal.timeout(15000)});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw providerError(response,data);
      models.push(...(data.models||[]).filter(m=>m.supportedGenerationMethods?.includes('generateContent')).map(m=>m.name.replace(/^models\//,'')));
      pageToken=data.nextPageToken||'';if(seen.has(pageToken))break;seen.add(pageToken);
    }while(pageToken&&seen.size<10);
    return [...new Set(models)];
  },
  supportsTextGeneration(model) {
    return Boolean(geminiCatalogEntry(model));
  },
  async healthCheck(apiKey, model) {
    const startedAt = Date.now();
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: AbortSignal.timeout(30000),
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody("Return the requested JSON.", "Return JSON with translation and englishMeaning, both short strings.", 700,model))
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw providerError(response, data);
    verifyJsonOutput(data);
    return { latencyMs: Date.now() - startedAt, usage: data.usageMetadata || null, httpStatus: response.status };
  },
  async translate(apiKey, model, text, instructions, { signal,maxOutputTokens } = {}) {
    const startedAt = Date.now();
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal,
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody(text, instructions, translationTokenBudget(instructions,maxOutputTokens),model))
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw providerError(response, data);
    return { rawOutput: data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "", usage: data.usageMetadata || null, latencyMs: Date.now() - startedAt, httpStatus: response.status };
  }
};
