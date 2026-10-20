import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {ModelManager} from '../model-manager.mjs';
import {groqError} from '../providers/groq-provider.mjs';
import {createTranslationDiagnosticSession} from '../translation-diagnostics.mjs';

test('Groq recommendation verifies available Free Plan models, preserves manual choice and never falls back during translation',async()=>{
  process.env.GROQ_API_KEY='synthetic-key';const calls=[],probes=[];let failure=null;
  const adapter={supportsTextGeneration:id=>['openai/gpt-oss-120b','openai/gpt-oss-20b'].includes(id),discoverModels:async()=>['openai/gpt-oss-20b','openai/gpt-oss-120b','qwen/qwen3.8-27b','llama-3.3-70b-versatile'],healthCheck:async(_key,id)=>{probes.push(id);return {latencyMs:id.endsWith('120b')?600:300};},translate:async(_key,id)=>{calls.push(id);if(failure)throw failure;return {rawOutput:'{"translation":"你好","englishMeaning":"Hello"}',latencyMs:300};}};
  const manager=new ModelManager({configurationDirectory:await mkdtemp(join(tmpdir(),'verba-groq-choice-')),adapters:{groq:adapter}});await manager.initialize();
  const other=JSON.stringify(manager.state.providers.openai);
  await manager.refresh('groq',{force:true});assert.equal(manager.getStatus().groq.selectedModel,'openai/gpt-oss-120b');assert.equal(probes.length,2);
  assert.deepEqual(manager.getStatus().groq.modelChoices.map(c=>c.id),['openai/gpt-oss-120b','openai/gpt-oss-20b']);
  await manager.selectGroqModel('openai/gpt-oss-20b');const before=probes.length;
  await manager.translate({provider:'groq',text:'Hello',instructions:'Return JSON.'});assert.equal(calls.at(-1),'openai/gpt-oss-20b');assert.equal(probes.length,before);
  failure=groqError(429);calls.length=0;
  await assert.rejects(manager.translate({provider:'groq',text:'Hello',instructions:'Return JSON.',diagnostics:createTranslationDiagnosticSession('groq')}),e=>e.internalCode==='PROVIDER_RATE_LIMIT');assert.deepEqual(calls,['openai/gpt-oss-20b']);
  await assert.rejects(manager.selectGroqModel('qwen/qwen3.8-27b'));assert.equal(manager.state.providers.groq.manualOverride,'openai/gpt-oss-20b');
  const reopened=new ModelManager({configurationDirectory:manager.configurationDirectory,adapters:{groq:adapter}});await reopened.initialize();assert.equal(reopened.getStatus().groq.selectedModel,'openai/gpt-oss-20b');assert.equal(JSON.stringify(reopened.state.providers.openai),other);
});

test('an explicitly checked unavailable Groq 120B is not advertised as the best available choice',async()=>{
  process.env.GROQ_API_KEY='synthetic-key';const calls=[];const adapter={supportsTextGeneration:()=>true,discoverModels:async()=>['openai/gpt-oss-120b','openai/gpt-oss-20b'],healthCheck:async(_key,id)=>{if(id.endsWith('120b'))throw groqError(404);return {latencyMs:300};},translate:async(_key,id)=>{calls.push(id);return {rawOutput:'{"translation":"你好","englishMeaning":"Hello"}',latencyMs:300};}};
  const manager=new ModelManager({configurationDirectory:await mkdtemp(join(tmpdir(),'verba-groq-unavailable-')),adapters:{groq:adapter}});await manager.initialize();await manager.refresh('groq',{force:true});
  assert.equal(manager.getStatus().groq.selectedModel,'openai/gpt-oss-20b');assert.equal(manager.getStatus().groq.modelChoices[0].id,'openai/gpt-oss-20b');assert.equal(manager.getStatus().groq.modelChoices[0].recommended,true);
  const reopened=new ModelManager({configurationDirectory:manager.configurationDirectory,adapters:{groq:adapter}});await reopened.initialize();
  assert.equal(reopened.getStatus().groq.selectedModel,'openai/gpt-oss-20b');
  await reopened.translate({provider:'groq',text:'Hello',instructions:'Return JSON.'});assert.deepEqual(calls,['openai/gpt-oss-20b']);
});
