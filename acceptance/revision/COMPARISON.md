# 本次修复与真实验收对照

本报告由 AI（Codex）逐条评审实际中文；没有真人母语者背书，也没有把正则、回译或 HTTP 成功当成质量通过。结论只适用于保存的有限样本。没有发布或部署。

## 原失败复核

[11个供应商结果、9条不同原文的逐条复核](FAILURE-AUDIT.md)包含原文、实际中文、错误片段、分类、可接受表达与更正依据。Gemini 原7项未通过中包含2项网络失败，不能称为7条错误译文。原报告和原始评审保留，复评单独保存在 baseline-reviews.json。

原 Gemini 12 的句末“了”、Gemini 35 的自然省略、DeepSeek 12 的 your 单复数和 DeepSeek 35 的“很沮丧”不能仅凭形式判错。更正后基线为 Gemini 31/36、DeepSeek 34/36；欠款事实、明确单数变复数与生硬中文仍按原标准判失败。

## 实际代码修改

1. 实体映射向模型提供类型与原值，保持占位符的可逆性及次数校验，避免完全隐藏姓名/币种语境。原始代词不转成姓名；显式字面内容仍优先。映射作为只读数据，不是指令。实际测试也暴露模型看到原值后仍会音译，不能把此项当作已证明的普遍质量提升。
2. 金额从不透明标识符中分离，复用现有币种/金额解析；允许NGN与奈拉、USD与美元等同义表达。显式原样术语不受影响。修复连接词and被解析成0的缺陷；明确金额变化仍阻断。
3. 精简重复提示，明确人物、物品归属、动作链、否定范围和自然中文。保留现有englishMeaning字段，在同一次调用中先生成源文含义，再生成译文；Gemini schema原先强制译文在前，现与提示顺序一致，OpenAI schema同步。
4. 未新增模型审查调用、固定译文、无上下文替换或新的关键词阻断。重试上限未提高。新增请求格式、金额语境及等价表示测试，66项代码测试通过。

第一次小范围试跑仍有问题；第二轮纠正schema顺序；第三轮验证币种误拦截修复。所有过渡失败都保留。随后按 freeze.json 冻结产品代码，再创建 independent-12.json，首次运行前未据此调优。本轮完整/独立/重复测试使用同一冻结方案。之后仅对原36条中发现的混合数字单位误拦截作本地解析修复（2万、2.5万、2万5千与三人），没有根据独立12条调整提示或姓名识别。最终代码差异见final-code.json；最后数字回归与三个保存候选的回放单列。10条真实数字回归后，又将小数系数改为整数精确运算，避免2.01万的浮点误差；这项精度细节以单元测试及三个实际候选回放验证，不能声称全部36和12又在最后这个解析版本上重跑了一遍。

## 计分口径

首次成功=一个翻译请求就交付且逐条评审达标；最终成功=允许现有有限重试后的实际交付达标。没有译文计入分母，另列无输出。语义、姓名/代词、语言错误分别计数，类别可能重叠，不能相加当作不同句子数。下表错误数针对最终交付；JSON另有首次候选错误数和首次候选通过数。UI共7个不同用例，其中36曾因页面中断取消后另作一次可见核对，所以记录8次，不能把取消算成模型翻译错误。正确候选被本地阻断单列，不算模型错误。耗时是记录的实际墙钟时间，包含网络、校验及异常等待，不能解释为纯模型速度或严格性能基准。

| 轮次 | 供应商 | 条数 | 首次成功 | 最终成功 | 语义错误 | 姓名/代词错误 | 语言未达标 | 无输出 | 本地误拦截候选 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 修改前（更正评审） | gemini | 36 | 29/36 | 31/36 | 1 | 0 | 2 | 2 | 0 |
| 修改前（更正评审） | deepseek | 36 | 34/36 | 34/36 | 1 | 1 | 1 | 0 | 0 |
| revision-full36 | gemini | 36 | 32/36 | 33/36 | 3 | 2 | 0 | 0 | 0 |
| revision-full36 | deepseek | 36 | 33/36 | 36/36 | 0 | 0 | 0 | 0 | 1 |
| revision-ui | deepseek | 8 | 4/8 | 6/8 | 0 | 0 | 0 | 2 | 0 |
| revision-independent12 | gemini | 12 | 7/12 | 8/12 | 1 | 1 | 1 | 2 | 0 |
| revision-independent12 | deepseek | 12 | 8/12 | 9/12 | 1 | 3 | 0 | 0 | 0 |
| revision-two-repeats | gemini | 46 | 40/46 | 40/46 | 4 | 2 | 2 | 0 | 0 |
| revision-two-repeats | deepseek | 46 | 38/46 | 42/46 | 0 | 0 | 1 | 3 | 2 |
| revision-independent-repeats | gemini | 14 | 8/14 | 8/14 | 2 | 2 | 3 | 1 | 0 |
| revision-independent-repeats | deepseek | 14 | 9/14 | 10/14 | 0 | 4 | 0 | 0 | 0 |
| revision-numeric-final | gemini | 5 | 4/5 | 4/5 | 1 | 0 | 0 | 0 | 0 |
| revision-numeric-final | deepseek | 5 | 5/5 | 5/5 | 0 | 0 | 0 | 0 | 0 |

