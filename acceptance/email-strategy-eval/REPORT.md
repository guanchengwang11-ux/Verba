# Professional email 中文→英文：独立忠实策略交付验证

未发布、未推送自动更新；产品版本仍为1.1.2，新策略 customer-email-zh-en/v1 尚未发布。供应商沿用现有 Gemini / gemini-3.1-flash-lite。以下为 Codex 逐条语义评审，不是真人语言认证。

最终主测试可用 **68/70（97.14%）**；16组对照可用 **15/16**。具体剩余错误见下文，不以HTTP成功或流畅度当作准确性。

## 实际前后对照

| 范围 | 可用译文 | 首次可用（不追加调用） | 正文/提示错误 | 无译文 | 模型HTTP请求 | 自动额外调用 | 请求耗时合计 ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| 旧1.1.2 主70 | 61/70 | 59/70 | 2/无此区域 | 7 | 79 | 9 | 233508 |
| 旧1.1.2 对照16 | 14/16 | 13/16 | 0/无此区域 | 2 | 19 | 3 | 49656 |
| 新策略首轮70（保留） | 68/70 | 63/70 | 2/1 | 0 | 76 | 6 | 424220 |
| 最终冻结策略70 | 68/70 | 68/70 | 1/1 | 0 | 70 | 0 | 140295 |
| 最终策略对照16 | 15/16 | 15/16 | 1/1 | 0 | 16 | 0 | 30910 |

“首次可用”采用保守口径：第一次供应商HTTP调用即交付可用正文及无误导的重要提示，不需要网络重试或自动修复。最终可用包括产品预算内自动修复；轻微翻译腔、合理省略及不改变事实的表达差异不算语义错误。对照16不加进主70的分母，也不称为86种独立原文。

耗时包括提交、网络和产品处理，不含条目间4500ms限速等待；不同时间段供应商延迟变化很大，不能将耗时差全部归因于代码。新策略扩大结构化输出预算以承载提示，但没有每次请求新增第二模型审查。最终主测试网络失败事件0次、校验修复0次；对照分别0、0次。

本地误拦：旧主70有7条最终无译文（15个正确候选曾被拦）；旧对照16有2条最终无译文（5个正确候选曾被拦）。最终主70及对照16均无校验阻断、无本地误拦、无自动重试。主测试1条正文错误、1条提示错误（不同条目）；对照1条正文错误且同条提示错误，二者不能相加称为两个不同案例。原始客户事实冲突固定为主67、69两条；它们的冲突不是翻译失败。主70的首次可用率/最终可用率均为97.14%，对照均为93.75%；主70和对照中合理澄清（空译文并正确说明不能翻译）均为0，不能把有冲突但可忠实呈现的67、69记作澄清失败。补充组201另外有1个真实状态冲突但提示误解，203有1次必要提示漏报；202发生1条本地引用误拦（2个候选），已在最后引用修正和定向验证中处理。

## 所有轮次与成本（不挑最好一次）

| 轮次 | 提交条数 | 实际调用 | 请求耗时 ms | 用途 |
|---|---:|---:|---:|---|
| pilot | 12 | 13 | 77500 | 优先复测旧失败和误拦，发现多余提示后修改 |
| main | 70 | 76 | 424220 | 第一次新策略全70，发现64、66问题 |
| targeted | 2 | 2 | 6718 | 增加通用否定范围/不臆测机制提示后的64、66复测 |
| finalmain | 70 | 70 | 140295 | 最终冻结策略完整70；没有用早先更好译文替换 |
| controls | 16 | 16 | 30910 | 原16个错别字纠正对照，各首次提交一次 |
| ambiguity | 3 | 4 | 9765 | 3个关键歧义补充检查 |
| other | 3 | 3 | 7478 | Team chat两方向及email英译中小范围实际回归 |
| citation | 1 | 1 | 5161 | 修复引用缺也误拦后的单次定向实测，不替换原202结果 |

本轮实现期间总计185次模型HTTP调用（不含原1.1.2基线的98次）；调优和发现问题的轮次没有从成本记录中删除。所有首次候选、修复候选和各阶段文本保存于对应 *-trace.jsonl。模型未收到测试编号、核对重点、参考译文或其他场景答案。

## 剩余错误、额外提示及阶段证据

### main / 64

原文：我买的是0.025 BTC，不是0.0025 BTC，你们显示少个数量，麻烦核下，别把小数点看错。

实际译文：I purchased 0.025 BTC, not 0.0025 BTC. The quantity displayed on your end is short by a digit. Please check this, and do not misread the decimal point.

评审：“少个数量”被擅自解释为 missing/short by a digit（少了一位数字）。金额虽然未变，错误机制却被补写；应保持宽泛如 The displayed quantity is too low.。原始模型输出已如此，恢复和后处理未改坏；本地检查未检出。

### main / 66

原文：我不是不是要退款，我是要退款，但只退多扣的50美元，正常那笔别动。

实际译文：I am not looking for a refund, but rather I do want a refund, only for the extra $50 that was deducted; please do not touch the normal transaction.

评审：原文双重否定加后续明确肯定表示要退款，模型却先写不想退款，再写想退款，还在提示中虚构客户先否定后改口。属于模型正文和提示错误，不是原文自相矛盾。

实际英文提示：

- The customer initially denies wanting a refund and then immediately corrects themselves to confirm they do want a refund.（我不是不是要退款，我是要退款）

### targeted / 64

原文：我买的是0.025 BTC，不是0.0025 BTC，你们显示少个数量，麻烦核下，别把小数点看错。

实际译文：I purchased 0.025 BTC, not 0.0025 BTC. The amount you are displaying is missing a digit. Please check it and make sure you haven't misread the decimal point.

评审：“少个数量”被擅自解释为 missing/short by a digit（少了一位数字）。金额虽然未变，错误机制却被补写；应保持宽泛如 The displayed quantity is too low.。原始模型输出已如此，恢复和后处理未改坏；本地检查未检出。

### targeted / 66

原文：我不是不是要退款，我是要退款，但只退多扣的50美元，正常那笔别动。

实际译文：I am not saying I do not want a refund; I do want a refund, but only for the $50 that was overcharged. Please do not touch the normal transaction.

评审：正文正确保留双重否定及只退多扣50美元；附加提示解释了双重否定，事实无误但无须提示。

实际英文提示：

- The customer uses a double negative '不是不是' which effectively functions as an affirmation of wanting a refund, clarified by the following clause.（我不是不是要退款）

### finalmain / 64

原文：我买的是0.025 BTC，不是0.0025 BTC，你们显示少个数量，麻烦核下，别把小数点看错。

实际译文：I bought 0.025 BTC, not 0.0025 BTC. The amount you are displaying is missing a digit. Please check this and make sure you haven't misread the decimal point.

评审：“少个数量”被擅自解释为 missing/short by a digit（少了一位数字）。金额虽然未变，错误机制却被补写；应保持宽泛如 The displayed quantity is too low.。原始模型输出已如此，恢复和后处理未改坏；本地检查未检出。

### finalmain / 66

原文：我不是不是要退款，我是要退款，但只退多扣的50美元，正常那笔别动。

实际译文：I am not saying I do not want a refund, I do want a refund, but only for the 50 USD that was overcharged; please do not touch the normal transaction.

