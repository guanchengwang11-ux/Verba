import { activeGlossary, glossaryOccurrences } from './glossary.mjs';
import { isPreserveExactlyGlossaryEntry } from './entity-protection.mjs';
import { analyzeSemanticConstraints, evaluateSemanticRoles } from './semantic-role-protection.mjs';

const actorEn = '(?:I|me|we|us|you|he|him|she|her|they|them|[A-Z][a-z]+(?: [A-Z][a-z]+)?)';
const actorZh = '(?:我们|我|你们|您们|你|您|他们|她们|他|她|[A-Z][a-z]+(?: [A-Z][a-z]+)?)';
function actor(value, language) {
  const normalized = value.toLowerCase().trim();
  const classes = language === 'en' ? [['i','me'],['we','us'],['you'],['he','him'],['she','her'],['they','them']]
    : [['我'],['我们'],['你','您','你们','您们'],['他'],['她'],['他们','她们']];
  const index = classes.findIndex(group => group.includes(normalized));
  return index < 0 ? 'name:' + normalized : ['speaker','speakerGroup','listener','male','female','thirdParty'][index];
}

// Conservative explicit actor/recipient frames. No guessed coreference,
// gender, omitted subjects, quoted speech, passive or complex negation.
export function explicitRelations(text, language) {
  if (/["“”«»`]/u.test(text)) return [];
  const frames = [];
  for (const clause of text.split(/[.!?。！？;；,，\n]+/u)) {
    if (language === 'en' ? /\b(?:not|never|no|don't|doesn't|didn't|can't|won't|if|unless|whether)\b/iu.test(clause) : /不|没|未|别|如果|若|除非|是否/u.test(clause)) continue;
    const patterns = language === 'en' ? [
      ['verification', new RegExp(`(?:^|\\s)(${actorEn})\\s*(?:'ll|’ll|(?:will|would|can|could|have|has|had|already)\\s+)*\\s*(?:verify|verified|check|checked|review|reviewed)\\s+(?!that\\b|whether\\b)(?:the |this |your |my |our )?(?:deposit|payment|receipt|case|transaction|account)\\b`, 'gu')],
      ['notify', new RegExp(`(?:^|\\s)(${actorEn})\\s*(?:'ll|’ll|(?:will|would|can|could|have|has|had|already)\\s+)*\\s*(?:notify|notified|inform|informed|tell|told|contact|contacted)\\s+(${actorEn})(?=\\s|$)`, 'gu')],
      ['notify', new RegExp(`(?:^|\\s)(${actorEn})\\s*(?:'ll|’ll|(?:will|would|can|could)\\s+)*\\s*let\\s+(${actorEn})\\s+know\\b`, 'gu')],
      ['payment', new RegExp(`(?:^|\\s)(${actorEn})\\s+(?:(?:have|has|had|already|will)\\s+)*(?:paid|pay)\\s+(${actorEn})(?=\\s|$)`, 'gu')],
      ['payment', new RegExp(`(?:^|\\s)(${actorEn})\\s+(?:(?:have|has|had|already|will)\\s+)*(?:sent|send|transferred|transfer)\\s+(?:\\$?\\d[\\d.,]*\\s*(?:USD|USDT|dollars?)?|the money|money)\\s+to\\s+(${actorEn})(?=\\s|$)`, 'gu')],
      ['debt', new RegExp(`(?:^|\\s)(${actorEn})\\s+(?:owe|owes|owed)\\s+(${actorEn})(?=\\s|$)`, 'gu')]
    ] : [
      ['verification', new RegExp(`(${actorZh})\\s*(?:(?:已经|已|将|会|要|正在)\\s*)*(?:核实|核对|检查|审核|查看)\\s*(?:这个|这笔|您的|你的|我的|我们的)?(?:入金|存款|付款|收据|案例|交易|账户)`, 'gu')],
      ['notify', new RegExp(`(${actorZh})\\s*(?:(?:已经|已|将|会|要|及时|马上)\\s*)*(?:通知|告知|告诉|联系)\\s*(${actorZh})`, 'gu')],
      ['payment', new RegExp(`(${actorZh})\\s*(?:(?:已经|已|将|会|要)\\s*)*(?:给|向)\\s*(${actorZh})\\s*(?:支付|付|转|汇)`, 'gu')],
      ['payment', new RegExp(`(${actorZh})\\s*(?:(?:已经|已|将|会|要)\\s*)*(?:支付|付|转|汇)(?:了)?\\s*(?:\\d[\\d.,]*\\s*(?:美元|美金|USD|USDT|元)|钱|款)\\s*给\\s*(${actorZh})`, 'gu')],
      ['debt', new RegExp(`(${actorZh})\\s*(?:还)?欠\\s*(${actorZh})`, 'gu')]
    ];
    for (const [kind, pattern] of patterns) for (const match of clause.matchAll(pattern)) {
      // Case-insensitive pronouns, with case-sensitive names to avoid inventing
      // actors out of common words. Sentence starters get their usual casing.
      frames.push({kind,from:actor(match[1],language),to:kind==='verification'?'':actor(match[2],language)});
    }
  }
  return [...new Map(frames.map(frame => [JSON.stringify(frame), frame])).values()];
}

export function finalTranslationCheck({ sourceText, translation, direction, glossary = [], protectedInput, semanticConstraints }) {
  if (!translation?.trim()) return null;
  const issues = [];
  for (const entry of activeGlossary(sourceText, glossary)) {
    if (isPreserveExactlyGlossaryEntry(entry)) continue;
    if (!glossaryOccurrences(translation, entry.target, {ignoreCase:false}).length) issues.push({code:'glossary_target_missing',sourceTerm:entry.source,requiredTarget:entry.target});
  }
  const sourceRelations = explicitRelations(sourceText, direction === 'enToZh' ? 'en' : 'zh');
  const outputRelations = explicitRelations(translation, direction === 'enToZh' ? 'zh' : 'en');
  for (const source of sourceRelations) {
    const sources = sourceRelations.filter(frame => frame.kind === source.kind);
    const outputs = outputRelations.filter(frame => frame.kind === source.kind);
    // Only one unambiguous relation of each kind on both sides can prove reversal.
    if (sources.length !== 1 || outputs.length !== 1 || source.from === source.to) continue;
    const output = outputs[0];
    if (source.kind === 'verification' && ['speaker','speakerGroup','listener'].includes(source.from) && ['speaker','speakerGroup','listener'].includes(output.from) && source.from !== output.from) issues.push({code:'participant_direction_reversed'});
    if (output.from === source.to && output.to === source.from) issues.push({code:'participant_direction_reversed'});
  }
  if (protectedInput && direction === 'enToZh') {
    const constraints = semanticConstraints || analyzeSemanticConstraints({originalText:sourceText,protectedText:protectedInput.text,direction,entityMap:protectedInput.entityMap});
    // Only proven existing role inversions, never missing lexical evidence or
    // the model's englishMeaning field as an independent validation witness.
    const provenRoles = evaluateSemanticRoles({translation,englishMeaning:'',constraints}).blocking.filter(item => ['target_became_direct_addressee','actor_target_reversed'].includes(item.code));
    if (provenRoles.length) issues.push({code:'participant_direction_reversed'});
  }
  return issues.length ? {version:'local-critical-check/v1',status:'retry_recommended',issues:[...new Map(issues.map(issue => [JSON.stringify(issue),issue])).values()]} : null;
}

export function attachFinalTranslationCheck(body, result, protectedInput, diagnostics, semanticConstraints) {
  const startedAt = performance.now();
  const review = finalTranslationCheck({sourceText:body.text,translation:result.translation,direction:body.direction,glossary:body.glossary,protectedInput,semanticConstraints});
  diagnostics?.record({event:review?'translation_final_check_warning':'translation_final_check_passed',stage:'final_critical_check',severity:review?'critical':'pass',disposition:review?'warn':'allow',issueCodes:review?.issues.map(issue=>issue.code)||[],validationMs:performance.now()-startedAt,success:!review});
  return review ? {...result,translationReview:review} : result;
}
