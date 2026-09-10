import { readFileSync, mkdirSync, appendFileSync, writeFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { startServer } from "../server.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const fixtureFile = resolve(root, arg("fixtures", "acceptance/cases.json"));
const cases = JSON.parse(readFileSync(fixtureFile, "utf8"));
const ids = arg("cases", cases.map(c => c.id).join(",")).split(",").map(Number);
const providers = arg("providers", "openai,gemini,deepseek").split(",");
if (ids.some(id => !cases.some(c => c.id === id)) || providers.some(p => !["openai", "gemini", "deepseek"].includes(p))) throw Error("Invalid cases/providers");
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
const output = join(root, "acceptance/runs", runId);
mkdirSync(output, { recursive: true });
const append = (name, record) => appendFileSync(join(output, name), JSON.stringify(record) + "\n");
const hashes = Object.fromEntries(["server.mjs", "entity-protection.mjs", "translation-policy.mjs", "translation-output.mjs", "semantic-role-protection.mjs", "factual-constraint-protection.mjs", "model-manager.mjs", "model-policy.json", "app.js", "acceptance/cases.json", "scripts/translation-acceptance.mjs", ...providers.map(p => `providers/${p}-provider.mjs`)].map(file => [file, createHash("sha256").update(readFileSync(join(root, file))).digest("hex")]));
writeFileSync(join(output, "fixtures.json"), JSON.stringify(cases, null, 2));
writeFileSync(join(output, "manifest.json"), JSON.stringify({ runId, label: arg("label", "acceptance"), startedAt: new Date().toISOString(), direction: "enToZh", mode: "chat", ids, providers, hashes, fixtureHash: createHash("sha256").update(readFileSync(fixtureFile)).digest("hex"), requiredIds: cases.map(c => c.id), review: "Pending explicit AI semantic and language review. Transport success is not quality acceptance." }, null, 2));
const completed = new Map();
const fetchNetwork = globalThis.fetch;
const providerHosts = { "api.openai.com": "openai", "generativelanguage.googleapis.com": "gemini", "api.deepseek.com": "deepseek" };
const httpCounts = { openai: 0, gemini: 0, deepseek: 0 };
const startCounts = new Map();
globalThis.fetch = async (input, options) => {
  const provider = providerHosts[new URL(typeof input === "string" || input instanceof URL ? input : input.url).hostname];
  if (provider) httpCounts[provider]++;
  return fetchNetwork(input, options);
};
const server = await startServer({
  publicDirectory: root,
  configurationDirectory: resolve(arg("config", process.env.VERBA_CONFIG_DIR || root)),
  port: Number(arg("port", "0")),
  translationObserver(event) {
    const { request, ...trace } = event;
    // Only public synthetic fixtures may be captured. No free-form input, glossary,
    // prompts, credentials, user history or provider error bodies are recorded.
    const fixture = cases.find(c => c.source === request.text);
    if (!fixture || request.mode !== "chat" || request.direction !== "enToZh" || request.glossary?.length) return;
    if (event.stage === "entity_protection") startCounts.set(event.requestId, httpCounts[request.provider]);
    if (["complete", "failed"].includes(event.stage)) trace.providerHttpRequestCount = httpCounts[request.provider] - startCounts.get(event.requestId);
    append("trace.jsonl", { id: fixture.id, provider: request.provider, ...trace });
    if (["complete", "failed"].includes(event.stage)) completed.set(`${request.provider}:${fixture.id}`, trace);
  }
});
const url = `http://127.0.0.1:${server.address().port}`;
const config = await (await fetch(`${url}/api/config`)).json();
writeFileSync(join(output, "availability.json"), JSON.stringify(config, null, 2));
console.log(JSON.stringify({ runId, output, url, keysPresent: config.keys }));
if (process.argv.includes("--serve")) {
  console.log("Synthetic-only UI capture server ready. Stop with Ctrl+C after recording UI observations.");
} else {
  try {
    for (const provider of providers) {
      let unavailable = config.keys[provider] ? "" : "No configured credential";
      for (const id of ids) {
        const fixture = cases.find(c => c.id === id);
        if (unavailable) { append("results.jsonl", { id, provider, source: fixture.source, status: "untested", reason: unavailable, requestCount: 0, elapsedMs: 0 }); continue; }
        // Development-only pacing for providers with small per-minute quotas.
        // No retries or extra review requests are added to production translation.
        const interval = Number(arg(`${provider}-interval-ms`, "0"));
        if (!Number.isFinite(interval) || interval < 0 || interval > 60000) throw Error("Invalid interval");
        if (interval) await new Promise(resolve => setTimeout(resolve, interval));
        const start = Date.now();
        const response = await fetch(`${url}/api/translate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: fixture.source, direction: "enToZh", mode: "chat", provider, glossary: [] }) });
        const data = await response.json();
        const trace = completed.get(`${provider}:${id}`);
        const diagnostic = trace?.diagnostic || data.diagnostic;
        const providerStatus = (await (await fetch(`${url}/api/config`)).json()).models[provider];
        const record = { id, provider, source: fixture.source, status: response.ok ? "needs_review" : "failed", httpStatus: response.status, translation: data.translation ?? null, englishMeaning: data.englishMeaning ?? null, model: diagnostic?.model || "", requestId: diagnostic?.requestId, requestCount: diagnostic?.attemptCount ?? null, providerHttpRequestCount: trace?.providerHttpRequestCount, elapsedMs: Date.now() - start, diagnostic, errorCode: data.errorCode, providerStatus: providerStatus?.status };
        append("results.jsonl", record);
        console.log(JSON.stringify({ id, provider, status: record.status, requestCount: record.requestCount, elapsedMs: record.elapsedMs }));
        if ([401, 403].includes(response.status) || data.errorCode === "PROVIDER_QUOTA_ERROR" || ["quota_error", "invalid_key", "permission_denied"].includes(providerStatus?.status)) unavailable = `Provider unavailable: ${providerStatus?.status || data.errorCode} (HTTP ${response.status}); see attempted case ${id}`;
      }
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
  console.log(`Saved all results: ${output}`);
}
