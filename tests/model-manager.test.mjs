import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelManager } from "../model-manager.mjs";
import { createTranslationDiagnosticSession } from "../translation-diagnostics.mjs";

async function createManager(adapter) {
  process.env.OPENAI_API_KEY = "test-key";
  const manager = new ModelManager({ configurationDirectory: await mkdtemp(join(tmpdir(), "verba-model-test-")), adapters: { openai: adapter, gemini: adapter, deepseek: adapter } });
  await manager.initialize();
  return manager;
}

function providerError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

test("does not use the first listed model when policy blocks it", async () => {
  const manager = await createManager({
    discoverModels: async () => ["gpt-5.4-pro", "gpt-4o-mini"],
    supportsTextGeneration: () => true,
    healthCheck: async () => ({ latencyMs: 5 }),
    translate: async () => ({ rawOutput: '{"translation":"ok","englishMeaning":"ok"}', latencyMs: 5 })
  });
  await manager.refresh("openai", { force: true });
  assert.equal(manager.getStatus().openai.primaryModel, "gpt-4o-mini");
});

test("switches to a fallback after an invalid model response", async () => {
  const calls = [];
  const manager = await createManager({
    discoverModels: async () => [], supportsTextGeneration: () => true, healthCheck: async () => ({ latencyMs: 1 }),
    translate: async (_key, model) => {
      calls.push(model);
      if (model === "model-a") throw providerError("Invalid model", 404);
      return { rawOutput: '{"translation":"ok","englishMeaning":"ok"}', latencyMs: 5 };
    }
  });
  Object.assign(manager.state.providers.openai, { primaryModel: "model-a", lastKnownGoodModel: "model-a", fallbackModels: ["model-b"] });
  const result = await manager.translate({ provider: "openai", text: "test", instructions: "test" });
  assert.equal(result.rawOutput.includes("translation"), true);
  assert.deepEqual(calls, ["model-a", "model-b"]);
});

test("switches immediately after a transient failure when a fallback exists", async () => {
  const calls = [];
  const manager = await createManager({
    discoverModels: async () => [], supportsTextGeneration: () => true, healthCheck: async () => ({ latencyMs: 1 }),
    translate: async (_key, model) => {
      calls.push(model);
      if (model === "model-a") throw providerError("Service unavailable", 503);
      return { rawOutput: '{"translation":"ok","englishMeaning":"ok"}', latencyMs: 5 };
    }
  });
  Object.assign(manager.state.providers.openai, { primaryModel: "model-a", lastKnownGoodModel: "model-a", fallbackModels: ["model-b"] });
  const diagnostics = createTranslationDiagnosticSession("openai");
  await manager.translate({ provider: "openai", text: "test", instructions: "test", diagnostics });
  assert.deepEqual(calls, ["model-a", "model-b"]);
  const attempts = diagnostics.summary().events.filter((entry) => entry.event === "translation_attempt");
  assert.deepEqual(attempts.map((entry) => entry.httpStatus), [503, 200]);
  assert.deepEqual(attempts.map((entry) => entry.willRetry), [false, false]);
  assert.equal(attempts.at(-1).modelSwitched, true);
});

test("retries one transient failure when no fallback model exists", async () => {
  let calls = 0;
  const manager = await createManager({
    discoverModels: async () => [], supportsTextGeneration: () => true, healthCheck: async () => ({ latencyMs: 1 }),
    translate: async () => {
      calls += 1;
      if (calls === 1) throw providerError("Service unavailable", 503);
      return { rawOutput: '{"translation":"ok","englishMeaning":"ok"}', latencyMs: 5 };
    }
  });
  Object.assign(manager.state.providers.openai, { primaryModel: "model-a", lastKnownGoodModel: "model-a", fallbackModels: [] });
  await manager.translate({ provider: "openai", text: "test", instructions: "test" });
  assert.equal(calls, 2);
});

test("does not switch models after an authorization failure", async () => {
  const calls = [];
  const manager = await createManager({
    discoverModels: async () => [], supportsTextGeneration: () => true, healthCheck: async () => ({ latencyMs: 1 }),
    translate: async (_key, model) => { calls.push(model); throw providerError("Unauthorized", 401); }
  });
  Object.assign(manager.state.providers.openai, { primaryModel: "model-a", lastKnownGoodModel: "model-a", fallbackModels: ["model-b"] });
  const diagnostics = createTranslationDiagnosticSession("openai");
  await assert.rejects(manager.translate({ provider: "openai", text: "test", instructions: "test", diagnostics }), /API key is invalid/);
  assert.deepEqual(calls, ["model-a"]);
  assert.equal(diagnostics.summary().events.filter((entry) => entry.event === "translation_attempt").length, 1);
});

