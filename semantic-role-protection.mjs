const entityToken = String.raw`\[\[VERBA_ENTITY_\d+\]\]`;
const actorToken = String.raw`(?:I|We|You|${entityToken})`;

const relationNames = {
  ask: ["ask", "asked"],
  tell: ["tell", "told"],
  remind: ["remind", "reminded"],
  let: ["let"],
  have: ["have", "has", "had"],
  want: ["want", "wants", "wanted"],
  need: ["need", "needs", "needed"]
};

const timeRules = [
  { id: "tomorrow", source: /\btomorrow\b/iu, chinese: /明天/u, english: /\btomorrow\b/iu },
  { id: "today", source: /\btoday\b/iu, chinese: /今天/u, english: /\btoday\b/iu },
  { id: "yesterday", source: /\byesterday\b/iu, chinese: /昨天/u, english: /\byesterday\b/iu },
  { id: "later", source: /\blater\b/iu, chinese: /稍后|晚点|之后/u, english: /\blater\b/iu },
  { id: "now", source: /\bnow\b/iu, chinese: /现在|当前/u, english: /\bnow\b/iu },
  { id: "already", source: /\balready\b/iu, chinese: /已经|已/u, english: /\balready\b|\bpreviously\b|\b(?:has|have|had)\b.*\bcompleted\b/iu }
];

function cleanAction(action) {
  return String(action || "").trim().replace(/[.?!。？！]+$/u, "");
}

function normalizeRelation(value) {
  const lower = value.toLowerCase();
  return Object.entries(relationNames).find(([, forms]) => forms.includes(lower))?.[0] || lower;
}

function entityForToken(token, entityMap) {
  return entityMap.find((entity) => entity.token === token) || null;
}

function actorDescriptor(actor, entityMap) {
  if (/^I$/iu.test(actor)) return { kind: "speaker", token: "", original: "I" };
  if (/^(We|You)$/iu.test(actor)) return { kind: /^You$/iu.test(actor) ? "listener" : "speakerGroup", token: "", original: actor };
  const entity = entityForToken(actor, entityMap);
  return { kind: "entity", token: actor, original: entity?.original || actor };
}

function parseRelationFrame(mainClause, entityMap) {
  const listenerRequest = mainClause.match(new RegExp(`^(could|can|would|will)\\s+you\\s+(?:please\\s+)?(ask|tell|remind)\\s+(${entityToken})\\s+to\\s+(.+)$`, "iu"));
  if (listenerRequest) {
    return {
      outerActor: { kind: "listener", token: "", original: "you" },
      explicitListener: true,
      relation: normalizeRelation(listenerRequest[2]),
      tense: "request",
      target: entityForToken(listenerRequest[3], entityMap),
      action: cleanAction(listenerRequest[4]),
      negative: false
    };
  }

  const imperative = mainClause.match(new RegExp(`^(?:please\\s+)?(?:(don't|do\\s+not)\\s+)?(ask|tell|remind)\\s+(${entityToken})\\s+to\\s+(.+)$`, "iu"));
  if (imperative) {
    return {
      outerActor: { kind: "listener", token: "", original: "you" },
      explicitListener: false,
      relation: normalizeRelation(imperative[2]),
      tense: "imperative",
      target: entityForToken(imperative[3], entityMap),
      action: cleanAction(imperative[4]),
      negative: Boolean(imperative[1])
    };
  }

  const subjectTo = mainClause.match(new RegExp(`^(${actorToken})\\s+(ask(?:ed)?|tell|told|remind(?:ed)?|want(?:s|ed)?|need(?:s|ed)?)\\s+(${entityToken})\\s+to\\s+(.+)$`, "iu"));
  if (subjectTo) {
    return {
      outerActor: actorDescriptor(subjectTo[1], entityMap),
      explicitListener: false,
      relation: normalizeRelation(subjectTo[2]),
      tense: /ed$|told$/iu.test(subjectTo[2]) ? "past" : "present",
      target: entityForToken(subjectTo[3], entityMap),
      action: cleanAction(subjectTo[4]),
      negative: false
    };
  }

  const subjectBare = mainClause.match(new RegExp(`^(${actorToken})\\s+(let|have|has|had)\\s+(${entityToken})\\s+(.+)$`, "iu"));
  if (subjectBare) {
    return {
      outerActor: actorDescriptor(subjectBare[1], entityMap),
      explicitListener: false,
      relation: normalizeRelation(subjectBare[2]),
      tense: /had$/iu.test(subjectBare[2]) ? "past" : "present",
      target: entityForToken(subjectBare[3], entityMap),
      action: cleanAction(subjectBare[4]),
      negative: false
    };
  }

  return null;
}

