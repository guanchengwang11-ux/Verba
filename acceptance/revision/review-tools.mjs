// Offline report authoring only. Decisions are supplied by the reviewer after
// reading each actual output; this file does not infer quality from keywords.
import fs from "node:fs";
import { renderReport, assessReview } from "../../scripts/translation-acceptance-report.mjs";
export const readLines = file => fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split(/\r?\n/).filter(Boolean).map(JSON.parse) : [];
export function reviewRun(directory, decisions, candidateDecisions = {}) {
  const rows = readLines(directory + "/results.jsonl");
  if (rows.length !== decisions.length) throw Error("Each result requires an explicit review decision");
  const fixtures = JSON.parse(fs.readFileSync(fs.existsSync(directory + "/fixtures.json") ? directory + "/fixtures.json" : "acceptance/cases.json"));
  const reviews = [];
  for (const [index, row] of rows.entries()) {
    const decision = decisions[index];
    if (!row.translation && decision !== null) throw Error("No output cannot be scored");
    if (row.translation && !decision) throw Error("Missing decision");
    const fixture = fixtures.find(f => f.id === row.id);
    const make = (text, d) => ({ requestId: row.requestId, translation: text, reviewer: "AI", logic: { pass: !d.semantic, reason: d.semantic || d.reason || `逐句核对人物、动作、否定和条件：${fixture.focus}` }, entities: { pass: !d.entity, reason: d.entity || "本次人物及所有者关系与原文相符；可接受的省略和同义表达不机械判错。" }, naturalness: d.naturalness ?? 4, colloquial: d.colloquial ?? 4, issues: d.issues || d.semantic || d.entity || "无实质错误，表达可用于同事协作。", categories: [...(d.semantic ? ["semantic"] : []), ...(d.entity ? ["entity"] : []), ...((d.naturalness ?? 4) < 4 || (d.colloquial ?? 4) < 4 ? ["language"] : [])] });
    if (row.translation) reviews.push(make(row.translation, decision));
    for (const t of readLines(directory + "/trace.jsonl").filter(t => t.requestId === row.requestId && t.stage === "entity_restoration")) {
      const normalize = s => s.trim().replace(/[.!?,;:…，。！？；：、]+$/u, "");
      const d = candidateDecisions[row.requestId + ":" + t.attempt] || (row.translation && normalize(t.translation) === normalize(row.translation) ? decision : null);
      if (!d) throw Error(`Candidate needs separate review: ${row.requestId}:${t.attempt}: ${t.translation}`);
      reviews.push({ ...make(t.translation, d), candidateAttempt: t.attempt });
    }
  }
  fs.writeFileSync(directory + "/reviews.json", JSON.stringify(reviews, null, 2) + "\n");
  return renderReport(directory);
}

export function metrics(directory, reviewFile = directory + "/reviews.json") {
  const rows = readLines(directory + "/results.jsonl");
  const traces = readLines(directory + "/trace.jsonl");
  const reviews = JSON.parse(fs.readFileSync(reviewFile));
  const pass = (r, v) => assessReview(r, v).status === "通过";
  return [...new Set(rows.map(r => r.provider))].map(provider => {
    const rs = rows.filter(r => r.provider === provider);
    const output = { provider, cases: rs.length, firstPass: 0, firstCandidatePass: 0, finalPass: 0, semantic: 0, entity: 0, language: 0, firstSemantic: 0, firstEntity: 0, firstLanguage: 0, noOutput: 0, translationRequests: 0, providerHttpRequests: 0, extraRequests: 0, localFalseBlocks: 0, elapsedMs: 0 };
    const times = [];
    for (const r of rs) {
      const v = reviews.find(v => v.requestId === r.requestId && !v.candidateAttempt);
      if (pass(r, v)) output.finalPass++;
      if (!r.translation) output.noOutput++;
      if (v && !v.logic.pass) output.semantic++;
      if (v && !v.entities.pass) output.entity++;
      if (v && (v.naturalness < 4 || v.colloquial < 4)) output.language++;
      output.translationRequests += r.requestCount || 0;
      output.providerHttpRequests += r.providerHttpRequestCount || 0;
      output.extraRequests += Math.max(0, (r.requestCount || 0) - 1);
      output.elapsedMs += r.elapsedMs || 0;
      if (r.elapsedMs) times.push(r.elapsedMs);
      const first = traces.find(t => t.requestId === r.requestId && t.stage === "entity_restoration" && t.attempt === 1);
      const firstReview = reviews.find(v => v.requestId === r.requestId && v.candidateAttempt === 1);
      // A candidate produced after a network retry is not a first-request success.
      const attempts = r.diagnostic?.events?.filter(e => e.event === "translation_attempt") || [];
      if (firstReview && !firstReview.logic.pass) output.firstSemantic++;
      if (firstReview && !firstReview.entities.pass) output.firstEntity++;
      if (firstReview && (firstReview.naturalness < 4 || firstReview.colloquial < 4)) output.firstLanguage++;
      if (first && pass(first, firstReview) && attempts[0]?.success) output.firstCandidatePass++;
      if (first && pass(first, firstReview) && pass(r, v) && r.requestCount === 1 && attempts[0]?.success) output.firstPass++;
      for (const t of traces.filter(t => t.requestId === r.requestId && t.stage === "entity_restoration")) {
        const cv = reviews.find(v => v.requestId === r.requestId && v.candidateAttempt === t.attempt);
        const blocked = r.diagnostic?.events?.some(e => e.validationAttempt === t.attempt && e.disposition === "block");
        if (blocked && pass(t, cv)) output.localFalseBlocks++;
      }
    }
    times.sort((a,b) => a-b);
    return { ...output, firstSuccessRate: output.firstPass / rs.length, finalSuccessRate: output.finalPass / rs.length, medianMs: times.length ? times[Math.floor(times.length / 2)] : null, maxMs: times.at(-1) ?? null };
  });
}
