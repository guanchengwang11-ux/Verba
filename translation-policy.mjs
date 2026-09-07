import { sanitizeTranslationOutput } from "./translation-output.mjs";
import { findEntityRestorationIssues, restoreEntities } from "./entity-protection.mjs";
import { validateSemanticRoles } from "./semantic-role-protection.mjs";

export const TEAM_CHAT_STYLE_INSTRUCTIONS = `Write like a normal colleague communicating in Teams, Slack, Lark, or a workplace WhatsApp group. Keep the message natural, concise, mildly polite, and workplace-neutral. It should not sound like a formal email, customer-service script, close-friend joke, or regional dialect.
For Chinese, prefer ordinary expressions such as 麻烦, 帮忙, 看下, 确认下, 辛苦, 方便的话, and 有空的话 when they fit the source intent. Avoid stiff expressions such as 烦请, 敬请, 劳烦您, and 请您务必. Never introduce slang, regional speech, internet jargon, excessive familiarity, or intimate forms of address such as 姐们儿, 哥们儿, 老铁, 宝, 亲, 老哥, 姐, 哥, or 兄弟. Do not use 瞅, 啥, 咋, 整一下, 搞一下, 嘞, 呗, 嗷, 哈哈, or similar expressions unless the source explicitly contains that meaning and preserving it is intentional.
Do not add emoji, exclamation marks, filler particles, pet names, personal relationships, or information absent from the source. Do not call someone 老板 unless the source explicitly says boss. A name or protected placeholder at the beginning of a request is the person being addressed directly: keep it at the beginning followed by a natural comma, and never rewrite it as "ask [name] to..." or "让/麻烦 [name]...". Keep one-sentence messages compact where possible. For English, use natural neutral workplace phrasing such as "Could you help check..." rather than overly formal wording such as "Could you kindly assist in reviewing..." or overly casual wording such as "take a quick look at this thing".
Style examples: "pls check this transaction" should read like "麻烦帮忙看下这笔交易"; "can you check this for me" like "麻烦帮我看下这个"; "please confirm if this is okay" like "麻烦确认下这个是否可以"; "are you free now" like "你现在方便吗"; and "can you send it to me later" like "方便的话晚点发我一下". Preserve placeholders in these patterns exactly.`;

export const TEAM_CHAT_FORBIDDEN_TERMS = [
  "姐们儿", "哥们儿", "老铁", "瞅一眼", "瞅", "咋", "啥", "整一下", "搞一下", "嘞", "呗", "嗷", "哈哈", "啊姐", "老哥"
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function finalizeProtectedTranslation(parsed, entityMap) {
  return {
    translation: sanitizeTranslationOutput(restoreEntities(parsed.translation, entityMap)),
    englishMeaning: restoreEntities(parsed.englishMeaning, entityMap).trim()
  };
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
  const semanticIssues = validateSemanticRoles({ translation, englishMeaning, constraints: semanticConstraints });
  const styleViolations = mode === "chat" ? findTeamChatStyleViolations(translation, sourceText) : [];
  const directAddressee = mode === "chat" ? findDirectAddressee(sourceText, entityMap) : "";
  if (directAddressee && !new RegExp(`^${escapeRegExp(directAddressee)}[，,]`, "u").test(translation.trimStart())) {
    styleViolations.push(`direct-address:${directAddressee}`);
  }
  return { valid: entityIssues.length === 0 && semanticIssues.length === 0 && styleViolations.length === 0, entityIssues, semanticIssues, styleViolations };
}

export function buildPolicyCorrectionInstruction(validation) {
  const issues = [];
  const affectedEntities = validation.entityIssues.filter((issue) => issue.original).map((issue) => issue.original);
  if (affectedEntities.length) issues.push(`Restore these protected entities exactly once per source occurrence: ${affectedEntities.join(", ")}.`);
  if (validation.entityIssues.some((issue) => issue.placeholderLeak)) issues.push("Do not expose or alter any VERBA_ENTITY placeholder.");
  if (validation.semanticIssues.length) issues.push(`Restore the original semantic roles and factual constraints. Fix: ${validation.semanticIssues.join(", ")}.`);
  const directAddresses = validation.styleViolations.filter((item) => item.startsWith("direct-address:")).map((item) => item.slice("direct-address:".length));
  const inappropriateExpressions = validation.styleViolations.filter((item) => !item.startsWith("direct-address:"));
  if (directAddresses.length) issues.push(`Keep ${directAddresses.join(", ")} as the direct addressee at the beginning, followed by a comma; do not turn the message into a request to someone else.`);
  if (inappropriateExpressions.length) issues.push(`Remove these inappropriate expressions without changing the meaning: ${inappropriateExpressions.join(", ")}.`);
  return `Correct the previous translation. ${issues.join(" ")} Return a fresh JSON response that follows every original instruction.`;
}

export async function executeTranslationPolicy({ sourceText, mode, entityMap, semanticConstraints, generate }) {
  let validation;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const correctionInstruction = attempt === 1 ? buildPolicyCorrectionInstruction(validation) : "";
    const parsed = await generate({ attempt, correctionInstruction });
    const result = finalizeProtectedTranslation(parsed, entityMap);
    validation = validateTranslationPolicy({ translation: result.translation, englishMeaning: result.englishMeaning, sourceText, mode, entityMap, semanticConstraints });
    if (validation.valid) return result;
    console.info(JSON.stringify({
      event: "translation_policy_validation_failed",
      attempt: attempt + 1,
      entityIssueCount: validation.entityIssues.length,
      semanticIssues: validation.semanticIssues,
      styleIssueCount: validation.styleViolations.length
    }));
  }
  const error = new Error("The translation did not preserve required terms or workplace tone. Please try again.");
  error.status = 422;
  throw error;
}