## 请求次数与耗时

额外请求=每个用例实际翻译请求数减1后的非负值；其中既可能是网络重试，也可能是校验重生成。全部供应商HTTP还包括该用例触发的模型检测。节流间隔不算用例耗时。

| 轮次 | 供应商 | 翻译请求 | 全部供应商HTTP | 额外请求 | 总耗时ms | 中位数ms | 最大ms |
|---|---|---:|---:|---:|---:|---:|---:|
| 修改前（更正评审） | gemini | 39 | 39 | 3 | 361920 | 4336 | 160000 |
| 修改前（更正评审） | deepseek | 36 | 36 | 0 | 128964 | 2160 | 22692 |
| revision-full36 | gemini | 37 | 37 | 1 | 259958 | 6427 | 26251 |
| revision-full36 | deepseek | 39 | 39 | 3 | 48391 | 1285 | 2889 |
| revision-ui | deepseek | 11 | 11 | 3 | 15226 | 1958 | 3085 |
| revision-independent12 | gemini | 15 | 15 | 3 | 62867 | 4706 | 10834 |
| revision-independent12 | deepseek | 13 | 13 | 1 | 15651 | 1235 | 2003 |
| revision-two-repeats | gemini | 46 | 46 | 0 | 71918 | 1432 | 3859 |
| revision-two-repeats | deepseek | 53 | 53 | 7 | 55882 | 1081 | 2329 |
| revision-independent-repeats | gemini | 16 | 16 | 2 | 22808 | 1443 | 2904 |
| revision-independent-repeats | deepseek | 15 | 15 | 1 | 17297 | 1083 | 3041 |
| revision-numeric-final | gemini | 5 | 5 | 0 | 7586 | 1450 | 1996 |
| revision-numeric-final | deepseek | 5 | 5 | 0 | 5357 | 1103 | 1183 |

## 所有本轮运行

- [revision-pilot](../runs/2026-09-09T16-46-13-151Z-9ba7d932/report.md)：{"未达标":5,"通过":13}。
- [revision-pilot2](../runs/2026-09-09T16-48-39-233Z-214aca66/report.md)：{"未达标":4,"通过":13,"未测/无可交付译文":1}。
- [revision-pilot3](../runs/2026-09-09T16-51-50-414Z-144d7cc9/report.md)：{"未达标":1,"通过":7}。
- [revision-full36](../runs/2026-09-09T16-53-28-734Z-27fb37ac/report.md)：{"通过":69,"未达标":3}。
- [revision-ui](../runs/2026-09-09T16-55-49-429Z-d11f326d/report.md)：{"通过":6,"未测/无可交付译文":2}。
- [revision-independent12](../runs/2026-09-09T17-01-20-513Z-4ed9093b/report.md)：{"通过":17,"未达标":5,"未测/无可交付译文":2}。
- [revision-two-repeats](../runs/2026-09-09T21-42-30-847Z-8deeaaeb/report.md)：{"通过":82,"未达标":7,"未测/无可交付译文":3}。
- [revision-independent-repeats](../runs/2026-09-09T21-48-07-440Z-4bb462fe/report.md)：{"通过":18,"未达标":9,"未测/无可交付译文":1}。
- [revision-numeric-final](../runs/2026-09-09T21-49-59-838Z-bc5f5263/report.md)：{"未达标":1,"通过":9}。

## 未通过结果逐条定位

以下由已完成的AI评审提取，不另行自动打分。完整输入、保护输入、原始模型JSON、恢复与后处理见同目录trace.jsonl；失败阶段汇总另存 remaining-failures.json。

