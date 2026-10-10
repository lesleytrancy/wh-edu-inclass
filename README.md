# 武侯课教智慧课堂

面向课堂教学的 React / Vite + FastAPI 应用，当前前端版本为 **2.0.0**。提供教师端、学生端与教室大屏，覆盖课程资料管理、课前预习、课中提问与讨论、课后复习和学情分析。默认以地理教学及“喀斯特地貌”为演示场景。

教师课程目录按账号存入 SQLite，上传课件同时保存在浏览器和服务端；课堂状态通过 BroadcastChannel 与 WebSocket 联动。豆包模型用于资料生成、检索对话、快照出题、作答分析及课堂诊断。当前仍是单演示教室应用，部分指标和超时结果使用明确标识的示例数据。

## 快速开始

需要 Node.js `^20.19.0 || >=22.12.0`（当前锁定 Vite 的要求）、npm、Python 3，以及支持 SQLite FTS5 的 Python 环境。

```sh
npm ci
python3 -m venv .venv
.venv/bin/pip install -r server/requirements.txt
cp .env.example .env
# 在 .env 中填写 DOUBAO_API_KEY 和 DOUBAO_MODEL
npm run dev
```

`npm run dev` 通过 `scripts/dev.mjs` 同时启动 FastAPI（`127.0.0.1:8000`）和 Vite（默认 `5173`），必须先安装 `.venv` 中的服务端依赖。Windows 安装依赖时使用 `.venv/Scripts/pip.exe`。

| 页面 | 默认开发入口 |
| --- | --- |
| 三端控制台 | `http://localhost:5173/` |
| 教师端 | `http://localhost:5173/teacher` |
| 学生端 | `http://localhost:5173/student` |
| 教室大屏 | `http://localhost:5173/screen` |

以终端实际输出的地址为准。三端使用固定路径，Logo 不跳转，各端没有返回控制台的按钮；退出登录仍停留在本端。控制台的入口链接在新标签页打开；旧 `?view=` 链接自动规范为对应路径。三端可分别在多个标签页或连接同一服务的设备上打开。相同协议、主机和端口共享浏览器存储；`localhost` 与 `127.0.0.1` 属于不同源。

### 账号与初始名册

| 教师账号 | 显示名称 | 初始密码 |
| --- | --- | --- |
| `fanjiaqi` | 地理老师-范佳琪 | `1234` |
| `dengyongchun` | 地理老师-邓永春 | `1234` |

教师登录与课程目录需要后端。密码采用带随机盐的 PBKDF2-HMAC-SHA256 保存，登录令牌有效期为 7 天；两位教师拥有各自独立的课程目录。

学生使用姓名与学号精确匹配登录。默认名册为 **高一三班，8 组、50 人**，来自 [doc/3班.xls](doc/3班.xls)。表格序号用作学号，范围为 `00001` 至 `00050`，按名单顺序均分为八组，定义见 [src/students.js](src/students.js)。例如：

| 学生 | 学号 | 初始小组身份 |
| --- | --- | --- |
| 陈若溪 | `00001` | 第 1 组组长 |
| 丁思诚 | `00002` | 第 2 组组长 |
| 黄新睿 | `00009` | 第 1 组组员 |

有分组信息时，每组名册中的第一名学生为组长。新班级使用独立存储键，首次更新后替换旧班级名单；之后新增、改名、删除的操作会保留。学生登录状态仅保存在页面内存中，刷新需重新登录；教师修改名册后，其他已打开页面需刷新。

### 常用命令与部署

```sh
npm run dev:web       # 仅启动前端；教师登录、上传及 AI 等后端功能不可用
npm run dev -- --host 0.0.0.0
npm run dev:tunnel   # 需预先安装 cloudflared，并启动开发服务
npm test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
npm run build
npm run preview
```

局域网设备访问开发机 IP；临时隧道将 `http://localhost:5173` 暴露为 HTTPS 地址。Vite 开发配置将 `/api` 的 HTTP 与 WebSocket 请求代理至 `8000`。

