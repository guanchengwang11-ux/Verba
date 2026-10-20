import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer,normalizeHistoryItem} from '../server.mjs';
import {modelManager} from '../model-manager.mjs';
import {EMAIL_STRATEGY} from '../email-strategy.mjs';
import {groqModelChoices} from '../groq-model-catalog.mjs';

test('layout survives shared translation validation, copy data and history across all providers/modes/directions',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'verba-layout-pipeline-')),original=modelManager.translate,calls=[];
  let current,broken=false;
  modelManager.translate=async request=>{
    calls.push(request);
    const marker=request.text.match(/\[\[VERBA_LAYOUT_[a-f0-9]+_\d+\]\]/gu)||[];
    const person=request.text.match(/\[\[VERBA_ENTITY_\d+\]\]/u)?.[0]||'David';
    const lines=current.direction==='zhToEn'?[`Hello ${person}.`,'Please check 50 USDT.','Thank you.']:[`你好${person}。`,'请核实50 USDT。','谢谢。'];
    const translation=broken?lines.join(' '):marker.length?marker.map((m,i)=>m+lines[i]).join(''):lines.join(' ');
    return {rawOutput:JSON.stringify({translation,englishMeaning:'Please check the deposit.',...(current.mode==='email'&&current.direction==='zhToEn'?{status:'translated',sourceNotes:[]}: {})})};
  };
  const server=await startServer({configurationDirectory:dir,port:0});
  t.after(async()=>{modelManager.translate=original;await new Promise(resolve=>server.close(resolve));});
  const api=async(path,body)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}`+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});return {status:response.status,data:await response.json()};};
  for(const provider of ['gemini','groq','openai','deepseek'])for(const mode of ['neutral','chat','email'])for(const direction of ['enToZh','zhToEn']){
    current={provider,mode,direction,text:direction==='zhToEn'?'  你好David。\r\n\r\n\t请核实50 USDT。\r\n谢谢。\r\n':'  Hello David.\r\n\r\n\tPlease check 50 USDT.\r\nThank you.\r\n',preserveLayout:true,glossary:[{source:'David',preserveExactly:true}]};
    calls.length=0;const response=await api('/api/translate',current);
    assert.equal(response.status,200,JSON.stringify(response.data));assert.equal(calls.length,1);
    assert.equal(response.data.layoutStatus,'preserved');
    assert.equal(response.data.translation,direction==='zhToEn'?'  Hello David\r\n\r\n\tPlease check 50 USDT\r\nThank you\r\n':'  你好David\r\n\r\n\t请核实50 USDT\r\n谢谢\r\n');
    assert.doesNotMatch(JSON.stringify(response.data),/VERBA_LAYOUT|VERBA_ENTITY/);
    assert.ok(calls[0].maxOutputTokens>(mode==='email'&&direction==='zhToEn'?1600:700));
    const item=await api('/api/history',{source:current.text,...response.data,mode,direction,provider,preserveLayout:true});
    assert.equal(item.data.item.translation,response.data.translation);assert.equal(item.data.item.source,current.text);assert.equal(item.data.item.layoutStatus,'preserved');
    if(mode==='email'&&direction==='zhToEn')assert.equal(response.data.strategyVersion,EMAIL_STRATEGY);
  }
  broken=true;calls.length=0;const unmatched=await api('/api/translate',current);
  assert.equal(unmatched.status,200);assert.equal(unmatched.data.layoutStatus,'unmatched');assert.equal(calls.length,1);
  assert.doesNotMatch(unmatched.data.translation,/VERBA_LAYOUT/);
  const off=await api('/api/translate',{...current,preserveLayout:false});assert.equal(off.data.layoutStatus,'off');
  assert.equal(calls.at(-1).maxOutputTokens,undefined);assert.doesNotMatch(calls.at(-1).instructions,/layout preservation is enabled/);
  assert.equal((await api('/api/translate',{...current,preserveLayout:'true'})).status,400);
});

test('source notes remain independent of layout metadata and legacy history normalization',()=>{
  const item={source:'  请核实。\n\n谢谢。\n',translation:'  Please check.\n\nThank you.\n',englishMeaning:'Check.',sourceNotes:[{kind:'ambiguity',sourceQuote:'请核实。',message:'Please confirm the account.'}],strategyVersion:EMAIL_STRATEGY,mode:'email',direction:'zhToEn',preserveLayout:true,layoutStatus:'preserved'};
  const restored=normalizeHistoryItem(item);assert.equal(restored.source,item.source);assert.equal(restored.translation,item.translation);assert.deepEqual(restored.sourceNotes,item.sourceNotes);
  assert.doesNotMatch(restored.translation,/confirm the account/);
  const legacy=normalizeHistoryItem({...item,preserveLayout:undefined});assert.equal(legacy.translation,'Please check.\n\nThank you.');
});

test('Groq dropdown offers only stable Free Plan models, with 120B capability first and real latency only',()=>{
  const choices=groqModelChoices(['llama-3.3-70b-versatile','qwen/qwen3.8-27b','openai/gpt-oss-20b','openai/gpt-oss-120b'],{'openai/gpt-oss-20b':{status:'healthy',probeLatencyMs:450}});
  assert.deepEqual(choices.map(c=>c.id),['openai/gpt-oss-120b','openai/gpt-oss-20b']);assert.equal(choices[0].recommended,true);assert.equal(choices[0].latencyMs,null);assert.equal(choices[1].latencyMs,450);
});