- revision-full36 / gemini / 12：My manager asked your assistant to contact their driver.
  实际：我的经理让你助理联系一下他的司机；their未指定性别，译成他的司机增加男性信息。。
- revision-full36 / gemini / 22：If he hasn't replied by noon, ask her to call him.
  实际：如果他中午还没回复，就让她们给他打个电话；her单数被译成她们，改变执行电话动作的人数。。
- revision-full36 / gemini / 34：Someone from support called me. They said they'd check it for us.
  实际：有个客服联系了我，说会帮我们查一下；called me明确为电话沟通，联系了我省去了沟通方式；不是仅省略重复主语。。
- revision-ui / deepseek / 6：May said she may join us later.
  实际：无可交付译文；ENTITY_VALIDATION_FAILED。
- revision-ui / deepseek / 36：Keep the username "She" unchanged, but translate the rest of her message.
  实际：无可交付译文；REQUEST_CANCELLED。
- revision-independent12 / gemini / 107：Not all the teams are ready, so do not publish the plan yet.
  实际：还没所有团队都准备好，所以先别发布那个计划；还没所有团队都准备好语序生硬，应为还不是所有团队都准备好或还有团队没准备好。。
- revision-independent12 / gemini / 109：Could you keep me in the loop while I am away?
  实际：无可交付译文；PROVIDER_NETWORK_ERROR。
- revision-independent12 / gemini / 110：I may have missed your point. Do you want us to move the appointment?
  实际：无可交付译文；PROVIDER_NETWORK_ERROR。
- revision-independent12 / gemini / 112：Keep the account "They" as written; she will update its details in May.
  实际：保持 They 账户原样，对方会在五月更新账户信息；明确的人称被弱化，且保持账户原样比保留账户名称的写法范围更宽。。
- revision-independent12 / deepseek / 102：I borrowed your charger, but Marta returned hers to you.
  实际：我借了你的充电器，但玛尔塔把她自己的还给你了；Marta被音译为玛尔塔。。
- revision-independent12 / deepseek / 103：Could you ask Omar to tell Leah to send the draft to them?
  实际：你能让Omar告诉Leah把草稿发给他吗；草稿收件人的指代加入男性信息。。
- revision-independent12 / deepseek / 108：If Rosa has not checked the figures by Friday, ask Ben to call her.
  实际：如果罗莎到周五还没核对数据，就让Ben给她打电话；Rosa被音译为罗莎；Ben正确保留。。
- revision-two-repeats / gemini / 2：They asked us to tell you that the meeting had been canceled.
  实际：他们让我转告你，会议取消了；us被译为我，转告者从我们变为单个说话者。。
- revision-two-repeats / gemini / 12：My manager asked your assistant to contact their driver.
  实际：我经理让您的助理联系一下他（她）的司机；他（她）的司机带括号犹疑，不是自然可直接发送的同事表达。。
- revision-two-repeats / gemini / 27：You don't owe me anything; I owe you NGN 25,000.
  实际：你不需要付我什么，我欠你 25,000 NGN；不需要付我什么未准确断言没有债务。。
- revision-two-repeats / gemini / 34：Someone from support called me. They said they'd check it for us.
  实际：刚才有位客服给我打电话，说会帮我们查一下；刚才增加了原文没有的近时信息。。
- revision-two-repeats / gemini / 12：My manager asked your assistant to contact their driver.
  实际：我经理请你的助理联系一下他的司机；their未指定性别，译成他的司机加入男性信息。。
- revision-two-repeats / gemini / 24：Unless you tell me otherwise, I'll use the latest version.
  实际：除非你另有指示，否则我将使用最新版本；否则我将使用最新版本偏通知/公文语体。。
- revision-two-repeats / deepseek / 35：When David spoke to Michael, he sounded upset.
  实际：无可交付译文；ENTITY_VALIDATION_FAILED。
- revision-two-repeats / deepseek / 6：May said she may join us later.
  实际：无可交付译文；ENTITY_VALIDATION_FAILED。
- revision-two-repeats / deepseek / 18：None of them has approved the request.
  实际：他们中没有一个人批准了这个请求；没有一个人批准了这个请求的否定与了搭配生硬，应为没有一个人批准这个请求。。
- revision-two-repeats / deepseek / 21：Don't send the files until Nana confirms the address.
  实际：无可交付译文；ENTITY_VALIDATION_FAILED。