评审：正文已正确表达“不是说不要退款；确实要退款”，但英文Source note仍断言 double negative + affirmative creates a logical contradiction。两者实际一致，提示误导英文读者，所以整条不计可用。提示来自模型原始输出；本地只核验结构和引用片段，不能可靠验证所有否定语义，未自动检出。

实际英文提示：

- The customer uses a double negative '不是不是' (not not) followed by an affirmative statement, which creates a logical contradiction regarding their refund request. I have translated this to reflect the customer's clarification that they do intend to request a refund.（我不是不是要退款，我是要退款）

### controls / 66

原文：我不是不是要退款；我是要退款，但只退多扣的50美元，正常那笔别动。

实际译文：I do not want a refund; actually, I do want a refund, but only for the extra $50 that was deducted. Please do not touch the regular charge.

评审：即使仅增加分号、没有改变双重否定，对照译文仍先断言I do not want a refund，随后actually改口，并把原文的两个一致肯定错误解释为矛盾。正文和提示均有错误；原始模型输出已如此，本地未检出。

实际英文提示：

- The customer uses a double negative '不是不是' followed by a contradiction '我是要退款', which functions as a correction of their initial statement.（我不是不是要退款；我是要退款）

### ambiguity / 201

原文：这笔75 USDT已经到账了，但这同一笔75 USDT到现在还没到账。请查一下。

实际译文：This 75 USDT has arrived, but this same 75 USDT has still not arrived yet. Please check.

评审：正文忠实保留同一笔75 USDT既已到又未到的矛盾；提示却擅自说two different transactions，新增两笔交易。真正的提示应说同一笔款的到账状态相互矛盾。错误在模型原始提示中，本地结构/引用检查未能检出。

实际英文提示：

- The customer refers to two different transactions as the 'same' transaction while claiming one has arrived and the other has not.（但这同一笔75 USDT）

### ambiguity / 202

原文：关于David和我的欠款500美元，欠款人名字漏写了。我也不确定这里说的是谁欠谁，请先核实。

实际译文：（无可用译文）

评审：两次模型引用都把原文“我也不确定这里说的是谁欠谁”省略为“我不确定这里说的是谁欠谁”，英文提示首轮正确表达债权债务关系不清，但精确substring检查将引用缺少“也”作为失败，修复一次后仍返回review_required。这属于新发现的引用校验过严，不能全部归因于模型：引用确实不是逐字摘录，却不足以证明正文错误。正文的my debt也不够中性，尚需语义评审；不能把本次停止算成合理澄清成功。保留两次候选。

实际英文提示：

- A faithful translation could not be produced within the repair limit. Please review the original details. Checks requiring review: ungrounded_source_note. This is a translation validation limitation, not evidence that the customer's statement is wrong.（关于David和我的欠款500美元，欠款人名字漏写了。我也不确定这里说的是谁欠谁，请先核实。）

### ambiguity / 203

原文：这笔50美元交易的编号第三位看不清，可能是大写O，也可能是数字0，请不要替我确定。

实际译文：The third character of the ID for this $50 transaction is unclear; it could be an uppercase 'O' or the number '0'. Please do not decide this for me.

评审：正文准确保留编号第三位O/0不确定，也没有替用户选择；但模型返回空Source notes，界面无邻近提醒状态，不满足本次关键编号歧义必须单独英文提示的验收要求。正文可理解不等于该要求通过。

### citation / 202

原文：关于David和我的欠款500美元，欠款人名字漏写了。我也不确定这里说的是谁欠谁，请先核实。

实际译文：Regarding David and my debt of $500, the debtor's name was omitted. I am also not sure who owes whom here; please verify first.

评审：仅修复引用片段缺少“也”的本地对齐后，一次调用返回可用正文和完整英文说明：客户不确定是自己欠500美元还是他人欠自己。my debt用词略不够中性，但后续句及显眼独立提示明确方向未知；不把模糊关系当已确认事实。此成功不删除旧202两次被拦的记录。

实际英文提示：

- The customer is unsure whether they owe the $500 or if someone else owes them the $500.（我也不确定这里说的是谁欠谁）

除补充202的引用校验过严外，上述生成问题在原始模型输出中已经存在，实体恢复与后处理没有把正确正文改坏。新首轮66还同时虚构了英文冲突提示；targeted的66正文恢复双重否定，但提示仍多余。第64条在已明确要求不要臆测缺位机制的定向结果中仍失败，属于当前单次模型策略尚不稳定的证据，不能凭一次更好结果声称可靠修复。可选后续是由使用者核实此类关键模糊表述，或单独评估更强配置的质量/成本；本次未默认加入第二审查、未继续堆规则。

## Source notes、校验与界面

最终主70的真实原文矛盾2条（67、69），必要提示2条均准确，遗漏0；另有1条虚构矛盾提示（66）。对照16没有应报告的真实原文矛盾，仍出现66的虚构提示。正常邮件均未逐个提示普通错字。正文/提示错误列可能同条重叠，不可相加当作不同失败句数。

正式比较中的主67必须同时保留1500与15000；主69正文保留18，独立英文解释998−990=8。不得从翻译正文中删除原文矛盾，也不把算术合理化作为修复目标。关键歧义补充组的实际正文、提示及状态逐条列于后文。补充201误报为两笔交易、203漏掉独立提示，仍未解决。202首次两次候选被引用少一个“也”误拦，最后仅增加严格的唯一原文片段对齐：只恢复省略的“也”，不允许省略否定、数字或编号，不改正文或模型提示词。修正后独立再实测202一次，成功给出不确定谁欠谁的英文提示。正文my debt略不够中性，但整句及独立提示明确债务方向未知，不将其评为已确认付款人。

这处引用修正发生在完整线上70+16之后，不能声称86条均在完全相同最新代码上重新调用模型。已用最新代码回放全部86条保存的原始模型输出，结果全部不变；加上3条歧义回放共89条，仅202从停止变为可用。citation-replay.json记录全部结果，回放不算新的线上翻译。最新代码另执行75项单元测试与独立界面检查。

旧报告保存的23条正确候选和3条错误候选已加入离线回归；正确候选全部放行，57记录诉求、68指定流程、69改18为8仍能拦截。本金/利息金额互换和有限第一人称收付款反转能检出；第三方David/Sarah对调不能可靠检出，测试明确记录这一边界。数字格式、同义币种、分数与普通量词不再机械按次数比较，但这不是完整语义验证器。复杂币种归属、日期时区、任意角色/否定范围等限制详见 [IMPLEMENTATION.md](IMPLEMENTATION.md)。

独立界面测试验证真实历史恢复、英文提示、只复制Translation、切换内容清除旧提示、清空后旧异步结果不回写、无可用译文时澄清状态及禁用复制。clipboard API使用边界桩核对复制参数，不假称验证了隐藏窗口的系统剪贴板。实际界面截图：[金额矛盾67](source-notes-67.png)、[客户差额69](source-notes-69.png)。

根因、修改文件和处理流程见 [IMPLEMENTATION.md](IMPLEMENTATION.md)。单元测试输出见 unit-tests-final.txt；配置及历史使用隔离目录，未改已安装用户的API配置、词典和历史。代码哈希见交付manifest；测试产物未检测到常见密钥格式。

有限测试不能保证任意输入准确。自动检查未能发现某项问题不等于该项语义已验证；Source notes也仍可能误报或漏报。

