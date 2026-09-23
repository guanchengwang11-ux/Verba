import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createTranslationDiagnosticSession } from '../translation-diagnostics.mjs';
import groq, { groqError, groqRequestBody, GROQ_TEXT_MODELS } from '../providers/groq-provider.mjs';
import { ModelManager, modelManager } from '../model-manager.mjs';
import { startServer } from '../server.mjs';
import { protectEntities } from '../entity-protection.mjs';
import { protectEmail, EMAIL_STRATEGY } from '../email-strategy.mjs';

test('Groq uses documented chat parameters and existing email schema; errors never echo secrets', () => {
  for (const model of GROQ_TEXT_MODELS) {
    const body = groqRequestBody(model, 'source', `Strategy ${EMAIL_STRATEGY}.`);
    for (const forbidden of ['store', 'thinking', 'max_tokens', 'logprobs', 'metadata', 'n']) assert.equal(body[forbidden], undefined);
    if (model.startsWith('openai/')) assert.ok(body.response_format.json_schema.schema.properties.sourceNotes);
    else assert.equal(body.response_format.type, 'json_object');
  }
  for (const [status, code, expected] of [[401,'invalid_api_key','INVALID_API_KEY'],[403,'permission_denied','PERMISSION_DENIED'],[404,'model_not_found','MODEL_NOT_FOUND'],[400,'invalid_request_error','PROVIDER_PARAMETER_ERROR'],[429,'rate_limit_exceeded','PROVIDER_RATE_LIMIT'],[429,'insufficient_quota','PROVIDER_QUOTA_ERROR'],[0,'','PROVIDER_NETWORK_ERROR']]) {
    const error = groqError(status, { error: { code, message: 'gsk_DO_NOT_EXPOSE source text' } });
    assert.equal(error.internalCode, expected); assert.doesNotMatch(JSON.stringify(error), /DO_NOT_EXPOSE|source text/);
  }
});