生产构建输出到 `dist/`，需由 HTTP/HTTPS 静态服务器托管，并对 `/teacher`、`/student`、`/screen` 提供 `index.html` 回退，以支持直接访问和刷新。部署时将同源 `/api` 反向代理至 FastAPI，并支持 `/api/classroom/live` 的 WebSocket 升级；`npm run preview` 不包含开发配置中的后端代理。依赖按 `package-lock.json` 锁定，使用 `npm ci` 安装。

## 当前功能

### 教师端：备课、教学与班级管理

- **课程目录**：预置地理必修第一册（自然地理）与第二册（人文地理），采用“教材 → 章节 → 小节”结构。支持展开目录、切换小节、新增或删除小节、编辑课堂标题和显示备课进度。各小节保存资料与教学内容，切换时恢复对应草稿及学习记录。
- **资料管理**：多文件上传，勾选用于解析的资料，并单独选择 PDF / PPTX 作为课中展示课件。上传入口接受 PDF、Word、PPT、文本、Markdown 和图片；实际解析能力见后文。资源生成按钮链接到外部资源平台。
- **教学内容生成**：AI 根据所选资料分别生成至少三条课前、课后学习任务，以及包含问题、解析和目标的开放式讨论题。资料解析不会自动生成测验；教师可编辑、保存确认或重新生成各阶段内容。
- **题库组卷**：课前与课后测验通过“生成题目”独立组卷，可选题库、数量、难度及多种题型。支持单选、填空、综合题，保留题干、原图、答案和解析。当前抽题池只包含有图片的题目；数量默认 3 道，可调整，生成后替换当前测验。内置题库为“2026年10月08日地理作业”，共 38 题。
- **内容发布**：课前、课中讨论、课后三个阶段均确认后，点击“发送至学生端”发布整套内容。草稿与发布副本分离，编辑草稿后需重新确认并发布；学生端通过通知红点感知新内容。
- **课件教学**：PDF 使用 PDF.js Canvas 渲染；PPTX 使用 `pptx-react-viewer` 预览、编辑、保存与播放。开始上课前保存未提交的 PPTX 修改，再切换播放模式。课件选择、版本与页码同步到大屏，页码从 1 开始。
- **板书与互动**：支持 PPT 批注和白板，批注按文件与页码保留在当前教师页面。点击提问入口可录音转写，拖到课件区域可合成课件与板书快照，由多模态模型生成问题。普通提问限时 **5 分钟**，支持提前停止并分析真实回答。
- **小组讨论**：教师编辑问题，学生选组，组长代表本组提交文字或录音转写。讨论限时 **20 分钟**，结束后整理各组回答并进行 AI 分析；未回答组显示“暂无回答”。组长可提交会议纪要，助教接收纪要并结合学情提供建议。
- **地理工具集**：加载 `tools/` 中的地理 H5 工具，在教师课件区域内展示，支持返回课中。当前“智能生成”只按喀斯特关键词开放内置喀斯特工具，是本地演示流程。
- **班级管理**：新增、改名、删除学生，随机点名并停止选中学生，查看个人成长报告。新增学号按现有最大编号加一生成；新增学生不自动分组，删除最大编号后编号可能复用。
- **AI 助教**：基于解析资料检索对话，返回来源引用；汇总学习反馈、学伴发言、课堂回答与讨论纪要，生成教学建议。侧栏支持收起、展开与清空消息。

### 学生端与教室大屏

学生端提供课前预习、课堂互动和课后复习。课前入口始终可用，课堂入口在开课后开放，课后复习在结束上课后开放；未发布内容时提示等待教师发送资料。

学生完成全部测验题后提交真实答案，单选题使用选项，填空与综合题使用文本。答案先保存到课堂状态，再请求 AI 逐题分析；分析失败不会撤销已提交答案。学伴提供启发式对话，学生发言写入课堂记录。课堂提问支持输入与语音转写，并记录首次响应时间和参与积分。讨论中组长必须加入自己的组才能提交本组回答，普通组员查看本组内容。

