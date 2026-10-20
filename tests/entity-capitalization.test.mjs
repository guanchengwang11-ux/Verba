import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {protectEntities,restoreEntities,findEntityRestorationIssues} from '../entity-protection.mjs';
import {activeGlossary} from '../glossary.mjs';
import {buildInstructions,startServer} from '../server.mjs';
import {modelManager} from '../model-manager.mjs';
import {EMAIL_STRATEGY} from '../email-strategy.mjs';

const screenshot="Teacher please this agent mistakenly top up another account, I don’t know if this resource request can work to retrieve the coins back";

test('the reported salutation stays readable instead of being forced into English',()=>{
  assert.deepEqual(protectEntities(screenshot),{text:screenshot,entityMap:[]});
});

test('ordinary salutations, roles, financial words and grammar share a case-insensitive classification',()=>{
  const sources=['Teacher, please check the deposit.','Agent please check this.','Manager said the payment is pending.','Dear Customer, please confirm the deposit.','Dear Team, please help.','Customer Service please help.','Please ask Finance to check.','Sir please help.','Doctor, please help.','Approved by Customer.','Refund please.','I have Lost access.','Customers asked for a refund.','Please ask the Supervisor to check.','You owe me 50 USD.','The deposit has not arrived.','Please have Patience.'];
  for(const source of sources)for(const text of [source,source.toLowerCase(),source.toUpperCase()]){
    const p=protectEntities(text);assert.deepEqual(p.entityMap,[],text);assert.equal(p.text,text);
  }
  for(const term of ['DePoSiT','TeAcHeR','ShE'])assert.equal(protectEntities(`${term} please check.`).text,`${term} please check.`);
});

test('all-caps prose stays readable while technical codes and named participants remain protected',()=>{
  const cases=[
    ['I AM NOT SURE.',[]],['AN UNEXPECTED INTERRUPTION OCCURRED. PLEASE CHECK.',[]],
    ['PLEASE ASK ALICE TO CONTACT BOB.',['ALICE','BOB']],
    ['KYC FAILED. PLEASE CHECK UID AND TXID ABC12345.',['KYC','UID','TXID','ABC12345']],
    ['Please contact IT team about ONE network and the US region.',['IT','ONE','US']],
    ['PLEASE CONTACT BINANCE ABOUT UID AND KYC.',['BINANCE','UID','KYC']],
    ['PLEASE CHECK HTX AND XRP AND DOGE.',['HTX','XRP','DOGE']],
    ['PLEASE ASK ALICE CHEN TO CONTACT BOB WANG.',['ALICE CHEN','BOB WANG']],
    ['Please ask MAY to contact WILL.',['MAY','WILL']]
  ];
  for(const [text,expected] of cases){const p=protectEntities(text);assert.deepEqual(p.entityMap.map(e=>e.original),expected,text);assert.equal(restoreEntities(p.text,p.entityMap),text);}
});

test('salutations and titles are outside exact personal-name spans',()=>{
  const cases=[
    ['Teacher Alice please help.',['Alice']],['Professor Lin Zhang will send the file.',['Lin Zhang']],
    ['Please contact Manager David.',['David']],['Dear Olumide Adebayo, please help.',['Olumide Adebayo']],
    ['She asked Dr. Smith to call back.',['Smith']],['May Chen asked Will Smith to check.',['May Chen','Will Smith']],
    ['Rose asked Grace to contact Nozizwe.',['Rose','Grace','Nozizwe']],['Please ask Hope to call Mark.',['Hope','Mark']],
    ['May I ask Will to help?',['Will']],['Will you ask May to check?',['May']],
    ['May 5 is the date. We will meet in May.',[]],
    ['Please contact Alice Merchant.',['Alice Merchant']],['John Friend said it is ready.',['John Friend']],
    ['Said asked David to check.',['Said','David']],['Patience asked David to check.',['Patience','David']]
  ];
  for(const [text,expected] of cases){const p=protectEntities(text);assert.deepEqual(p.entityMap.map(e=>e.original),expected,text);assert.equal(restoreEntities(p.text,p.entityMap),text);assert.deepEqual(findEntityRestorationIssues(text,p.entityMap),[]);}
});

test('explicit literal and glossary rules override inferred language without rewriting source text',()=>{
  for(const term of ['teacher','Teacher','TEACHER']){
    const text=`${term}, please check the deposit.`,glossary=[{source:'Teacher',target:'老师'}];
    assert.equal(activeGlossary(text,glossary).length,1);
    assert.equal(protectEntities(text,glossary).text,text);
    assert.match(buildInstructions({text,mode:'chat',direction:'enToZh',glossary}),/"target":"老师"/);
    const keep=protectEntities(text,[{source:'teacher',preserveExactly:true}]);
    assert.equal(keep.entityMap[0].original,term);assert.equal(restoreEntities(keep.text,keep.entityMap),text);
  }
  const text='Keep the username "Teacher" unchanged. Teacher please help.';
  const p=protectEntities(text);assert.equal(p.entityMap.length,1);assert.equal(p.entityMap[0].occurrenceCount,1);
  assert.match(p.text,/Teacher please help/);
});

test('all providers and modes use the corrected protection in the complete HTTP pipeline',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'verba-capitalization-test-'));
  const previous=modelManager.translate,calls=[];let current;
  modelManager.translate=async request=>{
    calls.push(request);
    const attempt=request.diagnostics.nextAttempt();
    request.diagnostics.record({event:'translation_attempt',attempt,provider:request.provider,model:'synthetic-model',success:true,result:'success',stage:'provider_request',httpStatus:200});
    const p=protectEntities(current.text,current.glossary||[]);
    let translation=current.translation;
    for(const e of p.entityMap)translation=translation.replaceAll(e.original,e.token);
    return {rawOutput:JSON.stringify({englishMeaning:'A literal account of the request.',translation,...(current.direction==='zhToEn'&&current.mode==='email'?{status:'translated',sourceNotes:[]}: {})})};
  };
  const server=await startServer({configurationDirectory:directory,port:0});
  t.after(async()=>{modelManager.translate=previous;await new Promise(resolve=>server.close(resolve));});
  const examples=[
    {text:'Teacher please check the deposit of 50 USDT.',translation:'老师，请核实50 USDT入金',direction:'enToZh',glossary:[{source:'Deposit',target:'入金'}]},
    {text:'Professor Lin Zhang will send the file.',translation:'Lin Zhang教授会发送文件',direction:'enToZh'},
    {text:'YOU OWE ME 50 USD.',translation:'你欠我50美元',direction:'enToZh'},
    {text:'请让Teacher核实这笔50 USDT入金。',translation:'Please ask Teacher to verify the deposit of 50 USDT.',direction:'zhToEn',glossary:[{source:'Teacher',preserveExactly:true}]}
  ];
  for(const provider of ['gemini','groq','deepseek','openai'])for(const mode of ['neutral','chat','email'])for(const example of examples){
    current={...example,provider,mode};calls.length=0;
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/translate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(current)});
    const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));
    assert.equal(result.translation,current.translation.replace(/\.$/u,''));assert.equal(calls.length,1);
    assert.equal(calls[0].provider,provider);assert.doesNotMatch(result.translation,/VERBA_ENTITY/);
    if(example.text.startsWith('Teacher')){assert.match(calls[0].text,/^Teacher please/);assert.equal(result.translationReview,undefined);}
    if(directionIsEmail(current)){assert.equal(result.strategyVersion,EMAIL_STRATEGY);assert.deepEqual(result.sourceNotes,[]);}
  }
});

function directionIsEmail(body){return body.mode==='email'&&body.direction==='zhToEn';}
