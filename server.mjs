import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

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

async function saveHistoryItem(item) {
  const history = await readHistory();
  const entry = { id: randomUUID(), createdAt: new Date().toISOString(), ...item };
  history.unshift(entry);
  await writeFile(historyFilePath(), JSON.stringify(history.slice(0, 200), null, 2), "utf8");
  return entry;
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
  modelCache.clear();
  return getKeyStatus();
}

const styleInstructions = {
  email: "Write as a polished workplace email: professional, concise, courteous, and direct.",
  chat: "Write as a natural message to a trusted colleague: friendly, relaxed, concise, and never overly formal."
};

const defaultModels = { openai: "gpt-5.6-luna", gemini: "gemini-3.5-flash", deepseek: "deepseek-v4-flash" };
const retiredModelMigrations = { gemini: { "gemini-2.5-flash": "gemini-3.5-flash" } };
const modelCache = new Map();

const outputSchema = {
  type: "object",
  properties: {
    translation: { type: "string", description: "The natural, context-appropriate translation." },
    englishMeaning: { type: "string", description: "A concise English explanation of the translated text's literal meaning." }
  },
  required: ["translation", "englishMeaning"],
  additionalProperties: false
};

const geminiOutputSchema = {
  type: "OBJECT",
  properties: {
    translation: { type: "STRING", description: "The natural, context-appropriate translation." },
    englishMeaning: { type: "STRING", description: "A concise English explanation of the translated text's literal meaning." }
  },
  required: ["translation", "englishMeaning"],
  propertyOrdering: ["translation", "englishMeaning"]
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function translate(body) {
  const provider = body.provider || "openai";
  const environmentKey = { openai: "OPENAI_API_KEY", gemini: "GEMINI_API_KEY", deepseek: "DEEPSEEK_API_KEY" }[provider];
  const apiKey = (process.env[environmentKey] || "").trim();
  if (!environmentKey || !/^[\x21-\x7E]{20,}$/.test(apiKey)) throw new Error(`${provider} API key is not configured correctly. Add a valid key to ${environmentKey} in .env, then restart the server.`);

  const instructions = buildInstructions(body);
  const model = await resolveModel(provider, apiKey);
  if (provider === "gemini") return translateWithGemini(body.text, instructions, apiKey, model);
  if (provider === "deepseek") return translateWithDeepSeek(body.text, instructions, apiKey, model);
  return translateWithOpenAI(body.text, instructions, apiKey, model);
}

async function resolveModel(provider, apiKey) {
  const configuredModel = process.env[`${provider.toUpperCase()}_MODEL`]?.trim();
  const migratedModel = retiredModelMigrations[provider]?.[configuredModel] || configuredModel || defaultModels[provider];
  const availableModels = await listAvailableModels(provider, apiKey);
  if (!availableModels.length) return migratedModel;
  if (availableModels.includes(migratedModel)) return migratedModel;
  const preferredModels = [defaultModels[provider], "gemini-flash-latest", "gpt-5.4-mini", "gpt-5", "deepseek-v4-pro"];
  return preferredModels.find((model) => availableModels.includes(model)) || availableModels[0];
}

async function listAvailableModels(provider, apiKey) {
  const cacheKey = `${provider}:${apiKey.slice(-8)}`;
  const cached = modelCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 10 * 60 * 1000) return cached.models;
  const request = {
    openai: { url: "https://api.openai.com/v1/models", headers: { Authorization: `Bearer ${apiKey}` }, parse: (data) => data.data?.map((model) => model.id) || [] },
    gemini: { url: "https://generativelanguage.googleapis.com/v1beta/models", headers: { "x-goog-api-key": apiKey }, parse: (data) => data.models?.filter((model) => model.supportedGenerationMethods?.includes("generateContent")).map((model) => model.name.replace(/^models\//, "")) || [] },
    deepseek: { url: "https://api.deepseek.com/models", headers: { Authorization: `Bearer ${apiKey}` }, parse: (data) => data.data?.map((model) => model.id) || [] }
  }[provider];
  try {
    const response = await fetch(request.url, { headers: request.headers });
    const data = await response.json();
    if (!response.ok) return [];
    const models = request.parse(data);
    modelCache.set(cacheKey, { createdAt: Date.now(), models });
    return models;
  } catch {
    return [];
  }
}

function buildInstructions(body) {
  const sourceLanguage = body.direction === "zhToEn" ? "Chinese" : "English";
  const targetLanguage = body.direction === "zhToEn" ? "English" : "Chinese";
  const glossary = (body.glossary || []).map((entry) => `${entry.source} => ${entry.target}`).join("\n");
  return `You are Verba, an expert workplace translator. Translate from ${sourceLanguage} to ${targetLanguage}. ${styleInstructions[body.mode] || styleInstructions.email} Preserve the user's intent, degree of certainty, names, dates, numbers, and requests. Do not add facts. ${glossary ? `The following glossary is mandatory. Use the target exactly whenever its source term appears:\n${glossary}` : ""} Return JSON only with translation and englishMeaning. englishMeaning must be a short, literal English explanation of what the final translation says, so an English speaker can verify a Chinese output.`;
}

async function translateWithOpenAI(text, instructions, apiKey, model) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      instructions,
      input: text,
      text: {
        format: {
          type: "json_schema",
          name: "workplace_translation",
          strict: true,
          schema: outputSchema
        }
      }
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "The translation service could not complete the request.");
  return parseTranslationOutput(data.output_text, "OpenAI");
}

async function translateWithGemini(text, instructions, apiKey, model) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instructions }] },
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: geminiOutputSchema }
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Gemini could not complete the translation.");
  return parseTranslationOutput(data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "", "Gemini");
}