大屏同步当前 PDF / PPTX、页码、提问与讨论进度、回答和分析结果，支持提前停止互动。教师的画笔、工具选择与录音文件不随课堂状态同步。

### 分析报告

分析中心提供“课前报告、课堂质量、课堂提问、课后总结、成长总览、新课标落实”六个入口，并支持学生个人报告。课前与课后统计真实提交和已评分答案，课堂统计互动次数与有效回答；个人指标包括答题正确率、参与次数、小组成绩、任务完成参与率及成长指标。

结束上课会打开课堂诊断报告，也可从助教入口生成。报告结合真实练习、提问历史、讨论纪要、学伴发言和活动时间，提供提问层级分布、首次响应耗时、AI 估计雷达图、教学环节时序、教学模式及附证据的改进建议。点击“下载 / 打印 PDF”调用浏览器打印，可另存为 PDF。

报告中缺失数据会显示示例或“数据不足”；新课标落实当前为示例视图，跨课节标准分等指标需要外部提供相应历史数据。开始上课提示中的“预习完成率 100%”仍为固定演示文案。AI 雷达与评分属于模型估计，不能等同于实测指标。

## AI 服务与处理流程

| 环境变量 | 用途 |
| --- | --- |
| `DOUBAO_API_KEY` | 服务端模型 API 密钥 |
| `DOUBAO_MODEL` | 豆包模型或接入点标识；快照出题需要支持图像输入 |
| `DOUBAO_BASE_URL` | 模型接口根地址，默认 `https://ark.cn-beijing.volces.com/api/v3` |
| `AI_DATA_DIR` | 服务端数据目录，默认项目下 `data/` |
| `CORS_ORIGINS` | 允许的前端源，逗号分隔，默认 `http://localhost:5173` |
| `VITE_AI_API_BASE` | `src/ai.js` 的 AI HTTP 请求前缀，默认同源；在前端构建时读取 |

教师账号、资料文件、题库上传和 WebSocket 仍使用同源 `/api`，因此设置 `VITE_AI_API_BASE` 不能替代同源后端代理。`.env`、`data/`、虚拟环境及构建输出已排除版本控制。

资料 AI 解析流程：上传文件 → 创建异步任务 → 提取正文并写入 SQLite / FTS5 → 模型生成教学内容 → 前端轮询任务 → 教师检查、确认并发布。对话检索解析后的资料并附来源引用。资料展示原文件与 AI 解析资源分别保存，文件 ID 不应混用。

正文优先通过 MarkItDown 提取，失败时对文本、DOCX、PPTX 和 PDF 使用内置读取或 pypdf；图片解析为资料描述，当前没有 OCR。扫描 PDF 和旧版二进制 DOC 不保证可提取正文。AI 资料上传单文件上限为 **500MB**。

题库上传支持 JSON、DOCX、PDF、PPTX、TXT、MD，上限 **40MB**。JSON 直接验证结构；其他格式调用模型提取题目，DOCX / PPTX 还提取原图并嵌入为图片 data URL。上传题库缓存在当前浏览器，不单独存入 SQLite；题库解析的临时原文件在请求完成后删除。

普通 AI 请求等待上限为 **30 秒**；资料上传与任务轮询共用 **120 秒**，内容重新生成和课堂报告也是 **120 秒**。客户端超时或收到 HTTP 408 / 504 时，可使用 [src/ai-demo.js](src/ai-demo.js) 的喀斯特预设结果，以 `fallback: true` 标识。普通连接、服务和解析错误会提示失败，不自动转换为超时演示结果。课堂报告在无真实记录或生成失败时还会展示带示例标识的报告。

未配置模型时，教师账号、课程目录、文件存储和课堂同步仍可使用；资料正文可提取并索引，但模型生成任务会失败，AI 对话也不保证返回结果。

## 数据结构

以下字段来自当前实现；多数课堂字段按功能执行后才创建，并非初始状态全部存在。前端时间戳通常为毫秒，教材、小节和文件以字符串 ID 关联，学生学号保持字符串形式。

