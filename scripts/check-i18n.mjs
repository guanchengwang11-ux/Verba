import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function flatten(value, prefix = "") { return Object.entries(value).flatMap(([key, nested]) => nested && typeof nested === "object" ? flatten(nested, `${prefix}${key}.`) : [`${prefix}${key}`]); }
const root = resolve(".");
const [zh, en] = await Promise.all(["zh-CN", "en-US"].map((locale) => readFile(resolve(root, "locales", `${locale}.json`), "utf8").then(JSON.parse)));
const zhKeys = new Set(flatten(zh)); const enKeys = new Set(flatten(en));
const missing = [...zhKeys].filter((key) => !enKeys.has(key)); const extra = [...enKeys].filter((key) => !zhKeys.has(key));
if (missing.length || extra.length) { console.error(JSON.stringify({ missing, extra })); process.exit(1); }
const files = ["app.js", "api-keys.js", "model-settings.js", "desktop-features.js", "app-interactions.js"];
const hardcodedChinese = [];
for (const file of files) { const text = await readFile(resolve(root, file), "utf8"); if (/[^\w]([\u3400-\u9fff])/.test(text)) hardcodedChinese.push(file); }
if (hardcodedChinese.length) { console.error(`Hard-coded Chinese remains in: ${hardcodedChinese.join(", ")}`); process.exit(1); }
console.log(`i18n check passed: ${zhKeys.size} matching keys`);
