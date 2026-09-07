import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { modelManager } from "./model-manager.mjs";
import { parseTranslationOutput, sanitizeTranslationOutput } from "./translation-output.mjs";
import {
  TEAM_CHAT_STYLE_INSTRUCTIONS,
  executeTranslationPolicy,
} from "./translation-policy.mjs";
import { buildEntityProtectionInstruction, isPreserveExactlyGlossaryEntry, protectEntities } from "./entity-protection.mjs";
import { analyzeSemanticConstraints, buildSemanticConstraintInstruction } from "./semantic-role-protection.mjs";

let publicDirectory = process.env.VERBA_APP_DIR || process.cwd();
let configurationDirectory = process.env.VERBA_CONFIG_DIR || process.cwd();
let updateHandlers = null;
const contentTypes = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

async function loadEnvironmentFile() {
  try {
    const environmentFile = await readFile(join(configurationDirectory, ".env"), "utf8");
    for (const line of environmentFile.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match || match[1] in process.env) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function getKeyStatus() {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    deepseek: Boolean(process.env.DEEPSEEK_API_KEY)
  };
}

function historyFilePath() { return join(configurationDirectory, "translation-history.json"); }

async function readHistory() {
  try {
    const history = JSON.parse(await readFile(historyFilePath(), "utf8"));
    return Array.isArray(history) ? history : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function historyLanguageLabels(direction) {
  return direction === "enToZh"
    ? { sourceLanguage: "English", targetLanguage: "Chinese", sourceLanguageLabel: "English", targetLanguageLabel: "中文" }
    : { sourceLanguage: "Chinese", targetLanguage: "English", sourceLanguageLabel: "中文", targetLanguageLabel: "English" };
}

export function normalizeHistoryItem(item) {
  const direction = item.direction === "enToZh" ? "enToZh" : "zhToEn";
  const mode = item.mode === "chat" ? "chat" : "email";
  const provider = ["openai", "gemini", "deepseek"].includes(item.provider) ? item.provider : "";
  return {
    source: item.source.trim(),
    translation: sanitizeTranslationOutput(item.translation),
    englishMeaning: item.englishMeaning.trim(),
    requestId: typeof item.requestId === "string" ? item.requestId : "",
    direction,
    mode,
    provider,
    ...historyLanguageLabels(direction)
  };
}

function isRecentDuplicate(entry, item, now) {
  const createdAt = Date.parse(entry.createdAt);
  return Number.isFinite(createdAt)
    && now - createdAt < 15000
    && Boolean(entry.requestId)
    && entry.requestId === item.requestId
    && entry.source === item.source
    && entry.translation === item.translation
    && entry.sourceLanguage === item.sourceLanguage
    && entry.targetLanguage === item.targetLanguage;
}

async function saveHistoryItem(item) {
  const history = await readHistory();
  const normalizedItem = normalizeHistoryItem(item);
  const now = Date.now();
  const duplicate = history.find((entry) => isRecentDuplicate(entry, normalizedItem, now));
  if (duplicate) return { item: duplicate, created: false };

  const entry = { id: randomUUID(), createdAt: new Date(now).toISOString(), ...normalizedItem };
  history.unshift(entry);
  await writeFile(historyFilePath(), JSON.stringify(history.slice(0, 200), null, 2), "utf8");
  return { item: entry, created: true };
}

function historySearchText(entry) {
  const directionTerms = entry.direction === "enToZh" ? "English 中文 English Chinese" : "中文 English Chinese English";
  const modeTerms = entry.mode === "chat" ? "chat team colleague 同事 协作 自然" : "email professional 邮件 专业";
  return [entry.source, entry.translation, entry.englishMeaning, entry.sourceLanguage, entry.targetLanguage, entry.sourceLanguageLabel, entry.targetLanguageLabel, entry.direction, entry.mode, entry.provider, directionTerms, modeTerms].filter(Boolean).join("\n").toLowerCase();
}

export function setUpdateHandlers(handlers) { updateHandlers = handlers; }

async function saveApiKeys(keys) {
  const supportedKeys = { openai: "OPENAI_API_KEY", gemini: "GEMINI_API_KEY", deepseek: "DEEPSEEK_API_KEY" };
  const environmentFile = join(configurationDirectory, ".env");
  let lines = [];
  try { lines = (await readFile(environmentFile, "utf8")).split(/\r?\n/); } catch (error) { if (error.code !== "ENOENT") throw error; }
  for (const [provider, environmentKey] of Object.entries(supportedKeys)) {
    const value = keys?.[provider];
    if (typeof value !== "string" || !value.trim()) continue;
    const lineIndex = lines.findIndex((line) => new RegExp(`^\\s*${environmentKey}\\s*=`).test(line));
    const line = `${environmentKey}=${value.trim()}`;
    if (lineIndex >= 0) lines[lineIndex] = line; else lines.push(line);
    process.env[environmentKey] = value.trim();
  }
  await writeFile(environmentFile, `${lines.filter((line, index) => line || index < lines.length - 1).join("\n")}\n`, "utf8");
  const models = await modelManager.refreshAll({ force: true });
  return { keys: getKeyStatus(), models: models.status };
}

const styleInstructions = {
  email: "Write as a polished workplace email: professional, concise, courteous, and direct.",
  chat: TEAM_CHAT_STYLE_INSTRUCTIONS
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function errorCode(error) {
  if (error?.status === 401) return "INVALID_API_KEY";
  if (error?.status === 403) return "PERMISSION_DENIED";
  if (error?.status === 429 || /quota/i.test(error?.message || "")) return "INSUFFICIENT_QUOTA";
  if (error?.status === 404 || /model/i.test(error?.message || "")) return "MODEL_UNAVAILABLE";
  return "TRANSLATION_FAILED";
}

async function translate(body) {
  const provider = body.provider || "openai";
  const providerName = provider === "openai" ? "OpenAI" : provider === "gemini" ? "Gemini" : "DeepSeek";
  const protectedInput = protectEntities(body.text, body.glossary);
  const semanticConstraints = analyzeSemanticConstraints({ originalText: body.text, protectedText: protectedInput.text, direction: body.direction, entityMap: protectedInput.entityMap });
  const baseInstructions = buildInstructions(body, protectedInput.entityMap, semanticConstraints);
  return executeTranslationPolicy({
    sourceText: body.text,
    mode: body.mode,
    entityMap: protectedInput.entityMap,
    semanticConstraints,
    generate: async ({ correctionInstruction }) => {
      const instructions = correctionInstruction ? `${baseInstructions} ${correctionInstruction}` : baseInstructions;
      const response = await modelManager.translate({ provider, text: protectedInput.text, instructions });
      return parseTranslationOutput(response.rawOutput, providerName, { sanitize: false });
    }
  });
}

export function buildInstructions(body, entityMap = [], semanticConstraints = null) {
  const sourceLanguage = body.direction === "zhToEn" ? "Chinese" : "English";
  const targetLanguage = body.direction === "zhToEn" ? "English" : "Chinese";
  const glossary = (body.glossary || []).filter((entry) => !isPreserveExactlyGlossaryEntry(entry)).map((entry) => `${entry.source} => ${entry.target}`).join("\n");
  const protectedInstruction = buildEntityProtectionInstruction(entityMap);
  const semanticInstruction = buildSemanticConstraintInstruction(semanticConstraints);
  return `You are Verba, an expert workplace translator. Translate from ${sourceLanguage} to ${targetLanguage}. Accuracy and semantic-role preservation always take priority over naturalness or brevity. ${styleInstructions[body.mode] || styleInstructions.email} Preserve the user's intent, participants, who asks whom, who performs each action, degree of certainty, negation, conditions, completion state, names, dates, numbers, and requests. Do not add facts. ${protectedInstruction} ${semanticInstruction} ${glossary ? `The following glossary is mandatory. Use the target exactly whenever its source term appears:\n${glossary}` : ""} Return JSON only with translation and englishMeaning. englishMeaning must be a short, literal English explanation independently based on the original source meaning, including its participant roles; do not derive it by paraphrasing the translation.`;
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (request.method === "GET" && url.pathname === "/health") return sendJson(response, 200, { status: "ok" });
  if (request.method === "GET" && url.pathname === "/api/config") return sendJson(response, 200, { keys: getKeyStatus(), models: modelManager.getStatus() });
  if (request.method === "POST" && url.pathname === "/api/config") {
    let rawBody = "";
    for await (const chunk of request) rawBody += chunk;
    try { return sendJson(response, 200, await saveApiKeys(JSON.parse(rawBody).keys)); }
    catch (error) { return sendJson(response, 400, { error: error.message || "Unable to save API keys." }); }
  }
  if (request.method === "GET" && url.pathname === "/api/models") return sendJson(response, 200, { models: modelManager.getStatus() });
  if (request.method === "POST" && url.pathname === "/api/models") {
    let rawBody = "";
    for await (const chunk of request) rawBody += chunk;
    try {
      const body = JSON.parse(rawBody);
      if (!['openai', 'gemini', 'deepseek'].includes(body.provider)) return sendJson(response, 400, { error: "Unknown provider." });
      if (body.action === "refresh") return sendJson(response, 200, { models: await modelManager.refresh(body.provider, { force: true }) });
      if (body.action === "override") return sendJson(response, 200, { models: await modelManager.setManualOverride(body.provider, body.model, { allowHighCost: body.allowHighCost }) });
      return sendJson(response, 400, { error: "Unsupported model action." });
    } catch (error) { return sendJson(response, error.status || 400, { error: error.message || "Unable to update model settings." }); }
  }
  if (request.method === "GET" && url.pathname === "/api/history") {
    const search = url.searchParams.get("q")?.trim().toLowerCase() || "";
    const history = await readHistory();
    const filtered = search ? history.filter((entry) => historySearchText(entry).includes(search)) : history;
    return sendJson(response, 200, { history: filtered });
  }
  if (request.method === "POST" && url.pathname === "/api/history") {
    let rawBody = "";
    for await (const chunk of request) rawBody += chunk;
    try {
      const item = JSON.parse(rawBody);
      if (![item.source, item.translation, item.englishMeaning].every((value) => typeof value === "string" && value.trim().length > 0 && value.length <= 2000)) return sendJson(response, 400, { error: "Invalid history item." });
      if (item.direction && !["zhToEn", "enToZh"].includes(item.direction)) return sendJson(response, 400, { error: "Invalid history direction." });
      if (item.mode && !["email", "chat"].includes(item.mode)) return sendJson(response, 400, { error: "Invalid history mode." });
      if (item.provider && !["openai", "gemini", "deepseek"].includes(item.provider)) return sendJson(response, 400, { error: "Invalid history provider." });
      if (item.requestId && (typeof item.requestId !== "string" || item.requestId.length > 120)) return sendJson(response, 400, { error: "Invalid history request ID." });
      const saved = await saveHistoryItem(item);
      return sendJson(response, saved.created ? 201 : 200, saved);
    } catch (error) { return sendJson(response, 400, { error: error.message || "Unable to save history." }); }
  }
  if (request.method === "GET" && url.pathname === "/api/update") return sendJson(response, 200, { update: updateHandlers?.getState?.() || { status: "unavailable" } });
  if (request.method === "POST" && url.pathname === "/api/update") {
    let rawBody = "";
    for await (const chunk of request) rawBody += chunk;
    try {
      const action = JSON.parse(rawBody).action;
      if (!updateHandlers) return sendJson(response, 503, { error: "Updates are available only in the desktop app." });
      if (action === "check") await updateHandlers.check();
      else if (action === "install") updateHandlers.install();
      else return sendJson(response, 400, { error: "Unsupported update action." });
      return sendJson(response, 202, { update: updateHandlers.getState() });
    } catch (error) { return sendJson(response, 500, { error: error.message || "Unable to check for updates." }); }
  }
  if (request.method === "POST" && url.pathname === "/api/translate") {
    let rawBody = "";
    for await (const chunk of request) rawBody += chunk;
    try {
      const body = JSON.parse(rawBody);
      if (!body.text?.trim() || body.text.length > 1000 || !["email", "chat"].includes(body.mode) || !["zhToEn", "enToZh"].includes(body.direction) || !["openai", "gemini", "deepseek"].includes(body.provider || "openai") || !Array.isArray(body.glossary || []) || (body.glossary || []).some((entry) => !entry?.source || (!entry?.target && entry?.preserveExactly !== true) || entry.source.length > 120 || (entry.target || "").length > 120)) {
        return sendJson(response, 400, { error: "Please provide text (up to 1000 characters), a valid mode, and a valid language direction." });
      }
      return sendJson(response, 200, await translate(body));
    } catch (error) {
      return sendJson(response, error.status || 500, { errorCode: errorCode(error) });
    }
  }

  const requestedPath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const filePath = normalize(join(publicDirectory, requestedPath));
  if (!filePath.startsWith(publicDirectory)) return sendJson(response, 403, { error: "Forbidden" });
  try {
    const file = await readFile(filePath);
    response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" });
    response.end(file);
  } catch {
    sendJson(response, 404, { error: "Not found" });
  }
}

export async function startServer(options = {}) {
  publicDirectory = options.publicDirectory || publicDirectory;
  configurationDirectory = options.configurationDirectory || configurationDirectory;
  await loadEnvironmentFile();
  await modelManager.initialize({ configurationDirectory });
  const server = createServer(handleRequest);
  const port = Number(options.port || process.env.PORT || 3000);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer().then(() => console.log(`Verba is running at http://localhost:${process.env.PORT || 3000}`));
}