async function translateWithDeepSeek(text, instructions, apiKey, model) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: instructions }, { role: "user", content: text }], response_format: { type: "json_object" }, max_tokens: 1000, stream: false })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "DeepSeek could not complete the translation.");
  return parseTranslationOutput(data.choices?.[0]?.message?.content || "", "DeepSeek");
}

function parseTranslationOutput(rawOutput, provider) {
  const cleanedOutput = String(rawOutput).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed;
  try {
    parsed = JSON.parse(cleanedOutput);
  } catch {
    throw new Error(`${provider} returned an incomplete translation response. Please try again.`);
  }
  if (typeof parsed.translation !== "string" || typeof parsed.englishMeaning !== "string") {
    throw new Error(`${provider} returned an unexpected translation response. Please try again.`);
  }
  return { translation: parsed.translation.trim(), englishMeaning: parsed.englishMeaning.trim() };
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (request.method === "GET" && url.pathname === "/health") return sendJson(response, 200, { status: "ok" });
  if (request.method === "GET" && url.pathname === "/api/config") return sendJson(response, 200, { keys: getKeyStatus() });
  if (request.method === "POST" && url.pathname === "/api/config") {
    let rawBody = "";
    for await (const chunk of request) rawBody += chunk;
    try { return sendJson(response, 200, { keys: await saveApiKeys(JSON.parse(rawBody).keys) }); }
    catch (error) { return sendJson(response, 400, { error: error.message || "Unable to save API keys." }); }
  }
  if (request.method === "GET" && url.pathname === "/api/history") {
    const search = url.searchParams.get("q")?.trim().toLowerCase() || "";
    const history = await readHistory();
    const filtered = search ? history.filter((entry) => [entry.source, entry.translation, entry.englishMeaning].some((value) => value?.toLowerCase().includes(search))) : history;
    return sendJson(response, 200, { history: filtered });
  }
  if (request.method === "POST" && url.pathname === "/api/history") {
    let rawBody = "";
    for await (const chunk of request) rawBody += chunk;
    try {
      const item = JSON.parse(rawBody);
      if (![item.source, item.translation, item.englishMeaning].every((value) => typeof value === "string" && value.length <= 2000)) return sendJson(response, 400, { error: "Invalid history item." });
      return sendJson(response, 201, { item: await saveHistoryItem(item) });
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
      if (!body.text?.trim() || body.text.length > 1000 || !["email", "chat"].includes(body.mode) || !["zhToEn", "enToZh"].includes(body.direction) || !["openai", "gemini", "deepseek"].includes(body.provider || "openai") || !Array.isArray(body.glossary || []) || (body.glossary || []).some((entry) => !entry?.source || !entry?.target || entry.source.length > 120 || entry.target.length > 120)) {
        return sendJson(response, 400, { error: "Please provide text (up to 1000 characters), a valid mode, and a valid language direction." });
      }
      return sendJson(response, 200, await translate(body));
    } catch (error) {
      return sendJson(response, 500, { error: error.message || "Unable to translate right now. Please try again." });
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
