import { createTranslationError, TRANSLATION_ERROR_CODES } from "./translation-diagnostics.mjs";

export function sanitizeTranslationOutput(text) {
  return String(text ?? "")
    .trimEnd()
    .replace(/(?:[.!?,;:…，。！？；：、]+\s*)+$/gu, "")
    .trimEnd();
}

export function parseTranslationOutput(rawOutput, provider, { sanitize = true } = {}) {
  const cleanedOutput = String(rawOutput).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (!cleanedOutput) {
    throw createTranslationError(TRANSLATION_ERROR_CODES.TRANSLATION_EMPTY, {
      message: `${provider} returned an empty translation response.`,
      status: 422,
      stage: "output_parse"
    });
  }
  let parsed;
  try {
    parsed = JSON.parse(cleanedOutput);
  } catch {
    throw createTranslationError(TRANSLATION_ERROR_CODES.JSON_PARSE_FAILED, {
      message: `${provider} returned an incomplete translation response.`,
      status: 422,
      stage: "output_parse"
    });
  }
  if (typeof parsed.translation !== "string" || typeof parsed.englishMeaning !== "string") {
    throw createTranslationError(TRANSLATION_ERROR_CODES.MODEL_OUTPUT_INVALID, {
      message: `${provider} returned an unexpected translation response.`,
      status: 422,
      stage: "output_validation"
    });
  }
  if (!parsed.translation.trim()) {
    throw createTranslationError(TRANSLATION_ERROR_CODES.TRANSLATION_EMPTY, {
      message: `${provider} returned an empty translation.`,
      status: 422,
      stage: "output_validation"
    });
  }
  return {
    translation: sanitize ? sanitizeTranslationOutput(parsed.translation) : parsed.translation,
    englishMeaning: parsed.englishMeaning.trim()
  };
}
