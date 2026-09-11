import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessEmail,executeEmail,protectEmail,isCustomerEmail,emailInstructions,EMAIL_STRATEGY,anchorSourceQuote} from '../email-strategy.mjs';
import {decimal,emailFacts,sourceNotes,checkEmailFacts} from '../email-facts.mjs';
import {buildInstructions,normalizeHistoryItem} from '../server.mjs';
const result=translation=>({translation,englishMeaning:'Source meaning',sourceNotes:[],status:'translated'});
test('saved correct candidates pass; wrong intent and changed source numbers block',()=>{
  const cases=JSON.parse(readFileSync(new URL('./fixtures/email-candidates.json',import.meta.url)));
  for(const c of cases)assert.equal(assessEmail(c.source,result(c.translation),protectEmail(c.source).entityMap).issues.length>0,c.shouldBlock,`case ${c.id} attempt ${c.attempt}`);
});
test('exact decimal and common colloquial amounts retain source spans',()=>{
  for(const [s,n] of [['两千五','2500'],['一千五','1500'],['一千零五','1005'],['2万5千','25000'],['2.01万','20100'],['25000.10','25000.1']])assert.equal(decimal(s),n);
  const f=emailFacts('我转了2万5千奈拉。');assert.equal(f.money[0].value,'25000');assert.equal(f.source.slice(f.money[0].start,f.money[0].end),f.money[0].raw);
  assert.deepEqual(checkEmailFacts('应为10 USDT，不低于10 USDT。','It should be 10 USDT, not less than that amount.').issues,[]);
});
test('source calculations are noted without changing translation',async()=>{
  const source='应到账998 USDT，实际到账990 USDT，所以少了18 USDT。';
  const p=result('Expected 998 USDT, received 990 USDT, a stated shortfall of 18 USDT.');
  let calls=0;const r=await executeEmail({sourceText:source,entityMap:[],generate:async()=>{calls++;return JSON.stringify(p);}});
  assert.equal(calls,1);assert.equal(r.translation,p.translation);assert.match(r.sourceNotes[0].message,/998 minus 990 equals 8/);
  assert.equal(sourceNotes(emailFacts('应到账0.30 USDT，实际到账0.10 USDT，所以少了0.20 USDT。')).length,0);
  assert.match(sourceNotes(emailFacts('1,500 USDT，也就是一万五千USDT'))[0].message,/15000/);
});
test('small injected relational reversals are detected within documented scope',()=>{
  assert.ok(checkEmailFacts('本金1000美元，利息20美元。','Principal 20 USD; interest 1000 USD.').issues.includes('financial_role_changed:principal'));
  assert.ok(checkEmailFacts('我向David转了50美元。','I received 50 USD from David.').issues.includes('payer_receiver_reversed'));
  // Unsupported third-party relationships must not be described as verified.
  assert.equal(checkEmailFacts('David给Sarah转了50美元。','Sarah paid David 50 USD.').issues.length,0);
});
test('one targeted repair maximum, anchored to the same source',async()=>{
  const source='应到账998 USDT，实际到账990 USDT，所以少了18 USDT。';let calls=0;
  const r=await executeEmail({sourceText:source,entityMap:[],generate:async({correctionInstruction})=>{calls++;if(calls===2)assert.match(correctionInstruction,/UNCHANGED ORIGINAL/);return JSON.stringify(result('Expected 998 USDT, received 990 USDT, shortfall 8 USDT.'));}});
  assert.equal(calls,2);assert.equal(r.translation,'');assert.equal(r.status,'review_required');assert.match(r.sourceNotes[0].message,/validation limitation/);
});
test('only email Chinese-to-English selects this strategy; history stores separate notes',()=>{
  assert.ok(isCustomerEmail({mode:'email',direction:'zhToEn'}));
  for(const b of [{mode:'chat',direction:'zhToEn'},{mode:'email',direction:'enToZh'},{mode:'chat',direction:'enToZh'}]){assert.equal(isCustomerEmail(b),false);assert.ok(!buildInstructions(b).includes(EMAIL_STRATEGY));}
  const item=normalizeHistoryItem({source:'原文',translation:'Text.',englishMeaning:'Meaning',mode:'email',direction:'zhToEn',strategyVersion:EMAIL_STRATEGY,sourceNotes:[{kind:'conflict',sourceQuote:'原文',message:'Conflicting source.'}],status:'translated'});
  assert.equal(item.translation,'Text.');assert.equal(item.sourceNotes[0].message,'Conflicting source.');
  assert.ok(emailInstructions({mode:'email',direction:'zhToEn'},[]).includes('Do not add greeting'));
});

test('currency replacement and identifier damage remain blocking',()=>{
  const source='请查ABO105这笔75美元扣款。';
  const entities=protectEmail(source).entityMap;
  assert.ok(assessEmail(source,result('Please check the 75 CAD charge for ABO105.'),entities).issues.some(i=>i.startsWith('currency_changed')));
  assert.ok(assessEmail(source,result('Please check the 75 USD charge for AB0105.'),entities).issues.some(i=>i.startsWith('protected_entity_missing')));
});

test('uncertain colloquial amounts are not silently parsed or used for arithmetic',()=>{
  assert.equal(decimal('两三千'),null);
  assert.deepEqual(checkEmailFacts('应到账两三千USDT，实际到账1000USDT，所以少了1000USDT。','Expected two or three thousand USDT, received 1000 USDT, so 1000 USDT is missing.').issues,[]);
  const notes=sourceNotes(emailFacts('应到账两三千USDT，实际到账1000USDT，所以少了1000USDT。'));
  assert.ok(notes.some(n=>n.kind==='ambiguity'));
  assert.ok(!notes.some(n=>n.message.includes('minus')));
});

test('citation alignment repairs a unique omitted additive particle, not facts or negation',()=>{
  assert.equal(anchorSourceQuote('我也不确定这里说的是谁欠谁，请先核实。','我不确定这里说的是谁欠谁'),'我也不确定这里说的是谁欠谁');
  assert.equal(anchorSourceQuote('我不确定这里说的是谁欠谁。','我确定这里说的是谁欠谁'),'我确定这里说的是谁欠谁');
  assert.equal(anchorSourceQuote('金额18美元。','金额8美元'),'金额8美元');
  assert.equal(anchorSourceQuote('我也不确定。我也不确定。','我不确定'),'我不确定');
});