### 教师课程目录

`teachers.library` 是 JSON 字符串，对应以下对象层级：

```text
TeacherLibrary
├── selectedSectionId: string
└── books[]: { id, name, chapters[] }
    └── chapters[]: { id, name, sections[] }
        └── sections[]: { id, name, title, materials[], teachingState? }
            ├── materials[]: { id, name, type, revision? }
            └── teachingState: 该小节保存的教学内容与学习记录
```

`name` 用于目录显示，`title` 用于课堂标题；上传文件元信息不包含文件二进制。`revision` 是课件保存后的版本标识，用于加载最新文件。

`teachingState` 保存学习包、确认状态、发布副本、讨论题、来源、解析选项、答案、反馈、AI 降级标志及课堂报告等选定字段。它不是完整的课堂状态备份：互动历史、画笔和录音等不在该快照中。切换教师或小节会切换当前教学上下文并回到课前阶段。

### 课堂状态 `wh-classroom`

| 字段组 | 主要字段与结构 | 说明 |
| --- | --- | --- |
| 教学上下文 | `teacherUsername`, `sectionId`, `lessonTitle` | 当前教师、小节与标题 |
| 课堂流程 | `phase: before / class / after`, `activity`, `classStartedAt`, `classEndedAt`, `updatedAt` | 阶段、活动与时间 |
| 展示资料 | `materials[]`, `materialId`, `materialPages: { [materialId]: page }`, `slide` | 当前课件与页码；`slide` 为从 0 开始的兼容字段 |
| 资料生成 | `analysisMaterialIds[]`, `parsedMaterialIds[]`, `resourcesReady`, `sourceRefs[]`, `sourceImages[]`, `aiFallback` | 待解析文件、来源和生成状态 |
| 教学草稿 | `learningPack: { preview, review }`, `discussions[]`, `discussionQuestion`, `resourceConfirmations` | 未发布内容及三个阶段确认标记 |
| 已发布内容 | `publishedLearningPack`, `publishedDiscussions`, `publishedDiscussionQuestion`, `publishedLearningFallback` | 学生当前收到的内容副本 |
| 学习记录 | `learningAnswers`, `learningFeedback` | 按阶段、学生和题目索引的答案与反馈 |
| 课堂互动 | `questionRun`, `questionHistory[]`, `activityHistory[]`, `studentPoints` | 当前互动、最多 100 条互动历史及 300 条活动记录 |
| 学伴与讨论 | `studentUtterances[]`, `discussionMinutes` | 最多 300 条学伴发言及分组会议纪要 |
| 报告通知 | `classroomReport`, `learningNotifications[]`, `reportNotifications[]`, `reportNotificationReads` | 当前报告、发布通知及教师报告通知 |
| 扩展指标 | `studentExpressionScores`, `studentCrossSubjectAccuracy`, `standardizedScoreHistory` | 报告可读取的可选数据，当前没有完整采集流程 |

`sourceRefs` 中的 `resourceId` 指向服务端 AI 解析资源，不是展示文件的 `materialId`。通知分别最多保存 20 条学习通知与 30 条报告通知。报告通知包含小节与教师信息，教师端按账号筛选。

### 学习包、题库与答案

```text
LearningContent = { title, tasks: string[], task: string, exercises: Exercise[] }
DiscussionContent = { id, question, analysis, goal }
QuestionBank = { id, name, questions: Exercise[] }
Exercise = {
  id, question, context?, images: string[], options: string[], answer,
  explanation?, type?: single / fill / comprehensive,
  difficulty?: easy / medium / hard, difficultyCoefficient?,
  knowledgePoints?, number?, bankId?, bankQuestionId?
}
```

`tasks` 是学习任务数组，`task` 是供编辑和显示的任务文本。新解析学习包的 `exercises` 为空，题库抽题后填入。旧演示题未指定 `type` 时按单选处理；单选题的 `answer` 必须等于完整选项文本。图片地址支持 `/question-bank/` 静态路径、图片 data URL 或 HTTPS 地址。抽题后生成测验题 ID，并用 `bankId` / `bankQuestionId` 保留来源。

