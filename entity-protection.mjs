const commonCapitalizedWords = new Set([
  "A", "An", "Are", "As", "Ask", "At", "Can", "Could", "Do", "Does", "Don", "English", "For", "Friday", "From", "Good", "Have", "Hello", "Hey", "Hi", "How", "I", "If", "In", "Is", "It", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "Let", "Monday", "My", "Need", "No", "On", "Our", "Please", "Remind", "Saturday", "Sunday", "Tell", "Thanks", "Thank", "That", "The", "This", "Thursday", "To", "Tuesday", "Want", "Wednesday", "We", "What", "When", "Where", "Which", "Who", "Why", "Will", "Would", "Yes", "You", "Your"
]);

const preserveTargets = new Set([
  "do not translate", "don't translate", "keep unchanged", "no translation", "preserve exactly", "不翻译", "保持原文", "原样保留"
]);

const knownBrands = ["Bybit", "Binance", "OKX", "KCEX", "OpenAI", "Google", "DeepSeek", "Ajuba"];

const entityPatterns = [
  { type: "url", regex: /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/giu, trimTrailingPunctuation: true },
  { type: "email", regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu },
  { type: "mention", regex: /@[A-Za-z0-9_][A-Za-z0-9_.-]*/g },
  { type: "file", regex: /\b[A-Za-z0-9_-]+\.(?:pdf|docx?|xlsx?|pptx?|csv|txt|json|xml|ya?ml|zip|rar|7z|png|jpe?g|gif|webp|js|mjs|cjs|ts|tsx|jsx|py|java|go|rs)\b/giu },
  { type: "identifier", regex: /\b(?=[A-Za-z0-9_-]*[A-Za-z])(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9][A-Za-z0-9_-]{3,}\b/g },
  { type: "identifier", regex: /\b\d{4,}(?:[-_/]\d+)*\b/g },
  { type: "acronym", regex: /\b[A-Z]{1,10}(?:&[A-Z]{1,10})+\b/g },
  { type: "ticker", regex: /\$[A-Z][A-Z0-9]{1,9}\b/g },
  { type: "acronym", regex: /\b[A-Z][A-Z0-9]{1,15}\b/g },
  { type: "properName", regex: /\b(?:[A-Z][a-z]+[A-Z][A-Za-z0-9]*|[A-Z]{2,}[a-z][A-Za-z0-9]*)\b/g },
  { type: "brand", regex: new RegExp(`\\b(?:${knownBrands.join("|")})\\b`, "g") },
  { type: "name", regex: /\b[A-Z][a-z]+(?:[ '-][A-Z][a-z]+){1,3}\b/g, filter: (value) => value.split(/[ '-]/u).every((word) => !commonCapitalizedWords.has(word) && !knownBrands.includes(word)) },
  { type: "possibleName", regex: /\b[A-Z][a-z]{1,}\b/g, filter: (value) => !commonCapitalizedWords.has(value) }
];

function overlaps(left, right) {
  return left.start < right.end && right.start < left.end;
}

function addRange(ranges, candidate) {
  if (!candidate.value || ranges.some((range) => overlaps(range, candidate))) return;
  ranges.push(candidate);
}

function glossaryOccurrences(text, value) {
  const matches = [];
  let start = 0;
  while (start <= text.length - value.length) {
    const index = text.indexOf(value, start);
    if (index < 0) break;
    matches.push({ start: index, end: index + value.length });
    start = index + value.length;
  }
  return matches;
}

export function isPreserveExactlyGlossaryEntry(entry) {
  if (!entry || typeof entry.source !== "string" || !entry.source.trim()) return false;
  const source = entry.source.trim();
  const target = typeof entry.target === "string" ? entry.target.trim() : "";
  return entry.preserveExactly === true || source === target || preserveTargets.has(target.toLowerCase());
}

