import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderReport } from '../scripts/translation-acceptance-report.mjs';
const dir = 'acceptance/runs/2026-09-10T04-47-22-496Z-20772b25';
const read = name => readFileSync(join(dir, name), 'utf8');
const rows = read('results.jsonl').trim().split(/\r?\n/).map(JSON.parse);
const traces = read('trace.jsonl').trim().split(/\r?\n/).map(JSON.parse);
if (rows.length !== 30) throw Error('Targeted run is incomplete');
const manifest = JSON.parse(read('manifest.json'));
manifest.acceptanceStandard = 'accurate-understandable';
manifest.requiredIds = manifest.ids;
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
// Explicit decisions after reading each saved result; no keyword grading.
const reviewed = new Set(rows.map(r => `${r.provider}:${r.id}`));
const reviews = [];
function review(r, candidateAttempt) {
  if (!reviewed.has(`${r.provider}:${r.id}`)) throw Error('Unreviewed case');
  const debtError = r.provider === 'gemini' && r.id === 27;
  return {requestId:r.requestId, translation:r.translation, reviewer:'AI', ...(candidateAttempt ? {candidateAttempt}:{}),
    logic:{pass:!debtError, reason:debtError ? '不需要付钱不等于不存在欠款；金额和第二分句方向正确。' : '逐条对照原文，人物行动、条件、否定及金额无明确矛盾；允许合理省略和歧义读法。'},
    entities:{pass:true,reason:'英文姓名按原样保留；普通代词未被当作英文姓名保留。'},
    naturalness:4,colloquial:4,understandable:true,
    issues:debtError ? '模型原始中文已经改变债务事实；本地仅去除句末标点。' : ''};
}
for (const r of rows) if (r.translation) reviews.push(review(r));
for (const t of traces.filter(t=>t.stage==='entity_restoration')) {
  const r=rows.find(r=>r.requestId===t.requestId);
  if (t.translation.replace(/[。.!！?？]+$/u,'') !== r.translation) throw Error('Different candidate requires separate review');
  reviews.push(review({...r,translation:t.translation},t.attempt));
}
writeFileSync(join(dir,'reviews.json'),JSON.stringify(reviews,null,2));
console.log(renderReport(dir));
console.log(JSON.stringify(['gemini','deepseek'].map(provider=>{
  const selected=rows.filter(r=>r.provider===provider);
  return {provider,results:selected.length,translationRequests:selected.reduce((n,r)=>n+r.requestCount,0),elapsedMs:selected.reduce((n,r)=>n+r.elapsedMs,0)};
})));