```text
learningAnswers[preview|review][studentId][exerciseId]
  = { text, simulated: false, submittedAt }

learningFeedback[preview|review][studentId]
  = { id, stage, studentId, summary, items[], analyzedAt, reportedAt, ... }

items[] = { question, response, correct, guidance, ... }
Student = { id: string, name, group?: number, score, status }
```

提交验证要求单选答案属于题目选项，其他题型文本非空。重新提交会清理该学生当前阶段的旧 AI 反馈；重新解析时保留真实答案并清理旧模拟记录。答案按题目 ID 关联，重组测验后旧 ID 的记录不会自动成为新题答案。报告中的主观题评分需匹配对应问题与回答的反馈。

### 互动、会议纪要与课堂报告

普通提问与讨论共用 `questionRun`：

```text
QuestionRun = {
  id, kind?: discussion, source, question,
  status: selecting / answering / analyzing / result,
  startedAt?, endAt?, finishedAt?, answers[], analysis?, analysisError?,
  groups[]?, members?, summary?
}
```

普通提问直接进入 `answering`，回答项为 `{ id: studentId, name, text, active, firstResponseAt, points }`。讨论先进入 `selecting`，组结构为 `{ id, number, name, leaderId, leaderName, studentIds? }`，`members` 是 `{ [studentId]: groupId }`；讨论回答的 `id` 为组 ID。`active` 表示正在回答或录音，停止时关闭。

`discussionMinutes[runId:groupId]` 保存 `{ id, runId, groupId, groupNumber, submittedAt, text }`。本地会议纪要按句子整理，不等同于模型语义总结。`studentUtterances[]` 保存 `{ studentId, name, stage, text, at }`，完整学伴聊天界面仍是页面内存状态。

`classroomReport` 包含 `title`、`conclusion`、`questionCounts`（五种提问层级）、`radar`（五项教学维度）、`timeline`、`mode`、`transitions`、`suggestions`、`issues`、`limitations`，服务端另支持 `rubric` 和 `beforeAfter`。时序 `start` / `end` 为距离开课的秒数；缺乏证据的数值允许为 `null`。改进项结构为 `{ problem, suggestion, evidence }`。

## 存储与同步边界

| 位置 | 名称 / 路径 | 保存内容 |
| --- | --- | --- |
| localStorage | `wh-students-grade1-class3` | 高一三班学生名册 |
| localStorage | `wh-classroom` | 当前课堂 JSON 状态 |
| localStorage | `wh-messages`, `wh-messages-cleared-at` | 教师助教消息与清空时间 |
| localStorage | `wh-teacher-token` | 教师登录令牌 |
| localStorage | `wh-teacher-pending-library-{username}` | 尚未成功保存到后端的课程目录，重载时尝试补交 |
| localStorage | `wh-question-banks` | 用户上传并解析后的题库 |
| localStorage | `wh-generated-geography-tools` | 已开放的演示工具名称 |
| IndexedDB | `wh-materials` / `files`，主键 `id` | `{ id, name, type, revision?, file: File }` |
| 服务端文件 | `data/classroom-materials/{materialId}` | 跨设备展示及编辑保存的课件原文件 |
| 服务端文件 | `data/uploads/` | AI 解析资源原文件 |
| SQLite | `data/classroom.db` | 账号、目录、解析正文、检索索引、任务与事件 |
| 服务端进程内存 | `classroom_state` | WebSocket 当前共享课堂状态，进程重启后丢失 |

### SQLite 表

