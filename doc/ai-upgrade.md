# AI 功能改造（requirement2.md）

## 配置

`.env` 已配置两种用途的推理接入点：原接入点用于 Flash，新接入点用于 thinking。thinking 对应用户提供的 `doubao-seed-2-1-pro-260628` 调用方式，并使用 `reasoning_effort: high`。

```dotenv
DOUBAO_API_KEY=已有密钥
DOUBAO_FLASH_MODEL=已有Flash接入点
DOUBAO_THINKING_MODEL=新的thinking接入点
DOUBAO_THINKING_REASONING_EFFORT=high
DOUBAO_THINKING_TIMEOUT_SECONDS=210
BOCHA_API_KEY=
```

联网搜索使用博查，域名为 `https://api.bocha.cn/`，请求地址为 `POST https://api.bocha.cn/v1/web-search`。`BOCHA_API_KEY` 按要求留空；填写后以 `Authorization: Bearer <key>` 认证。请求发送 `query`、`count: 5`、`freshness: "noLimit"` 和 `summary: true`；从 `data.webPages.value` 提取标题、URL 和摘要，摘要为空时使用 snippet。未配置密钥时不会发出搜索请求。

`DOUBAO_THINKING_MODEL` 可以填写 Model ID（如 `doubao-seed-2-1-pro-260628`）或控制台生成的 `ep-...` 推理接入点；当前保留已经添加的接入点。代码发送 `/chat/completions` 请求，工具类调用同时包含 `thinking: {"type": "enabled"}` 和 `reasoning_effort: "high"`，与示例要求一致。Flash 关闭 thinking，且不发送 reasoning_effort。工具类包括资源生成、报告、课堂回答分析、作答分析和实时纪要。

用于单独核对 thinking 接入点的请求示例（密钥从环境变量读取，不写入文件）：

```bash
curl https://ark.cn-beijing.volces.com/api/v3/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DOUBAO_API_KEY" \
  -d '{
    "model": "doubao-seed-2-1-pro-260628",
    "messages": [{"role": "user", "content": "请仅返回 JSON：{\"ok\":true}"}],
    "thinking": {"type": "enabled"},
    "reasoning_effort": "high",
    "response_format": {"type": "json_object"}
  }'
```

实际项目使用 `DOUBAO_THINKING_MODEL` 指定的接入点，并沿用已有 `DOUBAO_API_KEY`。控制台示例中的 `$ARK_API_KEY` 与本项目变量名称不同，均用于 Authorization Bearer 认证。

高强度思考可能超过原来的 110 秒等待时间。工具类请求现在默认等待后端最多 210 秒，前端最多 240 秒；Flash 对话保持较短的等待时间。可使用 `DOUBAO_THINKING_TIMEOUT_SECONDS` 调整后端等待时间，若设置超过 240 秒，需同时调整前端的 `AI_TOOL_TIMEOUT_MS`。超时仍明确报错，不使用示例结果替代真实报告。

开发服务启动命令为 `npm run dev -- --host 0.0.0.0`。开发服务监听 `.env` 变化，新的后端 worker 会重新读取本地 AI 配置，覆盖父进程中陈旧的接入点配置。本地 `.env` 中的 AI 配置优先；没有该文件的部署使用环境变量。其他环境变量不受重新加载影响。

原来的 503 原因：修改 `.env` 后，旧 Uvicorn worker 仍持有 `DOUBAO_THINKING_MODEL` 的空值，导致接口返回“未配置思考型模型”。配置重新读取已修复此问题。报告提示词进一步绑定完整 JSON Schema，缺少起止时间的时序片段不输出，避免模型输出 null 时间戳导致结构校验失败。上游限流、密钥或接入点错误现在返回对应的配置提示，上游错误正文与密钥不会暴露给前端。

设置用途专用变量后，不再回退到旧 `DOUBAO_MODEL`。尚未迁移的旧部署仍可使用旧变量。`/api/health` 分别返回 `thinkingConfigured`、`flashConfigured`、`dualModelConfigured` 和 `searchConfigured`，不返回密钥。

