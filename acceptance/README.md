# 翻译质量验收

此目录是开发与交付工具，不进入 Electron 交付包，也不会为普通用户翻译增加一次模型审查。固定 36 条英文→中文、同事协作用例见 `cases.json`。参考译文和评审重点只用于评审，运行器只把 `source` 发送给正常 `/api/translate`，不会把参考译文或评审重点放入请求。

## 运行

先执行 `npm test`，然后使用已有的 Verba 配置目录：

```powershell
npm run acceptance:run -- --config="$env:APPDATA/verba-workplace-translator/config" --gemini-interval-ms=4500 --label=full
```

默认跑所有三家供应商、36 条。也可用项目根目录 `.env` 或设置 `VERBA_CONFIG_DIR`。脚本不会创建新密钥、打印密钥或引入新的审查服务。`--providers=gemini,deepseek` 可选择供应商；`--cases=1,2` 可作回归。允许重复编号（如 `--cases=1,2,1,2`）以保留两次额外复测。每次启动创建新的唯一目录，逐条追加结果；失败、重试、未测均保留。不要删除失败记录后宣称通过。

`--gemini-interval-ms=4500` 只在开发验收中控制请求间隔，避免小额每分钟限流。额度/认证失败后剩余用例标为未测。恢复可用后另开一次运行，不覆盖旧结果。

真实界面复核：

```powershell
npm run acceptance:run -- --config="$env:APPDATA/verba-workplace-translator/config" --serve --port=3317 --label=ui
```

在浏览器打开 `http://127.0.0.1:3317`，选择英文→中文、同事协作、待测供应商，检查术语词典为空，依次输入 01、02、05、06、07、08、36 并点击翻译。记录实际显示文本和对应请求 ID 到运行目录 `ui-observations.json`。程序使用正常 `app.js`、实体保护、真实供应商、恢复、校验与展示路径；HTTP 批量运行覆盖服务端全链路，界面复核验证最终展示。界面翻译还会按产品正常行为写入该配置目录的历史记录（仅本次合成用例）。结束后停止本地进程。

## 证据与逐条评审

- `manifest.json`：时间、模式、供应商、用例和代码 SHA-256，区分修复阶段。
- `availability.json`：凭据是否存在和模型状态，不含密钥。
- `results.jsonl`：每一次请求的真实中文、模型、请求次数、耗时和错误；存在凭据不代表供应商实际可用。
- `trace.jsonl`：原始实体输入、模型原始 JSON、解析结果、实体恢复、后处理、最终状态。模型自行重生成的每个候选也保留。
- `reviews.json`：AI 直接逐条审阅原文及实际译文后记录逻辑/实体通过与理由、自然度、口语化、问题说明；必须绑定原始 `requestId` 和实际译文。
- `report.md`：逐条报告及全部候选。无译文的项目不评分；失败前生成但未交付的候选在单独表内，不冒充实际交付。

评审文件每条格式：

```json
{
  "requestId": "本次请求 ID",
  "translation": "本次实际中文",
  "reviewer": "AI",
  "logic": { "pass": true, "reason": "具体人物、动作方向、范围与事实判断" },
  "entities": { "pass": true, "reason": "具体姓名及代词判断" },
  "naturalness": 4,
  "colloquial": 4,
  "issues": "说明可润色之处或实际错误"
}
```

自然度与口语化分别评分：5 为同事聊天中自然会用；4 为自然清楚、轻微可润色；3 为可理解但生硬或书面；1–2 为明显不自然或妨碍理解。逻辑、姓名/代词必须通过，两项分数都至少 4。任何一项失败都不能靠平均分抵消。人工填写或 AI 审阅均应明确身份，本项目本轮使用 AI 审阅，未经过真人母语者验证。

```powershell
npm run acceptance:report -- acceptance/runs/<运行目录名>
```

该命令只检查评审完整性并生成报告，不自动判断语义。缺少评审、译文与评审不对应、未覆盖 36 条或有未达标结果时，退出码为 2，不能把脚本成功产生报告当作质量通过。正则检查、回译、模型自评分、HTTP 200 和界面文案都不是质量验收证据。主轮通过后还需核查已发现错误用例的两次额外复测及七条实际界面结果。

## 隐私边界

普通产品启动没有内容跟踪器。仅验收进程通过本地启动选项注入观察器；HTTP 请求不能启用它。观察器只记录与固定合成原文完全相同、方向/模式匹配且没有自定义术语的请求，不记录真实用户内容或提示词。公开合成数据可以提交；不要把密钥、真实历史、真实用户请求或配置目录复制进本目录。仓库中的 `*.log` 被忽略，交付依据是可提交的 JSON/JSONL/Markdown。

本轮结论见 `REPORT.md`，其结论只适用于列出的运行，不能推广为任意输入都正确。不发布 Release，不自动部署。

## 独立测试与本次后续修复

详细结果见 [修改前后对照](revision/COMPARISON.md) 和 [原失败复核](revision/FAILURE-AUDIT.md)。独立12条在生成方案冻结后创建并首次运行，没有据此调整提示或姓名规则。最后仅根据原36条的金额误拦截修复了数字解析，版本边界在对照报告中单列。

```powershell
npm run acceptance:run -- --config="$env:APPDATA/verba-workplace-translator/config" --providers=gemini,deepseek --fixtures=acceptance/revision/independent-12.json --gemini-interval-ms=4500 --label=independent
```

运行器会复制 fixtures.json 并保存 fixtureHash/requiredIds；报告的完整性指该运行对应的用例集，12条单独通过不代表整个交付验收通过。自然度和语义必须逐条AI或人工审阅，revision/review-tools.mjs仅辅助录入和汇总已作出的评审，不自动生成质量判断。后续编辑数字解析应重跑金额回归；后续调整生成提示必须重新做完整、独立和稳定性验证。
