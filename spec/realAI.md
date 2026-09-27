把 AI 能力做成**服务端事件驱动 + 编排器 + 领域 Agent + 工具/模型层**，并保留现有模拟逻辑作为降级方案。本次文档工作不新增功能，以下是后续接入方案。

## 一、需要接入哪些 AI 功能

**OCR/解析 → 统一 Markdown → 全文检索 + 目录路由 → 长上下文 LLM → Web Search 按需补充**

**Web Search:作为  Agent 工具 ，按需调用，不要每次自动搜。**

| 功能域               | 当前状态                             |
| -------------------- | ------------------------------------ |
| 资料解析与知识点抽取 | 上传后固定模拟学习包，不读正文       |
| 学习包生成           | 固定两道预习、两道复习、默认讨论题   |
| 课堂提问             | 模拟录音、模拟回答、预设分析         |
| 小组讨论             | 浏览器语音识别 + 手动文字            |
| 教师助教             | 预设启发式回复                       |
| 学生学伴             | 组件内预设回复                       |
| 课堂报告             | 当前状态临时渲染 +`window.print()` |
| 多模态课堂           | 图片/PDF 展示，无应用级翻页          |
| 语音交互             | 讨论编辑/组长录音用浏览器原生 API    |

## 配置清单

## 二、Agent 架构设计

```text
上传资料（PDF/PPT/图片/黑板截图）
        │
        ▼
解析层：
  原生 PDF/PPTX → pdfplumber / python-pptx 直接提取
  扫描件/图片   → PaddleOCR PP-OCRv4 + PP-Structure
  公式          → LaTeX-OCR（可选）
        │
        ▼
统一转 Markdown：
  标题层级、段落、表格、图片引用、来源页码
        │
        ▼
结构化存储：
  SQLite/PostgreSQL
  ├── 资料元信息
  ├── Markdown 原文
  ├── 章节树 + 摘要 + 关键词
  └── FTS5 / tsvector 全文索引
        │
        ▼
LLM 编排（Orchestrator）：
  1. 读目录和摘要
  2. 关键词/BM25 召回相关章节
  3. 拼接上下文给 LLM
  4. 需要时调用 Web Search
        │
        ▼
Qwen2.5-7B（Ollama）
```

### Agent 通信协议

所有 Agent 之间用统一 JSON 信封，避免直接耦合

### 典型流程

1. **教师上传资料**前端上传对象存储 → `resource.uploaded` 事件 → ResourceParserAgent 解析 → LearningPackAgent 生成草稿 → 教师确认 → 写入课堂状态 → WebSocket 推送学生端和大屏。
2. **学生课堂提问**学生录音 → 流式 ASR → ClassroomQAAgent 分析 → 大屏展示 → 写入课堂事件 → ReportAgent 汇总。
3. **小组讨论**组长录音/文字 → ASR → DiscussionAgent 按组转写 → 实时推送教师和大屏 → 结束/超时 → 生成按组总结。
4. **教师助教 / 学生学伴**TutorAgent 可读全课堂，生成建议和报告；StudyBuddyAgent 只读该学生数据，输出启发式提示，不直接给答案。
5. **报告生成**
   ReportAgent 汇总课件数量、练习提交、提问分析、讨论总结、教师对话 → LLM 生成报告 → 输出 HTML/PDF。

## 三、关键设计原则

1. **AI 输出默认是草稿，教师确认后生效**尤其是学习包、讨论题、报告。符合原始需求“确认并发送”。
2. **权限最小化**网关鉴权，Agent 调用工具时校验 `classroomId`、`studentId`、角色。学生只能访问自己的学伴和答题记录，大屏只读。
3. **实时与异步分离**讨论转写走流式 WebSocket；资料解析、报告生成走异步队列。课堂提问可先出部分结果，再出完整分析。
4. **RAG 与引用**学习包、助教、报告都应基于资料 chunks 检索，返回 `sourceRefs`，减少幻觉。
5. **数据与合规**
   录音需授权，学生数据脱敏，未成年人内容审核，模型优先私有化或合规云。原文件、向量、报告分开存储。

## 四、实施路线

| 阶段 | 目标                                                                            | 替换的模拟能力                         |
| ---- | ------------------------------------------------------------------------------- | -------------------------------------- |
| P0   | BFF + Orchestrator + 事件总线；ResourceParser + LearningPack + Tutor/StudyBuddy | FR-05、FR-17、FR-18 的预设逻辑         |
| P1   | 流式 ASR + ClassroomQAAgent + DiscussionAgent                                   | FR-10、FR-14 的模拟提问和讨论          |
| P2   | OCR/多模态 + PPT/PDF 页面解析 + ReportAgent                                     | 原始差距“PPT 大纲、翻页、报告持久化” |
| P3   | WebSocket 跨端同步、并发控制、学生画像、实时语音对话                            | 原始差距“跨终端联动、真实语音回答”   |

最小可行版本：**1 个 BFF + 1 个 Orchestrator + 3 个核心 Agent（解析、课堂、助教/学伴）+ 模型工具层**。

| 组件               | POC 配置                                | key/链接                                                                |
| ------------------ | --------------------------------------- | ----------------------------------------------------------------------- |
| LLM                | 豆包 2.1 Pro                            | .evn 预览填写                                                           |
| 图片识别           | 豆包 2.1 Pro                            | .evn 预览填写                                                          |
| 转 Markdown       | **MarkItDown**                    | 已部署至`.venv`                                                       |
| 编排               | FastAPI +`BackgroundTasks` + 轮询/SSE | [fastapi.tiangolo.com/zh](https://fastapi.tiangolo.com/zh/)              |
| **存储**     | **本地文件 + SQLite 元信息表**    | [github.com/CodeWeaver13/simple](https://github.com/CodeWeaver13/simple) |
| **演示界面** | **单页 HTML / Streamlit**         |                                                                         |
