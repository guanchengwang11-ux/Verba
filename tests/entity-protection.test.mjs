import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEntityProtectionInstruction,
  detectEntities,
  findEntityRestorationIssues,
  isPreserveExactlyGlossaryEntry,
  protectEntities,
  restoreEntities
} from "../entity-protection.mjs";

test("replaces every entity in the reported failing sentence with program-level placeholders", () => {
  const protectedInput = protectEntities("Nana asked David to check the Bybit UID.");
  assert.equal(protectedInput.text, "[[VERBA_ENTITY_0]] asked [[VERBA_ENTITY_1]] to check the [[VERBA_ENTITY_2]] [[VERBA_ENTITY_3]].");
  assert.deepEqual(protectedInput.entityMap.map(({ original, type }) => ({ original, type })), [
    { original: "Nana", type: "possibleName" },
    { original: "David", type: "possibleName" },
    { original: "Bybit", type: "brand" },
    { original: "UID", type: "acronym" }
  ]);
});

test("detects names, multi-word names, brands, acronyms, accounts, and identifiers", () => {
  const text = "Muyiwa told Lin Zhang to contact Wang Guancheng to check Bybit Binance OKX KCEX OpenAI Google DeepSeek Ajuba UID KYC KYB AML API P&L VIP SOP FAQ @David @nana123 user@example.com https://example.com CASE-20260907 987654";
  const entities = detectEntities(text).map((entity) => entity.value);
  for (const value of ["Muyiwa", "Lin Zhang", "Wang Guancheng", "Bybit", "Binance", "OKX", "KCEX", "OpenAI", "Google", "DeepSeek", "Ajuba", "UID", "KYC", "KYB", "AML", "API", "P&L", "VIP", "SOP", "FAQ", "@David", "@nana123", "user@example.com", "https://example.com", "CASE-20260907", "987654"]) {
    assert.ok(entities.includes(value), `expected ${value} to be protected`);
  }
});

test("excludes common sentence starters, weekdays, and language names", () => {
  const entities = detectEntities("Please check the report. Hello David. English is used on Monday. Send the file. Review and Confirm it.").map((entity) => entity.value);
  assert.ok(entities.includes("David"));
  for (const value of ["Please", "Hello", "English", "Monday", "Send", "Review", "Confirm"]) assert.ok(!entities.includes(value), `did not expect ${value}`);
});

test("restores exact and mildly altered placeholder formats", () => {
  const { entityMap } = protectEntities("Nana asked David to check Bybit UID");
  const output = "**[[VERBA_ENTITY_0]]**让 VERBA\\_ENTITY\\_1 检查 __VERBA_ENTITY_2__ 的 `VERBA ENTITY 3`";
  assert.equal(restoreEntities(output, entityMap), "Nana让 David 检查 Bybit 的 UID");
});

test("detects missing, duplicated, and leaked placeholders", () => {
  const { entityMap } = protectEntities("Nana asked David");
  assert.deepEqual(findEntityRestorationIssues("Nana询问David", entityMap), []);
  assert.equal(findEntityRestorationIssues("娜娜询问David", entityMap)[0].original, "Nana");
  assert.equal(findEntityRestorationIssues("Nana询问David和David", entityMap)[0].original, "David");
  assert.ok(findEntityRestorationIssues("Nana询问[[VERBA_ENTITY_1]]", entityMap).some((issue) => issue.placeholderLeak));
});

test("gives glossary preserve entries highest priority", () => {
  const glossary = [
    { source: "nana-internal", target: "Do not translate" },
    { source: "David", target: "不翻译" },
    { source: "Bybit", preserveExactly: true },
    { source: "transaction", target: "交易" }
  ];
  const protectedInput = protectEntities("nana-internal asked David to check Bybit transaction", glossary);
  assert.deepEqual(protectedInput.entityMap.map((entity) => entity.original), ["nana-internal", "David", "Bybit"]);
  assert.ok(isPreserveExactlyGlossaryEntry(glossary[0]));
  assert.ok(!isPreserveExactlyGlossaryEntry(glossary[3]));
});

test("preserves tokens while exposing typed original entity context", () => {
  const { entityMap } = protectEntities("Nana checks UID");
  const instruction = buildEntityProtectionInstruction(entityMap);
  assert.match(instruction, /\[\[VERBA_ENTITY_0\]\]/);
  assert.match(instruction, /\[\[VERBA_ENTITY_1\]\]/);
  const dictionary = JSON.parse(instruction.split("\n").at(-1));
  assert.deepEqual(dictionary.map(e => e.original), ["Nana", "UID"]);
  assert.equal(dictionary[0].type, "possibleName");
  assert.equal(restoreEntities(entityMap.map(e => e.token).join(" "), entityMap), "Nana UID");
});