- revision-independent-repeats / gemini / 107：Not all the teams are ready, so do not publish the plan yet.
  实际：还没所有团队都准备好，所以先别发布那个计划；还没所有团队都准备好语序生硬，应为还不是所有团队都准备好。。
- revision-independent-repeats / gemini / 112：Keep the account "They" as written; she will update its details in May.
  实际：保留They账户现状，对方会在五月份更新账户详情；保留账户现状范围大于保留名称的写法；she变为对方。。
- revision-independent-repeats / gemini / 103：Could you ask Omar to tell Leah to send the draft to them?
  实际：无可交付译文；ENTITY_VALIDATION_FAILED。
- revision-independent-repeats / gemini / 107：Not all the teams are ready, so do not publish the plan yet.
  实际：还没所有团队都准备好，所以先别发布那个计划；还没所有团队都准备好语序生硬，应为还不是所有团队都准备好。。
- revision-independent-repeats / gemini / 109：Could you keep me in the loop while I am away?
  实际：我不在的时候，请随时告知我相关进展；请随时告知我相关进展偏书面汇报语体。。
- revision-independent-repeats / gemini / 112：Keep the account "They" as written; she will update its details in May.
  实际：保留账户 They 的原样，对方会在五月份更新其详细信息；保留账户现状范围大于保留名称的写法；she变为对方。。
- revision-independent-repeats / deepseek / 102：I borrowed your charger, but Marta returned hers to you.
  实际：我借了你的充电器，但玛尔塔把她自己的还给你了；Marta被音译，姓名未原样保留。。
- revision-independent-repeats / deepseek / 108：If Rosa has not checked the figures by Friday, ask Ben to call her.
  实际：如果罗莎到周五还没核对数字，就让Ben给她打电话；Rosa被音译为罗莎。。
- revision-independent-repeats / deepseek / 102：I borrowed your charger, but Marta returned hers to you.
  实际：我借了你的充电器，但玛塔把她的还给你了；Marta被音译，姓名未原样保留。。
- revision-independent-repeats / deepseek / 108：If Rosa has not checked the figures by Friday, ask Ben to call her.
  实际：如果罗莎到周五还没核对数字，就让Ben给她打个电话；Rosa被音译为罗莎。。
- revision-numeric-final / gemini / 27：You don't owe me anything; I owe you NGN 25,000.
  实际：你不需要付我钱，我欠你25,000 NGN；不需要付我钱没有准确保留不欠钱的事实。。

## 已验证的原因与限制

- 多数语义错误在模型原始JSON里已经存在（说明错误发生于生成阶段，但未做受控A/B，不能据此证明仅由模型固有能力造成、与提示策略完全无关），恢复和后处理只还原占位符及处理句末标点，不能归咎于页面或缓存。欠款、代词人数的旧失败输入本就没有人物占位符。
- 姓名音译分两类：May等已有占位符但模型仍音译，被正确阻断；Marta、Rosa等未被启发式识别，原名仍直接可见，但模型未遵守保留要求，音译被交付。因此现有人名识别覆盖仍有限，不能声称剩余问题全是模型能力、与本地方案无关。
- 完整主轮DeepSeek 29 首个候选“每位员工应获得2万奈拉，三人共6万奈拉”数值正确，曾被冻结版本的混合数字单位解析误拦截。最后已修复并用原主轮/复测的三个真实候选回放验证，均只经过一次本地生成接口、外部调用0次；另有10条真实调用记录。旧轮的误拦截次数保留，没有改成0。
- 英文解释有时把有歧义的he/their指定为具体人；它不是中文正确性的证明。中文本身有合理省略时不因回译收窄就自动判错。
- 独立111中的they也可能指通话双方，不能强行当单数测试。其结果按合理解读评审；该条不提供单数指代稳定性的证据，明确单数另由101与原34覆盖。
- OpenAI沿用本机已有额度失败证据，本次没有可供比较的OpenAI译文，也没有把它计为通过。

可选后续方向：对于姓名，比较仅提供实体类型的映射与当前包含原值的映射，做受控A/B后决定，不能凭本轮随机输出断言哪种更优；若仍不能稳定遵守人物关系，可单独评估更强模型的质量、费用与延迟。上述方案没有在本次偷偷启用，也未引入每次翻译的额外审查服务。

整体验收仍未通过；不靠单次好结果、平均分或更多重试包装为通过。