## 最终70条及16组对照逐条实际结果

## finalmain

### 1 — 可用

原文：您好，我昨天分两笔充值，分别是1,200 USDT和800 USDT。目前只收到第一笔，第二笔800 USDT尚未到账。请帮我核查第二笔充值。

Translation：I made two deposits yesterday, of 1,200 USDT and 800 USDT respectively. Currently, I have only received the first one, and the second deposit of 800 USDT has not arrived yet. Please help me check the second deposit.

Source notes：无

评审：两笔金额、第二笔未到账及查第二笔准确；省略您好是轻微形式差异，不计关键语义错误。

执行：1次模型HTTP，4849ms；状态translated；界面匹配true；请求ID da923600-224e-4bc3-bc93-27b40b099e4a。

### 2 — 可用

原文：我申请提现1,000 USDT，页面显示手续费为2 USDT，预计到账998 USDT，但实际只收到990 USDT。请解释少到账的8 USDT。

Translation：I applied to withdraw 1,000 USDT. The page displayed a fee of 2 USDT and an expected arrival amount of 998 USDT, but I actually only received 990 USDT. Please explain the 8 USDT discrepancy in the amount received.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1746ms；状态translated；界面匹配true；请求ID d198651f-3fa6-4b5d-9a65-f757a88f3942。

### 3 — 可用

原文：我通过银行转入了2万5千奈拉，但账户只增加了2,500奈拉。请核查剩余的22,500奈拉去了哪里。

Translation：I transferred 25,000 Naira via bank, but my account only increased by 2,500 Naira. Please check where the remaining 22,500 Naira went.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1303ms；状态translated；界面匹配true；请求ID 90df8007-6b27-4654-baeb-9f8fae15e73f。

### 4 — 可用

原文：同一笔49.90美元的付款被扣了两次，合计99.80美元。我只授权了一次付款，请退回重复扣除的49.90美元。

Translation：The same payment of 49.90 USD was deducted twice, totaling 99.80 USD. I only authorized one payment, please refund the duplicate 49.90 USD charge.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1765ms；状态translated；界面匹配true；请求ID e5aa13e8-5203-4d09-ad16-337c2a373fdd。

### 5 — 可用

原文：原付款金额是240美元，商户同意退还其中的90美元，其余150美元不退款。目前这90美元仍未到账。

Translation：The original payment amount was 240 USD. The merchant agreed to refund 90 USD of this amount, with the remaining 150 USD not being refunded. The 90 USD has not yet been received.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1648ms；状态translated；界面匹配true；请求ID ec522855-9df0-4854-ba8b-d14219994fab。

### 6 — 可用

原文：我的150美元退款申请已经获批，但账户里还没有这笔退款。请确认退款是否已经实际发出，而不只是审核通过。

Translation：My refund request for 150 USD has been approved, but I have not yet received the refund in my account. Please confirm whether the refund has actually been issued, rather than just having passed the review process.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，2977ms；状态translated；界面匹配true；请求ID 11ec27a3-ffbe-4165-bfe0-d7e73e45af39。

### 7 — 可用

原文：我希望对方实际收到500美元，手续费由我额外支付。请不要从这500美元中扣除手续费。

Translation：I would like the recipient to receive exactly 500 USD, and I will pay the transaction fee separately. Please do not deduct any fees from this 500 USD.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1539ms；状态translated；界面匹配true；请求ID 1ca67357-ebed-4925-8df1-5e70d6533504。

### 8 — 可用

原文：我的付款币种是CAD，金额为300加元，但交易记录显示成了300美元。请核查币种是否标错，不要再次扣款。

Translation：My payment currency is CAD and the amount is 300 CAD, but the transaction record shows 300 USD. Please verify if the currency is incorrectly labeled. Do not charge me again.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，2756ms；状态translated；界面匹配true；请求ID 9e75d702-d081-4157-912f-45df592e46a4。

### 9 — 可用

原文：兑换页面显示1美元可兑换1,500奈拉，所以100美元应兑换150,000奈拉，但我的账户只增加了145,000奈拉。请说明5,000奈拉的差额。

Translation：The exchange page showed that 1 USD can be exchanged for 1,500 Naira, so 100 USD should be exchanged for 150,000 Naira, but my account only increased by 145,000 Naira. Please explain the 5,000 Naira difference.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，2629ms；状态translated；界面匹配true；请求ID 6ae2989c-01b3-46ad-8b08-491dc5cf877b。

### 10 — 可用

原文：我本来要给账户A转200 USDT，却误转给了账户B。请协助核查能否追回，不要再从我的账户向A转出200 USDT。

Translation：I originally intended to transfer 200 USDT to account A, but I transferred it to account B by mistake. Please assist in checking if it can be recovered. Do not transfer 200 USDT from my account to account A again.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，2406ms；状态translated；界面匹配true；请求ID 8b38951e-5ff4-48f6-8d4c-b7ed5d81b2fe。

### 11 — 可用

原文：David说他已经向我转了750 USDT，但我这里只收到250 USDT。我还不能确认剩余500 USDT是否已经发出，请协助核查。

Translation：David said they have transferred 750 USDT to me, but I have only received 250 USDT. I cannot confirm whether the remaining 500 USDT has been sent, so please assist in checking.

Source notes：无

评审：David说已转750、实收250、余500是否发出未知均保留；单数they中性代词不改变人物关系，不机械判错。

执行：1次模型HTTP，6696ms；状态translated；界面匹配true；请求ID 31bd48b2-b428-4251-9d1c-18ff4a88ab06。

### 12 — 可用

原文：我从资金账户向交易账户划转了600 USDT。资金账户已经减少600 USDT，但交易账户没有增加，请检查这笔内部划转。

Translation：I transferred 600 USDT from my funding account to my trading account. The funding account has decreased by 600 USDT, but the trading account has not increased. Please check this internal transfer.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，2185ms；状态translated；界面匹配true；请求ID f18dfefe-3336-489c-af66-6d5343ef4cfb。

### 13 — 可用

原文：我在提现仍待审核时提交了取消申请，但现在显示“处理中”。请确认取消是否成功；我没有要求重新提交提现。

Translation：I submitted a cancellation request while my withdrawal was still pending review, but it now shows as 'Processing'. Please confirm whether the cancellation was successful; I did not request to resubmit the withdrawal.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1649ms；状态translated；界面匹配true；请求ID 3064c5b8-dd71-4878-a5e3-1c4fa3b11ca1。

### 14 — 可用

原文：我的每日提现上限是5,000 USDT，今天已经提现3,200 USDT，现在申请再提1,500 USDT却被拒绝。两笔合计4,700 USDT，未超过上限，请核查原因。

Translation：My daily withdrawal limit is 5,000 USDT. I have already withdrawn 3,200 USDT today, but my request to withdraw another 1,500 USDT was rejected. The sum of the two transactions is 4,700 USDT, which is within the limit. Please investigate the reason.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1528ms；状态translated；界面匹配true；请求ID 9af11534-89da-47a2-aaa1-fc1dc541b348。

### 15 — 可用

原文：页面写着最低提现金额为10 USDT。我申请的正好是10 USDT，不是低于10 USDT，为什么仍提示金额不足？