export function analyzeSemanticConstraints({ originalText, protectedText, direction, entityMap }) {
  const source = String(originalText ?? "").trim();
  let mainClause = String(protectedText ?? "").trim();
  let condition = "";
  const conditionMatch = mainClause.match(/^if\s+(.+?),\s*(.+)$/iu);
  if (conditionMatch) {
    condition = conditionMatch[1];
    mainClause = conditionMatch[2];
  }

  const relationFrame = direction === "enToZh" ? parseRelationFrame(mainClause, entityMap) : null;
  const timeMarkers = timeRules.filter((rule) => rule.source.test(source)).map((rule) => rule.id);
  const modality = /\b(?:may|might)\b/iu.test(source) ? "possibility"
    : /\bmust\b/iu.test(source) ? "obligation"
      : /\bshould\b/iu.test(source) ? "recommendation" : "";
  const negative = Boolean(relationFrame?.negative || /\b(?:don't|doesn't|didn't|do\s+not|does\s+not|did\s+not|never|not)\b/iu.test(source));
  const completed = /\b(?:has|have|had)\s+(?:already\s+)?[a-z]+(?:ed|en)\b/iu.test(source) || /\balready\b/iu.test(source);
  return {
    direction,
    relationFrame,
    condition,
    negative,
    timeMarkers,
    modality,
    completed,
    hasConstraints: Boolean(relationFrame || condition || negative || timeMarkers.length || modality || completed)
  };
}

function relationInstruction(frame) {
  if (!frame) return "";
  const target = frame.target?.token || "the named person";
  const action = frame.action || "the stated action";
  if (frame.outerActor.kind === "listener" && frame.explicitListener) {
    return `The speaker is asking the listener to ${frame.relation} ${target} to perform this action: ${action}. This is an indirect request. Do not turn it into a direct request addressed to ${target}. In Chinese, keep an explicit intermediary structure before the target, such as “麻烦你让${target}…” or “可以请${target}…吗”.`;
  }
  if (frame.outerActor.kind === "listener") {
    const polarity = frame.negative ? `not to ${frame.relation}` : `to ${frame.relation}`;
    const chinesePattern = frame.negative ? `“不要让${target}…”` : frame.relation === "tell" ? `“告诉${target}…”` : frame.relation === "remind" ? `“提醒${target}…”` : `“让${target}…”`;
    return `The speaker is instructing the listener ${polarity} ${target} to perform this action: ${action}. Do not address the instruction directly to ${target}. In Chinese, preserve the relationship before the target, for example ${chinesePattern}.`;
  }
  const actor = frame.outerActor.token || frame.outerActor.original;
  const presentVerb = { ask: "asks", tell: "tells", remind: "reminds", let: "lets", have: "has", want: "wants", need: "needs" }[frame.relation] || frame.relation;
  const pastVerb = { ask: "asked", tell: "told", remind: "reminded", let: "let", have: "had", want: "wanted", need: "needed" }[frame.relation] || frame.relation;
  const relationVerb = frame.tense === "past" ? pastVerb : presentVerb;
  return `${actor} ${relationVerb} ${target} to perform this action: ${action}. Preserve that actor-to-target relationship and do not convert it into a new direct request.`;
}

export function buildSemanticConstraintInstruction(constraints) {
  if (!constraints?.hasConstraints) return "";
  const rules = [relationInstruction(constraints.relationFrame)];
  if (constraints.condition) rules.push(`Preserve the IF condition before the main instruction: ${constraints.condition}.`);
  if (constraints.negative) rules.push("Preserve the negative meaning. Never turn a prohibition or negated statement into a positive instruction.");
  if (constraints.timeMarkers.length) rules.push(`Preserve these time or aspect markers: ${constraints.timeMarkers.join(", ")}.`);
  if (constraints.modality === "possibility") rules.push("Preserve uncertainty such as may/might; do not strengthen it into must.");
  if (constraints.modality === "obligation") rules.push("Preserve the obligation expressed by must.");
  if (constraints.modality === "recommendation") rules.push("Preserve the recommendation expressed by should.");
  if (constraints.completed) rules.push("Preserve that the action has already happened; do not rewrite it as a new request.");
  return `SEMANTIC ROLE CONSTRAINTS — accuracy has higher priority than naturalness:\n${rules.filter(Boolean).map((rule) => `- ${rule}`).join("\n")}\nThe englishMeaning field must independently restate the original source meaning and these roles. Do not derive englishMeaning from a potentially simplified translation.`;
}

function chineseRelationMarkers(relation) {
  if (relation === "tell") return /告诉|转告|让|叫/u;
  if (relation === "remind") return /提醒/u;
  if (relation === "let") return /让|允许/u;
  if (relation === "have") return /让|叫|安排/u;
  if (relation === "want") return /想让|希望/u;
  if (relation === "need") return /需要|要让|让/u;
  return /让|请|叫|要求|拜托|麻烦/u;
}

function englishRelationMarkers(relation) {
  if (relation === "tell") return /\b(?:tell|told|instruct|instructed|notify|notified)\b/iu;
  if (relation === "remind") return /\b(?:remind|reminded|prompt|prompted)\b/iu;
  if (relation === "let") return /\b(?:let|allow|allowed|permit|permitted)\b/iu;
  if (relation === "have") return /\b(?:have|has|had|arrange|arranged|get|got)\b/iu;
  if (relation === "want") return /\b(?:want|wants|wanted|would\s+like)\b/iu;
  if (relation === "need") return /\b(?:need|needs|needed|require|requires|required)\b/iu;
  return /\b(?:ask|asked|request|requested|instruct|instructed|get|got|have|had)\b/iu;
}

function validateRelationInChinese(output, frame) {
  if (!frame?.target?.original) return [];
  const compact = output.replace(/\s+/gu, "");
  const target = frame.target.original;
  const targetIndex = compact.indexOf(target);
  const issues = [];
  if (targetIndex < 0) return ["target_person_missing"];
  if (new RegExp(`^${escapeRegExp(target)}[，,]`, "u").test(compact)) issues.push("target_became_direct_addressee");
  const prefix = compact.slice(0, targetIndex);
  if (!chineseRelationMarkers(frame.relation).test(prefix)) issues.push("delegation_relation_missing");
  if (frame.outerActor.kind === "speaker" && !prefix.includes("我")) issues.push("speaker_role_missing");
  if (frame.outerActor.kind === "speakerGroup" && !prefix.includes("我们")) issues.push("speaker_group_role_missing");
  if (frame.outerActor.kind === "entity") {
    const actorIndex = compact.indexOf(frame.outerActor.original);
    if (actorIndex < 0 || actorIndex >= targetIndex || !chineseRelationMarkers(frame.relation).test(compact.slice(actorIndex + frame.outerActor.original.length, targetIndex))) {
      issues.push("actor_target_relationship_changed");
    }
  }
  return issues;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateCommonFeatures(text, constraints, language, prefix = "") {
  const issues = [];
  const output = String(text ?? "");
  const isChinese = language === "zh";
  if (constraints.negative && !(isChinese ? /不|别|不要|无需|不能/u : /\b(?:not|don't|do\s+not|never|shouldn't|mustn't)\b/iu).test(output)) issues.push(`${prefix}negation_missing`);
  if (constraints.condition && !(isChinese ? /如果|若|只要|除非/u : /\bif\b/iu).test(output)) issues.push(`${prefix}condition_missing`);
  for (const marker of constraints.timeMarkers) {
    const rule = timeRules.find((item) => item.id === marker);
    if (rule && !(isChinese ? rule.chinese : rule.english).test(output)) issues.push(`${prefix}time_${marker}_missing`);
  }
  if (constraints.modality === "possibility" && !(isChinese ? /可能|也许|或许|未必/u : /\b(?:may|might|possibly|perhaps)\b/iu).test(output)) issues.push(`${prefix}possibility_missing`);
  if (constraints.modality === "possibility" && (isChinese ? /必须|务必/u : /\bmust\b/iu).test(output)) issues.push(`${prefix}possibility_strengthened`);
  if (constraints.modality === "obligation" && !(isChinese ? /必须|务必|需要/u : /\bmust|have\s+to\b/iu).test(output)) issues.push(`${prefix}obligation_missing`);
  if (constraints.modality === "recommendation" && !(isChinese ? /应该|最好|建议/u : /\bshould|ought\s+to\b/iu).test(output)) issues.push(`${prefix}recommendation_missing`);
  if (constraints.completed && !(isChinese ? /已经|已|过|了/u : /\b(?:already|has|have|had)\b/iu).test(output)) issues.push(`${prefix}completion_missing`);
  return issues;
}

function validateEnglishMeaning(meaning, constraints) {
  if (!constraints.relationFrame) return validateCommonFeatures(meaning, constraints, "en", "meaning_");
  const output = String(meaning ?? "");
  const frame = constraints.relationFrame;
  const issues = validateCommonFeatures(output, constraints, "en", "meaning_");
  if (!output.includes(frame.target?.original || "")) issues.push("meaning_target_person_missing");
  if (!englishRelationMarkers(frame.relation).test(output)) issues.push("meaning_relation_missing");
  if (frame.outerActor.kind === "listener" && frame.explicitListener && !/\b(?:you|listener)\b/iu.test(output)) issues.push("meaning_listener_role_missing");
  if (frame.outerActor.kind === "speaker" && !/\b(?:I|speaker)\b/u.test(output)) issues.push("meaning_speaker_role_missing");
  if (frame.outerActor.kind === "entity" && !output.includes(frame.outerActor.original)) issues.push("meaning_actor_missing");
  if (new RegExp(`^${escapeRegExp(frame.target.original)}\\s*[,，]`, "u").test(output.trim())) issues.push("meaning_target_became_direct_addressee");
  return [...new Set(issues)];
}

export function validateSemanticRoles({ translation, englishMeaning, constraints }) {
  if (!constraints?.hasConstraints) return [];
  const targetLanguage = constraints.direction === "enToZh" ? "zh" : "en";
  const relationIssues = targetLanguage === "zh" ? validateRelationInChinese(String(translation ?? ""), constraints.relationFrame) : [];
  return [...new Set([
    ...relationIssues,
    ...validateCommonFeatures(translation, constraints, targetLanguage),
    ...validateEnglishMeaning(englishMeaning, constraints)
  ])];
}
