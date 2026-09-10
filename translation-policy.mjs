import { sanitizeTranslationOutput } from "./translation-output.mjs";
import { findEntityRestorationIssues, restoreEntities } from "./entity-protection.mjs";
import { evaluateSemanticRoles } from "./semantic-role-protection.mjs";
import {
  createTranslationError,
  normalizeTranslationError,
  TRANSLATION_ERROR_CODES
} from "./translation-diagnostics.mjs";

export const TEAM_CHAT_STYLE_INSTRUCTIONS = `Use clear, everyday workplace chat language: concise, neutral and mildly polite, without sounding like a formal notice or a customer-service script. Translate idioms by their communicative meaning, not their individual words.
For Chinese, rebuild the sentence in natural spoken Chinese rather than copying English clause order and every pronoun. Use ordinary verbs and short clauses. Omit redundant subjects or objects only when ownership, action direction and reference remain intact. Grammatical particles and light conversational wording are allowed when they do not add facts, urgency, familiarity or emotion. Keep the source's degree of firmness and uncertainty: politeness must not make a requirement optional. Do not add courtesy formulas, slang, dialect, pet names or emoji absent from the source.
Keep an actual direct addressee distinct from a third-person subject or an intermediary in a request. For English, use normal colleague-to-colleague phrasing.`;