Translation：The page states that the minimum withdrawal amount is 10 USDT. I applied for exactly 10 USDT, which is not below 10 USDT. Why does it still indicate that the amount is insufficient?

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1404ms；状态translated；界面匹配true；请求ID dca2bf8c-d61c-44dd-9b11-8672577deb0f。

### 16 — 可用

原文：我的总余额是1,000 USDT，其中300 USDT被冻结，可用余额为700 USDT。我想了解冻结原因，并不是说300 USDT已经被扣走。

Translation：My total balance is 1,000 USDT, with 300 USDT frozen and an available balance of 700 USDT. I would like to understand the reason for the freeze; I am not suggesting that the 300 USDT has already been deducted.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1520ms；状态translated；界面匹配true；请求ID f9022bab-1dd7-4849-a555-d491d2a72a0b。

### 17 — 可用

原文：这笔80美元只是预授权，商户已经取消交易，但金额仍被占用。请核查何时释放，而不是再发起一笔80美元退款。

Translation：This $80 transaction is only a pre-authorization. The merchant has already cancelled the transaction, but the amount is still being held. Please verify when it will be released, rather than initiating another $80 refund.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1427ms；状态translated；界面匹配true；请求ID 88b4d0da-75aa-4194-9b1f-cd89a90a9e42。

### 18 — 可用

原文：我已在9月1日取消自动续费，但9月5日仍被收取20美元。我要求核查这次扣费，并保留已付费期间的服务。

Translation：I cancelled the auto-renewal on September 1st, but I was still charged 20 USD on September 5th. I request that this charge be investigated, and I wish to retain the service for the period that has already been paid for.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1421ms；状态translated；界面匹配true；请求ID 53ac04e0-d4ff-4a0d-9374-dd84efda23a3。

### 19 — 可用

原文：请将60美元退回原付款卡，不要退成平台积分，也不要转入我的交易账户。

Translation：Please refund the 60 USD to the original payment card. Do not refund it as platform points, and do not transfer it to my trading account.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1648ms；状态translated；界面匹配true；请求ID b7e719ba-5718-4015-bed3-c8fbb73bcea2。

### 20 — 可用

原文：昨天的三笔交易中，100美元那笔是我操作的，另外两笔各200美元不是我授权的。请只将这两笔合计400美元的交易作为未授权交易调查。

Translation：Of the three transactions from yesterday, the $100 transaction was initiated by me, but the other two transactions of $200 each were not authorized by me. Please only investigate these two transactions, which total $400, as unauthorized transactions.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1533ms；状态translated；界面匹配true；请求ID 7befcac7-2415-4c69-9058-2b82ef722d3f。

### 21 — 可用

原文：我的资产数量应为0.025 BTC，但页面显示0.0025 BTC，只有正确数量的十分之一。请核查是否存在小数位错误。

Translation：My asset balance should be 0.025 BTC, but the page shows 0.0025 BTC, which is only one-tenth of the correct amount. Please check if there is a decimal place error.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1209ms；状态translated；界面匹配true；请求ID db5d0e23-ba5f-43e6-916b-25952aecf8e9。

### 22 — 可用

原文：我以每枚25 USDT的价格买入40枚代币，成交额应为1,000 USDT，不含手续费。请核查记录里为什么显示只买到4枚。

Translation：I bought 40 tokens at a price of 25 USDT each, so the transaction amount should be 1,000 USDT, excluding fees. Please check why the records show that only 4 were purchased.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，2427ms；状态translated；界面匹配true；请求ID 37542c5a-9658-4535-9d06-c955f07fcb1b。

### 23 — 可用

原文：我挂单卖出100枚代币，目前成交了60枚，还有40枚未成交。请只取消剩余40枚的委托，不要对已经成交的60枚再进行操作。

Translation：I placed a sell order for 100 tokens, 60 of which have currently been filled, leaving 40 unfilled. Please cancel only the order for the remaining 40 tokens; do not take any action regarding the 60 that have already been filled.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1534ms；状态translated；界面匹配true；请求ID 1201f784-8669-4cf0-a1c3-e20625301685。

### 24 — 可用

原文：我提交的是限价买单，限价为每枚2美元，但成交记录显示每枚2.10美元。请核查这是否为显示错误。

Translation：I submitted a limit buy order at a price of $2 per unit, but the transaction record shows $2.10 per unit. Please check if this is a display error.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1536ms；状态translated；界面匹配true；请求ID 3722c180-70b8-41e3-bdce-202d3b92a604。

### 25 — 可用

原文：我想取消尚未成交的买单，不是卖出我已经持有的资产。请确认取消操作不会自动卖出当前持仓。

Translation：I would like to cancel an unexecuted buy order, not sell the assets I currently hold. Please confirm that the cancellation action will not automatically sell my current holdings.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1403ms；状态translated；界面匹配true；请求ID fbecc1a9-4d98-4a31-84aa-291acd626bc2。

### 26 — 可用

原文：我使用200 USDT保证金建立了名义价值1,000 USDT的仓位，杠杆是5倍。我并没有存入1,000 USDT，请不要把仓位价值当成我的入金金额。

Translation：I opened a position with a nominal value of 1,000 USDT using 200 USDT as margin, with 5x leverage. I did not deposit 1,000 USDT; please do not treat the position value as my deposit amount.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1753ms；状态translated；界面匹配true；请求ID fbf69ca2-b013-46c8-a61f-4511c40a84ab。

### 27 — 可用

原文：我只想给现有仓位追加100 USDT保证金，不想增加持仓数量，也不想新开一个仓位。

Translation：I only want to add 100 USDT to the margin of my existing position. I do not want to increase the holding size, nor do I want to open a new position.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，2294ms；状态translated；界面匹配true；请求ID 2f0487ee-d712-44d1-9aea-c9ea81e2fc93。

### 28 — 可用

原文：页面显示已实现盈利50 USDT、未实现亏损20 USDT。我想确认两者合计是否为盈利30 USDT，而不是亏损30 USDT。

Translation：The page shows a realized profit of 50 USDT and an unrealized loss of 20 USDT. I would like to confirm whether the combined total is a profit of 30 USDT, instead of a loss of 30 USDT.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1651ms；状态translated；界面匹配true；请求ID 0fa579a7-f0f4-4eb9-a663-c6a44eff3b6e。

### 29 — 可用

原文：这笔投资从1,000美元降到800美元，亏损是200美元，也就是20%，不是只剩下原金额的20%。

Translation：This investment dropped from $1,000 to $800, which is a loss of $200, or 20%. It did not drop to 20% of the original amount.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1540ms；状态translated；界面匹配true；请求ID 09820e96-7f90-4580-97a1-75f47cfa4ebf。

### 30 — 可用

原文：页面上的年利率从4%降到了3%，下降了1个百分点，并不是下降了1%。请确认新的利率何时生效。

Translation：The annual interest rate on the page has decreased from 4% to 3%, which is a decrease of 1 percentage point, not a 1% decrease. Please confirm when the new interest rate will take effect.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1313ms；状态translated；界面匹配true；请求ID 5683ad07-5cfc-4206-ad75-b22a8cf0150a。

### 31 — 可用

原文：这笔交易金额为2,000 USDT，手续费率是0.1%，按此计算应收2 USDT，但记录显示20 USDT。请核查是否多收了18 USDT。

