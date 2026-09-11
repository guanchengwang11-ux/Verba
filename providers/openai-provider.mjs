import {usesEmailSchema,emailSchema} from './email-schema.mjs';
const outputSchema = {
  type: "object",
  properties: {
    englishMeaning: { type: "string" },
    translation: { type: "string" }
  },
  required: ["translation", "englishMeaning"],
  additionalProperties: false
};

function providerError(response, data) {
  const error = new Error(data?.error?.message || "OpenAI could not complete the request.");
  error.status = response.status;
  error.code = data?.error?.code || "";
  return error;
}

function verifyJsonOutput(rawOutput) {
  try {
    const parsed = JSON.parse(String(rawOutput || "").trim());
    if (typeof parsed.translation === "string" && typeof parsed.englishMeaning === "string") return;
  } catch {}
  throw providerError({ status: 422 }, { error: { message: "Model did not return the required JSON output." } });
}

export default {
  id: "openai",
  async discoverModels(apiKey) {
    const response = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw providerError(response, data);
    return data.data?.map((model) => model.id).filter(Boolean) || [];
  },
  supportsTextGeneration(model) {
    return /^(gpt-|chat-latest$)/i.test(model)
      && !/(embedding|image|audio|speech|tts|transcri|moderation|realtime|search|codex|pro|reason)/i.test(model);
  },
  async healthCheck(apiKey, model) {
    const startedAt = Date.now();
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        store: false,
        input: "Return the requested JSON.",
        max_output_tokens: 32,
        text: { format: { type: "json_schema", name: "verba_health", strict: true, schema: outputSchema } }
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw providerError(response, data);
    verifyJsonOutput(data.output_text);
    return { latencyMs: Date.now() - startedAt, usage: data.usage || null, httpStatus: response.status };
  },
  async translate(apiKey, model, text, instructions, { signal } = {}) {
    const startedAt = Date.now();
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        store: false,
        instructions,
        input: text,
        max_output_tokens: usesEmailSchema(instructions)?1600:700,
        text: { format: { type: "json_schema", name: "workplace_translation", strict: true, schema: usesEmailSchema(instructions)?emailSchema:outputSchema } }
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw providerError(response, data);
    return { rawOutput: data.output_text, usage: data.usage || null, latencyMs: Date.now() - startedAt, httpStatus: response.status };
  }
};