| 表 | 主要字段 | 用途 |
| --- | --- | --- |
| `teachers` | `username` 主键，`name`, `salt`, `password_hash`, `library` | 教师身份与账号独立的课程 JSON |
| `teacher_sessions` | `token` 主键，`username`, `expires_at` | 登录会话；过期时间为 Unix 秒 |
| `resources` | `id` 主键，`classroom_id`, `name`, `path`, `markdown`, `created_at` | AI 解析资源与正文 |
| `resource_fts` | `resource_id`, `classroom_id`, `name`, `markdown` | FTS5 虚拟表，`unicode61` 分词 |
| `jobs` | `id` 主键，`classroom_id`, `kind`, `status`, `result`, `error`, `created_at` | 异步任务，状态为 processing / completed / failed，结果为 JSON 文本 |
| `events` | `id` 主键，`classroom_id`, `type`, `envelope`, `created_at` | 资源、对话及分析事件，事件封装为 JSON 文本 |

### 同步行为

同源标签页通过 `BroadcastChannel('wh-classroom')` 广播完整课堂状态；连接同一后端的设备通过 `/api/classroom/live` WebSocket 同步，断开后约 1.5 秒重连。后端尚无课堂状态时仅接受教师角色初始化；随后向连接端广播状态。同一互动 ID 的回答按回答 `id` 合并，其余状态主要依赖整份覆盖，未实现完整并发冲突控制。

文件读取优先使用匹配版本的本机 IndexedDB，缺失或版本不一致时读取服务端原文件。教师目录通过带 Bearer token 的 HTTP 接口保存，不通过课堂广播。

**学生名册、教师助教消息、上传题库、工具名称不会随课堂状态自动跨设备同步。** 学生学伴发言及反馈可随状态同步，但完整聊天、登录状态、画笔和录音属于页面本地状态。教师课程目录是账号独立的，当前共享课堂与默认 AI `demo-classroom` 上下文仍是单教室；当前没有多班级隔离和覆盖全部接口的权限体系。

## 主要后端接口

| 接口 | 用途 |
| --- | --- |
| `GET /api/health` | 服务与模型配置状态 |
| `POST /api/teachers/login`, `POST /api/teachers/logout` | 教师登录 / 注销 |
| `GET /api/teachers/library`, `PUT /api/teachers/library` | 读取 / 保存教师目录，需要 Bearer token |
| `PUT /api/classroom/materials/{id}`, `GET /api/classroom/materials/{id}` | 保存 / 读取展示原文件 |
| `WS /api/classroom/live` | 三端课堂同步，消息含 `type` 与 `state` |
| `POST /api/resources`, `GET /api/jobs/{id}` | 上传 AI 解析资源 / 轮询任务 |
| `POST /api/question-banks/upload` | 解析与校验上传题库 |
| `POST /api/agents/chat` | 教师助教 / 学生学伴检索对话 |
| `POST /api/agents/resources/regenerate` | 重新生成学习任务或讨论题 |
| `POST /api/agents/classroom/snapshot-question` | 快照出题 |
| `POST /api/agents/learning/analyze` | 逐题作答分析 |
| `POST /api/agents/teacher/insight` | 教学建议 |
| `POST /api/agents/classroom/analyze` | 课堂回答分析 |
| `POST /api/agents/classroom/report` | 课堂诊断报告 |
| `POST /api/agents/classroom/pre-report` | 课前提交诊断；当前前端主要使用本地统计视图 |
| `GET /api/events` | 按课堂与时间读取持久化事件 |
| `POST /api/classroom/reset-demo` | 清理共享演示状态与相关资源 |

服务启动后可在 `http://localhost:8000/docs` 查看请求模型。

## 推荐演示流程

1. 教师登录，选择课程小节并上传资料，勾选解析来源，指定课中 PDF / PPTX。
2. 解析所选资料，编辑课前任务、讨论题和课后任务；在课前 / 课后分别从题库组卷，保存确认三个阶段，再发送至学生端。
3. 学生登录并提交预习；教师查看真实作答、反馈与课前报告。
4. 教师预览课件并开始上课，大屏同步课件与页码；通过语音或快照发起提问，收集并分析学生回答。
5. 发起讨论，学生选组，组长录音或输入，提交会议纪要；教师或大屏提前停止，或等待 20 分钟结束。
6. 教师结束上课，查看课堂诊断，学生完成课后复习；在分析中心查看课堂与个人报告，必要时打印为 PDF。