Translation：The transaction amount is 2,000 USDT and the fee rate is 0.1%. Based on this calculation, the fee should be 2 USDT, but the record shows 20 USDT. Please verify if an extra 18 USDT has been charged.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，4703ms；状态translated；界面匹配true；请求ID d3266b31-21c7-4c53-b19e-8505076c5cd6。

### 32 — 可用

原文：我已经支付了开仓手续费，但账单里又有一笔5 USDT的资金费用。我想了解两者的区别，并不是认定这5 USDT属于重复扣费。

Translation：I have already paid the opening fee, but there is an additional 5 USDT funding fee on my bill. I would like to understand the difference between the two; I am not claiming that this 5 USDT is a duplicate charge.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，3959ms；状态translated；界面匹配true；请求ID cd9400e7-aa8f-4af3-83d0-4027e97bba43。

### 33 — 可用

原文：我的止损触发价是95 USDT，但实际成交价是94.50 USDT。请解释原因；我没有说订单是在95 USDT成交的。

Translation：My stop-loss trigger price is 95 USDT, but the actual execution price was 94.50 USDT. Please explain the reason for this; I am not saying that the order was executed at 95 USDT.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，3298ms；状态translated；界面匹配true；请求ID e4137a85-a228-468d-9551-d9b05aabd0b3。

### 34 — 可用

原文：我持有10张合约，只申请平掉其中4张，应该还剩6张，但页面显示仓位已全部关闭。请核查。

Translation：I held 10 contracts and only applied to close 4 of them; there should be 6 remaining, but the page shows that all positions have been closed. Please check this.

Source notes：无

评审：10张、只关4、应剩6和页面显示全部关闭均保留；positions为可理解的泛称，不凭原文未明示的英文单复数机械判错。

执行：1次模型HTTP，1538ms；状态translated；界面匹配true；请求ID ca59e045-beda-4499-900a-9615995ae8df。

### 35 — 可用

原文：我向平台借了500 USDT，已经归还200 USDT，按本金计算还欠300 USDT。请单独列出利息，不要把已还的200 USDT再次计入欠款。

Translation：I borrowed 500 USDT from the platform and have already repaid 200 USDT, leaving a remaining principal balance of 300 USDT. Please list the interest separately and do not include the 200 USDT that has already been repaid in the outstanding debt calculation.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1654ms；状态translated；界面匹配true；请求ID da2b0fa9-74a2-4c33-8664-1c7e4acecfae。

### 36 — 可用

原文：账单合计为1,020美元，其中本金1,000美元，利息20美元。我想提前还清全部1,020美元，不是只支付20美元利息。

Translation：The total bill is 1,020 USD, consisting of 1,000 USD in principal and 20 USD in interest. I would like to pay off the full 1,020 USD early, rather than just paying the 20 USD interest.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1869ms；状态translated；界面匹配true；请求ID f3f23413-68f4-42ef-9316-69e879781f73。

### 37 — 可用

原文：这笔600美元账单分6期偿还，每期100美元。我已经付了4期，还剩2期，不是还剩4期。

Translation：This $600 bill is to be repaid in 6 installments of $100 each. I have already paid 4 installments, and there are 2 installments remaining, not 4.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1542ms；状态translated；界面匹配true；请求ID aee789c8-ef74-46ec-97bf-29dc793fa7d6。

### 38 — 可用

原文：本月应还100美元，但我误操作还了两次。请把多还的100美元退回，不要在退回后把正常那笔还款也撤销。

Translation：The amount due this month was $100, but I made a mistake and paid twice. Please refund the extra $100 paid, and do not cancel the normal payment after the refund is processed.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1532ms；状态translated；界面匹配true；请求ID 0f9a7324-28fd-489e-866f-4251f8e81606。

### 39 — 可用

原文：活动页面写的是符合条件后奖励15 USDT，但我只收到5 USDT。请核查剩余10 USDT是否尚未发放。

Translation：The event page stated that a 15 USDT reward would be given upon meeting the requirements, but I only received 5 USDT. Please check whether the remaining 10 USDT has not yet been issued.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1400ms；状态translated；界面匹配true；请求ID 96bd2ccc-e136-4289-9d3a-b336bb1c382d。

### 40 — 可用

原文：活动返现比例为10%，最高返20美元。我的消费金额是300美元，因此按上限应返20美元，而不是30美元。

Translation：The event cashback rate is 10%, with a maximum of 20 USD. My transaction amount is 300 USD, so according to the cap, I should receive 20 USD back, not 30 USD.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1534ms；状态translated；界面匹配true；请求ID c505a2c8-641d-4805-a653-9a560795ecb7。

### 41 — 可用

原文：账户里的50美元是优惠券额度，不是可以提现的现金。我想确认使用条件，不是申请提现这50美元。

Translation：The 50 USD in my account is voucher credit, not withdrawable cash. I would like to confirm the terms of use, rather than apply to withdraw these 50 USD.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1643ms；状态translated；界面匹配true；请求ID 4ddc0522-5d16-4d50-8d92-f1c9b2051e3f。

### 42 — 可用

原文：我的身份材料已经提交，但还没有通过审核。请告知是否需要补充材料，不要将我的账户标记为已验证。

Translation：I have already submitted my identity materials, but they have not yet passed the review. Please let me know if I need to provide any supplementary materials, and do not mark my account as verified.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1318ms；状态translated；界面匹配true；请求ID 344728eb-7868-481a-852d-8d16538d4f7b。

### 43 — 可用

原文：我可以登录账户，但已经无法使用旧邮箱。请帮助我更换绑定邮箱，不要注销账户或删除交易记录。

Translation：I can log into my account, but I can no longer use my old email address. Please help me change the bound email address; do not cancel the account or delete the transaction history.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1313ms；状态translated；界面匹配true；请求ID 8dfc49df-bf1b-4514-95a3-1fc643881cf6。

### 44 — 可用

原文：我丢失了验证器，但仍能使用绑定手机接收短信。请告诉我如何申请重置两步验证，我没有要求关闭所有安全验证。

Translation：I have lost my authenticator, but I can still use my linked mobile phone to receive SMS messages. Please tell me how to apply for a reset of my two-step verification. I am not requesting that all security verifications be turned off.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1309ms；状态translated；界面匹配true；请求ID 1cb333db-2957-4cf8-970c-d1f06a1182fa。

### 45 — 可用

原文：我目前可以登录和交易，只是无法提现。请核查提现限制，不要把问题记录成账户完全无法使用。

Translation：I can currently log in and trade; I am just unable to make withdrawals. Please check the withdrawal restrictions, and do not record this issue as the account being completely unusable.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1647ms；状态translated；界面匹配true；请求ID 268ff1ee-5094-450f-bac0-1c94f94ab4ed。

### 46 — 可用

原文：请提供2026年8月1日至8月31日的交易明细，包含这两天的记录，不需要9月份的数据。

Translation：Please provide the transaction details from August 1, 2026, to August 31, 2026, including the records for both of these days. I do not need the data for September.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1538ms；状态translated；界面匹配true；请求ID 646ff1df-10b9-4f29-9f10-eae8cda80c95。

### 47 — 可用

原文：这笔交易发生在北京时间9月10日凌晨0点30分，对应UTC时间9月9日16点30分。请按UTC时间查找，不要只查9月10日。

