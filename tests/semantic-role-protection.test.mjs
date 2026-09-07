import assert from "node:assert/strict";
import test from "node:test";
import { protectEntities } from "../entity-protection.mjs";
import {
  analyzeSemanticConstraints,
  buildSemanticConstraintInstruction,
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
