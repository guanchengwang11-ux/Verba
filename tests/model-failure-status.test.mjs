import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelManager } from '../model-manager.mjs';
import { createTranslationError } from '../translation-diagnostics.mjs';

for (const provider of ['gemini', 'groq']) {
  for (const [httpStatus, code, status] of [
    [401, 'INVALID_API_KEY', 'key_error'],
    [403, 'PERMISSION_DENIED', 'key_error'],
    [429, 'PROVIDER_RATE_LIMIT', 'rate_limited'],
    [429, 'PROVIDER_QUOTA_ERROR', 'quota_error']
  ]) {
    test(`${provider} ${code} persists real health and keeps the selected model fixed`, async () => {
      const id = provider === 'gemini' ? 'gemini-3.5-flash-lite' : 'openai/gpt-oss-120b';
      const fallback = provider === 'gemini' ? 'gemini-3.8-flash' : 'openai/gpt-oss-20b';
      const calls = [], snapshots = [];
      let fail = true;
      const adapter = {
        supportsTextGeneration: () => true,
        translate: async (key, model) => {
          calls.push(model);
          if (fail) throw createTranslationError(code, { status: httpStatus, provider, model, stage: 'provider_request' });
          return { rawOutput: '{"translation":"你好","englishMeaning":"Hello"}', latencyMs: 4, httpStatus: 200 };
        }
      };
      const manager = new ModelManager({ adapters: { [provider]: adapter } });
      manager.loaded = true;
      manager.policy = {};
      manager.getApiKey = () => 'synthetic-key';
      manager.persist = async () => snapshots.push(JSON.parse(JSON.stringify(manager.state)));
      const state = manager.state.providers[provider];
      const checkedAt = new Date().toISOString();
      Object.assign(state, {
        models: [id, fallback], manualOverride: id, selectedModel: id,
        primaryModel: id, lastKnownGoodModel: id, fallbackModels: [fallback], status: 'ready',
        modelHealth: { [id]: { status: 'healthy', checkedAt, probeCheckedAt: checkedAt, probeLatencyMs: 30 } }
      });
      await assert.rejects(manager.translate({ provider, text: 'Hello', instructions: 'Return translation JSON.' }), error => error.internalCode === code);
      assert.deepEqual(calls, [id], 'neither another model nor a same-model retry is allowed for these errors');
      assert.equal(snapshots.length, 1);
      const saved = snapshots[0].providers[provider];
      assert.equal(saved.status, status);
      assert.equal(saved.manualOverride, id);
      assert.equal(saved.modelHealth[id].status, 'unhealthy');
      assert.equal(saved.modelHealth[id].httpStatus, httpStatus);
      assert.equal(saved.modelHealth[id].errorCode, code);
      assert.equal(provider === 'gemini' ? saved.selectionErrorCode : saved.errorCode, code);
      assert.ok(saved.lastError);
      const reported = manager.getStatus(provider)[provider];
      assert.equal(reported.status, status);
      assert.equal(reported.modelStatus, 'unhealthy');
      assert.equal(reported.selectedModel, id);
      assert.ok(!reported.modelChoices.some(choice => choice.id === id && choice.health === 'healthy'));

      // A later successful request to that same explicit choice clears the
      // displayed provider error; no discovery or selection call is required.
      fail = false;
      await manager.translate({ provider, text: 'Hello', instructions: 'Return translation JSON.' });
      assert.deepEqual(calls, [id, id]);
      const recovered = manager.getStatus(provider)[provider];
      assert.equal(recovered.status, 'ready');
      assert.equal(recovered.modelStatus, 'healthy');
      assert.equal(provider === 'gemini' ? recovered.selectionErrorCode : recovered.errorCode, '');
      assert.ok(recovered.modelChoices.some(choice => choice.id === id && choice.health === 'healthy'));
    });
  }
}
