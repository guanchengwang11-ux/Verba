import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHistoryItem } from "../server.mjs";
import { parseTranslationOutput, sanitizeTranslationOutput } from "../translation-output.mjs";

const cases = [
  ["Hello.", "Hello"],
  ["Really?", "Really"],
  ["Thank you!!!", "Thank you"],
  ["好的。", "好的"],
  ["可以吗？？", "可以吗"],
  ["I'm sorry, but I'm busy.", "I'm sorry, but I'm busy"],
  ["I'm sorry, ma'am, but I'm busy right now.", "I'm sorry, ma'am, but I'm busy right now"],
  ["好的。。。\n\n", "好的"],
  ["明白了！！  ", "明白了"],
  ["Really!  ??\n", "Really"],
  ["Thanks,", "Thanks"],
  ["Done;", "Done"],
  ["Note:", "Note"],
  ["收到……", "收到"],
  ["好的、", "好的"],
  ["", ""]
];

test("removes only trailing punctuation and whitespace", () => {
  for (const [input, expected] of cases) assert.equal(sanitizeTranslationOutput(input), expected);
});

test("applies the same translation sanitizing to every provider response", () => {
  for (const provider of ["OpenAI", "Gemini", "DeepSeek"]) {
    const output = parseTranslationOutput(JSON.stringify({ translation: "I'm sorry, but I'm busy!!!\n", englishMeaning: "The speaker is busy." }), provider);
    assert.deepEqual(output, { translation: "I'm sorry, but I'm busy", englishMeaning: "The speaker is busy." });
  }
});

test("keeps screen, history event, and clipboard inputs identical by returning one canonical translation", () => {
  const response = parseTranslationOutput('{"translation":"可以吗？？","englishMeaning":"Is that okay?"}', "Gemini");
  const screenText = response.translation;
  const historyPayload = normalizeHistoryItem({
    source: "Is that okay?",
    translation: response.translation,
    englishMeaning: response.englishMeaning,
    direction: "enToZh",
    mode: "chat",
    provider: "gemini"
  }).translation;
  const clipboardText = response.translation;
  assert.equal(screenText, "可以吗");
  assert.equal(historyPayload, screenText);
  assert.equal(clipboardText, screenText);
});
