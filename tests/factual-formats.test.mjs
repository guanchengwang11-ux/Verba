import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {analyzeFactualConstraints,evaluateFactualConstraints,extractCurrencies} from '../factual-constraint-protection.mjs';
import {protectEntities,findEntityRestorationIssues} from '../entity-protection.mjs';
import {analyzeSemanticConstraints,evaluateSemanticRoles} from '../semantic-role-protection.mjs';
import {executeTranslationPolicy} from '../translation-policy.mjs';
import {sanitizeTranslationOutput} from '../translation-output.mjs';
const cases=JSON.parse(readFileSync(new URL('./fixtures/factual-format-cases.json',import.meta.url)));

test('saved correct currency, decimal, list, fraction and date candidates pass while clear corruption blocks',()=>{
  for(const c of cases){const p=protectEntities(c.text),facts=analyzeFactualConstraints(c.text,{entityMap:p.entityMap});
    const findings=evaluateFactualConstraints(c.translation,facts),entities=findEntityRestorationIssues(c.translation,p.entityMap);
    assert.equal(entities.length>0||findings.some(f=>f.severity==='block'),c.shouldBlock,c.id);
  }
});
test('the reported first candidate and saved equivalent forms need one generation, not a repair',async()=>{
  for(const c of cases.filter(c=>!c.shouldBlock)){const p=protectEntities(c.text);let calls=0;
    const result=await executeTranslationPolicy({sourceText:c.text,mode:'email',entityMap:p.entityMap,
      semanticConstraints:analyzeSemanticConstraints({originalText:c.text,protectedText:p.text,direction:'enToZh',entityMap:p.entityMap}),
      generate:async()=>{calls++;return {translation:c.translation,englishMeaning:c.text};}});
    assert.equal(calls,1,c.id);assert.equal(result.translation,sanitizeTranslationOutput(c.translation),c.id);
  }
});
test('currency scans never borrow a list number, word fragment or URL amount',()=>{
  assert.deepEqual(extractCurrencies('100 USDT\n2. Check').map(x=>x.value),['USDT:100']);
  assert.equal(extractCurrencies('100 USDTx, ABCUSD100, https://example.test/USD100').length,0);
  assert.deepEqual(extractCurrencies('USDT 100 and USD 50').map(x=>x.value),['USDT:100','USD:50']);
  for(const spelling of ['US dollars','us dollars','US DOLLARS'])assert.equal(extractCurrencies('100 '+spelling)[0].value,'USD:100');
  assert.equal(extractCurrencies('560+ USDT')[0].value,'USDT:560');
  assert.equal(extractCurrencies('560＋USDT')[0].value,'USDT:560');
  const lowerBound=analyzeFactualConstraints('超过560 USDT');
  assert.ok(!evaluateFactualConstraints('560+ USDT',lowerBound).some(f=>f.severity==='block'));
  assert.ok(evaluateFactualConstraints('650+ USDT',lowerBound).some(f=>f.severity==='block'));
  assert.equal(extractCurrencies('100 USTD').length,0,'A spelling change is not currency normalization');
});
test('malformed or uncertain numeric source text never crashes or yields guessed exact money',()=>{
  for(const text of ['0/00','1/0','1/00','两三千USDT','USDT and','USDT \n 2.','$$','NaN USDT','Infinity USDT','点USDT','点五USDT','一百点五点六USDT'])assert.doesNotThrow(()=>analyzeFactualConstraints(text));
  assert.equal(extractCurrencies('两三千USDT').length,0);
  assert.equal(extractCurrencies('一百点五点六USDT').length,0);
  assert.equal(extractCurrencies('一〇〇点五USDT')[0].value,'USDT:100.5');
  const unchanged=cases.find(c=>c.id==='repeated-unit');const warnings=evaluateFactualConstraints(unchanged.translation,analyzeFactualConstraints(unchanged.text));
  assert.ok(warnings.some(f=>f.code==='currency_repetition_unverified'&&f.severity==='warning'));
});
test('negated completion and separate requests are not cross-clause reversals; saved corruption still blocks',async()=>{
  const samples=[
    ['1. The balance is 735 USDT\n2. Please check the pending transfer of 620 USDT\n3. No withdrawal has been submitted',
      '账户余额为735 USDT。请核对金额为620 USDT的待处理转账。目前尚未提交任何提现申请'],
    ['No withdrawal has been submitted.','尚未提交任何提现申请'],
    ['We have received 100 USDT. Please check the account.','我们收到100 USDT，请核对账户']
  ];
  for(const [text,translation] of samples){const p=protectEntities(text);let calls=0;
    const semanticConstraints=analyzeSemanticConstraints({originalText:text,protectedText:p.text,direction:'enToZh',entityMap:p.entityMap});
    await executeTranslationPolicy({sourceText:text,mode:'email',entityMap:p.entityMap,semanticConstraints,
      generate:async()=>{calls++;return {translation,englishMeaning:text};}});
    assert.equal(calls,1,text);
    if(text.includes('620 USDT'))assert.ok(evaluateSemanticRoles({translation:translation.replace('620','735'),englishMeaning:text,constraints:semanticConstraints}).blocking.some(f=>f.code==='currency_or_amount_changed'));
  }
});
