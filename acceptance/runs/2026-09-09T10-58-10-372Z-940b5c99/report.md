# 翻译质量验收：full-retest

运行：2026-09-09T10-58-10-372Z-940b5c99；英文→中文；同事协作。

评审人为 AI（Codex），直接对照英文和本次实际中文；不是人工母语者验证。HTTP 成功、回译及正则校验都不代替语义与语言评审。仅适用于本次结果。

请求次数列为翻译请求 / 全部供应商 HTTP 请求（包括模型发现和健康检测）；早期记录缺少后者时记为 —。耗时为毫秒。

| 编号 | 供应商 / 模型 | 英文原文 | 实际交付中文 | 逻辑准确性及理由 | 姓名/代词及理由 | 自然度 | 口语化 | 问题说明 | 请求次数 | 耗时 | 结论 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | openai / 未选定 | She said that he had already sent them our address. | 未生成/未交付 | 未评审 | 未评审 | — | — | PROVIDER_UNAVAILABLE | 0 / 4 | 4010 | 未测/无可交付译文 |
| 2 | openai / 未选定 | They asked us to tell you that the meeting had been canceled. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 3 | openai / 未选定 | He said you could send it to me directly. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 4 | openai / 未选定 | We haven't told her yet because we're waiting for your confirmation. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 5 | openai / 未选定 | Nana asked David to help Sarah with her report. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 6 | openai / 未选定 | May said she may join us later. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 7 | openai / 未选定 | Will said he will send it tomorrow. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 8 | openai / 未选定 | Will you ask May if she can join us? | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 9 | openai / 未选定 | I gave her your number, but I didn't give you hers. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 10 | openai / 未选定 | You told me to contact him, but he told me to contact you. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 11 | openai / 未选定 | Please ask him to remind her to reply to us. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 12 | openai / 未选定 | My manager asked your assistant to contact their driver. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 13 | openai / 未选定 | She filled out the form herself, but I submitted it for her. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 14 | openai / 未选定 | The documents were sent to David by Sarah, not by me. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 15 | openai / 未选定 | I didn't ask you to cancel the order; I asked you to hold off on payment. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 16 | openai / 未选定 | You don't have to reply today, but please read it before tomorrow's meeting. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 17 | openai / 未选定 | Not everyone has received the update. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 18 | openai / 未选定 | None of them has approved the request. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 19 | openai / 未选定 | I only asked him to check the amount, not to approve the payment. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 20 | openai / 未选定 | She isn't refusing to help; she just needs more time. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 21 | openai / 未选定 | Don't send the files until Nana confirms the address. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 22 | openai / 未选定 | If he hasn't replied by noon, ask her to call him. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 23 | openai / 未选定 | Even if they agree, we still need your approval. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 24 | openai / 未选定 | Unless you tell me otherwise, I'll use the latest version. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 25 | openai / 未选定 | By the time I called her, she had already spoken to you. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 26 | openai / 未选定 | He might send it today, but he hasn't promised. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 27 | openai / 未选定 | You don't owe me anything; I owe you NGN 25,000. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 28 | openai / 未选定 | We paid them USD 1,250.50, but they refunded only USD 1,205.50. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 29 | openai / 未选定 | Each of the three employees should receive NGN 20,000, making NGN 60,000 in total. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 30 | openai / 未选定 | David has twice as many orders as I do, but only half as many as Sarah. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 31 | openai / 未选定 | Could you give me a heads-up before you change the schedule? | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 32 | openai / 未选定 | I'm not sure I follow. Are you saying we should wait? | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 33 | openai / 未选定 | No rush—just send it over when you get a chance. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 34 | openai / 未选定 | Someone from support called me. They said they'd check it for us. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 35 | openai / 未选定 | When David spoke to Michael, he sounded upset. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 36 | openai / 未选定 | Keep the username "She" unchanged, but translate the rest of her message. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: quota_error (HTTP 503); see attempted case 1 | 0 / — | 0 | 未测/无可交付译文 |
| 1 | gemini / gemini-3.1-flash-lite | She said that he had already sent them our address. | 她说他已经把我们的地址发给他们了 | 通过：她转述；他已经发送；接收者是他们；地址属于我们。 | 通过：She、he、them、our分别按她、他、他们、我们的含义处理。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 4179 | 通过 |
| 2 | gemini / gemini-3.1-flash-lite | They asked us to tell you that the meeting had been canceled. | 他们让我们通知你，会议已经取消了 | 通过：他们提出要求，我们负责转告，你接收会议已取消的消息。 | 通过：They为普通代词；us与you对应我们与你。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 3150 | 通过 |
| 3 | gemini / gemini-3.1-flash-lite | He said you could send it to me directly. | 他说你可以直接发给我 | 通过：他转述许可，你发送，我接收；直接发送的关系保留。 | 通过：He、you、me按他、你、我处理，没有误作姓名。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 2365 | 通过 |
| 4 | gemini / gemini-3.1-flash-lite | We haven't told her yet because we're waiting for your confirmation. | 我们还没告诉她，因为在等你的确认 | 通过：尚未告诉她；原因是等待你的确认。 | 通过：we、her、your的指代及所属关系保留。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 3439 | 通过 |
| 5 | gemini / gemini-3.1-flash-lite | Nana asked David to help Sarah with her report. | Nana 请 David 帮忙处理 Sarah 的报告 | 通过：Nana提出要求，David帮助Sarah，报告归Sarah；未写成任务已经完成。 | 通过：Nana、David、Sarah保留英文；报告指向Sarah。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 2599 | 通过 |
| 6 | gemini / gemini-3.1-flash-lite | May said she may join us later. | May 说她可能稍后加入我们 | 通过：姓名May发言；参加只是可能，时间是晚些时候。 | 通过：May是英文姓名；小写may是可能性，不是姓名。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 2192 | 通过 |
| 7 | gemini / gemini-3.1-flash-lite | Will said he will send it tomorrow. | Will 说他明天会发过来 | 通过：Will发言并说明明天会发送，没有增加具体接收人。 | 通过：姓名Will保留；普通will译出将来含义。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1918 | 通过 |
| 8 | gemini / gemini-3.1-flash-lite | Will you ask May if she can join us? | 麻烦问下 May 她方便加入我们吗 | 通过：请求听者去问May是否能一起参加，询问和参加两层动作保留。 | 通过：句首Will按请求语气处理；May保留为姓名。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 3618 | 通过 |
| 9 | gemini / gemini-3.1-flash-lite | I gave her your number, but I didn't give you hers. | 我把你的号码给她了，但我没有把她的号码给你 | 通过：我给她的是你的号码；没给你的是她的号码。 | 通过：your与hers两个号码归属分别保留。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 2918 | 通过 |
| 10 | gemini / gemini-3.1-flash-lite | You told me to contact him, but he told me to contact you. | 你让我联系他，但他让我联系你 | 通过：你要求我联系他，他要求我联系你，两次联系对象没有颠倒。 | 通过：you、me、him在两次要求中的角色分别正确。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 2265 | 通过 |
| 11 | gemini / gemini-3.1-flash-lite | Please ask him to remind her to reply to us. | 麻烦让他提醒她回复我们 | 通过：听者让他提醒她，再由她回复我们，中间人完整。 | 通过：他、她、我们各有角色，未丢失中间参与者。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 3880 | 通过 |
| 12 | gemini / gemini-3.1-flash-lite | My manager asked your assistant to contact their driver. | 我的主管让我助理联系了他们的司机 | 失败：把“你的助理”译成“我助理”，且“联系了”增加已完成含义。 | 失败：助理归属从听者改为说话者。 | 4 | 4 | 助理归属从听者改为说话者。 | 1 / 1 | 3234 | 未达标 |
| 13 | gemini / gemini-3.1-flash-lite | She filled out the form herself, but I submitted it for her. | 表格是她自己填的，但我替她提交了 | 通过：她独自填表，我替她提交，两项动作主体区分清楚。 | 通过：herself译为她自己；for her译为替她或帮她。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 2494 | 通过 |
| 14 | gemini / gemini-3.1-flash-lite | The documents were sent to David by Sarah, not by me. | 文件是 Sarah 发给 David 的，不是我发的 | 通过：Sarah发送，David接收；否认发送者是我。 | 通过：Sarah和David原样保留；me按我翻译。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 2071 | 通过 |
| 15 | gemini / gemini-3.1-flash-lite | I didn't ask you to cancel the order; I asked you to hold off on payment. | 我没有让你取消订单，我是让你先暂停付款 | 通过：否定取消订单的要求，肯定暂缓付款的要求，两个动作区分清楚。 | 通过：I与you的要求关系保留，没有把否定对象换人。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 2916 | 通过 |
| 16 | gemini / gemini-3.1-flash-lite | You don't have to reply today, but please read it before tomorrow's meeting. | 未生成/未交付 | 未评审 | 未评审 | — | — | PROVIDER_QUOTA_ERROR | 1 / 1 | 306 | 未测/无可交付译文 |
| 17 | gemini / 未选定 | Not everyone has received the update. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: degraded (HTTP 429); see attempted case 16 | 0 / — | 0 | 未测/无可交付译文 |
| 18 | gemini / 未选定 | None of them has approved the request. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: degraded (HTTP 429); see attempted case 16 | 0 / — | 0 | 未测/无可交付译文 |
| 19 | gemini / 未选定 | I only asked him to check the amount, not to approve the payment. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: degraded (HTTP 429); see attempted case 16 | 0 / — | 0 | 未测/无可交付译文 |
| 20 | gemini / 未选定 | She isn't refusing to help; she just needs more time. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: degraded (HTTP 429); see attempted case 16 | 0 / — | 0 | 未测/无可交付译文 |
| 21 | gemini / 未选定 | Don't send the files until Nana confirms the address. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: degraded (HTTP 429); see attempted case 16 | 0 / — | 0 | 未测/无可交付译文 |
| 22 | gemini / 未选定 | If he hasn't replied by noon, ask her to call him. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: degraded (HTTP 429); see attempted case 16 | 0 / — | 0 | 未测/无可交付译文 |
| 23 | gemini / 未选定 | Even if they agree, we still need your approval. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: degraded (HTTP 429); see attempted case 16 | 0 / — | 0 | 未测/无可交付译文 |
| 24 | gemini / 未选定 | Unless you tell me otherwise, I'll use the latest version. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: degraded (HTTP 429); see attempted case 16 | 0 / — | 0 | 未测/无可交付译文 |
| 25 | gemini / 未选定 | By the time I called her, she had already spoken to you. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: degraded (HTTP 429); see attempted case 16 | 0 / — | 0 | 未测/无可交付译文 |
| 26 | gemini / 未选定 | He might send it today, but he hasn't promised. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: degraded (HTTP 429); see attempted case 16 | 0 / — | 0 | 未测/无可交付译文 |
| 27 | gemini / 未选定 | You don't owe me anything; I owe you NGN 25,000. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: degraded (HTTP 429); see attempted case 16 | 0 / — | 0 | 未测/无可交付译文 |
| 28 | gemini / 未选定 | We paid them USD 1,250.50, but they refunded only USD 1,205.50. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: degraded (HTTP 429); see attempted case 16 | 0 / — | 0 | 未测/无可交付译文 |
| 29 | gemini / 未选定 | Each of the three employees should receive NGN 20,000, making NGN 60,000 in total. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: degraded (HTTP 429); see attempted case 16 | 0 / — | 0 | 未测/无可交付译文 |
| 30 | gemini / 未选定 | David has twice as many orders as I do, but only half as many as Sarah. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: degraded (HTTP 429); see attempted case 16 | 0 / — | 0 | 未测/无可交付译文 |
| 31 | gemini / 未选定 | Could you give me a heads-up before you change the schedule? | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: degraded (HTTP 429); see attempted case 16 | 0 / — | 0 | 未测/无可交付译文 |
| 32 | gemini / 未选定 | I'm not sure I follow. Are you saying we should wait? | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: degraded (HTTP 429); see attempted case 16 | 0 / — | 0 | 未测/无可交付译文 |
| 33 | gemini / 未选定 | No rush—just send it over when you get a chance. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: degraded (HTTP 429); see attempted case 16 | 0 / — | 0 | 未测/无可交付译文 |
| 34 | gemini / 未选定 | Someone from support called me. They said they'd check it for us. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: degraded (HTTP 429); see attempted case 16 | 0 / — | 0 | 未测/无可交付译文 |
| 35 | gemini / 未选定 | When David spoke to Michael, he sounded upset. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: degraded (HTTP 429); see attempted case 16 | 0 / — | 0 | 未测/无可交付译文 |
| 36 | gemini / 未选定 | Keep the username "She" unchanged, but translate the rest of her message. | 未生成/未交付 | 未评审 | 未评审 | — | — | Provider unavailable: degraded (HTTP 429); see attempted case 16 | 0 / — | 0 | 未测/无可交付译文 |
| 1 | deepseek / deepseek-v4-flash | She said that he had already sent them our address. | 她说他已经把我们的地址发给他们了 | 通过：她转述；他已经发送；接收者是他们；地址属于我们。 | 通过：She、he、them、our分别按她、他、他们、我们的含义处理。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1210 | 通过 |
| 2 | deepseek / deepseek-v4-flash | They asked us to tell you that the meeting had been canceled. | 他们让我们告诉你会议已经取消了 | 通过：他们提出要求，我们负责转告，你接收会议已取消的消息。 | 通过：They为普通代词；us与you对应我们与你。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1768 | 通过 |
| 3 | deepseek / deepseek-v4-flash | He said you could send it to me directly. | 他说你可以直接发给我 | 通过：他转述许可，你发送，我接收；直接发送的关系保留。 | 通过：He、you、me按他、你、我处理，没有误作姓名。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1009 | 通过 |
| 4 | deepseek / deepseek-v4-flash | We haven't told her yet because we're waiting for your confirmation. | 我们还没告诉她，因为我们在等你的确认 | 通过：尚未告诉她；原因是等待你的确认。 | 通过：we、her、your的指代及所属关系保留。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1092 | 通过 |
| 5 | deepseek / deepseek-v4-flash | Nana asked David to help Sarah with her report. | Nana请David帮忙看下Sarah的报告 | 通过：Nana提出要求，David帮助Sarah，报告归Sarah；未写成任务已经完成。 | 通过：Nana、David、Sarah保留英文；报告指向Sarah。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1105 | 通过 |
| 6 | deepseek / deepseek-v4-flash | May said she may join us later. | May说她可能会晚点加入我们 | 通过：姓名May发言；参加只是可能，时间是晚些时候。 | 通过：May是英文姓名；小写may是可能性，不是姓名。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1134 | 通过 |
| 7 | deepseek / deepseek-v4-flash | Will said he will send it tomorrow. | Will 说他明天会发 | 通过：Will发言并说明明天会发送，没有增加具体接收人。 | 通过：姓名Will保留；普通will译出将来含义。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1279 | 通过 |
| 8 | deepseek / deepseek-v4-flash | Will you ask May if she can join us? | 你能问下May她能不能加入我们吗 | 通过：请求听者去问May是否能一起参加，询问和参加两层动作保留。 | 通过：句首Will按请求语气处理；May保留为姓名。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1337 | 通过 |
| 9 | deepseek / deepseek-v4-flash | I gave her your number, but I didn't give you hers. | 我把你的号码给她了，但没把她的给你 | 通过：我给她的是你的号码；没给你的是她的号码。 | 通过：your与hers两个号码归属分别保留。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1285 | 通过 |
| 10 | deepseek / deepseek-v4-flash | You told me to contact him, but he told me to contact you. | 你让我联系他，但他让我联系你 | 通过：你要求我联系他，他要求我联系你，两次联系对象没有颠倒。 | 通过：you、me、him在两次要求中的角色分别正确。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1203 | 通过 |
| 11 | deepseek / deepseek-v4-flash | Please ask him to remind her to reply to us. | 麻烦让他提醒她回复我们 | 通过：听者让他提醒她，再由她回复我们，中间人完整。 | 通过：他、她、我们各有角色，未丢失中间参与者。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1363 | 通过 |
| 12 | deepseek / deepseek-v4-flash | My manager asked your assistant to contact their driver. | 我的经理让你的助理联系他们的司机 | 通过：经理属于我，助理属于听者，司机属于他们，要求联系的方向保留。 | 通过：my、your、their的所有关系保持。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1055 | 通过 |
| 13 | deepseek / deepseek-v4-flash | She filled out the form herself, but I submitted it for her. | 表格是她自己填的，但我帮她提交了 | 通过：她独自填表，我替她提交，两项动作主体区分清楚。 | 通过：herself译为她自己；for her译为替她或帮她。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1307 | 通过 |
| 14 | deepseek / deepseek-v4-flash | The documents were sent to David by Sarah, not by me. | 文件是 Sarah 发给 David 的，不是我发的 | 通过：Sarah发送，David接收；否认发送者是我。 | 通过：Sarah和David原样保留；me按我翻译。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1325 | 通过 |
| 15 | deepseek / deepseek-v4-flash | I didn't ask you to cancel the order; I asked you to hold off on payment. | 我没让你取消订单；我是让你先别付款 | 通过：否定取消订单的要求，肯定暂缓付款的要求，两个动作区分清楚。 | 通过：I与you的要求关系保留，没有把否定对象换人。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1490 | 通过 |
| 16 | deepseek / deepseek-v4-flash | You don't have to reply today, but please read it before tomorrow's meeting. | 你今天不用回复，但请在明天的会议之前看一下 | 通过：今天回复不是必须；阅读须在明天会议前，不是禁止回复。 | 通过：you为听者，没有新增人物。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1220 | 通过 |
| 17 | deepseek / deepseek-v4-flash | Not everyone has received the update. | 不是每个人都收到了更新 | 通过：部分人没有收到更新，不是所有人都没有收到。 | 通过：everyone为量化人群表达，没有误作姓名。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 989 | 通过 |
| 18 | deepseek / deepseek-v4-flash | None of them has approved the request. | 他们中没有一个人批准这个请求 | 通过：全体均未批准，明确无人批准申请。 | 通过：none of them保留全称否定，没有误作人名。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1195 | 通过 |
| 19 | deepseek / deepseek-v4-flash | I only asked him to check the amount, not to approve the payment. | 我只是让他看了下金额，不是让他批准付款 | 失败：“让他看了下金额”断定核对已发生，原文仅说提出要求。 | 通过：I为要求者、him为执行核对者，关系正确。 | 4 | 4 | “让他看了下金额”断定核对已发生，原文仅说提出要求。 | 1 / 1 | 1312 | 未达标 |
| 20 | deepseek / deepseek-v4-flash | She isn't refusing to help; she just needs more time. | 她不是不愿意帮忙，只是需要更多时间 | 通过：她并未拒绝帮忙，只需要更多时间。 | 通过：She为普通代词，没有误保留英文。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 936 | 通过 |
| 21 | deepseek / deepseek-v4-flash | Don't send the files until Nana confirms the address. | 在 Nana 确认地址之前，不要发送文件 | 通过：确认地址在前、发送文件在后；未确认前不发送。 | 通过：Nana保留英文，作为确认地址者。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1290 | 通过 |
| 22 | deepseek / deepseek-v4-flash | If he hasn't replied by noon, ask her to call him. | 如果他到中午还没回复，麻烦让她打电话给他 | 通过：到中午还未回复才采取行动；让她给他打电话。 | 通过：he是待回复者、her是拨号者、him是电话接收者。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1053 | 通过 |
| 23 | deepseek / deepseek-v4-flash | Even if they agree, we still need your approval. | 即使他们同意，我们仍然需要你的批准 | 通过：他们同意不能取代你的批准。 | 通过：他们与听者是两方，批准权限未合并。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1419 | 通过 |
| 24 | deepseek / deepseek-v4-flash | Unless you tell me otherwise, I'll use the latest version. | 除非你另有说明，我会用最新版本 | 通过：默认用最新版，但听者给出不同指示时例外。 | 通过：you为给出不同指示的人，I为使用版本的人。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1233 | 通过 |
| 25 | deepseek / deepseek-v4-flash | By the time I called her, she had already spoken to you. | 在我给她打电话之前，她已经跟你谈过了 | 通过：她和你交谈在前，我给她打电话在后。 | 通过：I、her、you的前后两次沟通关系正确。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1233 | 通过 |
| 26 | deepseek / deepseek-v4-flash | He might send it today, but he hasn't promised. | 他今天可能会发，但他没有承诺 | 通过：今天发送仅为可能，不是已经作出承诺。 | 通过：He按普通代词翻译，没有凭空指定姓名。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1127 | 通过 |
| 27 | deepseek / deepseek-v4-flash | You don't owe me anything; I owe you NGN 25,000. | 你不欠我什么；是我欠你 NGN 25,000 | 通过：你不欠我；我欠你25000奈拉，方向和金额正确。 | 通过：you与I的债权债务关系没有颠倒。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1389 | 通过 |
| 28 | deepseek / deepseek-v4-flash | We paid them USD 1,250.50, but they refunded only USD 1,205.50. | 我们付给他们USD 1,250.50，但他们只退了USD 1,205.50 | 通过：我们付款给他们1250.50美元，他们退款1205.50美元，金额与动作区分正确。 | 通过：we与them/they分别是付款方和退款方。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1497 | 通过 |
| 29 | deepseek / deepseek-v4-flash | Each of the three employees should receive NGN 20,000, making NGN 60,000 in total. | 三名员工每人应收到 NGN 20,000，总计 NGN 60,000 | 通过：三名员工，每人20000奈拉，共60000奈拉，每人与总额区分正确。 | 通过：人数与每人的分配没有改变，未新增姓名。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1293 | 通过 |
| 30 | deepseek / deepseek-v4-flash | David has twice as many orders as I do, but only half as many as Sarah. | David的订单数量是我的两倍，但只有Sarah的一半 | 通过：David是我的两倍、Sarah的一半，没有添加具体订单数。 | 通过：David、Sarah保留英文，I为另一比较对象。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1151 | 通过 |
| 31 | deepseek / deepseek-v4-flash | Could you give me a heads-up before you change the schedule? | 改时间表之前能提前说一声吗 | 通过：改安排前先告知我，保留预告含义，没有逐字翻译习语。 | 通过：you是更改安排者、me是接收预告者。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1011 | 通过 |
| 32 | deepseek / deepseek-v4-flash | I'm not sure I follow. Are you saying we should wait? | 我不太确定我是否理解了。你是说我们应该等吗 | 通过：表达尚未理解，并询问是否应该等待，疑问语气保留。 | 通过：I与we分别表示说话者及所谈群体，未新增人。 | 3 | 3 | “我不太确定我是否理解了”按英文句法套译，冗长生硬。 | 1 / 1 | 1204 | 未达标 |
| 33 | deepseek / deepseek-v4-flash | No rush—just send it over when you get a chance. | 不急，有空的时候发过来就行 | 通过：不催促，在有空时发送，没有添加截止时间。 | 通过：省略听者主语符合中文语境，发送关系仍清楚。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 952 | 通过 |
| 34 | deepseek / deepseek-v4-flash | Someone from support called me. They said they'd check it for us. | 支持部门有人给我打了电话。他们说会帮我们查一下 | 失败：一位支持人员被后句“他们”复数化。 | 失败：一位支持人员被后句“他们”复数化。 | 4 | 4 | 一位支持人员被后句“他们”复数化。 | 1 / 1 | 1477 | 未达标 |
| 35 | deepseek / deepseek-v4-flash | When David spoke to Michael, he sounded upset. | 当David和Michael说话时，他听起来很不高兴 | 通过：David与Michael交谈；不高兴的he保持未明确归属，不添加背景。 | 通过：两个姓名保留，he未明确改写成某个姓名。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1352 | 通过 |
| 36 | deepseek / deepseek-v4-flash | Keep the username "She" unchanged, but translate the rest of her message. | 把用户名“She”保留不变，但翻译她消息的其余部分 | 通过：翻译整条指令本身；保留用户名，翻译消息其余部分，而不是执行或捏造另一条消息。 | 通过：用户名She保留；her按她翻译，没有把She当成被称呼者。 | 4 | 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 | 1 / 1 | 1565 | 通过 |