export const TEAM_CHAT_FORBIDDEN_TERMS = [
  "姐们儿", "哥们儿", "老铁", "瞅一眼", "瞅", "咋", "啥", "整一下", "搞一下", "嘞", "呗", "嗷", "哈哈", "啊姐", "老哥"
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function finalizeProtectedTranslation(parsed, entityMap) {
  try {
    return {
      translation: restoreEntities(sanitizeTranslationOutput(parsed.translation), entityMap),
      englishMeaning: restoreEntities(parsed.englishMeaning, entityMap).trim()
    };
  } catch (error) {
    throw createTranslationError(TRANSLATION_ERROR_CODES.ENTITY_RESTORE_FAILED, {
      message: "Protected entities could not be restored.",
      status: 422,
      stage: "entity_restore",
      cause: error
    });
  }
}

export function findTeamChatStyleViolations(translation, sourceText) {
  const source = String(sourceText ?? "");
  const output = String(translation ?? "");
  const violations = TEAM_CHAT_FORBIDDEN_TERMS.filter((term) => output.includes(term) && !source.includes(term));
  const addedAddress = output.match(/(?:^|[\s，,])(?:宝|亲|姐|哥|兄弟)(?=[\s，,]|$)/u)?.[0]?.trim();
  if (addedAddress && !source.includes(addedAddress)) violations.push(addedAddress);
  const addedFiller = output.match(/(?:哈+|呀)$/u)?.[0];
  if (addedFiller && !source.includes(addedFiller)) violations.push(addedFiller);
  if (output.includes("老板") && !/(老板|\bboss\b)/iu.test(source)) violations.push("老板");
  return [...new Set(violations)];
}

function findDirectAddressee(sourceText, entityMap) {
  const source = String(sourceText ?? "").trimStart();
  return entityMap.find((entity) => {
    if (!source.startsWith(entity.original)) return false;
    const rest = source.slice(entity.original.length);
    return /^[，,]/u.test(rest) || /^\s+(?:pls\b|please\b|can\s+you\b|could\s+you\b|would\s+you\b|will\s+you\b|check\b|confirm\b|send\b|help\b|look\b|review\b)/iu.test(rest);
  })?.original || "";
}

export function validateTranslationPolicy({ translation, englishMeaning = "", sourceText, mode, entityMap, semanticConstraints }) {
  const entityIssues = findEntityRestorationIssues(translation, entityMap);
  const semanticEvaluation = evaluateSemanticRoles({ translation, englishMeaning, constraints: semanticConstraints });
  const semanticIssues = semanticEvaluation.findings.map((finding) => finding.code);
  const semanticBlockingIssues = semanticEvaluation.blocking.map((finding) => finding.code);
  const semanticWarnings = semanticEvaluation.warnings.map((finding) => finding.code);
  const styleViolations = mode === "chat" ? findTeamChatStyleViolations(translation, sourceText) : [];
  const directAddressee = mode === "chat" ? findDirectAddressee(sourceText, entityMap) : "";
  if (directAddressee && !new RegExp(`^${escapeRegExp(directAddressee)}[，,]`, "u").test(translation.trimStart())) {
    styleViolations.push(`direct-address:${directAddressee}`);
  }
  const warnings = [...semanticWarnings, ...styleViolations];
  const criticalStyleViolations = [];
  const criticalIssues = [
    ...entityIssues.map((issue) => `entity:${issue.original || "placeholder"}`),
    ...semanticBlockingIssues.map((issue) => `semantic:${issue}`)
  ];
  return {
    valid: criticalIssues.length === 0,
    entityIssues,
    semanticIssues,
    semanticEvaluation,
    semanticBlockingIssues,
    semanticWarnings,
    styleViolations,
    criticalStyleViolations,
    criticalIssues,
    warnings
  };
}

export function buildPolicyCorrectionInstruction(validation) {
  const issues = [];
  const affectedEntities = validation.entityIssues.filter((issue) => issue.original).map((issue) => issue.original);
  if (affectedEntities.length) issues.push(`Restore these protected entities exactly once per source occurrence: ${affectedEntities.join(", ")}.`);
  if (validation.entityIssues.some((issue) => issue.placeholderLeak)) issues.push("Do not expose or alter any VERBA_ENTITY placeholder.");
  if (validation.semanticBlockingIssues.length) issues.push(`Restore the original semantic roles and factual constraints. Fix only these blocking rules: ${validation.semanticBlockingIssues.join(", ")}.`);
  const directAddresses = validation.styleViolations.filter((item) => item.startsWith("direct-address:")).map((item) => item.slice("direct-address:".length));
  const inappropriateExpressions = validation.styleViolations.filter((item) => !item.startsWith("direct-address:"));
  if (directAddresses.length) issues.push(`Keep ${directAddresses.join(", ")} as the direct addressee at the beginning, followed by a comma; do not turn the message into a request to someone else.`);
  if (inappropriateExpressions.length) issues.push(`Remove these inappropriate expressions without changing the meaning: ${inappropriateExpressions.join(", ")}.`);
  return `Correct the previous translation. ${issues.join(" ")} Return a fresh JSON response that follows every original instruction.`;
}

function validationErrorCode(validation) {
  if (validation.entityIssues.length) return TRANSLATION_ERROR_CODES.ENTITY_VALIDATION_FAILED;
  if (validation.semanticBlockingIssues.length) return TRANSLATION_ERROR_CODES.SEMANTIC_VALIDATION_FAILED;
  return TRANSLATION_ERROR_CODES.MODEL_OUTPUT_INVALID;
}

function canRegenerateAfter(error) {
  return [
    TRANSLATION_ERROR_CODES.JSON_PARSE_FAILED,
    TRANSLATION_ERROR_CODES.MODEL_OUTPUT_INVALID,
    TRANSLATION_ERROR_CODES.TRANSLATION_EMPTY,
    TRANSLATION_ERROR_CODES.ENTITY_RESTORE_FAILED
  ].includes(error.internalCode);
}

export async function executeTranslationPolicy({ sourceText, mode, entityMap, semanticConstraints, generate, diagnostics, observe }) {
  let validation;
  let generationError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const correctionInstruction = attempt === 1
      ? validation ? buildPolicyCorrectionInstruction(validation) : "The previous response was empty or invalid. Return complete JSON with both required string fields and preserve every placeholder exactly."
      : "";
    let parsed;
    let result;
    try {
      parsed = await generate({ attempt, correctionInstruction });
      observe?.("parsed_output", { attempt: attempt + 1, parsed });
      observe?.("entity_restoration", { attempt: attempt + 1, translation: restoreEntities(parsed.translation, entityMap) });
      result = finalizeProtectedTranslation(parsed, entityMap);
      observe?.("postprocess", { attempt: attempt + 1, result });
    } catch (error) {
      generationError = normalizeTranslationError(error, { stage: error?.stage || "output_validation" });
      const willRegenerate = attempt === 0 && canRegenerateAfter(generationError);
      diagnostics?.record({
        event: "translation_stage_failed",
        validationAttempt: attempt + 1,
        stage: generationError.stage,
        internalCode: generationError.internalCode,
        httpStatus: generationError.status,
        providerErrorCode: generationError.providerErrorCode,
        willRegenerate,
        severity: "critical",
        success: false
      });
      if (willRegenerate) continue;
      throw generationError;
    }
    const validationStartedAt = Date.now();
    validation = validateTranslationPolicy({ translation: result.translation, englishMeaning: result.englishMeaning, sourceText, mode, entityMap, semanticConstraints });
    const validationMs = Date.now() - validationStartedAt;
    if (validation.valid) {
      diagnostics?.record({
        event: validation.warnings.length ? "translation_validation_warning" : "translation_validation_passed",
        validationAttempt: attempt + 1,
        stage: "policy_validation",
        severity: validation.warnings.length ? "warning" : "pass",
        disposition: "allow",
        validationMs,
        issueCodes: validation.warnings.map((issue) => issue.startsWith("direct-address:") ? "direct_addressee_format" : issue),
        ruleIds: validation.semanticEvaluation.warnings.map((finding) => finding.ruleId),
        success: true
      });
      return result;
    }
    const internalCode = validationErrorCode(validation);
    diagnostics?.record({
      event: "translation_validation_failed",
      validationAttempt: attempt + 1,
      stage: internalCode === TRANSLATION_ERROR_CODES.ENTITY_VALIDATION_FAILED ? "entity_validation" : internalCode === TRANSLATION_ERROR_CODES.SEMANTIC_VALIDATION_FAILED ? "semantic_validation" : "style_validation",
      internalCode,
      willRegenerate: attempt === 0,
      severity: "critical",
      disposition: "block",
      retryReason: attempt === 0 ? internalCode : "retry_limit_reached",
      validationMs,
      issueCodes: [
        ...validation.entityIssues.map((issue) => issue.placeholderLeak ? "placeholder_leak" : "protected_entity_mismatch"),
        ...validation.semanticBlockingIssues
      ],
      ruleIds: validation.semanticEvaluation.blocking.map((finding) => finding.ruleId),
      success: false
    });
  }
  const code = validation ? validationErrorCode(validation) : generationError?.internalCode || TRANSLATION_ERROR_CODES.UNKNOWN_ERROR;
  throw createTranslationError(code, {
    message: "The translation did not pass critical output validation.",
    status: 422,
    stage: code === TRANSLATION_ERROR_CODES.ENTITY_VALIDATION_FAILED ? "entity_validation" : code === TRANSLATION_ERROR_CODES.SEMANTIC_VALIDATION_FAILED ? "semantic_validation" : "output_validation"
  });
}
