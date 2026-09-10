import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

export function assessReview(result, review, standard = "native-chat") {
  if (!result.translation) return { status: "未测/无可交付译文" };
  if (!review || review.translation !== result.translation || review.requestId !== result.requestId || review.reviewer !== "AI") return { status: "待逐条 AI 评审" };
  if (![true, false].includes(review.logic?.pass) || !review.logic?.reason?.trim() || ![true, false].includes(review.entities?.pass) || !review.entities?.reason?.trim() || ![review.naturalness, review.colloquial].every(n => Number.isInteger(n) && n >= 1 && n <= 5)) return { status: "评审不完整" };
  const languagePass = standard === "accurate-understandable" ? review.understandable === true : review.naturalness >= 4 && review.colloquial >= 4;
  return { status: review.logic.pass && review.entities.pass && languagePass ? "通过" : "未达标", review };
}

export function renderReport(directory) {
  const manifest = JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8"));
  const jsonl = file => existsSync(join(directory, file)) ? readFileSync(join(directory, file), "utf8").trim().split(/\r?\n/).filter(Boolean).map(JSON.parse) : [];
  const traces = jsonl("trace.jsonl");
  const results = jsonl("results.jsonl");
  const ui = existsSync(join(directory, "ui-observations.json")) ? JSON.parse(readFileSync(join(directory, "ui-observations.json"), "utf8")) : [];
  if (!results.length) {
    for (const t of traces.filter(t => ["complete", "failed"].includes(t.stage))) {
      const fixture = JSON.parse(readFileSync(new URL("../acceptance/cases.json", import.meta.url), "utf8")).find(c => c.id === t.id);
      results.push({ id: t.id, provider: t.provider, source: fixture.source, requestId: t.requestId, translation: t.result?.translation ?? null, model: t.diagnostic.model, requestCount: t.diagnostic.attemptCount, providerHttpRequestCount: t.providerHttpRequestCount, elapsedMs: t.diagnostic.totalLatencyMs, errorCode: t.diagnostic.errorCode });
    }
  }
  const reviews = existsSync(join(directory, "reviews.json")) ? JSON.parse(readFileSync(join(directory, "reviews.json"), "utf8")) : [];
  const escape = x => String(x ?? "—").replaceAll("|", "\\|").replace(/\r?\n/g, "<br>");
  const lines = [`# 翻译质量验收：${manifest.label}`, "", `运行：${manifest.runId}；英文→中文；同事协作。`, "", "评审人为 AI（Codex），直接对照英文和本次实际中文；不是人工母语者验证。HTTP 成功、回译及正则校验都不代替语义与语言评审。仅适用于本次结果。", "", "请求次数列为翻译请求 / 全部供应商 HTTP 请求（包括模型发现和健康检测）；早期记录缺少后者时记为 —。耗时为毫秒。", "", "| 编号 | 供应商 / 模型 | 英文原文 | 实际交付中文 | 逻辑准确性及理由 | 姓名/代词及理由 | 自然度 | 口语化 | 问题说明 | 请求次数 | 耗时 | 结论 |", "|---|---|---|---|---|---|---|---|---|---|---|---|"];
  const statuses = [];
  for (const result of results) {
    const assessment = assessReview(result, reviews.find(r => r.requestId === result.requestId && !r.candidateAttempt), manifest.acceptanceStandard);
    const review = assessment.review;
    statuses.push({ id: result.id, provider: result.provider, status: assessment.status });
    const judged = field => review ? `${review[field].pass ? "通过" : "失败"}：${review[field].reason}` : "未评审";
    const observed = ui.find(u => u.requestId === result.requestId);
    const uiNote = observed ? observed.translation === result.translation ? "；真实界面显示一致" : "；界面显示不一致" : "";
    lines.push(`| ${[result.id, `${result.provider} / ${result.model || "未选定"}`, result.source, result.translation ?? "未生成/未交付", judged("logic"), judged("entities"), review?.naturalness, review?.colloquial, `${review?.issues || result.reason || result.errorCode || assessment.status}${uiNote}`, `${result.requestCount ?? "—"} / ${result.providerHttpRequestCount ?? "—"}`, result.elapsedMs, assessment.status].map(escape).join(" | ")} |`);
  }
  // Preserve every model candidate, including responses rejected before display.
  lines.push("", "## 所有生成尝试（含未交付结果）", "", "以下是模型返回、实体恢复后的原始候选，不能与最终显示结果混为一谈；完整原始 JSON、占位符输入和后处理结果见 trace.jsonl。候选评审同样由 AI 逐条作出，不能替代交付结果。", "", "| 请求 ID | 编号 | 供应商 | 第几次生成 | 恢复后候选（未做末尾处理） | 逻辑及理由 | 姓名/代词及理由 | 自然度 / 口语化 | 问题说明 |", "|---|---|---|---|---|---|---|---|---|");
  for (const t of traces.filter(t => t.stage === "entity_restoration")) {
    const a = assessReview(t, reviews.find(r => r.requestId === t.requestId && r.candidateAttempt === t.attempt), manifest.acceptanceStandard);
    const r = a.review;
    lines.push(`| ${[t.requestId, t.id, t.provider, t.attempt, t.translation, r ? `${r.logic.pass ? "通过" : "失败"}：${r.logic.reason}` : a.status, r ? `${r.entities.pass ? "通过" : "失败"}：${r.entities.reason}` : a.status, r ? `${r.naturalness} / ${r.colloquial}` : "未评审", r?.issues].map(escape).join(" | ")} |`);
  }
  const counts = Object.fromEntries([...new Set(statuses.map(s => s.status))].map(status => [status, statuses.filter(s => s.status === status).length]));
  lines.push("", `逐条结论：${JSON.stringify(counts)}。不使用平均分抵消失败。`);
  const fullCoverage = statuses.length > 0 && statuses.every(s => s.status === "通过") && manifest.providers.every(provider => (manifest.requiredIds || Array.from({length:36},(_,i)=>i+1)).every(id => statuses.some(s => s.provider === provider && s.id === id && s.status === "通过")));
  writeFileSync(join(directory, "report.md"), lines.join("\n") + "\n");
  return { counts, fullCoverage, results: results.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw Error("Usage: npm run acceptance:report -- acceptance/runs/<run-id>");
  const result = renderReport(resolve(process.argv[2]));
  console.log(JSON.stringify(result));
  if (!result.fullCoverage) process.exitCode = 2;
}
