# 武侯课教智慧课堂 · 文档补齐计划

更新日期：2026-09-15。依据：[现有系统规格](spec.md)。本计划的实现对象是文档补齐，架构部分记录当前系统。

## 技术上下文

| 项目 | 当前实现 |
| --- | --- |
| 应用 | React 单页应用，JSX 与原生 CSS，无路由库 |
| 依赖 | 锁文件记录 React / React DOM 19.3.0、Vite 8.3.0、`@vitejs/plugin-react` 6.1.1 |
| 构建 | `vite` 默认配置；没有 Vite 配置文件，已安装 React 插件未在配置中启用 |
| Node.js | 锁定的 Vite 要求 `^20.19.0 || >=22.12.0`；本地验证环境为 Node 20.20.2、npm 10.8.2 |
| 测试 | `node --test tests/*.test.js`；渲染测试通过 Vite `transformWithOxc` 编译真实 JSX，再由 React 服务端静态渲染检查 |
| 存储 | localStorage 保存课堂状态、学生和教师消息；IndexedDB 保存 File 对象 |
| 同步 | BroadcastChannel，同源同一浏览器的标签页广播完整课堂状态 |
| 录音 | `getUserMedia`、MediaRecorder、可用的 SpeechRecognition / webkitSpeechRecognition |
| 课件 | 图片 `<img>`、PDF `<iframe>`、其他格式下载原文件 |
| 教学工具 | Vite `import.meta.glob` 按需读取本地 HTML 原文，注入 `iframe srcDoc` |
| 报告 | React 渲染报告视图，打印 CSS 与 `window.print()` |
| 服务端 | 未实现；没有模型密钥、API、SQLite 或独立 Agent 服务 |

`package.json` 依赖范围为 `latest`，以上版本以当前 `package-lock.json` 为准。README 使用 `npm ci` 复现锁文件，不在本次更新依赖或引入文档工具链。

## 当前架构与数据流

入口 `index.html` 加载 `src/main.jsx`。`App` 根据 `view` 查询参数选择控制台、教师、学生或大屏视图。学生身份为内存状态，刷新会回到登录；课堂状态、学生列表和教师消息由 `useStoredState` 初始化并持久化。

教师上传资料后，`materials.js` 先将原始 File 保存至 IndexedDB，再返回 `{ id, name, type }` 元信息。`MaterialWorkspace` 把元信息写入课堂状态并调用固定学习包与模拟答案逻辑。展示组件根据元信息 ID 从 IndexedDB 取回文件，生成 Blob URL，在卸载或文件变更时回收 URL。

课堂阶段、学习提交、小组选择和回答调用 `updateState`。更新后完整状态对象发至广播通道，其他标签接收后更新各自状态并写入本地存储。学生名册与教师消息由独立 setter 更新，未通过该通道主动同步，也没有 `storage` 事件监听；其他已打开页面需要刷新获取最新名册。

讨论逻辑由 `discussion.js` 的纯函数限制运行 ID、阶段、小组及组长身份；`learning.js` 校验阶段与完整有效选项。普通提问流程和示例数据保留在 `main.jsx`。`App` 根据 `endAt`、`analyzeAt` 设置定时器，驱动作答到分析再到结果，每个打开的应用标签均可能执行计时逻辑。

`useVoiceCapture.js` 只用于讨论编辑和组长录音。录音 Blob URL 属于当前页面，可播放和下载，不写入 IndexedDB 或广播；转写文本进入课堂状态。浏览器语音识别可能依赖在线服务。普通提问录音组件和普通学生提问麦克风仍使用模拟文字。

地理工具选择和加载属于教师本地视图，覆盖课件展示层，不广播到大屏。工具 HTML 含内嵌脚本/资源，单文件约 0.73–2.79 MiB；构建中按工具拆分，较大输出块可触发 Vite 大小提示。未逐个验证工具的所有运行期网络行为，不承诺整套系统完全离线。

## 核心状态约定

