import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ModelManager } from '../model-manager.mjs';
import { geminiCatalogEntry, geminiModelChoices } from '../gemini-model-catalog.mjs';

const A = 'gemini-3.5-flash-lite';
const B = 'gemini-3.8-flash';
const C = 'gemini-3.6-flash';
const freeStable = [A, B, C, 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'];
const excluded = ['gemini-4-argon', 'gemini-3.8-flash-preview', 'gemini-3.5-flash', 'gemini-2.5-flash-preview-tts', 'gemini-2.5-flash-native-audio-preview', 'gemini-embedding-001'];
const now = Date.parse('2026-10-20T12:00:00Z');
const httpError = (status, message = 'Synthetic provider failure') => Object.assign(new Error(message), { status });

async function fixture(t, overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'verba-gemini-selection-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const calls = { discovery: [], probes: [], translations: [] };
  const adapter = {
    supportsTextGeneration: id => Boolean(geminiCatalogEntry(id)),
    async discoverModels(key) {
      assert.equal(key, 'synthetic-key-for-local-tests');
      calls.discovery.push(true);
      return [...freeStable, ...excluded];
    },
    async healthCheck(key, model) {
      assert.equal(key, 'synthetic-key-for-local-tests');
      calls.probes.push(model);
      return { latencyMs: 42, httpStatus: 200 };
    },
    async translate(key, model, text, instructions, options) {
      assert.equal(key, 'synthetic-key-for-local-tests');
      calls.translations.push({ model, text, instructions });
      return { rawOutput: JSON.stringify({ translation: '合成译文', englishMeaning: text }), latencyMs: 31, httpStatus: 200 };
    },
    ...overrides
  };
  const manager = new ModelManager({ configurationDirectory: directory, adapters: { gemini: adapter } });
  // Never inspect or modify process.env or the real user configuration.
  manager.getApiKey = provider => provider === 'gemini' ? 'synthetic-key-for-local-tests' : '';
  await manager.initialize();
  return { manager, adapter, directory, calls };
}

const translate = (manager, extra = {}) => manager.translate({ provider: 'gemini', text: 'A synthetic test.', instructions: 'Return JSON.', ...extra });

test('Google choices are the detected official stable free-tier text intersection', () => {
  const choices = geminiModelChoices([A, B, B, ...excluded], {}, { now });
  assert.deepEqual(new Set(choices.map(m => m.id)), new Set([A, B]));
  assert.ok(choices.every(m => m.health === 'unknown' && m.latencyMs === null));
  assert.equal(choices.filter(m => m.recommended).length, 1);
  assert.deepEqual(geminiModelChoices([], {}, { now }), []);
  for (const id of excluded) assert.equal(geminiCatalogEntry(id, now), null, id);
  assert.ok(geminiCatalogEntry('gemini-3.1-flash-lite', Date.parse('2027-05-06T23:59:59Z')));
  assert.equal(geminiCatalogEntry('gemini-3.1-flash-lite', Date.parse('2027-05-07T00:00:00Z')), null);
});

test('ranking uses comparable recent probes; unknown or translation latency is never invented', () => {
  const stamp = new Date(now).toISOString();
  const health = (fast, slow) => ({
    [B]: { status: 'healthy', checkedAt: stamp, probeCheckedAt: stamp, probeLatencyMs: fast },
    [C]: { status: 'healthy', checkedAt: stamp, probeCheckedAt: stamp, probeLatencyMs: slow },
    [A]: { status: 'healthy', checkedAt: stamp, latencyMs: 1 }
  });
  const first = geminiModelChoices([B, C, A], health(10, 500), { now });
  const second = geminiModelChoices([B, C, A], health(500, 10), { now });
  assert.ok(first.findIndex(m => m.id === B) < first.findIndex(m => m.id === C));
  assert.ok(second.findIndex(m => m.id === C) < second.findIndex(m => m.id === B));
  assert.equal(first.find(m => m.id === A).latencyMs, null);
  const stale = geminiModelChoices([B], {
    [B]: { status: 'healthy', probeLatencyMs: 8, probeCheckedAt: new Date(now - 86400001).toISOString() }
  }, { now });
  assert.equal(stale[0].latencyMs, null);
});

test('refresh is bounded to three probes, with remaining detected models selectable as unknown', async t => {
  const { manager, calls } = await fixture(t);
  await manager.refresh('gemini', { force: true });
  const status = manager.getStatus().gemini;
  assert.equal(calls.discovery.length, 1);
  assert.equal(calls.probes.length, 3);
  assert.equal(new Set(calls.probes).size, 3);
  assert.equal(status.modelChoices.length, freeStable.length);
  assert.ok(status.modelChoices.every(m => freeStable.includes(m.id)));
  const untested = status.modelChoices.filter(m => !calls.probes.includes(m.id));
  assert.equal(untested.length, freeStable.length - 3);
  assert.ok(untested.every(m => m.health === 'unknown' && m.latencyMs === null));
  await manager.selectGeminiModel(untested[0].id);
  assert.equal(calls.probes.length, 4);
  assert.equal(manager.getStatus().gemini.selectedModel, untested[0].id);
});

test('paid, preview, retired-route and audio models cannot bypass the catalog using high-cost override', async t => {
  const { manager } = await fixture(t);
  await manager.refresh('gemini', { force: true });
  for (const id of excluded) {
    await assert.rejects(manager.setManualOverride('gemini', id, { allowHighCost: true }), error => error.internalCode === 'MODEL_NOT_FOUND');
  }
  assert.equal(manager.getStatus().gemini.allowHighCost, false);
  assert.ok(!manager.getStatus().gemini.modelChoices.some(m => excluded.includes(m.id)));
});

test('saving B wins over stale last-known-good A even when B and later discovery fail', async t => {
  const { manager, adapter, calls } = await fixture(t);
  await manager.refresh('gemini', { force: true });
  const state = manager.state.providers.gemini;
  state.lastKnownGoodModel = A;
  delete state.modelHealth[B];
  adapter.healthCheck = async (key, model) => {
    calls.probes.push(model);
    throw httpError(404, 'Requested model not found');
  };
  await manager.selectGeminiModel(B);
  assert.equal(state.lastKnownGoodModel, A);
  assert.equal(manager.getStatus().gemini.selectedModel, B);
  assert.deepEqual(manager.orderedTranslationModels('gemini'), [B]);
  adapter.discoverModels = async () => { throw new TypeError('Synthetic network failure'); };
  await manager.refresh('gemini', { force: true });
  const result = await translate(manager);
  assert.equal(result.model, B);
  assert.deepEqual(calls.translations.map(c => c.model), [B]);
});

test('a selected model that disappears is reported explicitly without translating through A', async t => {
  const { manager, adapter, calls } = await fixture(t);
  await manager.refresh('gemini', { force: true });
  await manager.selectGeminiModel(B);
  adapter.discoverModels = async () => [A];
  await manager.refresh('gemini', { force: true });
  assert.equal(manager.getStatus().gemini.selectedModel, B);
  assert.equal(manager.getStatus().gemini.selectionErrorCode, 'MODEL_NOT_FOUND');
  await assert.rejects(translate(manager), error => error.internalCode === 'MODEL_NOT_FOUND' && error.model === B);
  assert.equal(calls.translations.length, 0);
});

test('an older in-flight refresh cannot invalidate a subsequently selected model', async t => {
  const { manager, adapter, calls } = await fixture(t);
  await manager.refresh('gemini', { force: true });
  let releaseDiscovery;
  let discoveryStarted;
  const started = new Promise(resolve => { discoveryStarted = resolve; });
  adapter.discoverModels = async () => {
    discoveryStarted();
    return new Promise(resolve => { releaseDiscovery = resolve; });
  };
  const pendingRefresh = manager.refresh('gemini', { force: true });
  await started;
  await manager.selectGeminiModel(B);
  releaseDiscovery([A]);
  await pendingRefresh;
  assert.equal(manager.getStatus().gemini.selectedModel, B);
  const result = await translate(manager);
  assert.equal(result.model, B);
  assert.deepEqual(calls.translations.map(c => c.model), [B]);
});

test('an older failed refresh cannot replace the success state of a newer manual selection', async t => {
  const { manager, adapter } = await fixture(t);
  await manager.refresh('gemini', { force: true });
  let rejectDiscovery;
  let discoveryStarted;
  const started = new Promise(resolve => { discoveryStarted = resolve; });
  adapter.discoverModels = async () => {
    discoveryStarted();
    return new Promise((resolve, reject) => { rejectDiscovery = reject; });
  };
  const pendingRefresh = manager.refresh('gemini', { force: true });
  await started;
  await manager.selectGeminiModel(B);
  rejectDiscovery(httpError(401, 'An obsolete request failed'));
  await pendingRefresh;
  const status = manager.getStatus().gemini;
  assert.equal(status.selectedModel, B);
  assert.equal(status.status, 'ready');
  assert.equal(status.selectionErrorCode, '');
});

test('ordinary selected-model translation adds no discovery or health requests and retains probe latency', async t => {
  const { manager, calls } = await fixture(t);
  await manager.refresh('gemini', { force: true });
  await manager.selectGeminiModel(B);
  const before = { discovery: calls.discovery.length, probes: calls.probes.length };
  await translate(manager);
  await translate(manager);
  assert.equal(calls.discovery.length, before.discovery);
  assert.equal(calls.probes.length, before.probes);
  assert.deepEqual(calls.translations.map(c => c.model), [B, B]);
  assert.equal(manager.getStatus().gemini.modelChoices.find(m => m.id === B).latencyMs, 42);
});

test('saved B survives restart without changing other provider state or user files', async t => {
  const { manager, adapter, directory } = await fixture(t);
  await manager.refresh('gemini', { force: true });
  manager.state.providers.openai.manualOverride = 'existing-openai-model';
  manager.state.providers.deepseek.lastKnownGoodModel = 'existing-deepseek-model';
  manager.state.providers.groq.primaryModel = 'existing-groq-model';
  const otherProviders = structuredClone(Object.fromEntries(Object.entries(manager.state.providers).filter(([id]) => id !== 'gemini')));
  const sentinelFiles = {
    'settings.json': '{"selectedProvider":"deepseek","apiKey":"synthetic-sentinel"}',
    'glossary.json': '[{"source":"Deposit","target":"入金"}]',
    'history.json': '[{"id":"existing-history","translation":"旧记录"}]'
  };
  for (const [file, contents] of Object.entries(sentinelFiles)) await writeFile(join(directory, file), contents);
  await manager.selectGeminiModel(B);
  const restored = new ModelManager({ configurationDirectory: directory, adapters: { gemini: adapter } });
  restored.getApiKey = manager.getApiKey;
  await restored.initialize();
  assert.equal(restored.getStatus().gemini.selectedModel, B);
  assert.deepEqual(restored.orderedTranslationModels('gemini'), [B]);
  assert.deepEqual(Object.fromEntries(Object.entries(restored.state.providers).filter(([id]) => id !== 'gemini')), otherProviders);
  for (const [file, contents] of Object.entries(sentinelFiles)) assert.equal(await readFile(join(directory, file), 'utf8'), contents);
});

test('Gemini selection reports model, authentication, rate-limit and network failures distinctly', async t => {
  const { manager, adapter } = await fixture(t);
  for (const [error, code, state] of [
    [httpError(404, 'Model not found'), 'MODEL_NOT_FOUND', 'no_compatible_model'],
    [httpError(401, 'API key rejected'), 'INVALID_API_KEY', 'key_error'],
    [httpError(403, 'Permission denied'), 'PERMISSION_DENIED', 'key_error'],
    [httpError(429, 'Rate limit reached'), 'PROVIDER_RATE_LIMIT', 'quota_error'],
    [httpError(429, 'Quota exceeded'), 'PROVIDER_QUOTA_ERROR', 'quota_error'],
    [new TypeError('Synthetic network timeout'), 'PROVIDER_NETWORK_ERROR', 'cache_only']
  ]) {
    adapter.discoverModels = async () => { throw error; };
    await manager.refresh('gemini', { force: true });
    const result = manager.getStatus().gemini;
    assert.equal(result.selectionErrorCode, code, `${error.status || 0}: ${error.message}`);
    assert.equal(result.status, state);
  }
});

test('selected-model HTTP errors retain classification and never silently switch models', async t => {
  const { manager, adapter, calls } = await fixture(t);
  await manager.refresh('gemini', { force: true });
  await manager.selectGeminiModel(B);
  for (const [failure, code] of [
    [httpError(404, 'Requested model not found'), 'MODEL_NOT_FOUND'],
    [httpError(401, 'API key rejected'), 'INVALID_API_KEY'],
    [httpError(429, 'Rate limit reached'), 'PROVIDER_RATE_LIMIT']
  ]) {
    const before = calls.translations.length;
    adapter.translate = async (key, model) => { calls.translations.push({ model }); throw failure; };
    await assert.rejects(translate(manager), error => error.internalCode === code && error.model === B);
    assert.deepEqual(calls.translations.slice(before).map(c => c.model), [B]);
  }
});

test('selected-model timeout uses the request budget without health calls or a hidden fallback', async t => {
  const { manager, adapter, calls } = await fixture(t);
  await manager.refresh('gemini', { force: true });
  await manager.selectGeminiModel(B);
  adapter.translate = async (key, model, text, instructions, { signal }) => {
    calls.translations.push({ model });
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  };
  const probeCount = calls.probes.length;
  const diagnostics = { nextAttempt: () => 1, remainingMs: () => 15, canAttempt: () => false, record: () => {} };
  await assert.rejects(translate(manager, { diagnostics }), error => error.internalCode === 'PROVIDER_NETWORK_ERROR' && error.providerErrorCode === 'REQUEST_TIMEOUT' && error.model === B);
  assert.deepEqual(calls.translations.map(c => c.model), [B]);
  assert.equal(calls.probes.length, probeCount);
});