export function detectEntities(text, glossary = []) {
  const source = String(text ?? "");
  const ranges = [];

  for (const entry of glossary.filter(isPreserveExactlyGlossaryEntry)) {
    const value = entry.source.trim();
    for (const occurrence of glossaryOccurrences(source, value)) {
      addRange(ranges, { ...occurrence, value, type: "glossary", priority: 0 });
    }
  }

  entityPatterns.forEach((pattern, patternIndex) => {
    for (const match of source.matchAll(pattern.regex)) {
      const value = pattern.trimTrailingPunctuation ? match[0].replace(/[.,!?;:，。！？；：、…]+$/u, "") : match[0];
      if (!value || (pattern.filter && !pattern.filter(value))) continue;
      addRange(ranges, { value, start: match.index, end: match.index + value.length, type: pattern.type, priority: patternIndex + 1 });
    }
  });

  return ranges.sort((left, right) => left.start - right.start || left.priority - right.priority);
}

function canonicalToken(id) {
  return `[[VERBA_ENTITY_${id}]]`;
}

export function protectEntities(text, glossary = []) {
  const source = String(text ?? "");
  const ranges = detectEntities(source, glossary);
  const entityMap = [];
  const byOriginal = new Map();

  for (const range of ranges) {
    if (!byOriginal.has(range.value)) {
      const entity = { id: entityMap.length, token: canonicalToken(entityMap.length), original: range.value, type: range.type, occurrenceCount: 0 };
      byOriginal.set(range.value, entity);
      entityMap.push(entity);
    }
    range.entity = byOriginal.get(range.value);
    range.entity.occurrenceCount += 1;
  }

  let protectedText = source;
  for (const range of [...ranges].sort((left, right) => right.start - left.start)) {
    protectedText = `${protectedText.slice(0, range.start)}${range.entity.token}${protectedText.slice(range.end)}`;
  }
  return { text: protectedText, entityMap };
}

function flexibleTokenPattern(id) {
  const decoration = "(?:\\*{1,2}|_{1,2}|`)?";
  const opening = "(?:\\[\\[|⟦|【|\\()?";
  const separator = "(?:\\\\?[_-]|\\s)*";
  const closing = "(?:\\]\\]|⟧|】|\\))?";
  return new RegExp(`${decoration}${opening}VERBA${separator}ENTITY${separator}0*${id}${closing}${decoration}`, "giu");
}

export function restoreEntities(text, entityMap) {
  let restored = String(text ?? "");
  for (const entity of entityMap) {
    restored = restored.replace(flexibleTokenPattern(entity.id), entity.original);
    restored = restored.replaceAll(entity.token, entity.original);
  }
  return restored;
}

function countOccurrences(text, value) {
  if (!value) return 0;
  let count = 0;
  let start = 0;
  while (start <= text.length - value.length) {
    const index = text.indexOf(value, start);
    if (index < 0) break;
    count += 1;
    start = index + value.length;
  }
  return count;
}

export function findEntityRestorationIssues(text, entityMap) {
  const output = String(text ?? "");
  const issues = entityMap.flatMap((entity) => {
    const actualCount = countOccurrences(output, entity.original);
    return actualCount === entity.occurrenceCount ? [] : [{ original: entity.original, expectedCount: entity.occurrenceCount, actualCount }];
  });
  if (/VERBA(?:\\?[_-]|\s)*ENTITY/iu.test(output)) issues.push({ original: "", expectedCount: 0, actualCount: 0, placeholderLeak: true });
  return issues;
}

export function buildEntityProtectionInstruction(entityMap) {
  if (!entityMap.length) return "";
  return `The source contains protected entity placeholders. Copy every placeholder exactly, in the same semantic position and the same number of times. Never translate, transliterate, rename, split, omit, or explain a placeholder. Do not add Markdown around it. The original entity values are intentionally hidden from you and will be restored by the application. Valid placeholders:\n${entityMap.map((entity) => entity.token).join("\n")}`;
}