| 位置 | 名称 | 内容 |
| --- | --- | --- |
| localStorage | `wh-students` | 学生数组：`id`、`name`、演示 `score`、`status` |
| localStorage | `wh-classroom` | `phase`、`slide`、`activity`、`resourcesReady`，以及上传后/互动后附加的数据 |
| localStorage | `wh-messages` | 教师与助教消息数组，含 `from`、`text`、`time`，讨论通知可含 `discussionRunId` |
| BroadcastChannel | `wh-classroom` | 更新后的完整课堂状态，不是独立 Agent 消息信封 |
| IndexedDB | `wh-materials` v1 / `files` | `id` 为 keyPath；记录含 `id`、`name`、`type`、原始 `file` |

课堂阶段为 `before → class → after`，可再次开始；活动为 `screen`、`question`、`discussion`、`review`。普通提问状态为 `answering → analyzing → result`，讨论增加初始 `selecting`。

`learningPack` 包含 `preview`、`review` 的任务和习题；`learningAnswers[stage][studentId][exerciseId]` 包含 `text`、`simulated`、`submittedAt`。`questionRun` 包含运行 ID、题目、状态、截止时间和回答；讨论运行另含 `kind: 'discussion'`、`groups`、`members` 与最终 `summary`。`slide` 当前没有应用级换页入口，不用于 PDF 页码同步。

## 文档设计决策

1. 以当前代码建立规格，并保留原始需求差距表，避免把未来目标写成已完成能力。
2. 所有流程文档放在根目录 `spec/`；README 服务于首次运行和演示，规格提供详细功能验收，计划说明架构与数据边界，任务文件记录本次补齐进度。
3. 现有 `requierment.md` 保留原文件名与内容，通过相对链接引用；Eduplex `DESIGN.md` 明确为独立参考，不作为当前页面的设计规范。
4. 只新增四份 Markdown 文件，使用现有 Node/Python 与 npm 命令验证，不新增依赖、测试或脚手架。
5. 执行现有测试并将生产构建输出到临时目录，避免改写仓库已跟踪的 `dist/`；README 仍说明日常默认构建命令。
6. README 数据重置指明关闭其他标签，分别删除三个 localStorage 键和资料数据库，避免清空同源无关数据。

## 文件结构与职责

```text
.
├── README.md                  # 新增：安装、启动、演示、存储及限制
├── spec/
│   ├── spec.md                # 新增：现有功能、场景、验收与差距
│   ├── plan.md                # 新增：当前架构及本次文档实现计划
│   └── tasks.md               # 新增：依赖顺序、完成状态与验证记录
├── requierment.md             # 已有：原始需求，保留拼写
├── DESIGN.md                  # 已有：Eduplex 截图分析，独立参考
├── index.html                 # 应用 HTML 入口
├── package.json / package-lock.json
├── src/
│   ├── main.jsx               # 应用入口、三端 UI、课堂流程与本地状态
│   ├── styles.css             # 视觉布局、响应式与打印样式
│   ├── learning.js            # 固定学习包、模拟记录、提交校验
│   ├── discussion.js          # 选组、启动、组长提交与总结
│   ├── materials.js           # IndexedDB 保存和 Blob URL 读取
│   └── useVoiceCapture.js     # 原生录音、转写与资源清理
├── tests/
│   ├── learning.test.js
│   ├── discussion.test.js
│   └── discussion-render.test.js
├── tools/                     # 五个地理 H5 单文件工具
├── dist/                      # 已有构建产物，非本次编辑目标
└── output/                    # 已有演示/验证产物
```

## 实施顺序与验收

先核对源码、原始需求、依赖及测试，编写功能规格；再完成架构计划和任务清单；随后编写 README；最后检查相对链接、入口/账号/存储键与源码是否一致，执行 `npm test` 和生产构建，记录结果并勾选任务。

验证不自动扩展成未授权的功能修复。若现有测试或构建失败，停止本次实现并报告实际问题。浏览器权限、PDF 打印、多标签同步与完整课堂演示未执行时明确保留为手动验收项。
