function providerError(response, data) {
  const error = new Error(data?.error?.message || "DeepSeek could not complete the request.");
  error.status = response.status;
  error.code = data?.error?.code || "";
  return error;
}

function requestBody(model, messages, maxTokens) {
  return { model, messages, response_format: { type: "json_object" }, max_tokens: maxTokens, stream: false, thinking: { type: "disabled" } };
}

function verifyJsonOutput(data) {
  try {
    const parsed = JSON.parse(String(data.choices?.[0]?.message?.content || "").trim());
    if (typeof parsed.translation === "string" && typeof parsed.englishMeaning === "string") return;
  } catch {}
  throw providerError({ status: 422 }, { error: { message: "Model did not return the required JSON output." } });
}

export default {
  id: "deepseek",
  async discoverModels(apiKey) {
    const response = await fetch("https://api.deepseek.com/models", { headers: { Authorization: `Bearer ${apiKey}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw providerError(response, data);
    return data.data?.map((model) => model.id).filter(Boolean) || [];
  },
  supportsTextGeneration(model) {
    return /^deepseek-/i.test(model) && !/(reasoner|pro)/i.test(model);
  },
  async healthCheck(apiKey, model) {
    const startedAt = Date.now();
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody(model, [{ role: "system", content: "Return JSON with translation and englishMeaning." }, { role: "user", content: "health" }], 32))
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw providerError(response, data);
    verifyJsonOutput(data);
    return { latencyMs: Date.now() - startedAt, usage: data.usage || null, httpStatus: response.status };
  },
  async translate(apiKey, model, text, instructions, { signal } = {}) {
    const startedAt = Date.now();
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody(model, [{ role: "system", content: instructions }, { role: "user", content: text }], 700))
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw providerError(response, data);
    return { rawOutput: data.choices?.[0]?.message?.content || "", usage: data.usage || null, latencyMs: Date.now() - startedAt, httpStatus: response.status };
  }
};
