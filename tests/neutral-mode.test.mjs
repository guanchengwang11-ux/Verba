import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {buildInstructions,startServer,normalizeHistoryItem} from '../server.mjs';
import {modelManager} from '../model-manager.mjs';
import {NEUTRAL_STYLE_INSTRUCTIONS} from '../translation-policy.mjs';
import {EMAIL_STRATEGY,isCustomerEmail} from '../email-strategy.mjs';

test('neutral is independent in both directions; the four existing prompts remain unchanged',async()=>{
  const existing=JSON.parse(await readFile(new URL('./fixtures/existing-mode-prompts.json',import.meta.url),'utf8'));
  for(const {body,sha256} of existing)assert.equal(createHash('sha256').update(buildInstructions(body)).digest('hex'),sha256,`${body.mode}/${body.direction}`);
  for(const direction of ['enToZh','zhToEn']){
    const body={mode:'neutral',direction,text:'Please check the deposit.',glossary:[{source:'Deposit',target:'入金'}]};
    const instructions=buildInstructions(body);
    assert.ok(instructions.includes(NEUTRAL_STYLE_INSTRUCTIONS));
    assert.match(instructions,/balanced professional tone/);assert.match(instructions,/customers and colleagues/);
    assert.match(instructions,/Tone is secondary to fidelity/);assert.match(instructions,/Polite wording must not weaken a requirement/);
    assert.ok(!instructions.includes('polished workplace email'));assert.ok(!instructions.includes('everyday workplace chat'));
    assert.equal(isCustomerEmail(body),false);assert.ok(!instructions.includes(EMAIL_STRATEGY));
    assert.match(instructions,direction==='enToZh'?/Translate from English to Chinese/:/Translate from Chinese to English/);
    assert.match(instructions,/"source":"Deposit","target":"入金"/);
  }
});

test('neutral HTTP routes preserve glossary, names, amounts, legacy history, labels and the repair budget',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'verba-neutral-'));
  const legacy=['chat','email'].map(mode=>({id:'old-'+mode,createdAt:'2026-10-01T10:00:00Z',source:'Legacy source',translation:'旧译文',englishMeaning:'Legacy meaning',mode,direction:'enToZh',provider:'gemini'}));
  await writeFile(join(dir,'translation-history.json'),JSON.stringify(legacy));
  const oldEnv=Object.fromEntries(['OPENAI_API_KEY','GEMINI_API_KEY','DEEPSEEK_API_KEY','GROQ_API_KEY'].map(k=>[k,process.env[k]]));
  for(const key of Object.keys(oldEnv))delete process.env[key];
  const original=modelManager.translate,calls=[];let candidate;
  modelManager.translate=async request=>{
    calls.push(request);const attempt=request.diagnostics.nextAttempt();
    request.diagnostics.record({event:'translation_attempt',attempt,provider:request.provider,model:'synthetic-model',success:true,result:'success',stage:'provider_request',httpStatus:200});
    return {rawOutput:JSON.stringify(candidate),model:'synthetic-model'};
  };
  const server=await startServer({configurationDirectory:dir,port:0});
  t.after(async()=>{modelManager.translate=original;for(const [key,value] of Object.entries(oldEnv))if(value===undefined)delete process.env[key];else process.env[key]=value;await new Promise(resolve=>server.close(resolve));});
  const base=`http://127.0.0.1:${server.address().port}`;
  const api=async(path,body)=>{const response=await fetch(base+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});return {status:response.status,data:await response.json()};};
  for(const provider of ['gemini','deepseek','openai','groq'])for(const direction of ['enToZh','zhToEn']){
    const text=direction==='enToZh'?'Please ask David to check the deposit of 560 USDT.':'请让David核实560多USDT的入金。';
    const translation=direction==='enToZh'?'请让David核实这笔560 USDT入金':'Please ask David to verify the deposit of over 560 USDT';
    const glossary=[{source:'David',target:'David',preserveExactly:true},direction==='enToZh'?{source:'Deposit',target:'入金'}:{source:'入金',target:'deposit'}];
    candidate={translation,englishMeaning:'Please ask David to verify the deposit.'};calls.length=0;
    const response=await api('/api/translate',{text,mode:'neutral',direction,provider,glossary});
    assert.equal(response.status,200,JSON.stringify(response.data));assert.equal(response.data.translation,translation);
    assert.equal(calls.length,1);assert.equal(calls[0].provider,provider);assert.ok(calls[0].instructions.includes(NEUTRAL_STYLE_INSTRUCTIONS));
    assert.match(calls[0].text,/VERBA_ENTITY/);assert.doesNotMatch(response.data.translation,/VERBA_ENTITY/);assert.equal(response.data.strategyVersion,undefined);assert.equal(response.data.translationReview,undefined);
    const saved=await api('/api/history',{source:text,...response.data,mode:'neutral',direction,provider,requestId:`neutral-${provider}-${direction}`});
    assert.equal(saved.status,201);assert.equal(saved.data.item.mode,'neutral');assert.equal(saved.data.item.provider,provider);assert.equal(saved.data.item.direction,direction);
  }
  const found=(await api('/api/history?q=neutral%20communication')).data.history;
  assert.equal(found.length,8);assert.ok(found.every(item=>item.mode==='neutral'));
  assert.equal((await api('/api/history?q=%E4%B8%AD%E6%80%A7')).data.history.length,8);
  const saved=JSON.parse(await readFile(join(dir,'translation-history.json'),'utf8'));
  for(const old of legacy)assert.deepEqual(saved.find(item=>item.id===old.id),old);
  candidate={translation:'你向我支付了50美元',englishMeaning:'I paid you 50 USD.'};calls.length=0;
  const reversed=await api('/api/translate',{text:'I paid you 50 USD.',mode:'neutral',direction:'enToZh',provider:'gemini'});
  assert.equal(reversed.status,200);assert.equal(calls.length,1);assert.ok(reversed.data.translationReview.issues.some(issue=>issue.code==='participant_direction_reversed'));
  candidate={translation:'请核实561 USDT',englishMeaning:'Please check 560 USDT.'};calls.length=0;
  const corrupted=await api('/api/translate',{text:'Please check 560 USDT.',mode:'neutral',direction:'enToZh',provider:'gemini'});
  assert.equal(corrupted.status,422);assert.equal(corrupted.data.errorCode,'SEMANTIC_VALIDATION_FAILED');assert.equal(calls.length,2);
  calls.length=0;assert.equal((await api('/api/translate',{text:'Hello',mode:'unsupported',direction:'enToZh'})).status,400);assert.equal(calls.length,0);
});

test('history distinguishes identical neutral, chat and email items',()=>{
  const item={source:'Text',translation:'译文',englishMeaning:'Meaning',direction:'enToZh',provider:'gemini'};
  for(const mode of ['neutral','chat','email'])assert.equal(normalizeHistoryItem({...item,mode}).mode,mode);
});