Translation：This transaction occurred at 00:30 on September 10, Beijing time, which corresponds to 16:30 on September 9, UTC time. Please search using UTC time, and do not limit the search to September 10.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1427ms；状态translated；界面匹配true；请求ID b910f1cc-c433-462c-be80-49bf55ed0372。

### 48 — 可用

原文：客服之前说通常需要1到3个工作日，并没有保证24小时内完成。目前已经过了4个工作日，请提供最新进展。

Translation：Customer service previously stated that it usually takes 1 to 3 business days and did not guarantee completion within 24 hours. It has now been 4 business days; please provide the latest progress.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1183ms；状态translated；界面匹配true；请求ID 61af9e67-162d-4f56-baac-0c1a95645d70。

### 49 — 可用

原文：如果这笔重复扣费已经退回，请提供退款凭证；如果尚未退回，请继续处理。我不要求额外赔偿，只要求退回重复扣除的75美元。

Translation：If this duplicate charge has already been refunded, please provide a refund receipt; if it has not been refunded yet, please continue to process it. I am not requesting additional compensation, only the return of the $75 that was deducted in duplicate.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，4728ms；状态translated；界面匹配true；请求ID 53cd0b65-5734-4c2a-a3b5-58dc81d6fd33。

### 50 — 可用

原文：请先将剩余的125.50美元退回原付款账户，再关闭我的账户。如果退款尚未完成，请暂时不要关闭账户。

Translation：Please first refund the remaining $125.50 to the original payment account, then close my account. If the refund has not yet been completed, please do not close the account for the time being.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1424ms；状态translated；界面匹配true；请求ID 7f9e0f67-d615-4bd9-976e-5f3d1cb44462。

### 51 — 可用

原文：您好，我昨天冲值了500 USDT，到现在还没到帐，麻烦帮我查一下。

Translation：Hello, I deposited 500 USDT yesterday, and it has not yet arrived in my account. Please help me check the status.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1434ms；状态translated；界面匹配true；请求ID 45d56fda-369b-495c-a54d-e9a6d8b637d2。

### 52 — 可用

原文：我提先了1,000 USDT，手序费是2 USDT，应该到帐998 USDT，但只收道990 USDT，请帮我查少的8 USDT。

Translation：I withdrew 1,000 USDT. The fee was 2 USDT, so I should have received 998 USDT, but I only received 990 USDT. Please help me look into the missing 8 USDT.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，7246ms；状态translated；界面匹配true；请求ID beb15145-a5a6-4d32-a121-b474093c6900。

### 53 — 可用

原文：我的退款申清已经审和通过了，可钱还没到，请问是还没打款吗？

Translation：My refund application has been approved, but the funds have not arrived yet. May I ask if the payment has not been sent yet?

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1866ms；状态translated；界面匹配true；请求ID 9b3e90dc-ea90-4013-91bf-f4618c64182f。

### 54 — 可用

原文：这个月会员费扣了俩次每次20美元我只订了一份请把多扣的那次反还给我

Translation：The membership fee was deducted twice this month, 20 USD each time. I only subscribed to one; please refund the extra deduction to me.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1206ms；状态translated；界面匹配true；请求ID 9078c4c4-2b06-4095-8625-e42cb94dcbbd。

### 55 — 可用

原文：这三笔里100美元的是我付的，另外俩笔各200美元不是我弄的，请查那俩笔就行。

Translation：Among these three transactions, the $100 one was paid by me; the other two transactions of $200 each were not made by me. Please investigate those two transactions.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1530ms；状态translated；界面匹配true；请求ID 3ee7645e-65c5-4a51-a03d-07a456b74d8c。

### 56 — 可用

原文：我的手机能收到短信，但是验正码一直收不道，不是手机号不能用了。

Translation：My phone can receive SMS messages, but I have not been receiving the verification codes. It is not that my phone number is no longer working.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1418ms；状态translated；界面匹配true；请求ID 4a671f67-af81-407c-afaf-eb1d916cb21a。

### 57 — 可用

原文：我能登登录，也能看余额，就是提不了现，请不要把我的帐户写成完全不能使用。

Translation：I can log in and view my balance, but I am unable to make a withdrawal. Please do not describe my account as completely unusable.

Source notes：无

评审：正确保留记录/描述账户问题的诉求，没有变成要求改变账户权限。

执行：1次模型HTTP，1100ms；状态translated；界面匹配true；请求ID 350f174b-0170-4aa5-be87-08c6b0a26ffb。

### 58 — 可用

原文：余额里有300 USDT被冻洁了，但并没有扣掉，我是想问怎么解冻，不是申请退这300。

Translation：There is 300 USDT frozen in my balance, but it has not been deducted. I would like to ask how to unfreeze it; I am not requesting a refund of these 300.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1529ms；状态translated；界面匹配true；请求ID db3dc9ec-11ed-43df-8745-8b805994f6cb。

### 59 — 可用

原文：我把200 USDT转错给David了，本来要转给Sarah，请帮我看看能不能追会来，先别再转一笔。

Translation：I accidentally transferred 200 USDT to David, when I meant to transfer it to Sarah. Please help me check if it is possible to recover the funds. Also, please do not process any further transfers for the time being.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1757ms；状态translated；界面匹配true；请求ID 352b6882-e19a-4b1f-b5b8-45b0898a7b15。

### 60 — 可用

原文：我借了平台两千五USDT，已经还了一千，还欠一千五本金，利西麻烦另外列出来。

Translation：I borrowed 2,500 USDT from the platform and have already repaid 1,000. I still owe 1,500 in principal. Please list the interest separately.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1536ms；状态translated；界面匹配true；请求ID 13113c1f-c1df-4cbf-8b3c-bc0800402422。

### 61 — 可用

原文：我卖100个币，成较了60个，还胜40个没卖出，请只撤掉没成交的40个。

Translation：I put up 100 coins for sale, 60 have been traded, and 40 are still left unsold. Please only cancel the 40 that have not been traded.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1528ms；状态translated；界面匹配true；请求ID 9f0891b2-efcd-4b19-aa9f-29327b7280e3。

### 62 — 可用

原文：我上周就关了自动续，今天咋又扣我20美元？请查这次扣费，已经买的这个月服务别停。

Translation：I turned off auto-renewal last week, so why was I charged another 20 USD today? Please investigate this charge; do not stop the service for this month that has already been purchased.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1312ms；状态translated；界面匹配true；请求ID 63c69fe7-5572-4e69-9c1d-4fda6893f03d。

### 63 — 可用

原文：手序费写的是0.1%，我交易2,000 USDT应该扣2 USDT，不是20 USDT，是不是多扣了18？

Translation：The service fee is stated as 0.1%. For my transaction of 2,000 USDT, 2 USDT should have been deducted, not 20 USDT. Was an extra 18 USDT deducted?

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1319ms；状态translated；界面匹配true；请求ID c3c3e3ad-79e6-4519-83f9-d80c968c46b2。

### 64 — 语义错误

原文：我买的是0.025 BTC，不是0.0025 BTC，你们显示少个数量，麻烦核下，别把小数点看错。

Translation：I bought 0.025 BTC, not 0.0025 BTC. The amount you are displaying is missing a digit. Please check this and make sure you haven't misread the decimal point.

Source notes：无

评审：“少个数量”被擅自解释为 missing/short by a digit（少了一位数字）。金额虽然未变，错误机制却被补写；应保持宽泛如 The displayed quantity is too low.。原始模型输出已如此，恢复和后处理未改坏；本地检查未检出。

