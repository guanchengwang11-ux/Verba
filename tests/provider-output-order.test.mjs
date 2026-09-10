import test from "node:test";
import assert from "node:assert/strict";
import gemini from "../providers/gemini-provider.mjs";

test("Gemini schema agrees with source-meaning-first instruction without an extra request", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_, options) => {
    requests.push(JSON.parse(options.body));
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"englishMeaning":"A request","translation":"一个请求"}' }] } }] }) };
  };
  try {
    await gemini.translate("synthetic-test-key", "synthetic-model", "source", "instruction");
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0].generationConfig.responseSchema.propertyOrdering, ["englishMeaning", "translation"]);
    assert.equal(requests[0].contents[0].parts[0].text, "source");
  } finally { globalThis.fetch = originalFetch; }
});
