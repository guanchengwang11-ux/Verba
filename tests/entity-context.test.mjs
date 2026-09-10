import assert from "node:assert/strict";
import test from "node:test";
import { protectEntities, restoreEntities } from "../entity-protection.mjs";
import { analyzeSemanticConstraints, evaluateSemanticRoles } from "../semantic-role-protection.mjs";
import { finalizeProtectedTranslation } from "../translation-policy.mjs";

test("ordinary pronouns and capitalized nouns remain visible to the model", () => {
  for (const text of ["She said that he had already sent them our address.", "They asked us to tell you that the meeting had been canceled.", "He said you could send it to me directly.", "Her report is ready.", "Someone called. They said they would help.", "Budget is tight.", "Delivery is delayed.", "Support called yesterday."]) {
    assert.equal(protectEntities(text).text, text);
  }
});

test("names require local grammatical context, including ambiguous modal spellings", () => {
  const cases = [
    ["May said she may join us later.", ["May"]],
    ["Will said he will send it tomorrow.", ["Will"]],
    ["Will you ask May if she can join us?", ["May"]],
    ["May I ask Will to help?", ["Will"]],
    ["May the team join us?", []],
    ["May 5 is the date. We will meet in May.", []],
    ["The will is final. Free Will matters.", []],
    ["Nana asked David to help Sarah with her report.", ["Nana", "David", "Sarah"]],
    ["Priya asked Oluwaseun to contact Zainab.", ["Priya", "Oluwaseun", "Zainab"]],
    ["May said hello. May you succeed.", ["May"]]
  ];
  for (const [text, names] of cases) assert.deepEqual(protectEntities(text).entityMap.map(e => e.original), names, text);
});

test("quoted usernames, accounts and glossary terms protect spans, not spellings", () => {
  const source = 'Keep the username "She" unchanged, but translate the rest of her message. She said hello to @They.';
  const p = protectEntities(source);
  assert.deepEqual(p.entityMap.map(e => e.original), ["She", "@They"]);
  assert.match(p.text, /She said hello/);
  assert.match(p.text, /her message/);
  const glossary = protectEntities("She met Shelley", [{ source: "She", preserveExactly: true }]);
  assert.equal(glossary.entityMap[0].occurrenceCount, 1);
  assert.match(glossary.text, /Shelley/);
});

test("restoration handles double-digit tokens and literal replacement characters", () => {
  const values = Array.from({ length: 12 }, (_, i) => `@user${i}`);
  const p = protectEntities(values.join(" "));
  assert.equal(restoreEntities(p.text, p.entityMap), values.join(" "));
  const literal = protectEntities('Keep the literal "$&" unchanged');
  assert.equal(restoreEntities(literal.text, literal.entityMap), 'Keep the literal "$&" unchanged');
});

test("postprocessing preserves closing quotes and protected trailing punctuation", () => {
  const p = protectEntities('Keep the literal "key!" unchanged');
  assert.equal(finalizeProtectedTranslation({ translation: '保留“[[VERBA_ENTITY_0]]”。', englishMeaning: "Keep it" }, p.entityMap).translation, '保留“key!”');
});

test("a personal name May does not inject a possibility constraint", () => {
  for (const source of ["May said she will join.", "Will you ask May if she can join us?"]) {
    const p = protectEntities(source);
    assert.equal(analyzeSemanticConstraints({ originalText: source, protectedText: p.text, entityMap: p.entityMap, direction: "enToZh" }).modality, "");
  }
});

test("valid multi-time clauses and request nouns do not trigger semantic retries", () => {
  const cases = [
    ["You don't have to reply today, but please read it before tomorrow's meeting.", "你今天不用回复，但请在明天的会议之前看下"],
    ["None of them has approved the request.", "他们中没有人批准这个请求"],
    ["She has approved the request.", "她批准了这项请求"],
    ["He has checked the application.", "他审核过申请"]
  ];
  for (const [source, translation] of cases) {
    const p = protectEntities(source);
    const constraints = analyzeSemanticConstraints({ originalText: source, protectedText: p.text, entityMap: p.entityMap, direction: "enToZh" });
    assert.deepEqual(evaluateSemanticRoles({ translation, englishMeaning: source, constraints }).blocking, [], source);
  }
});

test("singular report hints require a single-person introduction and simple contact event", () => {
  const analyze = source => analyzeSemanticConstraints({ originalText: source, protectedText: source, entityMap: [], direction: "enToZh" });
  assert.equal(analyze("Somebody from sales emailed us. They said they'd investigate.").singularReport, true);
  assert.equal(analyze("A customer called me. They said they would check.").singularReport, true);
  assert.equal(analyze("Someone spoke to several colleagues. They said they would check.").singularReport, false);
  assert.equal(analyze("Two people called me. They said they would check.").singularReport, false);
});

test("currency amounts retain context while explicit literal instructions still win", () => {
  const source = "Nana said we owe USD1250 and NGN 25000.";
  const p = protectEntities(source);
  assert.match(p.text, /USD1250 and NGN 25000/);
  assert.ok(p.entityMap.some(e => e.original === "Nana"));
  const c = analyzeSemanticConstraints({ originalText: source, protectedText: p.text, direction: "enToZh", entityMap: p.entityMap });
  assert.deepEqual(evaluateSemanticRoles({ translation: "Nana说我们欠1250美元和25000奈拉", englishMeaning: source, constraints: c }).blocking, []);
  assert.ok(evaluateSemanticRoles({ translation: "Nana说我们欠1250美元和2500奈拉", englishMeaning: source, constraints: c }).blocking.length);
  assert.ok(protectEntities("Pay USD 100", [{source:"USD",target:"USD"}]).entityMap.some(e=>e.original==="USD"));
  assert.ok(protectEntities('Keep the literal "USD 100" unchanged').entityMap.some(e=>e.type==="literal"));
});
