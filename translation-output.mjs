export function sanitizeTranslationOutput(text) {
  return String(text ?? "")
    .trimEnd()
    .replace(/(?:[\p{P}\u2026]+\s*)+$/gu, "")
    .trimEnd();
}

export function parseTranslationOutput(rawOutput, provider, { sanitize = true } = {}) {
  const cleanedOutput = String(rawOutput).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed;
  try {
    parsed = JSON.parse(cleanedOutput);
  } catch {
    throw new Error(`${provider} returned an incomplete translation response. Please try again.`);
  }
  if (typeof parsed.translation !== "string" || typeof parsed.englishMeaning !== "string") {
    throw new Error(`${provider} returned an unexpected translation response. Please try again.`);
  }
  return {
    translation: sanitize ? sanitizeTranslationOutput(parsed.translation) : parsed.translation,
    englishMeaning: parsed.englishMeaning.trim()
  };
}