### 重置演示状态

控制台提供“一键重置演示状态”。操作会清理当前浏览器的课堂、名册、助教消息、工具记录和 IndexedDB 文件，清空后端共享课堂状态及 `demo-classroom` 的解析资源、任务与事件，并删除未被教师目录引用的服务端展示文件。

**重置保留教师账号、会话和课程目录，也保留被目录引用的课件，以及本机上传题库、教师令牌和待保存目录缓存。** 它不是清空所有项目数据；进入教师端时仍可能恢复目录中已保存的小节教学状态。其他同源标签页会收到重载通知，但它们各自的数据和跨设备浏览器存储不会被统一清除。建议重置前关闭其他课堂页面，避免旧状态再次写回。

## 浏览器要求与限制

- 使用支持 localStorage、IndexedDB、WebSocket 和 Canvas 的现代浏览器；BroadcastChannel 用于同源标签页同步。
- 麦克风需要 localhost 或 HTTPS 与用户授权。语音识别依赖浏览器原生能力，支持自动续连；不支持时可输入文字。录音可本机播放与下载，不持久化、不跨端同步。
- 旧版 `.ppt` 应另存为 `.pptx`。复杂动画、字体和音视频兼容性以播放器与浏览器为准；播放器按需加载，许可文件见 `public/licenses/pptx-react-viewer/`。
- 当前无 OCR、服务端流式语音识别、Web Search 或独立报告文件归档。课堂报告保存于课堂状态与小节快照，不会自动生成 PDF 文件。
- 课堂共享状态在后端内存中，浏览器与服务器文件也没有自动备份流程；生产多进程或多教室部署需要进一步设计状态与隔离机制。
- 教师目录接口有账号校验，学生登录、组长校验和 WebSocket 角色字段仍主要用于演示；课堂、文件与 AI 接口没有完整的鉴权隔离。
- H5 工具包含较多内嵌资源，构建可能提示输出块较大；AI 与浏览器语音服务依赖网络。

## 项目结构与验证

```text
src/main.jsx                    三端入口、教师工作台、学生交互与同步
src/students.js                 初始名册与旧数据迁移
src/teacher-library.js          教师账号接口与课程目录操作
src/learning.js                 草稿确认、发布、提交与反馈
src/question-bank.js            含图题筛选与随机组卷
src/questions.js                课堂回答与积分
src/discussion.js               小组、组长回答、会议纪要与总结
src/materials.js                IndexedDB、服务端文件同步与版本读取
src/PowerPointPresentation.jsx  PPTX 预览、编辑、保存与播放
src/pptx-state.js               PPTX 页码与版本状态
src/pdf-page.js                 PDF 页码和渲染状态
src/pdf-renderer.js             PDF.js 加载
src/snapshot.js                 课件与板书快照合成
src/useVoiceCapture.js          录音、语音识别与资源清理
src/ai.js / src/ai-demo.js       AI 请求、任务轮询、超时与示例内容
src/reports.js                  报告统计、个人指标与通知
src/AnalysisReports.jsx         六类分析视图与学生报告
src/ClassroomReport.jsx         课堂诊断图表与打印
src/reset-demo.js               浏览器演示数据清理
src/styles.css                 三端、响应式与打印样式
server/app.py                  API、WebSocket、SQLite/FTS5 与模型编排
server/teacher_library.py      教师认证与初始课程目录
server/requirements.txt        服务端依赖
scripts/dev.mjs                前后端联合启动
scripts/build-question-bank.py 内置题库构建
public/question-bank/          内置题库 JSON 与原图
public/licenses/               第三方播放器许可
dist/                          生产构建输出（不提交版本控制）
tools/                         地理 H5 工具
tests/                         Node / Python 自动化测试
doc/                           题库与课堂评价参考资料
spec/                          规格、设计和实现计划
```

