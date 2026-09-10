import assert from "node:assert/strict";
import test from "node:test";
import { protectEntities } from "../entity-protection.mjs";
import {
  analyzeSemanticConstraints,
  buildSemanticConstraintInstruction,
  evaluateSemanticRoles,
  validateSemanticRoles
} from "../semantic-role-protection.mjs";

function analyze(source, direction = "enToZh") {
  const protectedInput = protectEntities(source);
  const constraints = analyzeSemanticConstraints({ originalText: source, protectedText: protectedInput.text, direction, entityMap: protectedInput.entityMap });
  return { protectedInput, constraints };
}

test("extracts the listener-to-David delegation frame", () => {
  const { constraints } = analyze("Could you please ask David to check this?");
  assert.equal(constraints.relationFrame.outerActor.kind, "listener");
  assert.equal(constraints.relationFrame.explicitListener, true);
  assert.equal(constraints.relationFrame.relation, "ask");
  assert.equal(constraints.relationFrame.target.original, "David");
  assert.equal(constraints.relationFrame.action, "check this");
});

test("extracts ask, tell, remind, let, have, want, and need relationships", () => {
  const cases = [
    ["Please tell Nana to contact David", "tell", "Nana"],
    ["Remind David to send the file", "remind", "David"],
    ["I asked David to contact Nana", "ask", "David"],
    ["I let David check this", "let", "David"],
    ["We have David review this", "have", "David"],
    ["I want David to review this", "want", "David"],
    ["I need David to review this", "need", "David"]
  ];
  for (const [source, relation, target] of cases) {
    const frame = analyze(source).constraints.relationFrame;
    assert.equal(frame?.relation, relation, source);
    assert.equal(frame?.target?.original, target, source);
  }
});

test("rejects turning an indirect request into direct address", () => {
  const { constraints } = analyze("Could you please ask David to check this?");
  const issues = validateSemanticRoles({
    translation: "David，麻烦帮忙看下这个",
    englishMeaning: "David, could you please help look at this",
    constraints
  });
  assert.ok(issues.includes("target_became_direct_addressee"));
  assert.ok(issues.includes("delegation_relation_missing"));
  assert.ok(issues.includes("meaning_target_became_direct_addressee"));
});

test("accepts the correct listener-to-David relationship and English meaning", () => {
  const { constraints } = analyze("Could you please ask David to check this?");
  assert.deepEqual(validateSemanticRoles({
    translation: "麻烦你让David看一下这个",
    englishMeaning: "You are politely asking the listener to ask David to check something.",
    constraints
  }), []);
});

test("protects negation, time, condition, modality, and completion", () => {
  const negative = analyze("Don't ask David to check this").constraints;
  assert.ok(validateSemanticRoles({ translation: "让David检查这个", englishMeaning: "Ask David to check this", constraints: negative }).includes("negation_missing"));

  const tomorrow = analyze("Ask David to check this tomorrow").constraints;
  assert.ok(validateSemanticRoles({ translation: "让David检查这个", englishMeaning: "Ask David to check this", constraints: tomorrow }).includes("time_tomorrow_missing"));

  const conditional = analyze("If Nana agrees, ask David to proceed").constraints;
  assert.ok(validateSemanticRoles({ translation: "让David继续处理", englishMeaning: "Ask David to proceed", constraints: conditional }).includes("condition_missing"));

  const possibility = analyze("David may need to check this").constraints;
  const modalityIssues = validateSemanticRoles({ translation: "David必须检查这个", englishMeaning: "David must check this", constraints: possibility });
  assert.ok(modalityIssues.includes("possibility_missing"));
  assert.ok(modalityIssues.includes("possibility_strengthened"));

  const completed = analyze("David has already checked this").constraints;
  assert.ok(validateSemanticRoles({ translation: "让David检查这个", englishMeaning: "Ask David to check this", constraints: completed }).includes("time_already_missing"));
});

test("builds a high-priority semantic instruction with hidden entity tokens", () => {
  const { constraints } = analyze("Could you please ask David to check this?");
  const instruction = buildSemanticConstraintInstruction(constraints);
  assert.match(instruction, /accuracy has higher priority than naturalness/i);
  assert.match(instruction, /asking the listener to ask \[\[VERBA_ENTITY_0\]\]/i);
  assert.match(instruction, /Do not turn it into a direct request/i);
  assert.match(instruction, /englishMeaning field must independently restate/i);
});

test("treats missing lexical evidence as uncertain warnings", () => {
  const later = analyze("I would be traveling later today").constraints;
  const laterResult = evaluateSemanticRoles({ translation: "我今天晚一点出发", englishMeaning: "I would travel later today", constraints: later });
  assert.equal(laterResult.outcome, "warning");
  assert.ok(laterResult.warnings.some((item) => item.code === "time_later_missing"));

  const omittedSubject = analyze("I asked David to contact Nana").constraints;
  const subjectResult = evaluateSemanticRoles({ translation: "让David联系Nana", englishMeaning: "I asked David to contact Nana", constraints: omittedSubject });
  assert.equal(subjectResult.outcome, "warning");
  assert.ok(subjectResult.warnings.some((item) => item.code === "speaker_role_missing"));
});

test("allows natural order and polite paraphrases when roles remain intact", () => {
  const { constraints } = analyze("Could you please ask David to check this?");
  for (const translation of ["麻烦你请David看下这个", "方便的话，请David帮忙确认一下这个"]) {
    const result = evaluateSemanticRoles({ translation, englishMeaning: "You are asking the listener to ask David to check this", constraints });
    assert.notEqual(result.outcome, "block", translation);
  }
});

test("blocks explicit polarity, time-direction, modality, completion, and role reversals", () => {
  const negative = analyze("Don't ask David to check this").constraints;
  assert.ok(evaluateSemanticRoles({ translation: "让David检查这个", englishMeaning: "Ask David to check this", constraints: negative }).blocking.some((item) => item.code === "negation_reversed"));

  const later = analyze("Ask David to check this later").constraints;
  assert.ok(evaluateSemanticRoles({ translation: "让David之前检查这个", englishMeaning: "Ask David to check this before", constraints: later }).blocking.some((item) => item.code === "time_direction_reversed"));

  const relation = analyze("Nana asked David to check this").constraints;
  assert.ok(evaluateSemanticRoles({ translation: "David让Nana检查这个", englishMeaning: "David asked Nana to check this", constraints: relation }).blocking.some((item) => item.code === "actor_target_reversed"));

  const possibility = analyze("David may need to check this").constraints;
  assert.ok(evaluateSemanticRoles({ translation: "David必须检查这个", englishMeaning: "David must check this", constraints: possibility }).blocking.some((item) => item.code === "possibility_strengthened"));

  const completed = analyze("David has already checked this").constraints;
  assert.ok(evaluateSemanticRoles({ translation: "让David检查这个", englishMeaning: "Ask David to check this", constraints: completed }).blocking.some((item) => item.code === "completion_reversed_to_request"));
});
