import assert from "node:assert/strict";
import test from "node:test";
import { protectEntities } from "../entity-protection.mjs";
import { buildInstructions } from "../server.mjs";
import { TEAM_CHAT_FORBIDDEN_TERMS, executeTranslationPolicy, validateTranslationPolicy } from "../translation-policy.mjs";
import { analyzeSemanticConstraints } from "../semantic-role-protection.mjs";

test("Team chat prompt defines neutral workplace chat without changing email style", () => {
  const chat = buildInstructions({ direction: "enToZh", mode: "chat", glossary: [] });
  const email = buildInstructions({ direction: "enToZh", mode: "email", glossary: [] });
  assert.match(chat, /mildly polite/);
  assert.match(chat, /Teams, Slack, Lark/);
  assert.match(chat, /姐们儿/);
  assert.match(chat, /Do not add emoji/);
  assert.match(email, /polished workplace email: professional, concise, courteous, and direct/);
  assert.doesNotMatch(email, /姐们儿/);
});

test("removes preserve-exactly glossary entries from translation mappings", () => {
  const glossary = [
    { source: "Nana", target: "Do not translate" },
    { source: "transaction", target: "交易" }
  ];
  const { entityMap } = protectEntities("Nana checks the transaction", glossary);
  const instructions = buildInstructions({ direction: "enToZh", mode: "chat", glossary }, entityMap);
  assert.doesNotMatch(instructions, /Nana => Do not translate/);
  assert.match(instructions, /transaction => 交易/);
});

async function translateWithMockedProvider(sourceText, translatedTemplate, mode = "chat", direction = "enToZh") {
  const protectedInput = protectEntities(sourceText);
  const semanticConstraints = analyzeSemanticConstraints({ originalText: sourceText, protectedText: protectedInput.text, direction, entityMap: protectedInput.entityMap });
  return executeTranslationPolicy({
    sourceText,
    mode,
    entityMap: protectedInput.entityMap,
    semanticConstraints,
    generate: async () => ({ translation: translatedTemplate, englishMeaning: sourceText })
  });
}

test("restores entities in all required English to Chinese examples", async () => {
  const cases = [
    ["Nana asked David to check the Bybit UID.", "[[VERBA_ENTITY_0]]让[[VERBA_ENTITY_1]]查一下[[VERBA_ENTITY_2]] [[VERBA_ENTITY_3]]。", "Nana让David查一下Bybit UID"],
    ["I spoke with David yesterday.", "我昨天和[[VERBA_ENTITY_0]]聊过。", "我昨天和David聊过"],
    ["Please ask Nana to contact Muyiwa.", "请让[[VERBA_ENTITY_0]]联系[[VERBA_ENTITY_1]]。", "请让Nana联系Muyiwa"],
    ["Lin Zhang will send the KCEX UID.", "[[VERBA_ENTITY_0]]会发送[[VERBA_ENTITY_1]] [[VERBA_ENTITY_2]]。", "Lin Zhang会发送KCEX UID"],
    ["Please check the report.", "请检查报告。", "请检查报告"],
    ["Hello David", "你好[[VERBA_ENTITY_0]]。", "你好David"]
  ];
  for (const [source, template, expected] of cases) assert.equal((await translateWithMockedProvider(source, template)).translation, expected);
});

test("preserves English names embedded in Chinese to English translation", async () => {
  const result = await translateWithMockedProvider("请让David联系Nana", "Please ask [[VERBA_ENTITY_0]] to contact [[VERBA_ENTITY_1]].", "chat", "zhToEn");
  assert.equal(result.translation, "Please ask David to contact Nana");
});

test("preserves all requested participant relationships and factual constraints", async () => {
  const cases = [
    ["Could you please ask David to check this?", "麻烦你让[[VERBA_ENTITY_0]]看一下这个。", "麻烦你让David看一下这个"],
    ["Please tell Nana to contact David", "请告诉[[VERBA_ENTITY_0]]联系[[VERBA_ENTITY_1]]。", "请告诉Nana联系David"],
    ["Can you ask Muyiwa to send the file?", "你可以让[[VERBA_ENTITY_0]]把文件发过来吗？", "你可以让Muyiwa把文件发过来吗"],
    ["I asked David to contact Nana", "我让[[VERBA_ENTITY_0]]联系[[VERBA_ENTITY_1]]。", "我让David联系Nana"],
    ["Don't ask David to check this", "不要让[[VERBA_ENTITY_0]]检查这个。", "不要让David检查这个"],
    ["Ask David to check this tomorrow", "让[[VERBA_ENTITY_0]]明天检查一下这个。", "让David明天检查一下这个"],
    ["If Nana agrees, ask David to proceed", "如果[[VERBA_ENTITY_0]]同意，就让[[VERBA_ENTITY_1]]继续处理。", "如果Nana同意，就让David继续处理"],
    ["David has already checked this", "[[VERBA_ENTITY_0]]已经检查过这个。", "David已经检查过这个"]
  ];
  for (const [source, template, expected] of cases) assert.equal((await translateWithMockedProvider(source, template)).translation, expected, source);
});

