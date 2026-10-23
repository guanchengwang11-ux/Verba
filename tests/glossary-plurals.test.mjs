import test from 'node:test';import assert from 'node:assert/strict';
import {activeGlossary,glossaryOccurrences,glossaryInstruction} from '../glossary.mjs';
import {protectEntities,restoreEntities} from '../entity-protection.mjs';
import {finalTranslationCheck} from '../translation-final-check.mjs';
import {buildInstructions} from '../server.mjs';
import {startServer} from '../server.mjs';
import {modelManager} from '../model-manager.mjs';
import {mkdtemp} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';

const source="Hi, Some XMR withdrawals appear to be stuck. Could you please help check and process the pending withdrawals? Thank you.";
const glossary=[{source:'withdraw',target:'提现'},{source:'withdrawal',target:'提现'},{source:'pending',target:'处理中'}];

test('screenshot regular plural activates the noun mapping in prompts and missing-target review',()=>{
  const active=activeGlossary(source,glossary);
  assert.deepEqual(active.map(e=>e.source),['withdrawal','pending']);
  assert.deepEqual(active[0].occurrences.map(span=>source.slice(span.start,span.end)),['withdrawals','withdrawals']);
  for(const mode of ['neutral','chat','email']){
    const prompt=buildInstructions({text:source,mode,direction:'enToZh',glossary});
    assert.match(prompt,/"source":"withdrawal","target":"提现","matchedSourceForms":\["withdrawals"\]/u);
    assert.doesNotMatch(prompt,/"source":"withdraw","target"/u,'No verb-to-noun derivation');
  }
  const incorrect=finalTranslationCheck({sourceText:source,translation:'您好，有一些 XMR 取款似乎卡住了，请您检查并处理这些处理中取款',direction:'enToZh',glossary});
  assert.deepEqual(incorrect.issues,[{code:'glossary_target_missing',sourceTerm:'withdrawal',requiredTarget:'提现'}]);
  assert.equal(finalTranslationCheck({sourceText:source,translation:'您好，有一些 XMR 提现似乎卡住了，请协助核实并处理这些处理中的提现，谢谢',direction:'enToZh',glossary}),null);
});

test('regular noun plurals and phrases ignore capitalization without rewriting source offsets',()=>{
  for(const [term,forms] of [['withdrawal',['withdrawals','Withdrawals','WITHDRAWALS']],['Deposit',['deposits','DEPOSITS']],['case',['cases']],['private key',['private keys','PRIVATE KEYS']],['policy',['policies']],['address',['addresses']],['status',['statuses']]]){
    for(const form of forms){const text='Check '+form+' now',entry=activeGlossary(text,[{source:term,target:'指定译文'}])[0];assert.equal(entry.source,term);assert.equal(entry.occurrences[0].value,form);assert.equal(text.slice(entry.occurrences[0].start,entry.occurrences[0].end),form);}
  }
});

test('explicit plural entries outrank aliases regardless of dictionary order, and longer phrases still win',()=>{
  const singular={source:'withdrawal',target:'提现'},plural={source:'withdrawals',target:'出金'};
  for(const entries of [[singular,plural],[plural,singular]])assert.deepEqual(activeGlossary('withdrawals',entries).map(e=>e.target),['出金']);
  const entries=[...glossary,{source:'pending withdrawal',target:'待处理提现'}];
  const active=activeGlossary('pending withdrawals and another withdrawal',entries);
  assert.deepEqual(active.map(e=>e.source),['withdrawal','pending withdrawal']);
  assert.equal(active.find(e=>e.source==='withdrawal').occurrences.length,1);
  assert.equal(active.find(e=>e.source==='pending withdrawal').occurrences[0].value,'pending withdrawals');
});

