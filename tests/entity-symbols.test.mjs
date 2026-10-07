import test from 'node:test';
import assert from 'node:assert/strict';
import {protectEntities,restoreEntities,findEntityRestorationIssues} from '../entity-protection.mjs';
import {analyzeSemanticConstraints} from '../semantic-role-protection.mjs';
import {executeTranslationPolicy} from '../translation-policy.mjs';

const report='Site: HTX\nUID: 509987654\nCoin: ONE\nNetwork: ONE\nAmount: 1,440,269.6 ONE\nTime: 2026-08-12 14:09:25\nOrder ID: 100998877\nTXID:0x'+'ab12'.repeat(16)+'\n\nIssue: The customer\'s deposit has not been credited. The withdrawal was made via the ONE network, while the HTX deposit address shows ERC20. The project may have changed the deposit network. Please help check whether the network change caused the deposit not to be credited. Thank you.';

test('structured deposit reports preserve UID, Order ID and TXID without substring count errors',async()=>{
  const p=protectEntities(report);
  const translation=restoreEntities(p.text,p.entityMap).replace('Site:','平台：').replace('Order ID:','订单ID：').replace('Issue:', '问题：');
  assert.deepEqual(findEntityRestorationIssues(translation,p.entityMap),[]);
  let calls=0;
  const result=await executeTranslationPolicy({sourceText:report,mode:'email',entityMap:p.entityMap,
    semanticConstraints:analyzeSemanticConstraints({originalText:report,protectedText:p.text,direction:'enToZh',entityMap:p.entityMap}),
    generate:async()=>{calls++;return {translation,englishMeaning:report};}});
  assert.equal(calls,1,'An intact report must not regenerate because ID is inside UID/TXID');
  assert.ok(result.translation.includes('100998877'));assert.ok(result.translation.includes('0x'+'ab12'.repeat(16)));
});

test('special-character entities are counted by whole nonoverlapping spans',()=>{
  for(const source of ['Use $USDT, not USDT.','UID: 1234\nAmount: $1234.50','UID: 1234\nAmount: 1234美元','Keep the literal "$&" unchanged.','Keep the literal "$$" unchanged.','Keep the literal "$1" unchanged.','Keep the literal "a+b?" unchanged.']){
    const p=protectEntities(source);assert.equal(restoreEntities(p.text,p.entityMap),source);
    assert.deepEqual(findEntityRestorationIssues(source,p.entityMap),[],source);
  }
  const p=protectEntities('UID: 1234\nAmount: $1234.50');
  assert.ok(findEntityRestorationIssues('UID: 9999\nAmount: $1234.50',p.entityMap).some(i=>i.original==='1234'&&i.actualCount===0),'Amount digits cannot rescue a changed UID');
});

test('whole-entity checks still reject missing, duplicated, changed and leaked identifiers',()=>{
  const source='UID: 12345678\nOrder ID: 98765432\nTXID: 0xabcdef1234567890',p=protectEntities(source);
  for(const wrong of [source.replace('Order ID:','订单编号：'),source.replace('12345678','12345679'),source.replace('0xabcdef1234567890','0xabcdef1234567891'),source+'\nOrder ID: 98765432',source+' [[VERBA_ENTITY_99]]']){
    assert.ok(findEntityRestorationIssues(wrong,p.entityMap).length,wrong);
  }
  const names=protectEntities('Please ask David to contact Davidson.');
  assert.deepEqual(findEntityRestorationIssues('请让David联系Davidson',names.entityMap),[]);
  assert.ok(findEntityRestorationIssues('请联系Davidson',names.entityMap).some(i=>i.original==='David'&&i.actualCount===0));
});

test('dollar amounts and literal dollar signs traverse the existing complete policy unchanged',async()=>{
  for(const direction of ['enToZh','zhToEn'])for(const mode of ['email','chat']){
    const source=direction==='enToZh'?'Please send $100 and $1,000.50. The symbol is $.':'请发送100美元和1,000.50美元。符号是$。';
    const translation=direction==='enToZh'?'请发送100美元和1,000.50美元，符号是$':'Please send $100 and $1,000.50. The symbol is $';
    const p=protectEntities(source);let calls=0;
    const result=await executeTranslationPolicy({sourceText:source,mode,entityMap:p.entityMap,
      semanticConstraints:analyzeSemanticConstraints({originalText:source,protectedText:p.text,direction,entityMap:p.entityMap}),
      generate:async()=>{calls++;return {translation,englishMeaning:source};}});
    assert.equal(calls,1);assert.equal(result.translation,translation);
  }
  const source='Send $100.',p=protectEntities(source);let calls=0;
  await assert.rejects(executeTranslationPolicy({sourceText:source,mode:'email',entityMap:p.entityMap,
    semanticConstraints:analyzeSemanticConstraints({originalText:source,protectedText:p.text,direction:'enToZh',entityMap:p.entityMap}),
    generate:async()=>{calls++;return {translation:'发送200美元',englishMeaning:source};}}),error=>error.internalCode==='SEMANTIC_VALIDATION_FAILED');
  assert.equal(calls,2,'Changed amounts remain blocked after the existing single repair');
});