test('Groq full HTTP pipeline, four routes, isolation, persistence, connection failures and budget', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'verba-groq-'));
  const oldEnv = Object.fromEntries(['OPENAI_API_KEY','GEMINI_API_KEY','DEEPSEEK_API_KEY','GROQ_API_KEY'].map(k => [k, process.env[k]]));
  for (const key of Object.keys(oldEnv)) delete process.env[key];
  await writeFile(join(dir,'.env'), 'OPENAI_API_KEY=synthetic-old-key\nGEMINI_API_KEY=synthetic-gemini\nDEEPSEEK_API_KEY=synthetic-deepseek\n');
  const originalFetch = globalThis.fetch;
  let answer = { translation: '你好', englishMeaning: 'Hello' }, failure = null, calls = [];
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).startsWith('http://127.0.0.1:')) return originalFetch(url,options);
    assert.ok(String(url).startsWith('https://api.groq.com/openai/v1/'), 'No other provider is contacted');
    calls.push({ url, body: options.body ? JSON.parse(options.body) : null });
    if (failure && !String(url).endsWith('/models')) return Response.json({ error: { code: failure.code, message: 'synthetic-secret-never-log' } }, { status: failure.status });
    if (String(url).endsWith('/models')) return Response.json({ data: [...GROQ_TEXT_MODELS, 'whisper-large-v3', 'groq/compound', 'qwen/qwen3.8-27b', 'unknown-preview'].map(id=>({id,active:true})) });
    return Response.json({ model: JSON.parse(options.body).model, choices: [{ message: { content: JSON.stringify(answer) }, finish_reason: 'stop' }] });
  };
  const server = await startServer({ configurationDirectory: dir, port: 0 });
  t.after(async () => { globalThis.fetch = originalFetch; for (const [k,v] of Object.entries(oldEnv)) if (v === undefined) delete process.env[k]; else process.env[k]=v; await new Promise(r=>server.close(r)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const api = async (path, body) => { const response = await fetch(base+path,body ? { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body) } : {}); return { status:response.status, data:await response.json() }; };
  modelManager.state.providers.openai.manualOverride = 'legacy-model';
  const before = JSON.stringify(modelManager.state.providers.openai);
  let saved = await api('/api/config',{keys:{groq:'synthetic-groq-key',openai:'',gemini:'',deepseek:''}});
  assert.equal(saved.status,200); assert.deepEqual(saved.data.keys,{openai:true,gemini:true,deepseek:true,groq:true});
  assert.deepEqual(saved.data.models.groq.models,GROQ_TEXT_MODELS);
  assert.equal(saved.data.models.groq.primaryModel,'openai/gpt-oss-20b');
  assert.equal(JSON.stringify(modelManager.state.providers.openai),before);
  assert.equal(process.env.OPENAI_API_KEY,'synthetic-old-key');
  delete process.env.GROQ_API_KEY;
  const restarted = spawnSync(process.execPath, ['--input-type=module', '-e', `import {startServer} from './server.mjs';const s=await startServer({configurationDirectory:process.argv[1],port:0});console.log(JSON.stringify({groq:process.env.GROQ_API_KEY==='synthetic-groq-key',legacy:process.env.OPENAI_API_KEY==='synthetic-old-key'}));s.close();`, dir], {encoding:'utf8'});
  assert.equal(restarted.status,0); assert.deepEqual(JSON.parse(restarted.stdout),{groq:true,legacy:true});
  const second = await startServer({configurationDirectory:dir,port:0});
  await new Promise(r=>second.close(r));
  assert.equal(process.env.GROQ_API_KEY,'synthetic-groq-key','Saved key reloads from isolated configuration');
  const reopened = new ModelManager({configurationDirectory:dir}); await reopened.initialize();
  assert.equal(reopened.getStatus().groq.primaryModel,'openai/gpt-oss-20b');
  assert.equal(reopened.getStatus().openai.manualOverride,'legacy-model');
  for (const mode of ['chat','email']) for (const direction of ['enToZh','zhToEn']) {
    const text = direction === 'enToZh' ? 'I paid David 50 USD.' : '我向David转了50美元。';
    const translation = direction === 'enToZh' ? '我向David支付了50美元。' : 'I transferred 50 USD to David.';
    const special = mode==='email' && direction==='zhToEn';
    const glossary = [{source:'David',target:'David',preserveExactly:true}];
    const protectedInput = special ? protectEmail(text,glossary) : protectEntities(text,glossary);
    const tokenized = value => protectedInput.entityMap.reduce((s,e)=>s.replaceAll(e.original,e.token),value);
    answer = { translation: tokenized(translation), englishMeaning: tokenized('I transferred 50 USD to David.'), ...(special ? {sourceNotes:[],status:'translated'} : {}) };
    calls=[];
    const result = await api('/api/translate',{text,mode,direction,provider:'groq',glossary});
    assert.equal(result.status,200,JSON.stringify(result.data));
    assert.match(result.data.translation,/David/); assert.doesNotMatch(result.data.translation,/VERBA_ENTITY/); assert.equal(calls.length,1);
    assert.equal(calls[0].body.messages[1].content,protectedInput.text);
    assert.equal(calls[0].body.messages[0].content.startsWith('Strategy '+EMAIL_STRATEGY),special);
    if (special) assert.equal(result.data.strategyVersion,EMAIL_STRATEGY);
    const history=await api('/api/history',{source:text,...result.data,mode,direction,provider:'groq'});
    assert.equal(history.data.item.provider,'groq');
    const diagnostic=(await api('/api/diagnostics')).data.diagnostic;
    assert.equal(diagnostic.provider,'groq'); assert.equal(diagnostic.model,'openai/gpt-oss-20b');
  }
  answer={translation:'Expected 998 USDT, received 990 USDT, a stated shortfall of 18 USDT.',englishMeaning:'Customer states a shortfall of 18 USDT.',sourceNotes:[],status:'translated'};
  const noted=await api('/api/translate',{text:'应到账998 USDT，实际到账990 USDT，所以少了18 USDT。',mode:'email',direction:'zhToEn',provider:'groq'});
  assert.equal(noted.status,200); assert.match(noted.data.sourceNotes[0].message,/998 minus 990 equals 8/); assert.match(noted.data.translation,/18/);
  const history=await api('/api/history',{source:'应到账998 USDT，实际到账990 USDT，所以少了18 USDT。',...noted.data,mode:'email',direction:'zhToEn',provider:'groq'});
  assert.deepEqual(history.data.item.sourceNotes,noted.data.sourceNotes);
  for (const [text,wrong] of [['我向David转了50美元。','I received 50 USD from David.'],['应到账998 USDT，实际到账990 USDT，所以少了18 USDT。','Expected 998 USDT, received 990 USDT, a shortfall of 8 USDT.']]) {
    answer={translation:wrong,englishMeaning:wrong,sourceNotes:[],status:'translated'}; calls=[];
    const rejected=await api('/api/translate',{text,mode:'email',direction:'zhToEn',provider:'groq'});
    assert.equal(rejected.data.status,'review_required');assert.equal(rejected.data.translation,'');assert.equal(calls.length,2,'Only one existing targeted repair');
  }
  for(const item of [{status:401,code:'invalid_api_key',expected:'INVALID_API_KEY'},{status:404,code:'model_not_found',expected:'MODEL_NOT_FOUND'},{status:400,code:'invalid_request_error',expected:'PROVIDER_PARAMETER_ERROR'},{status:429,code:'rate_limit_exceeded',expected:'PROVIDER_RATE_LIMIT'}]) {
    failure=item; calls=[];
    const result=await api('/api/translate',{text:'Hello',mode:'chat',direction:'enToZh',provider:'groq'});
    assert.equal(result.data.errorCode,item.expected); assert.equal(calls.length,1,'No retry/fallback on deterministic errors or 429');
    assert.equal(result.data.diagnostic.provider,'groq'); assert.doesNotMatch(JSON.stringify(result),/synthetic-secret/);
    const health=await api('/api/models',{provider:'groq',action:'refresh'});
    assert.equal(health.data.models.groq.errorCode,item.expected);
  }
  failure=null; answer={translation:'你好',englishMeaning:'Hello'};
  const invalid=await api('/api/models',{provider:'groq',action:'override',model:'whisper-large-v3'});
  assert.equal(invalid.data.models.groq.errorCode,'MODEL_NOT_FOUND'); calls=[];
  assert.equal((await api('/api/translate',{text:'Hello',mode:'chat',direction:'enToZh',provider:'groq'})).data.errorCode,'MODEL_NOT_FOUND'); assert.equal(calls.length,0);
  const selected=await api('/api/models',{provider:'groq',action:'override',model:'openai/gpt-oss-120b'});
  assert.equal(selected.data.models.groq.primaryModel,'openai/gpt-oss-120b');
  calls=[]; await api('/api/translate',{text:'Hello',mode:'chat',direction:'enToZh',provider:'groq'}); assert.equal(calls[0].body.model,'openai/gpt-oss-120b');
  await api('/api/config',{keys:{groq:null}}); delete process.env.GROQ_API_KEY;
  const third=await startServer({configurationDirectory:dir,port:0}); await new Promise(r=>third.close(r));
  assert.equal((await api('/api/config')).data.keys.groq,false);
  assert.doesNotMatch(await readFile(join(dir,'.env'),'utf8'),/GROQ_API_KEY/);
  assert.match(await readFile(join(dir,'.env'),'utf8'),/OPENAI_API_KEY=synthetic-old-key/);
});

test('Groq network retries stay within the shared call and time budget', async t => {
  const old = process.env.GROQ_API_KEY; process.env.GROQ_API_KEY='synthetic-key';
  t.after(()=>{if(old===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=old;});
  let calls=0;
  const manager=new ModelManager({configurationDirectory:await mkdtemp(join(tmpdir(),'groq-budget-')),adapters:{groq:{...groq,translate:async()=>{calls++;throw groqError(0);}}}});
  await manager.initialize();
  const diagnostic=createTranslationDiagnosticSession('groq',{maxProviderAttempts:1,timeoutMs:1000});
  await assert.rejects(manager.translate({provider:'groq',text:'Hello',instructions:'JSON',diagnostics:diagnostic}),e=>e.internalCode==='PROVIDER_NETWORK_ERROR');
  assert.equal(calls,1);assert.equal(diagnostic.attempt,1);
  const expired=createTranslationDiagnosticSession('groq',{timeoutMs:1});
  expired.startedAt=Date.now()-100;
  await assert.rejects(manager.translate({provider:'groq',text:'Hello',instructions:'JSON',diagnostics:expired}),e=>e.stage==='attempt_budget');
  assert.equal(calls,1);
});