## 所有生成尝试（含未交付结果）

以下是模型返回、实体恢复后的原始候选，不能与最终显示结果混为一谈；完整原始 JSON、占位符输入和后处理结果见 trace.jsonl。候选评审同样由 AI 逐条作出，不能替代交付结果。

| 请求 ID | 编号 | 供应商 | 第几次生成 | 恢复后候选（未做末尾处理） | 逻辑及理由 | 姓名/代词及理由 | 自然度 / 口语化 | 问题说明 |
|---|---|---|---|---|---|---|---|---|
| d65cf907-5fe3-4010-a92e-401d888db469 | 1 | gemini | 1 | 她说他已经把我们的地址发给他们了。 | 通过：她转述；他已经发送；接收者是他们；地址属于我们。 | 通过：She、he、them、our分别按她、他、他们、我们的含义处理。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 84093e52-cd77-47de-84f3-52fcee06e5de | 2 | gemini | 1 | 他们让我们通知你，会议已经取消了。 | 通过：他们提出要求，我们负责转告，你接收会议已取消的消息。 | 通过：They为普通代词；us与you对应我们与你。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 552736f9-fe3c-4f9c-8f14-5c7547bdc4a9 | 3 | gemini | 1 | 他说你可以直接发给我。 | 通过：他转述许可，你发送，我接收；直接发送的关系保留。 | 通过：He、you、me按他、你、我处理，没有误作姓名。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| a30d4c03-50d9-46cb-ad4d-581e2c5a74ac | 4 | gemini | 1 | 我们还没告诉她，因为在等你的确认。 | 通过：尚未告诉她；原因是等待你的确认。 | 通过：we、her、your的指代及所属关系保留。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 8b27c330-8619-4762-8bed-0ded8784365b | 5 | gemini | 1 | Nana 请 David 帮忙处理 Sarah 的报告。 | 通过：Nana提出要求，David帮助Sarah，报告归Sarah；未写成任务已经完成。 | 通过：Nana、David、Sarah保留英文；报告指向Sarah。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 300884e2-4c34-4ed2-ba35-2bab687ff95e | 6 | gemini | 1 | May 说她可能稍后加入我们。 | 通过：姓名May发言；参加只是可能，时间是晚些时候。 | 通过：May是英文姓名；小写may是可能性，不是姓名。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 00192395-c261-44e7-9548-82d104cf90f8 | 7 | gemini | 1 | Will 说他明天会发过来。 | 通过：Will发言并说明明天会发送，没有增加具体接收人。 | 通过：姓名Will保留；普通will译出将来含义。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 463f53c2-5187-47d2-bb49-fe48afd0a389 | 8 | gemini | 1 | 麻烦问下 May 她方便加入我们吗？ | 通过：请求听者去问May是否能一起参加，询问和参加两层动作保留。 | 通过：句首Will按请求语气处理；May保留为姓名。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 39d5a830-549f-4e5a-9623-cb776eef9087 | 9 | gemini | 1 | 我把你的号码给她了，但我没有把她的号码给你。 | 通过：我给她的是你的号码；没给你的是她的号码。 | 通过：your与hers两个号码归属分别保留。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 28d04804-8b8a-4797-8557-fbe1ef409c11 | 10 | gemini | 1 | 你让我联系他，但他让我联系你。 | 通过：你要求我联系他，他要求我联系你，两次联系对象没有颠倒。 | 通过：you、me、him在两次要求中的角色分别正确。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 0abb5ec0-5ac5-4d12-9c68-16587862a92a | 11 | gemini | 1 | 麻烦让他提醒她回复我们。 | 通过：听者让他提醒她，再由她回复我们，中间人完整。 | 通过：他、她、我们各有角色，未丢失中间参与者。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| a11d6860-f9fb-4d10-8203-51bbf4336e49 | 12 | gemini | 1 | 我的主管让我助理联系了他们的司机。 | 失败：把“你的助理”译成“我助理”，且“联系了”增加已完成含义。 | 失败：助理归属从听者改为说话者。 | 4 / 4 | 助理归属从听者改为说话者。 |
| 91b823fa-5d5d-4e5e-bfc6-6617611c6109 | 13 | gemini | 1 | 表格是她自己填的，但我替她提交了。 | 通过：她独自填表，我替她提交，两项动作主体区分清楚。 | 通过：herself译为她自己；for her译为替她或帮她。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| e6488aca-e152-4884-b34b-4337045cea6a | 14 | gemini | 1 | 文件是 Sarah 发给 David 的，不是我发的。 | 通过：Sarah发送，David接收；否认发送者是我。 | 通过：Sarah和David原样保留；me按我翻译。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| b8ff71b9-05be-4030-abda-31cd51f8ce90 | 15 | gemini | 1 | 我没有让你取消订单，我是让你先暂停付款。 | 通过：否定取消订单的要求，肯定暂缓付款的要求，两个动作区分清楚。 | 通过：I与you的要求关系保留，没有把否定对象换人。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| d6c33b8d-a3b9-4d09-8a0f-c8de81d8693d | 1 | deepseek | 1 | 她说他已经把我们的地址发给他们了。 | 通过：她转述；他已经发送；接收者是他们；地址属于我们。 | 通过：She、he、them、our分别按她、他、他们、我们的含义处理。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| a046877f-0106-412f-8582-84fa2788eba2 | 2 | deepseek | 1 | 他们让我们告诉你会议已经取消了。 | 通过：他们提出要求，我们负责转告，你接收会议已取消的消息。 | 通过：They为普通代词；us与you对应我们与你。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 8e565058-de48-4d34-bf6b-c597d2dd7e6e | 3 | deepseek | 1 | 他说你可以直接发给我。 | 通过：他转述许可，你发送，我接收；直接发送的关系保留。 | 通过：He、you、me按他、你、我处理，没有误作姓名。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 3098a02a-a27a-47af-bb61-e3e862952e89 | 4 | deepseek | 1 | 我们还没告诉她，因为我们在等你的确认。 | 通过：尚未告诉她；原因是等待你的确认。 | 通过：we、her、your的指代及所属关系保留。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 49b45ef9-5279-4741-900e-157195fe3385 | 5 | deepseek | 1 | Nana请David帮忙看下Sarah的报告。 | 通过：Nana提出要求，David帮助Sarah，报告归Sarah；未写成任务已经完成。 | 通过：Nana、David、Sarah保留英文；报告指向Sarah。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| ba119354-9823-41dc-9baf-8d93e7074711 | 6 | deepseek | 1 | May说她可能会晚点加入我们。 | 通过：姓名May发言；参加只是可能，时间是晚些时候。 | 通过：May是英文姓名；小写may是可能性，不是姓名。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 1950185c-5142-4484-b8d3-f45de4426ab9 | 7 | deepseek | 1 | Will 说他明天会发。 | 通过：Will发言并说明明天会发送，没有增加具体接收人。 | 通过：姓名Will保留；普通will译出将来含义。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 91f661bf-0cfa-4712-a541-720028b168c7 | 8 | deepseek | 1 | 你能问下May她能不能加入我们吗？ | 通过：请求听者去问May是否能一起参加，询问和参加两层动作保留。 | 通过：句首Will按请求语气处理；May保留为姓名。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 790e6112-c449-4543-ad07-4bba6a1f5d00 | 9 | deepseek | 1 | 我把你的号码给她了，但没把她的给你。 | 通过：我给她的是你的号码；没给你的是她的号码。 | 通过：your与hers两个号码归属分别保留。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| cb7b0136-c48f-4860-9d7a-2ee2022ab8c4 | 10 | deepseek | 1 | 你让我联系他，但他让我联系你。 | 通过：你要求我联系他，他要求我联系你，两次联系对象没有颠倒。 | 通过：you、me、him在两次要求中的角色分别正确。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| af8b5976-13a7-4dec-9147-4298fef25c53 | 11 | deepseek | 1 | 麻烦让他提醒她回复我们。 | 通过：听者让他提醒她，再由她回复我们，中间人完整。 | 通过：他、她、我们各有角色，未丢失中间参与者。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 40019ef6-fc75-425a-9ba5-f36e270033ec | 12 | deepseek | 1 | 我的经理让你的助理联系他们的司机。 | 通过：经理属于我，助理属于听者，司机属于他们，要求联系的方向保留。 | 通过：my、your、their的所有关系保持。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 8c4c0083-911e-4a18-a70f-3781bf13c53b | 13 | deepseek | 1 | 表格是她自己填的，但我帮她提交了。 | 通过：她独自填表，我替她提交，两项动作主体区分清楚。 | 通过：herself译为她自己；for her译为替她或帮她。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 153326ed-a3b0-4637-b8d8-fadd3b93bd43 | 14 | deepseek | 1 | 文件是 Sarah 发给 David 的，不是我发的。 | 通过：Sarah发送，David接收；否认发送者是我。 | 通过：Sarah和David原样保留；me按我翻译。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 4ab1ae81-f72c-40bc-89ae-6e32f20fa1f2 | 15 | deepseek | 1 | 我没让你取消订单；我是让你先别付款。 | 通过：否定取消订单的要求，肯定暂缓付款的要求，两个动作区分清楚。 | 通过：I与you的要求关系保留，没有把否定对象换人。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 14aee66b-ef78-485c-be56-170676f8ea4b | 16 | deepseek | 1 | 你今天不用回复，但请在明天的会议之前看一下。 | 通过：今天回复不是必须；阅读须在明天会议前，不是禁止回复。 | 通过：you为听者，没有新增人物。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 0b063377-d8bd-493b-b1a0-b2a6861ae995 | 17 | deepseek | 1 | 不是每个人都收到了更新。 | 通过：部分人没有收到更新，不是所有人都没有收到。 | 通过：everyone为量化人群表达，没有误作姓名。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| a70fb94a-c541-409e-b31d-b00cb0c341c9 | 18 | deepseek | 1 | 他们中没有一个人批准这个请求。 | 通过：全体均未批准，明确无人批准申请。 | 通过：none of them保留全称否定，没有误作人名。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| c00bebd2-422d-4060-a8a2-6d58ffd62a7f | 19 | deepseek | 1 | 我只是让他看了下金额，不是让他批准付款。 | 失败：“让他看了下金额”断定核对已发生，原文仅说提出要求。 | 通过：I为要求者、him为执行核对者，关系正确。 | 4 / 4 | “让他看了下金额”断定核对已发生，原文仅说提出要求。 |
| 1cce1e40-e604-4423-82dd-82bf17d42a0b | 20 | deepseek | 1 | 她不是不愿意帮忙，只是需要更多时间。 | 通过：她并未拒绝帮忙，只需要更多时间。 | 通过：She为普通代词，没有误保留英文。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 5a47a050-7f5b-41d1-9c0e-2beca0cf3e3e | 21 | deepseek | 1 | 在 Nana 确认地址之前，不要发送文件。 | 通过：确认地址在前、发送文件在后；未确认前不发送。 | 通过：Nana保留英文，作为确认地址者。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 7f9a01fc-df3e-4c9b-9495-e7921729903d | 22 | deepseek | 1 | 如果他到中午还没回复，麻烦让她打电话给他。 | 通过：到中午还未回复才采取行动；让她给他打电话。 | 通过：he是待回复者、her是拨号者、him是电话接收者。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| aa6844f5-d736-4156-9216-dda8e18c6ede | 23 | deepseek | 1 | 即使他们同意，我们仍然需要你的批准。 | 通过：他们同意不能取代你的批准。 | 通过：他们与听者是两方，批准权限未合并。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 3ccee5bb-caa9-4ad8-b661-b048764e1347 | 24 | deepseek | 1 | 除非你另有说明，我会用最新版本。 | 通过：默认用最新版，但听者给出不同指示时例外。 | 通过：you为给出不同指示的人，I为使用版本的人。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 9d51325f-5745-4fbe-8f5c-8cb9d7cc9f84 | 25 | deepseek | 1 | 在我给她打电话之前，她已经跟你谈过了。 | 通过：她和你交谈在前，我给她打电话在后。 | 通过：I、her、you的前后两次沟通关系正确。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 3097fa83-9a64-4839-9b76-4d11fd8720d5 | 26 | deepseek | 1 | 他今天可能会发，但他没有承诺。 | 通过：今天发送仅为可能，不是已经作出承诺。 | 通过：He按普通代词翻译，没有凭空指定姓名。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 5b319282-bf8e-4e46-bdee-d30369e67a32 | 27 | deepseek | 1 | 你不欠我什么；是我欠你 NGN 25,000。 | 通过：你不欠我；我欠你25000奈拉，方向和金额正确。 | 通过：you与I的债权债务关系没有颠倒。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 5bc04fa1-57ea-4b44-b28e-544c28c1beb1 | 28 | deepseek | 1 | 我们付给他们USD 1,250.50，但他们只退了USD 1,205.50。 | 通过：我们付款给他们1250.50美元，他们退款1205.50美元，金额与动作区分正确。 | 通过：we与them/they分别是付款方和退款方。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| f13b54a0-bbdf-4f07-ba3f-31910b2dd07e | 29 | deepseek | 1 | 三名员工每人应收到 NGN 20,000，总计 NGN 60,000。 | 通过：三名员工，每人20000奈拉，共60000奈拉，每人与总额区分正确。 | 通过：人数与每人的分配没有改变，未新增姓名。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| c2897cc5-e553-4f56-861d-75ff65804284 | 30 | deepseek | 1 | David的订单数量是我的两倍，但只有Sarah的一半。 | 通过：David是我的两倍、Sarah的一半，没有添加具体订单数。 | 通过：David、Sarah保留英文，I为另一比较对象。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| a1126414-0221-4361-9b6e-db6ef0cdce50 | 31 | deepseek | 1 | 改时间表之前能提前说一声吗？ | 通过：改安排前先告知我，保留预告含义，没有逐字翻译习语。 | 通过：you是更改安排者、me是接收预告者。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 3b4d5676-9608-4295-8228-2d7aaf3afd75 | 32 | deepseek | 1 | 我不太确定我是否理解了。你是说我们应该等吗？ | 通过：表达尚未理解，并询问是否应该等待，疑问语气保留。 | 通过：I与we分别表示说话者及所谈群体，未新增人。 | 3 / 3 | “我不太确定我是否理解了”按英文句法套译，冗长生硬。 |
| b65319b0-1266-482c-a57f-7bb49b73c660 | 33 | deepseek | 1 | 不急，有空的时候发过来就行。 | 通过：不催促，在有空时发送，没有添加截止时间。 | 通过：省略听者主语符合中文语境，发送关系仍清楚。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 605a3231-12f8-4653-8c5d-1d8cde90f37a | 34 | deepseek | 1 | 支持部门有人给我打了电话。他们说会帮我们查一下。 | 失败：一位支持人员被后句“他们”复数化。 | 失败：一位支持人员被后句“他们”复数化。 | 4 / 4 | 一位支持人员被后句“他们”复数化。 |
| 7bdc2015-e3a3-4d71-b4b2-90cd8fdd6526 | 35 | deepseek | 1 | 当David和Michael说话时，他听起来很不高兴。 | 通过：David与Michael交谈；不高兴的he保持未明确归属，不添加背景。 | 通过：两个姓名保留，he未明确改写成某个姓名。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |
| 1c4eb9ef-9b95-4a88-b320-0bc1a0e2e29c | 36 | deepseek | 1 | 把用户名“She”保留不变，但翻译她消息的其余部分。 | 通过：翻译整条指令本身；保留用户名，翻译消息其余部分，而不是执行或捏造另一条消息。 | 通过：用户名She保留；her按她翻译，没有把She当成被称呼者。 | 4 / 4 | 含义清楚；整体自然，仍有轻微口语润色空间。 |

逐条结论：{"未测/无可交付译文":57,"通过":47,"未达标":4}。不使用平均分抵消失败。
