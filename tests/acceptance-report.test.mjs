import assert from "node:assert/strict";
import test from "node:test";
import { assessReview, renderReport } from "../scripts/translation-acceptance-report.mjs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("acceptance requires an explicit, current, complete semantic review", () => {
  const result = { requestId: "r1", translation: "她说他已经把我们的地址发给他们了" };
  assert.notEqual(assessReview(result).status, "通过");
  const review = { ...result, reviewer: "AI", logic: { pass: true, reason: "她转述、他发送、他们接收、地址属于我们" }, entities: { pass: true, reason: "所有代词按语义翻译" }, naturalness: 5, colloquial: 5 };
  assert.equal(assessReview(result, review).status, "通过");
  assert.notEqual(assessReview({...result,translation:"另一译文"}, review).status, "通过");
  assert.notEqual(assessReview(result, {...review,logic:{pass:false,reason:"方向颠倒"}}).status,"通过");
  assert.notEqual(assessReview(result, {...review,colloquial:3}).status,"通过");
  const releaseReview = {...review, naturalness:3, colloquial:2, understandable:true};
  assert.equal(assessReview(result, releaseReview, "accurate-understandable").status,"通过");
  assert.notEqual(assessReview(result, {...releaseReview, understandable:false}, "accurate-understandable").status,"通过");
  assert.notEqual(assessReview(result, {...releaseReview, logic:{pass:false,reason:"欠款关系错误"}}, "accurate-understandable").status,"通过");
  assert.notEqual(assessReview(result, {...releaseReview, entities:{pass:false,reason:"代词变成姓名"}}, "accurate-understandable").status,"通过");
  assert.notEqual(assessReview(result, {...review,entities:{pass:true,reason:""}}).status,"通过");
});

test("a successful duplicate cannot hide a failed attempt in the acceptance gate", () => {
  const dir = mkdtempSync(join(tmpdir(), "verba-report-gate-"));
  const results = Array.from({length:36}, (_,i) => ({id:i+1,provider:"test",requestId:`r${i}`,translation:"用于验证报告状态的占位数据"}));
  const reviews = results.map(r=>({...r,reviewer:"AI",logic:{pass:true,reason:"报告状态测试"},entities:{pass:true,reason:"报告状态测试"},naturalness:4,colloquial:4}));
  writeFileSync(join(dir,"manifest.json"),JSON.stringify({providers:["test"],label:"gate unit test",runId:"test"}));
  writeFileSync(join(dir,"reviews.json"),JSON.stringify(reviews));
  writeFileSync(join(dir,"results.jsonl"),results.map(r=>JSON.stringify(r)).join("\n"));
  assert.equal(renderReport(dir).fullCoverage,true);
  results.push({id:1,provider:"test",requestId:"failed-duplicate",translation:null,status:"failed"});
  writeFileSync(join(dir,"results.jsonl"),results.map(r=>JSON.stringify(r)).join("\n"));
  assert.equal(renderReport(dir).fullCoverage,false);
});