执行：1次模型HTTP，1641ms；状态translated；界面匹配true；请求ID 8c63bfb4-e107-4239-9da9-9373b37210c7。

### 65 — 可用

原文：之前说1到3个工做日，不是3个自然日，我已经等了4个工作日了，请给个进展。

Translation：I was previously told 1 to 3 business days, not 3 calendar days. I have already waited 4 business days; please provide a status update.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，2627ms；状态translated；界面匹配true；请求ID 58bd2a5b-72ef-4ac6-894a-5775a3dc6baf。

### 66 — 语义错误

原文：我不是不是要退款，我是要退款，但只退多扣的50美元，正常那笔别动。

Translation：I am not saying I do not want a refund, I do want a refund, but only for the 50 USD that was overcharged; please do not touch the normal transaction.

Source notes：The customer uses a double negative '不是不是' (not not) followed by an affirmative statement, which creates a logical contradiction regarding their refund request. I have translated this to reflect the customer's clarification that they do intend to request a refund.［我不是不是要退款，我是要退款］

评审：正文已正确表达“不是说不要退款；确实要退款”，但英文Source note仍断言 double negative + affirmative creates a logical contradiction。两者实际一致，提示误导英文读者，所以整条不计可用。提示来自模型原始输出；本地只核验结构和引用片段，不能可靠验证所有否定语义，未自动检出。

执行：1次模型HTTP，1745ms；状态translated；界面匹配true；请求ID 59249818-46d7-41f0-869e-dcd131eba82e。

### 67 — 可用

原文：我转了1,500 USDT，也就是一万五千USDT，但一直没到账，请查一下。

Translation：I transferred 1,500 USDT, that is 15,000 USDT, but it has not been credited yet. Please check.

Source notes：The customer equates 1500 with 15000 USDT. These stated amounts conflict. The translation preserves both; please confirm the intended amount.［1,500 USDT，也就是一万五千USDT］

评审：客户原文1500和15000同时保留；独立英文提示准确指出金额冲突并要求确认。

执行：1次模型HTTP，1424ms；状态translated；界面匹配true；请求ID 2d649bcd-faa9-475b-b643-a914c9d1fc3d。

### 68 — 可用

原文：我这笔钱转出去了，现在想把它退追回来，请帮我处理。

Translation：I have transferred this money out, and I would like to get it back. Please help me process this.

Source notes：无

评审：get it back保留宽泛拿回资金的愿望，没有擅自指定金融处理流程。

执行：1次模型HTTP，1090ms；状态translated；界面匹配true；请求ID 124ca7a2-b207-4072-a0a0-935294cea37e。

### 69 — 可用

原文：我提现1,000 USDT，扣2 USDT手续费，应到账998 USDT，实际到账990 USDT，所以少了18 USDT，请核查。

Translation：I requested a withdrawal of 1,000 USDT. With a 2 USDT fee deducted, I should have received 998 USDT, but I only received 990 USDT. Therefore, 18 USDT is missing. Please investigate this.

Source notes：The customer states a shortfall of 18 USDT, but 998 minus 990 equals 8 USDT. The translation preserves the stated amount.［应到账998 USDT，实际到账990 USDT，所以少了18］

评审：正文保留客户写的18；独立英文指出998减990等于8，没有替客户改数。

执行：1次模型HTTP，1418ms；状态translated；界面匹配true；请求ID 3959dc63-ccae-49c1-9e66-0ca2b9ef5e81。

### 70 — 可用

原文：我的交易编号是ABO105，里面第三位是大写字母O，不是数字0。请用这个编号查那笔75美元的扣款。

Translation：My transaction ID is ABO105; the third character is the uppercase letter O, not the number 0. Please use this ID to check the $75 deduction.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，3721ms；状态translated；界面匹配true；请求ID 7c466b33-5a54-480a-8893-fa893cb5ca20。

## controls

### 51 — 可用

原文：您好，我昨天充值了500 USDT，到现在还没到账，麻烦帮我查一下。

Translation：Hello, I deposited 500 USDT yesterday, and it has not arrived in my account yet. Could you please help me check on this?

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1867ms；状态translated；界面匹配true；请求ID b373e2a4-5c4e-4f3b-a20c-bed897b45821。

### 52 — 可用

原文：我提现了1,000 USDT，手续费是2 USDT，应该到账998 USDT，但只收到990 USDT，请帮我查少的8 USDT。

Translation：I withdrew 1,000 USDT and the fee was 2 USDT. I should have received 998 USDT, but I only received 990 USDT. Please help me check into the missing 8 USDT.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1438ms；状态translated；界面匹配true；请求ID 3e909b28-2947-4b71-a07c-530b81aedb7d。

### 53 — 可用

原文：我的退款申请已经审核通过了，可钱还没到，请问是还没打款吗？

Translation：My refund application has been approved, but I have not received the funds yet. Has the payment not been processed yet?

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1434ms；状态translated；界面匹配true；请求ID 0e4d8000-d879-43a8-ac09-7d4d542203a5。

### 54 — 可用

原文：这个月会员费扣了两次，每次20美元。我只订了一份，请把多扣的那次返还给我。

Translation：My membership fee was deducted twice this month, 20 USD each time. I only subscribed to one; please refund the extra charge to me.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1962ms；状态translated；界面匹配true；请求ID bc979f27-2c04-4840-b1fc-eb6668cffd47。

### 55 — 可用

原文：这三笔里100美元的是我付的，另外两笔各200美元不是我弄的，请查那两笔就行。

Translation：Of these three transactions, the $100 one was paid by me; the other two transactions of $200 each were not made by me. Please only investigate those two.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1545ms；状态translated；界面匹配true；请求ID b271e464-f729-460b-9429-05523efa5f15。

### 56 — 可用

原文：我的手机能收到短信，但是验证码一直收不到，不是手机号不能用了。

Translation：My mobile phone can receive text messages, but I haven't been receiving the verification codes. It is not that my phone number is no longer working.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，5140ms；状态translated；界面匹配true；请求ID 3d61ae43-2022-4ec3-87c7-8e43f2976830。

### 57 — 可用

原文：我能登录，也能看余额，就是提不了现，请不要把我的账户写成完全不能使用。

Translation：I can log in and view my balance, but I am unable to make withdrawals. Please do not label my account as completely unusable.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1428ms；状态translated；界面匹配true；请求ID fc2f6433-8001-4bcf-a2dd-13329e1fb059。

### 58 — 可用

原文：余额里有300 USDT被冻结了，但并没有扣掉，我是想问怎么解冻，不是申请退这300。

Translation：There are 300 USDT in my balance that have been frozen, but they have not been deducted. I would like to ask how to unfreeze them. I am not requesting a refund of these 300 USDT.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，2419ms；状态translated；界面匹配true；请求ID 0bf215ee-0fc7-415c-8925-90e3ab7ee61f。

### 59 — 可用

原文：我把200 USDT转错给David了，本来要转给Sarah，请帮我看看能不能追回来，先别再转一笔。

Translation：I accidentally transferred 200 USDT to David instead of Sarah. Please check if it can be recovered, and please do not process another transfer for the time being.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1754ms；状态translated；界面匹配true；请求ID 5ed644ff-7256-425e-91df-53359fbb119e。

