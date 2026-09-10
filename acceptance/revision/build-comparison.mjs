import fs from "node:fs";
import { metrics, readLines } from "./review-tools.mjs";
import { renderReport, assessReview } from "../../scripts/translation-acceptance-report.mjs";

const root = "acceptance/runs";
const baseline = root + "/2026-09-09T11-05-55-829Z-3b8ba79a";
const runs = fs.readdirSync(root).map(name => ({ name, manifest: JSON.parse(fs.readFileSync(`${root}/${name}/manifest.json`)) })).filter(r => r.manifest.label.startsWith("revision-"));
const records = runs.map(r => {
  const directory = `${root}/${r.name}`;
  const report = renderReport(directory);
  return { label: r.manifest.label, directory, ...report, metrics: metrics(directory) };
});
const before = metrics(baseline, "acceptance/revision/baseline-reviews.json");
fs.writeFileSync("acceptance/revision/comparison.json", JSON.stringify({ before, runs: records }, null, 2));
let text = `# 本次修复与真实验收对照\n\n本报告由 AI（Codex）逐条评审实际中文；没有真人母语者背书，也没有把正则、回译或 HTTP 成功当成质量通过。结论只适用于保存的有限样本。没有发布或部署。\n\n## 原失败复核\n\n[11个供应商结果、9条不同原文的逐条复核](FAILURE-AUDIT.md)包含原文、实际中文、错误片段、分类、可接受表达与更正依据。Gemini 原7项未通过中包含2项网络失败，不能称为7条错误译文。原报告和原始评审保留，复评单独保存在 baseline-reviews.json。\n\n原 Gemini 12 的句末“了”、Gemini 35 的自然省略、DeepSeek 12 的 your 单复数和 DeepSeek 35 的“很沮丧”不能仅凭形式判错。更正后基线为 Gemini 31/36、DeepSeek 34/36；欠款事实、明确单数变复数与生硬中文仍按原标准判失败。\n\n## 实际代码修改\n\n1. 实体映射向模型提供类型与原值，保持占位符的可逆性及次数校验，避免完全隐藏姓名/币种语境。原始代词不转成姓名；显式字面内容仍优先。映射作为只读数据，不是指令。实际测试也暴露模型看到原值后仍会音译，不能把此项当作已证明的普遍质量提升。\n2. 金额从不透明标识符中分离，复用现有币种/金额解析；允许NGN与奈拉、USD与美元等同义表达。显式原样术语不受影响。修复连接词and被解析成0的缺陷；明确金额变化仍阻断。\n3. 精简重复提示，明确人物、物品归属、动作链、否定范围和自然中文。保留现有englishMeaning字段，在同一次调用中先生成源文含义，再生成译文；Gemini schema原先强制译文在前，现与提示顺序一致，OpenAI schema同步。\n4. 未新增模型审查调用、固定译文、无上下文替换或新的关键词阻断。重试上限未提高。新增请求格式、金额语境及等价表示测试，66项代码测试通过。\n\n第一次小范围试跑仍有问题；第二轮纠正schema顺序；第三轮验证币种误拦截修复。所有过渡失败都保留。随后按 freeze.json 冻结产品代码，再创建 independent-12.json，首次运行前未据此调优。本轮完整/独立/重复测试使用同一冻结方案。之后仅对原36条中发现的混合数字单位误拦截作本地解析修复（2万、2.5万、2万5千与三人），没有根据独立12条调整提示或姓名识别。最终代码差异见final-code.json；最后数字回归与三个保存候选的回放单列。10条真实数字回归后，又将小数系数改为整数精确运算，避免2.01万的浮点误差；这项精度细节以单元测试及三个实际候选回放验证，不能声称全部36和12又在最后这个解析版本上重跑了一遍。\n\n## 计分口径\n\n首次成功=一个翻译请求就交付且逐条评审达标；最终成功=允许现有有限重试后的实际交付达标。没有译文计入分母，另列无输出。语义、姓名/代词、语言错误分别计数，类别可能重叠，不能相加当作不同句子数。下表错误数针对最终交付；JSON另有首次候选错误数和首次候选通过数。UI共7个不同用例，其中36曾因页面中断取消后另作一次可见核对，所以记录8次，不能把取消算成模型翻译错误。正确候选被本地阻断单列，不算模型错误。耗时是记录的实际墙钟时间，包含网络、校验及异常等待，不能解释为纯模型速度或严格性能基准。\n\n| 轮次 | 供应商 | 条数 | 首次成功 | 最终成功 | 语义错误 | 姓名/代词错误 | 语言未达标 | 无输出 | 本地误拦截候选 |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
const tabRows = [{ label: "修改前（更正评审）", metrics: before.filter(m => m.provider !== "openai") }, ...records.filter(r => ["revision-full36", "revision-independent12", "revision-two-repeats", "revision-independent-repeats", "revision-ui", "revision-numeric-final"].includes(r.label))];
for (const r of tabRows) for (const m of r.metrics) text += `| ${r.label} | ${m.provider} | ${m.cases} | ${m.firstPass}/${m.cases} | ${m.finalPass}/${m.cases} | ${m.semantic} | ${m.entity} | ${m.language} | ${m.noOutput} | ${m.localFalseBlocks} |\n`;
text += "\n## 请求次数与耗时\n\n额外请求=每个用例实际翻译请求数减1后的非负值；其中既可能是网络重试，也可能是校验重生成。全部供应商HTTP还包括该用例触发的模型检测。节流间隔不算用例耗时。\n\n| 轮次 | 供应商 | 翻译请求 | 全部供应商HTTP | 额外请求 | 总耗时ms | 中位数ms | 最大ms |\n|---|---|---:|---:|---:|---:|---:|---:|\n";
for (const r of tabRows) for (const m of r.metrics) text += `| ${r.label} | ${m.provider} | ${m.translationRequests} | ${m.providerHttpRequests} | ${m.extraRequests} | ${m.elapsedMs} | ${m.medianMs} | ${m.maxMs} |\n`;
text += "\n## 所有本轮运行\n\n";
for (const r of records) text += `- [${r.label}](../runs/${r.directory.split('/').at(-1)}/report.md)：${JSON.stringify(r.counts)}。\n`;
text += "\n## 未通过结果逐条定位\n\n以下由已完成的AI评审提取，不另行自动打分。完整输入、保护输入、原始模型JSON、恢复与后处理见同目录trace.jsonl；失败阶段汇总另存 remaining-failures.json。\n\n";
const failures = [];
for (const r of records.filter(r => !r.label.includes("pilot"))) {
  const reviews = JSON.parse(fs.readFileSync(r.directory + "/reviews.json"));
  const traces = readLines(r.directory + "/trace.jsonl");
  for (const row of readLines(r.directory + "/results.jsonl")) {
    const review = reviews.find(v => v.requestId === row.requestId && !v.candidateAttempt);
    if (assessReview(row, review).status === "通过") continue;
    const stages = traces.filter(t => t.requestId === row.requestId && ["entity_protection", "model_output", "entity_restoration", "postprocess"].includes(t.stage));
    failures.push({ run: r.label, ...row, review, stages });
    text += `- ${r.label} / ${row.provider} / ${row.id}：${row.source}\n  实际：${row.translation || "无可交付译文"}；${review?.issues || row.errorCode || "无输出"}。\n`;
  }
}
fs.writeFileSync("acceptance/revision/remaining-failures.json", JSON.stringify(failures, null, 2));
text += `\n## 已验证的原因与限制\n\n- 多数语义错误在模型原始JSON里已经存在（说明错误发生于生成阶段，但未做受控A/B，不能据此证明仅由模型固有能力造成、与提示策略完全无关），恢复和后处理只还原占位符及处理句末标点，不能归咎于页面或缓存。欠款、代词人数的旧失败输入本就没有人物占位符。\n- 姓名音译分两类：May等已有占位符但模型仍音译，被正确阻断；Marta、Rosa等未被启发式识别，原名仍直接可见，但模型未遵守保留要求，音译被交付。因此现有人名识别覆盖仍有限，不能声称剩余问题全是模型能力、与本地方案无关。\n- 完整主轮DeepSeek 29 首个候选“每位员工应获得2万奈拉，三人共6万奈拉”数值正确，曾被冻结版本的混合数字单位解析误拦截。最后已修复并用原主轮/复测的三个真实候选回放验证，均只经过一次本地生成接口、外部调用0次；另有10条真实调用记录。旧轮的误拦截次数保留，没有改成0。\n- 英文解释有时把有歧义的he/their指定为具体人；它不是中文正确性的证明。中文本身有合理省略时不因回译收窄就自动判错。\n- 独立111中的they也可能指通话双方，不能强行当单数测试。其结果按合理解读评审；该条不提供单数指代稳定性的证据，明确单数另由101与原34覆盖。\n- OpenAI沿用本机已有额度失败证据，本次没有可供比较的OpenAI译文，也没有把它计为通过。\n\n可选后续方向：对于姓名，比较仅提供实体类型的映射与当前包含原值的映射，做受控A/B后决定，不能凭本轮随机输出断言哪种更优；若仍不能稳定遵守人物关系，可单独评估更强模型的质量、费用与延迟。上述方案没有在本次偷偷启用，也未引入每次翻译的额外审查服务。\n\n整体验收仍未通过；不靠单次好结果、平均分或更多重试包装为通过。\n`;
fs.writeFileSync("acceptance/revision/COMPARISON.md", text);
console.log(JSON.stringify(records.map(({ label, counts }) => ({ label, counts }))));
