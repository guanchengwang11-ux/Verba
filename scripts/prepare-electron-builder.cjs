const { readFile, writeFile } = require("node:fs/promises");
const { join } = require("node:path");

const builderPath = join(
  process.cwd(),
  "node_modules",
  ".pnpm",
  "app-builder-lib@26.15.3_dmg_c5739d9600ac3f98a55503c35c5a46a9",
  "node_modules",
  "app-builder-lib",
  "out",
  "util",
  "electronGet.js"
);
const originalStatement = "await fs.rename(tmpDir, dir);";
const replacementStatement = "for (let attempt = 0; ; attempt += 1) { try { await fs.rename(tmpDir, dir); break; } catch (error) { if (error.code !== 'EPERM' || attempt === 9) throw error; await new Promise(resolve => setTimeout(resolve, 250)); } }";

async function main() {
  const source = await readFile(builderPath, "utf8");
  if (source.includes(replacementStatement)) return;
  if (!source.includes(originalStatement)) throw new Error("Unsupported electron-builder version: extraction retry location was not found.");
  await writeFile(builderPath, source.replace(originalStatement, replacementStatement));
}

main().catch((error) => { console.error(error.message); process.exit(1); });
