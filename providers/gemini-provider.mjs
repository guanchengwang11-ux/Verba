import {usesEmailSchema,geminiEmailSchema} from './email-schema.mjs';
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
  return error;
}

function requestBody(text, instructions, maxOutputTokens) {
  return {
    systemInstruction: { parts: [{ text: instructions }] },
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: usesEmailSchema(instructions)?geminiEmailSchema:outputSchema, maxOutputTokens: usesEmailSchema(instructions)?1600:maxOutputTokens }
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
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models", { headers: { "x-goog-api-key": apiKey } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw providerError(response, data);
    return data.models?.filter((model) => model.supportedGenerationMethods?.includes("generateContent")).map((model) => model.name.replace(/^models\//, "")) || [];
  },
  supportsTextGeneration(model) {
    return /^gemini-/i.test(model)
      && !/(preview|experimental|latest|live|image|audio|tts|computer|robotics|omni|research|pro)/i.test(model);
  },
  async healthCheck(apiKey, model) {
    const startedAt = Date.now();
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody("Return the requested JSON.", "Return JSON with translation and englishMeaning, both short strings.", 128))
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw providerError(response, data);
    verifyJsonOutput(data);
    return { latencyMs: Date.now() - startedAt, usage: data.usageMetadata || null, httpStatus: response.status };
  },
  async translate(apiKey, model, text, instructions, { signal } = {}) {
    const startedAt = Date.now();
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal,
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody(text, instructions, 700))
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw providerError(response, data);
    return { rawOutput: data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "", usage: data.usageMetadata || null, latencyMs: Date.now() - startedAt, httpStatus: response.status };
  }
};