请求格式依据 [火山方舟深度思考文档](https://docs.volcengine.com/docs/ark/deep-thinking?lang=zh)；搜索服务依据 [博查 Web Search API](https://github.com/bocha-ai/dsh-web-search-bocha)。

## 教师使用流程

1. 在课程小节中选择已上传资料，点击“生成课堂资源”。前端单次 multipart 请求 `/api/agents/resources/generate-template`，后端解析并索引资料，以 JSON Mode 生成结果并通过严格 Schema 验证。生成结果分别显示在课前预习、课中讨论、课后复习三个选项卡中，可编辑并重新生成当前阶段内容。三个阶段分别保存确认后，点击“发送至学生端”发布资料与测验。
2. 课前预习和课后复习直接提供“生成题目”“新增题目”，支持选择或上传题库、按题型/难度/数量组卷，编辑题目、选项与参考答案，保存后发布。课中讨论保留新建讨论题、AI生成、解析与讨论目标编辑。已有模板数据和测验仍通过原选项卡打开。模板中的课后练习为学习活动，不冒充有标准答案的客观题。
3. 资料侧栏可填写本小节课程标准目标原文与学校人才培养要求。助教与报告共同使用；未提供时不会编造学校要求或课标落实分数。
4. 点击“开始上课”会启动浏览器录音与语音识别，首次使用须允许麦克风。每 15 秒将当前转写发送到 `/api/agents/classroom/minutes`，思考型模型生成摘要、教学主题、课堂问题和后续行动。助教侧栏显示实时纪要与原文；暂停、结束课程或离开教师界面停止录音。暂停时可手动补充转写并重试整理。
5. 分析报告默认展示按当前高一三班全部50人名册生成的独立模拟数据与六类演示报告，每类四章、合计18张图表。提示固定为“当前为演示报告,真实报告正在生成”。`/api/classroom/demo-reports`仅计算演示数据，不写课堂、数据库、课程文件夹或真实作答。点击“生成当前报告”只调用 `/api/agents/classroom/report-section` 生成所选一类的四章分析；其他类别仍保留演示内容。真实生成使用当前课堂记录，不混入演示数据。每类独立显示等待与错误，失败后保留当前内容。真实结果仅存在当前查看会话中，离开报告页、关闭报告弹窗、退出教师端或刷新后恢复演示报告；结束课堂弹窗与“分析报告－课后总结”在同一查看会话中共用课后报告。
6. 小组讨论中所有已加入小组的成员均可使用“我的讨论内容”输入框，点击“提交讨论内容”提交或更新自己的观点。服务端按成员与提交版本合并，避免覆盖其他成员的文字。仅组长能开启麦克风；其录音会议纪要与所有成员文字一起在“结束讨论并总结”时交给AI。AI失败明确显示错误，不用预设地貌结论替代讨论总结。

## 问答与数据依据

- 教师助教接收当前小节学情、课堂与讨论纪要、课标原文及学校方案，结合 FTS5 本地资料检索回答。
- 学伴接收当前学生的课前、课中、课后作答和近期对话，以苏格拉底追问引导，每次追问一至两个问题。提示词约束不直接给答案；模型行为仍需要课堂实际使用中观察。
- Flash 在需要最新资讯、规范或外部知识时生成通用搜索查询。博查 返回最多五条来源，前端展示可点击来源；未配置、无结果或搜索故障不会假称已联网。搜索规划失败可继续本地答疑。
- 主观题只有 AI 反馈匹配当前题目和当前回答时才计入正确率。模拟作答不进入报告统计；没有评分时不计为错误。
- 成长记录自动保存每个小节真实已评分题目的正确率，覆盖同一小节的旧记录，供跨课节比较。这是不同任务的正确率变化，不是经过难度校准的标准分或因果意义上的能力增长；已有外部标准分历史仍可使用。
- 小节切换保存纪要、互动和作答状态，隔离课堂记录；当前报告生成结果仅供本次查看。对话和真实报告超时明确报错，不返回预设喀斯特结论。旧演示生成接口的明确 fallback 行为继续兼容。

## 验证与限制

运行 `npm test`、`.venv/bin/python -m unittest discover -s tests -p 'test_*.py'`、`npm run build`。

录音原音频留在浏览器，服务端接收转写文本并生成纪要；没有新增独立的服务端音频 ASR 服务。浏览器必须支持 MediaRecorder 与 SpeechRecognition，使用 HTTPS 或 localhost；不支持语音识别时可输入转写。思考型接入点已配置；搜索仍需填写 博查 密钥。