test("regenerates when semantic roles change even if the entity is preserved", async () => {
  const sourceText = "Could you please ask David to check this?";
  const protectedInput = protectEntities(sourceText);
  const semanticConstraints = analyzeSemanticConstraints({ originalText: sourceText, protectedText: protectedInput.text, direction: "enToZh", entityMap: protectedInput.entityMap });
  const calls = [];
  const result = await executeTranslationPolicy({
    sourceText,
    mode: "chat",
    entityMap: protectedInput.entityMap,
    semanticConstraints,
    generate: async ({ attempt, correctionInstruction }) => {
      calls.push({ attempt, correctionInstruction });
      return attempt === 0
        ? { translation: "[[VERBA_ENTITY_0]]，麻烦帮忙看下这个。", englishMeaning: "[[VERBA_ENTITY_0]], could you please help look at this." }
        : { translation: "麻烦你让[[VERBA_ENTITY_0]]看一下这个。", englishMeaning: "You are politely asking the listener to ask [[VERBA_ENTITY_0]] to check something." };
    }
  });
  assert.equal(calls.length, 2);
  assert.match(calls[1].correctionInstruction, /semantic roles/);
  assert.equal(result.translation, "麻烦你让David看一下这个");
  assert.match(result.englishMeaning, /listener to ask David/);
});

test("OpenAI, Gemini, and DeepSeek share the same entity restoration path", async () => {
  for (const provider of ["OpenAI", "Gemini", "DeepSeek"]) {
    const result = await translateWithMockedProvider("Nana asked David to check the Bybit UID.", "[[VERBA_ENTITY_0]]让[[VERBA_ENTITY_1]]查一下[[VERBA_ENTITY_2]] [[VERBA_ENTITY_3]]。");
    assert.equal(result.translation, "Nana让David查一下Bybit UID", provider);
  }
});

test("regenerates once if a placeholder is lost and never returns transliterated names", async () => {
  const protectedInput = protectEntities("Nana asked David");
  const calls = [];
  const result = await executeTranslationPolicy({
    sourceText: "Nana asked David",
    mode: "chat",
    entityMap: protectedInput.entityMap,
    generate: async ({ attempt, correctionInstruction }) => {
      calls.push({ attempt, correctionInstruction });
      return attempt === 0
        ? { translation: "娜娜询问大卫。", englishMeaning: "Nana asked David." }
        : { translation: "[[VERBA_ENTITY_0]]询问[[VERBA_ENTITY_1]]。", englishMeaning: "[[VERBA_ENTITY_0]] asked [[VERBA_ENTITY_1]]." };
    }
  });
  assert.equal(calls.length, 2);
  assert.match(calls[1].correctionInstruction, /Nana/);
  assert.equal(result.translation, "Nana询问David");
});

test("throws after one retry if placeholders remain missing", async () => {
  const protectedInput = protectEntities("Nana asked David");
  let calls = 0;
  await assert.rejects(executeTranslationPolicy({
    sourceText: "Nana asked David",
    mode: "chat",
    entityMap: protectedInput.entityMap,
    generate: async () => {
      calls += 1;
      return { translation: "娜娜询问大卫。", englishMeaning: "Nana asked David." };
    }
  }), (error) => error.status === 422);
  assert.equal(calls, 2);
});

test("rejects added regional slang only in Team chat", () => {
  for (const forbidden of TEAM_CHAT_FORBIDDEN_TERMS) {
    const result = validateTranslationPolicy({ translation: `麻烦${forbidden}看下`, sourceText: "please check this", mode: "chat", entityMap: [] });
    assert.ok(result.styleViolations.includes(forbidden), `expected ${forbidden} to be rejected`);
  }
  const email = validateTranslationPolicy({ translation: "姐们儿", sourceText: "colleague", mode: "email", entityMap: [] });
  assert.equal(email.valid, true);
});

test("requires a leading name to remain a direct addressee", () => {
  const { entityMap } = protectEntities("Nana pls check this transaction");
  const validation = validateTranslationPolicy({ translation: "麻烦 Nana 帮忙看下这笔交易", sourceText: "Nana pls check this transaction", mode: "chat", entityMap });
  assert.deepEqual(validation.styleViolations, ["direct-address:Nana"]);
});
