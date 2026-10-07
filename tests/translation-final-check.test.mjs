import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { activeGlossary, glossaryOccurrences } from '../glossary.mjs';
import { protectEntities, restoreEntities } from '../entity-protection.mjs';
import { finalTranslationCheck, attachFinalTranslationCheck } from '../translation-final-check.mjs';
import { buildInstructions, normalizeHistoryItem } from '../server.mjs';
import { EMAIL_STRATEGY } from '../email-strategy.mjs';
const glossary=[{source:'coin',target:'金币'},{source:'case',target:'案例'},{source:'Deposit',target:'入金'}];
const screenshot={sourceText:"hi, we'll verify the deposit if we need any additional information ,well let you know. thank you for your patience",translation:'我们将核实入金，若需要任何补充信息，会及时告知您。感谢您的耐心等待',direction:'enToZh',glossary};
const check=(sourceText,translation,direction='enToZh',entries=[])=>finalTranslationCheck({sourceText,translation,direction,glossary:entries,protectedInput:protectEntities(sourceText,entries)});

test('source glossary matching ignores capitalization while targets stay exact',()=>{
  for(const source of ['deposit','Deposit','DEPOSIT']){
    assert.equal(activeGlossary('Check the '+source,glossary)[0].source,'Deposit');
    assert.equal(check('Check the '+source,'核实入金','enToZh',glossary),null);
    assert.equal(check('Check the '+source,'核实存款','enToZh',glossary).issues[0].code,'glossary_target_missing');
    const protectedInput=protectEntities('Check the '+source,glossary);
    assert.ok(protectedInput.text.includes(source),'ordinary translated entries remain readable');
    assert.ok(buildInstructions({text:'Check the '+source,mode:'email',direction:'enToZh',glossary}).includes('case-insensitively'));
  }
  assert.ok(buildInstructions({text:'存款记录',mode:'email',direction:'zhToEn',glossary:[{source:'存款',target:'deposit'}]}).includes('case-insensitively'));
  assert.equal(glossaryOccurrences('depositary deposits redeposit','Deposit').length,0);
});

test('preserve-exactly entries match case-insensitively but preserve original source spelling',()=>{
  const entries=[{source:'Ajuba',target:'Do not translate'}];
  const p=protectEntities('Contact AJUBA and ajuba.',entries);
  assert.equal(p.entityMap.length,2);
  assert.equal(restoreEntities(p.text,p.entityMap),'Contact AJUBA and ajuba.');
  const instructions=buildInstructions({text:'请联系AJUBA核实存款。',mode:'email',direction:'zhToEn',glossary:entries},protectEntities('请联系AJUBA核实存款。',entries).entityMap);
  assert.ok(instructions.includes('AJUBA'));assert.ok(!instructions.includes('Do not translate'),'preserve aliases never become a required translated target');
});

test('longer glossary phrases, literal contexts, repeats and absent terms do not cause false alerts',()=>{
  const entries=[{source:'case',target:'案例'},{source:'case study',target:'案例研究'}];
  assert.equal(check('Read the Case Study.','阅读案例研究','enToZh',entries),null);
  assert.equal(check('See https://coin.example and user@coin.example or `Deposit`.','查看 https://coin.example 和 user@coin.example 或 `Deposit`','enToZh',glossary),null);
  assert.equal(check('The deposit is pending. Please check the deposit.','入金待处理，请核实','enToZh',glossary),null);
  assert.equal(check('Please check the receipt.','请核对收据','enToZh',glossary),null);
  assert.equal(check('Check the case.','请查看案例库','enToZh',glossary),null);
  assert.ok(check('Check the case.','请查看案子','enToZh',glossary));
});

test('user screenshot keeps acceptable subject omission, dictionary wording and style',()=>{
  assert.equal(finalTranslationCheck(screenshot),null);
  assert.equal(check('We will let you know.','会告知您'),null);
  assert.equal(check('We will inform you.','您将收到我们的通知'),null);
  assert.equal(check('David said that Sarah told him I paid her.','David说Sarah告诉他，我付钱给她了'),null);
  assert.equal(check('If we need more information, we will let you know.','如果需要补充信息，会通知您'),null);
  assert.equal(check('We will verify the deposit.','我们会核实入金'),null);
});

test('only explicit actor and recipient reversals trigger a final warning',()=>{
  const cases=[
    ['We will inform you.','您会通知我们'],
    ["We'll let you know.",'您会告知我们'],
    ['I paid David 50 USD.','David向我支付了50美元'],
    ['We will verify the deposit.','您将核实入金'],
    ['我们会通知您。','You will inform us.','zhToEn'],
    ['我向David转了50美元。','David transferred 50 USD to me.','zhToEn'],
    ['You owe me 50 USD.','我欠你50美元']
  ];
  for(const [source,translation,direction] of cases) assert.ok(check(source,translation,direction).issues.some(issue=>issue.code==='participant_direction_reversed'),source);
  assert.equal(check('We will inform you.','我们会告诉您'),null);
  assert.equal(check('I paid David 50 USD.','我向David支付了50美元'),null);
  assert.equal(check('David paid Sarah and Sarah paid David.','Sarah给David付款，David也给Sarah付款'),null);
  assert.equal(check('We did not inform you.','您没有通知我们'),null,'complex negation is outside the new proven-frame scope');
});

test('new checks return a visible-review payload without regeneration and survive both histories',()=>{
  const events=[];
  for(const [mode,direction,source,translation,entries] of [['email','enToZh','Check the deposit.','核实存款',glossary],['chat','enToZh','We will inform you.','您会通知我们',[]],['email','zhToEn','存款记录','A savings record.',[{source:'存款',target:'deposit'}]]]){
    const result=attachFinalTranslationCheck({text:source,mode,direction,glossary:entries},{translation,englishMeaning:'meaning',...(direction==='zhToEn'?{strategyVersion:EMAIL_STRATEGY,status:'translated',sourceNotes:[]}:{})},protectEntities(source,entries),{record:event=>events.push(event)});
    assert.equal(result.translation,translation);assert.equal(result.translationReview.status,'retry_recommended');
    const item=normalizeHistoryItem({source,...result,mode,direction,provider:'gemini'});
    assert.deepEqual(item.translationReview,result.translationReview);
  }
  assert.ok(events.every(event=>event.stage==='final_critical_check'&&!event.willRegenerate));
  assert.ok(events.every(event=>!JSON.stringify(event).includes('deposit')),'diagnostics contain codes, not glossary/user text');
});

test('final checks keep normal notes and run locally with a small timing budget',()=>{
  const result={translation:screenshot.translation,englishMeaning:'meaning',sourceNotes:[{kind:'ambiguity',sourceQuote:'原文',message:'Existing source note.'}]};
  assert.equal(attachFinalTranslationCheck({text:screenshot.sourceText,direction:screenshot.direction,glossary},result,protectEntities(screenshot.sourceText,glossary)),result);
  const start=performance.now();for(let i=0;i<200;i++)finalTranslationCheck(screenshot);
  assert.ok(performance.now()-start<2000,'200 local checks must finish without model calls or network waits');
});