test('source matching never expands preservation rules, identifiers, substrings or already-plural futures',()=>{
  for(const entry of [{source:'Cloud',preserveExactly:true},{source:'Cloud',target:'Cloud'},{source:'Cloud',target:'Do not translate'},{source:'Cloud',target:'原样保留'}]){
    assert.equal(activeGlossary('Clouds',[entry]).length,0);
    const protectedInput=protectEntities('Clouds Cloud',[entry]);assert.equal(protectedInput.entityMap.length,1);assert.equal(restoreEntities(protectedInput.text,protectedInput.entityMap),'Clouds Cloud');
  }
  for(const text of ['prewithdrawals','withdrawalsABC','withdrawals_1','withdrawalRequest','withdrawal','withdrawals'])assert.equal(activeGlossary(text,[{source:'withdraw',target:'提现'}]).length,0,text);
  assert.equal(activeGlossary('future futureses',[{source:'futures',target:'合约'}]).length,0);
  assert.equal(activeGlossary('uses',[{source:'US',target:'美国'}]).length,0);
});

test('URL, address, file, mention and explicit literal contexts do not acquire plural mappings',()=>{
  const text='https://withdrawals.example user@withdrawals.example `withdrawals` username "withdrawals" withdrawals.csv withdrawals.rar withdrawals.tsx @withdrawals';
  assert.deepEqual(activeGlossary(text,glossary),[]);
  assert.equal(glossaryInstruction(text,glossary),'');
});

test('strict target and entity spelling do not inherit source plural aliases',()=>{
  assert.deepEqual(glossaryOccurrences('withdrawals','withdrawal',{ignoreCase:false}),[]);
  assert.deepEqual(glossaryOccurrences('depositary deposits redeposit','Deposit'),[]);
  const result=finalTranslationCheck({sourceText:'提现记录',translation:'withdrawals records',direction:'zhToEn',glossary:[{source:'提现',target:'withdrawal'}]});
  assert.equal(result.issues[0].code,'glossary_target_missing');
});

test('all providers and scenes send plural glossary requirements and warn instead of silently replacing a rejected candidate',async t=>{
  const original=modelManager.translate,calls=[];let bad=false;
  modelManager.translate=async request=>{
    calls.push(request);
    return {rawOutput:JSON.stringify({translation:bad?'您好，有一些 XMR 取款似乎卡住了，请协助处理这些处理中取款，谢谢':'您好，有一些 XMR 提现似乎卡住了，请协助处理这些处理中的提现，谢谢',englishMeaning:'Some XMR withdrawals are stuck. Please check the pending withdrawals. Thank you.'})};
  };
  const server=await startServer({configurationDirectory:await mkdtemp(join(tmpdir(),'verba-plural-http-')),port:0});
  t.after(async()=>{modelManager.translate=original;await new Promise(resolve=>server.close(resolve));});
  const api=async body=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/translate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,result:await response.json()};};
  for(const provider of ['gemini','groq','openai','deepseek'])for(const mode of ['neutral','chat','email'])for(const upper of [false,true]){
    calls.length=0;const response=await api({text:upper?source.replaceAll('withdrawals','WITHDRAWALS'):source,provider,mode,direction:'enToZh',glossary,preserveLayout:true});
    assert.equal(response.status,200,JSON.stringify(response.result));assert.equal(calls.length,1);assert.equal(calls[0].provider,provider);
    assert.ok(calls[0].instructions.includes(`"matchedSourceForms":["${upper?'WITHDRAWALS':'withdrawals'}"]`));
    assert.equal(response.result.translationReview,undefined);assert.ok(response.result.translation.includes('提现'));
  }
  bad=true;calls.length=0;const response=await api({text:source,provider:'gemini',mode:'neutral',direction:'enToZh',glossary,preserveLayout:false});
  assert.equal(response.status,200);assert.equal(calls.length,1,'No new automatic model review or retry');
  assert.ok(response.result.translation.includes('取款'),'No context-free synonym replacement');
  assert.deepEqual(response.result.translationReview.issues,[{code:'glossary_target_missing',sourceTerm:'withdrawal',requiredTarget:'提现'}]);
});