| 文档 | 用途 |
| --- | --- |
| [spec/spec.md](spec/spec.md) | 功能规格与需求差距 |
| [spec/plan.md](spec/plan.md) | 架构与实现计划 |
| [spec/tasks.md](spec/tasks.md) | 阶段任务记录 |
| [spec/realAI.md](spec/realAI.md) | AI 接入方案与后续规划 |
| [spec/DESIGN.md](spec/DESIGN.md) | 参考界面设计分析 |
| [implement.md](implement.md) | 实现记录 |
| [requierment.md](requierment.md) | 原始需求，保留已有文件名 |
| [start.md](start.md) | 启动说明 |

自动化测试覆盖学习提交、发布与确认、小组权限及纪要、课堂回答、题库筛选、教师目录、报告指标、超时降级、PDF / PPTX 状态、快照及重置等逻辑。实际跨设备联动、浏览器 IndexedDB、麦克风权限、复杂课件播放与打印仍需手动验证。

### AI 功能升级（requirement2）

双豆包模型分工、固定资源模板、真实数据六类图文报告、苏格拉底学伴、联网来源与实时课堂纪要已接入。配置及使用说明见 [AI 功能改造说明](doc/ai-upgrade.md)。思考型接入点已配置；博查 密钥预留在 `.env` 中。开发服务监听 `.env` 变化并重新加载 AI 配置。

### 六类分析报告与30人模拟课堂

启动 `npm run dev` 后，在控制台点击 **导入模拟数据**。Python 会生成 `data/demo-classroom-30.json`，为教师账号添加并选中独立的 **AI测试数据集（模拟） → 30人全流程课堂**。按钮随后变为 **清除模拟数据**：一键移除测试课堂、AI报告、模拟问答记录和测试生成的资源，并恢复导入前的课程选择；其他已打开的端会同步刷新。真实课程、学生名单和资料均保留。

测试课堂包含30名虚拟学生、五个地貌知识点、课前与课后作答（含未答与错因）、12轮课堂提问、学伴对话、六组讨论纪要、参与度记录、六周成长记录和教学目标量表。固定随机种子保证结果可复现。所有模拟作答保留 `simulated: true`，仅在明确标记的测试课堂中参与报告与助教统计；页面和AI上下文均标记模拟来源。测试目标与量表不是官方课标认证，参与度不是注意力测量，伴学时长与分数变化不能证明因果关系。

分析报告提供六类报告、每类四章、共18张Chart.js图表。进入页面即可查看演示统计；默认展示基于当前高一三班50名学生模拟记录的演示报告，提示“当前为演示报告,真实报告正在生成”。点击 **生成当前报告** 后，AI只生成当前所选类别，依据实际课堂统计、作答和纪要生成诊断及建议。退出报告页、关闭弹窗或刷新后恢复演示报告，真实生成结果不写入持久课堂状态。疑问关键词由AI提取，出现频次由程序从原始对话计算。图表可展开统计数据，报告支持浏览器打印为PDF。成长总览可查看每位学生的个人与班级能力对比。

可以在右侧课堂助教中测试：

- 哪些学生的课前预习需要重点关注？请列出姓名和依据。
- 溶蚀知识点从课前到课后改善了多少？
- 课堂提问是否覆盖后排学生？
- 哪些学生作业尚未完成？
- AI伴学时长与提升有关吗？能否证明因果关系？

手动生成不同种子的数据文件：

```bash
.venv/bin/python -m server.demo_dataset --seed 20261010 --output data/demo-classroom-30.json
```

`CLASSROOM_SIMULATION_SEED` 控制导入时的种子；需要换种子时，先清除模拟数据，再修改配置并重新导入。常规重启保留测试课堂中的修改及已生成报告。手动生成文件用于检查和离线测试，不会直接替换数据库中已有课堂。

小组讨论提供每名成员独立的文字输入与提交；仅组长可开麦。文字按成员合并，结束讨论时与组长纪要共同交由 AI 总结。报告演示数据与控制台的30人测试课堂互相独立，不覆盖真实学生名单或课堂数据。