test("switches models immediately after rate limiting without an identical retry", async () => {
  const calls = [];
  const manager = await createManager({
    discoverModels: async () => [], supportsTextGeneration: () => true, healthCheck: async () => ({ latencyMs: 1 }),
    translate: async (_key, model) => {
      calls.push(model);
      if (model === "model-a") throw providerError("Too many requests", 429);
      return { rawOutput: '{"translation":"ok","englishMeaning":"ok"}', latencyMs: 5, httpStatus: 200 };
    }
  });
  Object.assign(manager.state.providers.openai, { primaryModel: "model-a", lastKnownGoodModel: "model-a", fallbackModels: ["model-b"] });
  const diagnostics = createTranslationDiagnosticSession("openai");
  await manager.translate({ provider: "openai", text: "test", instructions: "test", diagnostics });
  assert.deepEqual(calls, ["model-a", "model-b"]);
});

test("shares a four-request budget across retries and model fallbacks", async () => {
  const calls = [];
  const manager = await createManager({
    discoverModels: async () => [], supportsTextGeneration: () => true, healthCheck: async () => ({ latencyMs: 1 }),
    translate: async (_key, model) => { calls.push(model); throw providerError("Service unavailable", 503); }
  });
  Object.assign(manager.state.providers.openai, { primaryModel: "model-a", lastKnownGoodModel: "model-a", fallbackModels: ["model-b", "model-c"] });
  const diagnostics = createTranslationDiagnosticSession("openai", { maxProviderAttempts: 4, timeoutMs: 10000 });
  await assert.rejects(manager.translate({ provider: "openai", text: "test", instructions: "test", diagnostics }), (error) => error.internalCode === "PROVIDER_UNAVAILABLE");
  assert.deepEqual(calls, ["model-a", "model-b", "model-c", "model-c"]);
  assert.equal(diagnostics.summary().attemptCount, 4);
});

test("does not call or retry a provider after request cancellation", async () => {
  let calls = 0;
  const manager = await createManager({
    discoverModels: async () => [], supportsTextGeneration: () => true, healthCheck: async () => ({ latencyMs: 1 }),
    translate: async () => { calls += 1; return { rawOutput: "{}", latencyMs: 1 }; }
  });
  Object.assign(manager.state.providers.openai, { primaryModel: "model-a", lastKnownGoodModel: "model-a", fallbackModels: ["model-b"] });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(manager.translate({ provider: "openai", text: "test", instructions: "test", signal: controller.signal }), (error) => error.internalCode === "REQUEST_CANCELLED");
  assert.equal(calls, 0);
});

test("uses the verified cache before its 24-hour expiry", async () => {
  let discoveryCalls = 0;
  const manager = await createManager({
    discoverModels: async () => { discoveryCalls += 1; return ["gpt-4o-mini"]; },
    supportsTextGeneration: () => true, healthCheck: async () => ({ latencyMs: 1 }),
    translate: async () => ({ rawOutput: '{"translation":"ok","englishMeaning":"ok"}', latencyMs: 5 })
  });
  await manager.refresh("openai", { force: true });
  await manager.refresh("openai");
  assert.equal(discoveryCalls, 1);
});

test("keeps the last verified model when model discovery fails", async () => {
  const manager = await createManager({
    discoverModels: async () => { throw providerError("Network unavailable", 0); },
    supportsTextGeneration: () => true, healthCheck: async () => ({ latencyMs: 1 }),
    translate: async () => ({ rawOutput: '{"translation":"ok","englishMeaning":"ok"}', latencyMs: 5 })
  });
  Object.assign(manager.state.providers.openai, { primaryModel: "gpt-4o-mini", lastKnownGoodModel: "gpt-4o-mini" });
  await manager.refresh("openai", { force: true });
  const state = manager.getStatus().openai;
  assert.equal(state.status, "cache_only");
  assert.equal(state.lastKnownGoodModel, "gpt-4o-mini");
});
