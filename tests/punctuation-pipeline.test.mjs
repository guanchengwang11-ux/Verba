import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {startServer} from '../server.mjs';import {modelManager} from '../model-manager.mjs';
import {PUNCTUATION_STYLE} from '../translation-punctuation.mjs';

test('global punctuation runs after layout/entity restoration for every provider, mode, direction and layout setting',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'verba-punctuation-pipeline-')),original=modelManager.translate,calls=[];
  const legacy={id:'legacy',source:'Existing source.',translation:'原有记录。',englishMeaning:'Existing source.',mode:'chat',direction:'enToZh'};
  await writeFile(join(directory,'translation-history.json'),JSON.stringify([legacy]));
  let current,lines;
  modelManager.translate=async request=>{
    calls.push(request);
    const markers=request.text.match(/\[\[VERBA_LAYOUT_[a-f0-9]+_\d+\]\]/gu)||[];
    const translation=markers.length?markers.map((marker,index)=>marker+lines[index]).join(''):lines.join('\n\n');
    return {rawOutput:JSON.stringify({translation,englishMeaning:'The deposit has not arrived. Please check.',...(current.mode==='email'&&current.direction==='zhToEn'?{sourceNotes:[],status:'translated'}:{})})};
  };
  const server=await startServer({configurationDirectory:directory,port:0});
  t.after(async()=>{modelManager.translate=original;await new Promise(resolve=>server.close(resolve));});
  const api=async(path,body)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}`+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});return {status:response.status,data:await response.json()};};
  for(const provider of ['gemini','groq','openai','deepseek'])for(const mode of ['neutral','chat','email'])for(const direction of ['enToZh','zhToEn'])for(const preserveLayout of [undefined,false,true]){
    const en=direction==='zhToEn';
    current={provider,mode,direction,text:en?'请检查50 USDT的入金，还没到账。\n\n请核实，谢谢。':'Please check the deposit of 50 USDT. It has not arrived yet!\n\nPlease verify. Thank you.',glossary:[],...(preserveLayout!==undefined?{preserveLayout}:{})};
    lines=en?['Please check the deposit of 50 USDT. It has not arrived yet!','Please verify. Thank you.']:['请检查50 USDT的入金。尚未到账！','请核实？谢谢。'];
    const expected=en?'Please check the deposit of 50 USDT, It has not arrived yet\n\nPlease verify, Thank you':'请检查50 USDT的入金，尚未到账\n\n请核实，谢谢';
    calls.length=0;const response=await api('/api/translate',current);
    assert.equal(response.status,200,JSON.stringify(response.data));assert.equal(calls.length,1,'No additional model/review call');
    assert.equal(response.data.translation,expected,JSON.stringify(current));
    assert.equal(response.data.englishMeaning,'The deposit has not arrived. Please check.');
    assert.equal(response.data.punctuationStyle,PUNCTUATION_STYLE);
    const saved=await api('/api/history',{source:current.text,...response.data,provider,mode,direction,preserveLayout:preserveLayout===true});
    assert.equal(saved.data.item.translation,response.data.translation);assert.equal(saved.data.item.punctuationStyle,PUNCTUATION_STYLE);
  }
  // A required target ending in a dot must not be damaged by the old sanitizer
  // on the layout-disabled branch or when persisted for clipboard/history.
  current={provider:'gemini',mode:'neutral',direction:'enToZh',text:'Brand',glossary:[{source:'Brand',target:'ACME Inc.'}],preserveLayout:false};lines=['ACME Inc.'];
  const exact=await api('/api/translate',current);assert.equal(exact.status,200);assert.equal(exact.data.translation,'ACME Inc.');assert.equal(exact.data.translationReview,undefined);
  assert.equal((await api('/api/history',{...exact.data,source:'Brand',mode:'neutral',direction:'enToZh',punctuationStyle:PUNCTUATION_STYLE})).data.item.translation,'ACME Inc.');
  const stored=JSON.parse(await readFile(join(directory,'translation-history.json'),'utf8'));assert.deepEqual(stored.find(item=>item.id==='legacy'),legacy);
});

test('email source notes and original arithmetic are separate from final prose punctuation',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'verba-punctuation-notes-')),original=modelManager.translate;
  modelManager.translate=async()=>({rawOutput:JSON.stringify({englishMeaning:'The customer states a shortfall of 18 USDT.',translation:'I should receive 998 USDT. I received 990 USDT, so I am short of 18 USDT!\n\nPlease check?',sourceNotes:[],status:'translated'})});
  const server=await startServer({configurationDirectory:directory,port:0});
  t.after(async()=>{modelManager.translate=original;await new Promise(resolve=>server.close(resolve));});
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/translate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'gemini',mode:'email',direction:'zhToEn',text:'应到账998 USDT，实际到账990 USDT，所以少了18 USDT。\n\n请核实。',glossary:[],preserveLayout:false})});
  const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));
  assert.equal(result.translation,'I should receive 998 USDT, I received 990 USDT, so I am short of 18 USDT\n\nPlease check');
  assert.equal(result.englishMeaning,'The customer states a shortfall of 18 USDT.');
  assert.equal(result.sourceNotes[0].message,'The customer states a shortfall of 18 USDT, but 998 minus 990 equals 8 USDT. The translation preserves the stated amount.');
});
