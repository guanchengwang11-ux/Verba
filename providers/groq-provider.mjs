import { emailSchema, usesEmailSchema } from './email-schema.mjs';
import { createTranslationError } from '../translation-diagnostics.mjs';

const base = 'https://api.groq.com/openai/v1';
// Official production text models, checked 2026-09-23. Intersect with live discovery.
export const GROQ_TEXT_MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
const schema = { type: 'object', properties: { englishMeaning: { type: 'string' }, translation: { type: 'string' } }, required: ['englishMeaning', 'translation'], additionalProperties: false };
export function groqError(status, data = {}) {
  const code = String(data.error?.code || '');
  const modelError = /model_not_found|model_decommissioned|model_permission_blocked/.test(code);
  const quota = /quota|billing|credit|spend_limit/.test(code);
  const [internalCode, message] = status === 401 ? ['INVALID_API_KEY', 'Groq: the API key was rejected.']
    : modelError || status === 404 ? ['MODEL_NOT_FOUND', 'Groq: the selected model does not exist or is unavailable to this account. Select another model explicitly.']
    : status === 403 ? ['PERMISSION_DENIED', 'Groq: account or model permission was denied.']
    : status === 429 ? [quota ? 'PROVIDER_QUOTA_ERROR' : 'PROVIDER_RATE_LIMIT', quota ? 'Groq: account quota or spending limit reached.' : 'Groq: rate limit reached. Wait before trying again.']
    : code === 'json_validate_failed' ? ['MODEL_OUTPUT_INVALID', 'Groq: the model did not return the required JSON format.']
    : [400, 422].includes(status) ? ['PROVIDER_PARAMETER_ERROR', 'Groq: the selected model rejected the request parameters.']
    : !status ? ['PROVIDER_NETWORK_ERROR', 'Groq: connection failed or timed out.']
    : ['PROVIDER_UNAVAILABLE', 'Groq: service temporarily unavailable.'];
  // Never propagate provider messages, headers or arbitrary error codes (may echo input/key).
  return createTranslationError(internalCode, { message, status, provider: 'groq', providerErrorCode: internalCode, stage: 'provider_request' });
}
async function request(path, apiKey, body, signal) {
  let response;
  try {
    response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${apiKey}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: signal || AbortSignal.timeout(15000) });
  } catch { throw groqError(0); }
  let data;
  try { data = await response.json(); } catch { throw response.ok ? createTranslationError('MODEL_OUTPUT_INVALID', { message: 'Groq: invalid JSON response.', status: 502, provider: 'groq' }) : groqError(response.status); }
  if (!response.ok) throw groqError(response.status, data);
  return data;
}
export function groqRequestBody(model, text, instructions) {
  const structured = model.startsWith('openai/gpt-oss-');
  return { model, messages: [{ role: 'system', content: instructions }, { role: 'user', content: text }], stream: false,
    max_completion_tokens: structured ? 4096 : usesEmailSchema(instructions) ? 1600 : 700,
    ...(structured ? { reasoning_effort: 'low' } : {}),
    response_format: structured ? { type: 'json_schema', json_schema: { name: 'translation', strict: true, schema: usesEmailSchema(instructions) ? emailSchema : schema } } : { type: 'json_object' } };
}
const provider = {
  supportsTextGeneration: model => GROQ_TEXT_MODELS.includes(model),
  async discoverModels(apiKey) {
    const data = await request('/models', apiKey);
    return (data.data || []).filter(item => item.active !== false && GROQ_TEXT_MODELS.includes(item.id)).map(item => item.id);
  },
  async healthCheck(apiKey, model) {
    const start = Date.now();
    const result = await provider.translate(apiKey, model, 'Hello', 'Return only JSON with englishMeaning and translation. Translate the user text into Chinese.');
    let parsed;
    try { parsed = JSON.parse(result.rawOutput); } catch { /* classified below */ }
    if (!parsed?.translation || typeof parsed.englishMeaning !== 'string') throw createTranslationError('MODEL_OUTPUT_INVALID', { message: 'Groq: connection succeeded but the model returned invalid translation JSON.', status: 422, provider: 'groq' });
    return { latencyMs: Date.now() - start };
  },
  async translate(apiKey, model, text, instructions, { signal } = {}) {
    const start = Date.now();
    const data = await request('/chat/completions', apiKey, groqRequestBody(model, text, instructions), signal);
    if (data.model && data.model !== model) throw createTranslationError('MODEL_OUTPUT_INVALID', { message: 'Groq: response model differs from the selected model.', status: 422, provider: 'groq' });
    if (data.choices?.[0]?.finish_reason === 'length') throw createTranslationError('MODEL_OUTPUT_INVALID', { message: 'Groq: response exceeded the output budget.', status: 422, provider: 'groq' });
    return { rawOutput: data.choices?.[0]?.message?.content || '', usage: data.usage, latencyMs: Date.now() - start, httpStatus: 200 };
  }
};
export default provider;