### 60 — 可用

原文：我借了平台两千五USDT，已经还了一千，还欠一千五本金，利息麻烦另外列出来。

Translation：I borrowed 2,500 USDT from the platform. I have already repaid 1,000, and I still owe 1,500 in principal. Please list the interest separately.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1859ms；状态translated；界面匹配true；请求ID 70f23e99-93ec-448e-a664-b0fc0ad0946c。

### 61 — 可用

原文：我卖100个币，成交了60个，还剩40个没卖出，请只撤掉没成交的40个。

Translation：I placed an order to sell 100 coins, 60 were executed, and 40 remain unsold. Please only cancel the 40 that have not been executed.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1206ms；状态translated；界面匹配true；请求ID 034c222b-2e13-408b-b966-a1eb0a837f28。

### 62 — 可用

原文：我上周就关了自动续费，今天咋又扣我20美元？请查这次扣费，已经买的这个月服务别停。

Translation：I turned off auto-renewal last week, so why was I charged 20 USD again today? Please investigate this charge, and do not stop the service I have already purchased for this month.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1538ms；状态translated；界面匹配true；请求ID cb4ed182-5f9e-4af9-9dfc-184bbff0e2ed。

### 63 — 可用

原文：手续费写的是0.1%，我交易2,000 USDT应该扣2 USDT，不是20 USDT，是不是多扣了18？

Translation：The fee is stated as 0.1%. For a transaction of 2,000 USDT, the fee should be 2 USDT, not 20 USDT. Was an extra 18 deducted?

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1549ms；状态translated；界面匹配true；请求ID d9a802ba-1560-4bcb-a350-446ba0c47081。

### 64 — 可用

原文：我买的是0.025 BTC，不是0.0025 BTC，你们显示的数量少了，麻烦核查一下，别把小数点看错。

Translation：I purchased 0.025 BTC, not 0.0025 BTC. The quantity you are showing is too low. Please check this and ensure you haven't misread the decimal point.

Source notes：无

评审：纠正普通错字后原文明确“显示的数量少了”，模型正确译为quantity is too low，没有补写缺失数字。与原64失败形成对照，但不能把纠错版当原文的替代来源。

执行：1次模型HTTP，1742ms；状态translated；界面匹配true；请求ID f07ca114-b1ac-44de-99e0-62de854f1139。

### 65 — 可用

原文：之前说1到3个工作日，不是3个自然日，我已经等了4个工作日了，请给个进展。

Translation：You previously stated 1 to 3 business days, not 3 calendar days. I have already waited for 4 business days; please provide an update on the progress.

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，2080ms；状态translated；界面匹配true；请求ID a31584a6-4763-48c2-a719-fad7a13a22b3。

### 66 — 语义错误

原文：我不是不是要退款；我是要退款，但只退多扣的50美元，正常那笔别动。

Translation：I do not want a refund; actually, I do want a refund, but only for the extra $50 that was deducted. Please do not touch the regular charge.

Source notes：The customer uses a double negative '不是不是' followed by a contradiction '我是要退款', which functions as a correction of their initial statement.［我不是不是要退款；我是要退款］

评审：即使仅增加分号、没有改变双重否定，对照译文仍先断言I do not want a refund，随后actually改口，并把原文的两个一致肯定错误解释为矛盾。正文和提示均有错误；原始模型输出已如此，本地未检出。

执行：1次模型HTTP，1949ms；状态translated；界面匹配true；请求ID 5e15a7ea-b3ca-462e-9780-c44df7c66f3e。

## ambiguity

### 201 — 语义错误

原文：这笔75 USDT已经到账了，但这同一笔75 USDT到现在还没到账。请查一下。

Translation：This 75 USDT has arrived, but this same 75 USDT has still not arrived yet. Please check.

Source notes：The customer refers to two different transactions as the 'same' transaction while claiming one has arrived and the other has not.［但这同一笔75 USDT］

评审：正文忠实保留同一笔75 USDT既已到又未到的矛盾；提示却擅自说two different transactions，新增两笔交易。真正的提示应说同一笔款的到账状态相互矛盾。错误在模型原始提示中，本地结构/引用检查未能检出。

执行：1次模型HTTP，2420ms；状态translated；界面匹配true；请求ID 3c133b73-a9fe-4e4f-a06a-9567f28ae632。

### 202 — 需澄清/无结果

原文：关于David和我的欠款500美元，欠款人名字漏写了。我也不确定这里说的是谁欠谁，请先核实。

Translation：（空）

Source notes：A faithful translation could not be produced within the repair limit. Please review the original details. Checks requiring review: ungrounded_source_note. This is a translation validation limitation, not evidence that the customer's statement is wrong.［关于David和我的欠款500美元，欠款人名字漏写了。我也不确定这里说的是谁欠谁，请先核实。］

评审：两次模型引用都把原文“我也不确定这里说的是谁欠谁”省略为“我不确定这里说的是谁欠谁”，英文提示首轮正确表达债权债务关系不清，但精确substring检查将引用缺少“也”作为失败，修复一次后仍返回review_required。这属于新发现的引用校验过严，不能全部归因于模型：引用确实不是逐字摘录，却不足以证明正文错误。正文的my debt也不够中性，尚需语义评审；不能把本次停止算成合理澄清成功。保留两次候选。

执行：2次模型HTTP，4617ms；状态review_required；界面匹配true；请求ID f8271c52-2521-4844-a877-bd53bc2de4bc。

### 203 — 语义错误

原文：这笔50美元交易的编号第三位看不清，可能是大写O，也可能是数字0，请不要替我确定。

Translation：The third character of the ID for this $50 transaction is unclear; it could be an uppercase 'O' or the number '0'. Please do not decide this for me.

Source notes：无

评审：正文准确保留编号第三位O/0不确定，也没有替用户选择；但模型返回空Source notes，界面无邻近提醒状态，不满足本次关键编号歧义必须单独英文提示的验收要求。正文可理解不等于该要求通过。

执行：1次模型HTTP，2728ms；状态translated；界面匹配true；请求ID 668b9bbe-d254-4f39-abb3-03b65eb6f5cd。

## other

### 101 — 可用

原文：David还没把那份文件发给Sarah，请明天上午再跟进，不要现在催。

Translation：David hasn't sent the document to Sarah yet. Please follow up tomorrow morning instead of pushing for it now

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，1982ms；状态200；界面匹配true；请求ID 5d8018fc-a6e1-4f01-9aea-d7b2e2a63985。

### 102 — 可用

原文：Sarah sent the invoice to David, but he has not paid the 75 USD yet. Please follow up tomorrow.

Translation：Sarah 把发票发给了 David，但他还没付那 75 USD。请明天跟进一下

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，3202ms；状态200；界面匹配true；请求ID ef4f95c8-2d9c-475d-96c5-e68e78007c92。

### 103 — 可用

原文：Please refund the duplicate charge of 50 USD to my original payment card. Do not cancel the other payment.

Translation：请将重复扣除的 50 美元退还至我的原支付卡。请勿取消另一笔款项

Source notes：无

评审：逐条核对：保留原文主要事实、金额、人物关系、否定和请求范围。

执行：1次模型HTTP，2294ms；状态200；界面匹配true；请求ID f0c39087-7f8d-43b2-89dd-ea44932ebf47。

