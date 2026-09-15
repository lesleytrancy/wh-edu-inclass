---
version: alpha
name: eduplex-learning-dashboard
description: "根据 Eduplex 学习仪表盘截图提取的设计规范：深色左侧导航、浅灰主画布、白色圆角卡片与黄绿色强调色。当前交付仅为设计规范，所有尺寸和色值均为截图视觉估计。"
colors:
  canvas: "#F7F7F5"
  surface: "#FFFFFF"
  sidebar: "#211F32"
  premium-decoration: "#2C2942"
  accent: "#D9F478"
  ink: "#202024"
  muted: "#7E7E80"
  on-dark: "#F8F8FA"
  on-dark-muted: "#B3B0BE"
  grid-line: "#EEEEEF"
  peach: "#F7E1D4"
  lavender: "#E0DCF1"
  lime-soft: "#EEF8C9"
  cream: "#FCF3D9"
  coral: "#F6C7C4"
  violet: "#C4A5E6"
  positive: "#80B558"
  star: "#EDD95A"
  outer-lilac: "#B49BD9"
typography:
  greeting:
    fontFamily: "Arial, Helvetica, system-ui, sans-serif"
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -1px
  brand:
    fontFamily: "Arial, Helvetica, system-ui, sans-serif"
    fontSize: 34px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.8px
  section-title:
    fontFamily: "Arial, Helvetica, system-ui, sans-serif"
    fontSize: 28px
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: -0.6px
  body-md:
    fontFamily: "Arial, Helvetica, system-ui, sans-serif"
    fontSize: 19px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.3px
  body-sm:
    fontFamily: "Arial, Helvetica, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: 0px
  label:
    fontFamily: "Arial, Helvetica, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.2px
  calendar-day:
    fontFamily: "Arial, Helvetica, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: 0px
  tooltip:
    fontFamily: "Arial, Helvetica, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0px
rounded:
  shell: 32px
  sidebar: 30px
  card: 26px
  icon-tile: 18px
  tooltip: 4px
  pill: 999px
spacing:
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 28px
  column-gap: 40px
  section-gap: 30px
components:
  dashboard-shell:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.shell}"
    padding: 18px
  side-navigation:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.sidebar}"
    width: 314px
    padding: "{spacing.lg}"
  navigation-item:
    typography: "{typography.body-md}"
    height: 66px
    rounded: "{rounded.pill}"
    padding: "{spacing.lg}"
  active-navigation-item:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.sidebar}"
    base: "{components.navigation-item}"
  course-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.lg}"
    height: 200px
    typography: "{typography.body-md}"
  icon-tile:
    backgroundColor: "{colors.lavender}"
    rounded: "{rounded.icon-tile}"
    size: 60px
  activity-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.xl}"
    height: 455px
  schedule-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.lg}"
    height: 455px
  premium-card:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.card}"
    padding: "{spacing.xl}"
    height: 256px
  calendar-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.xl}"
    height: 348px
  course-progress-row:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    height: 104px
    padding: "{spacing.lg}"
  assignment-row:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    height: 104px
    padding: "{spacing.lg}"
  status-badge:
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: 42px
    padding: "{spacing.md}"
  search-field:
    backgroundColor: "{colors.surface}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    width: 338px
    height: 60px
  chart-tooltip:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.on-dark}"
    typography: "{typography.tooltip}"
    rounded: "{rounded.tooltip}"
  add-button:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.sidebar}"
    rounded: "{rounded.pill}"
    size: 38px
  download-promo:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    width: 264px
    height: 190px
---

## Overview

参考图为 Eduplex 在线教育平台的桌面学习仪表盘，附件显示尺寸约为 **1792 × 1254px**，宽高比约 **1.43:1**。画面展示完整左导航、顶部欢迎语、新课程、学习时长图表、日程、在学课程，以及右侧会员推广、月历和作业列表。

图中观察：深蓝紫侧栏形成左侧视觉锚点；右侧采用暖浅灰底和白色卡片；黄绿色集中用于选中导航、会员按钮、图表高亮、日历选中日期与添加按钮。卡片轮廓宽松、边界柔和，文字与线性图标为深色。粉橙、浅紫、浅黄及浅绿仅用于图标底和状态标签。

近似估计：本文色值、字体大小、圆角、坐标和间距来自可见截图，未进行原始文件像素采样。实现假设：未来复刻可将图片宽度作为 CSS 基准宽度；截图缩放和 DPR 未知。本文只定义截图可见内容，不扩展业务流程。

## Colors

| 角色 | 令牌 / 估计色值 | 图中用途 |
| --- | --- | --- |
| 主画布 | `{colors.canvas}` / `#F7F7F5` | 导航以外的页面底色 |
| 卡片表面 | `{colors.surface}` / `#FFFFFF` | 课程、图表、日程、月历、列表与搜索框 |
| 深色基底 | `{colors.sidebar}` / `#211F32` | 左导航、会员推广、图表浮层 |
| 深色装饰 | `{colors.premium-decoration}` / `#2C2942` | 会员卡底部弧形装饰 |
| 主强调色 | `{colors.accent}` / `#D9F478` | Dashboard 胶囊、Get Access、加号和高亮柱 |
| 主文字 | `{colors.ink}` / `#202024` | 标题、课程名称、数值 |
| 次级文字 | `{colors.muted}` / `#7E7E80` | 元信息、日期、刻度、辅助标签 |
| 深底文字 | `{colors.on-dark}`、`{colors.on-dark-muted}` | 导航文字、会员卡标题和说明 |
| 浅色辅助底 | `{colors.peach}`、`{colors.lavender}`、`{colors.lime-soft}`、`{colors.cream}` | 学科图标、日程图标、作业状态 |
| 课程图标底 | `{colors.coral}`、`{colors.violet}` | Development Basics、3D Design Course |
| 数据正向提示 | `{colors.positive}` / `#80B558` | +3% 与课程进度环 |
| 评分星标 | `{colors.star}` / `#EDD95A` | 课程评分 |
| 图表分隔 | `{colors.grid-line}` / `#EEEEEF` | 水平网格及月历星期条 |
| 外缘色 | `{colors.outer-lilac}` / `#B49BD9` | 页面右侧和底部可见细窄紫色外缘 |

画布未观察到明显渐变；外缘紫色可能含轻微渐变或截图阴影，证据不足。不要将黄绿色推广为所有文字或所有卡片的背景色。

## Typography

### Font Family

图中文字呈现代无衬线外观，笔画均匀，标题紧凑，正文较圆润。无法从截图确定准确字体名称。建议离线实现字体栈为 `Arial, Helvetica, system-ui, sans-serif`；这是替代方案，而非源字体识别结论。

### Hierarchy

| 令牌 | 字号 / 字重 / 行高 / 字距 | 用途 |
| --- | --- | --- |
| `{typography.greeting}` | 40px / 700 / 1.2 / -1px | Welcome back Taylor |
| `{typography.brand}` | 34px / 700 / 1.2 / -0.8px | 侧栏 Eduplex 品牌 |
| `{typography.section-title}` | 28px / 500 / 1.25 / -0.6px | New Courses、Hours Activity 等区块标题 |
| `{typography.body-md}` | 19px / 600 / 1.3 / -0.3px | 导航、课程名、日程名、作业名 |
| `{typography.body-sm}` | 16px / 400 / 1.35 / 0px | 课时、教师、说明、日期和图表刻度 |
| `{typography.label}` | 16px / 600 / 1.25 / -0.2px | 按钮、状态标签和关键元信息 |
| `{typography.calendar-day}` | 14px / 400 / 1.2 / 0px | 月历日期与星期 |
| `{typography.tooltip}` | 14px / 600 / 1.4 / 0px | 图表高亮提示 |

会员推广标题约 30px，中型品牌约 20px，可局部使用相邻字号，不另行扩展一套字体层级。

### Principles

主标题和区块标题左对齐；卡片名称位于图标右侧，辅助说明另起一行。课程名通常一行显示；会员说明和下载提示为两行。大部分元信息较主文字浅一个层级，评分数值和进度百分比保持深色。日历和图表刻度居中。

### Note on Font Substitutes

替代字体可能改变课程名宽度、会员说明换行和侧栏标签长度。调整时优先保持卡片宽度与文本行数，再微调字号或字距，不通过大幅缩小正文解决布局问题。截图的欢迎语右侧有挥手符号，实际符号外观依赖平台或素材。

## Layout

### Spacing System

间距为截图估计，不代表源产品采用严格的统一倍数体系。8px 用于紧邻的图标和短标签；12–16px 用于名称与说明、图标与文字；24–28px 用于卡片内边距；30px 为上下区块间距；40px 为主区域与右栏的间隔。左导航和主内容之间约 42px。

### Grid & Container

基准视口假设为 **1792 × 1254 CSS px**。页面外壳约位于 x=0、y=0，宽 1782px、高 1238px，圆角约 32px；右侧和底部留下紫色细边。主要构图如下，位置均为近似值：

| 区块 | 左上角 x / y | 宽 × 高 | 布局关系 |
| --- | --- | --- | --- |
| 左侧导航 | 18px / 18px | 314 × 1184px | 从顶部贯穿至底部 |
| 顶部欢迎语 | 374px / 43px | 约 650 × 52px | 对齐中间内容左边界 |
| 顶部搜索 / 头像 | 1320px / 36px | 338 × 60px / 64 × 64px | 头像与搜索框间隔约 22px |
| 中间内容容器 | 374px / 140px | 906px 宽 | 顶部三张卡，下面两列，再下面整宽列表 |
| New Courses 标题 | 374px / 141px | 高约 36px | View All 靠右，与标题共行 |
| 新课程卡片组 | 374px / 198px | 906 × 200px | 三列，宽约 282px，列距约 30px |
| Hours Activity | 374px / 428px | 472 × 455px | 左卡稍宽 |
| Daily Schedule | 874px / 428px | 406 × 455px | 与图表间隔约 28px |
| 在学课程标题行 | 374px / 914px | 906 × 44px | Active 和加号在右端 |
| 在学课程列表 | 374px / 978px | 906 × 228px | 两行，各约 104px，行距约 20px |
| 右侧容器 | 1320px / 138px | 422px 宽 | 推广、月历、作业依次向下 |
| 会员推广 | 1320px / 138px | 422 × 256px | 顶部独立深色卡片 |
| 月历 | 1320px / 426px | 422 × 348px | 与推广间隔约 32px |
| 作业标题 | 1320px / 804px | 422 × 38px | 加号右对齐 |
| 作业列表 | 1320px / 861px | 422 × 345px | 三行，行距约 18px |

页面采用“侧栏 + 中间主区 + 右侧辅助区”三大分区。中间区域内部有三列课程卡和两列信息面板；右侧不是中间面板网格的第三张卡。底部在学课程与作业列表末行基本齐平。

### Whitespace Philosophy

白色卡片之间由浅灰留白分隔，不使用明显描边。左侧导航项之间留有稳定节奏，导航最后一项和下载推广之间有大块空白。图表上方说明、坐标区域和日程行之间均保留呼吸空间，不做密集表格。

## Elevation & Depth

卡片边界主要依赖白色与浅灰底的差异；可见极轻的软阴影或抗锯齿边缘，无法准确确认阴影参数。默认不需要明显投影。下拉筛选、搜索框和小箭头按钮可用很浅的边界。

图表提示框为深色矩形，位于高亮柱顶端右侧，左侧有指向柱子的三角尖角。侧栏下载推广上方有白色圆形箭头按钮，深色粗描边，与绿色卡片顶部重叠约一半。会员卡插画覆盖在深色弧形装饰上，形成明确前后关系。

## Shapes

### Border Radius Scale

| 令牌 | 估计值 | 用途 |
| --- | --- | --- |
| `{rounded.shell}` | 32px | 页面外壳 |
| `{rounded.sidebar}` | 30px | 左导航外轮廓 |
| `{rounded.card}` | 26px | 信息卡、列表行和推广卡 |
| `{rounded.icon-tile}` | 18px | 60px 方形图标底 |
| `{rounded.tooltip}` | 4px | 图表提示框 |
| `{rounded.pill}` | 999px | 选中导航、搜索、按钮和状态标签 |

新课程图标底、头像、加号和日期高亮采用圆形。图表柱为细长圆头竖线，宽约 9px。进度指示为直径约 30px 的细圆环。品牌图形是环形与圆点的组合，不能直接以普通字母代替。

## Components

### Dashboard Shell

对应 `{components.dashboard-shell}`。暖浅灰整体底色，左侧深色导航，右侧卡片均为可分离区域。顶部不设置独立横贯整页的工具栏背景。保留截图可见的外壳圆角和紫色细边。

### Side Navigation

对应 `{components.side-navigation}`、`{components.navigation-item}`、`{components.active-navigation-item}`。顶部为白色 Eduplex 图形标志和品牌文字，约位于 x=43px、y=43px。品牌下方约 54px 留白后进入导航。

可见顺序为 **Dashboard、My Courses、My Classes、Messages、Notifications、Calendars、Community、Settings**。Dashboard 为约 264 × 66px 黄绿色胶囊，其余行保持深底。每行左侧为约 28px 的线性图标，文字在相同纵向轴线上；Notifications 右侧显示浅桃色圆形数字徽标 **2**。图标分别对应四格、盾牌式课程、剪贴板、聊天气泡、铃铛、日历、多人和齿轮。

### Download Promo

对应 `{components.download-promo}`。位于侧栏底部 x≈43px、y≈987px。黄绿色卡片左下有白色大圆弧覆盖，文案为 **Download our / mobile app**，左侧有回形针装饰，右侧为深浅绿色短横条和矩形。顶部中央的白色圆形按钮约 72px，内部为右上箭头，外沿深色描边。图中未显示下载后的动作。

### Welcome and Search

欢迎文案为 **Welcome back Taylor**，右侧挥手符号。搜索框对应 `{components.search-field}`，左侧为搜索图标，占位文案 **Search courses**。头像位于最右侧，圆形裁切，内容是紫红头发、深色眼镜的人物；头像属于局部位图素材。没有观察到搜索结果、输入状态或头像菜单。

### New Course Cards

对应 `{components.course-card}`。卡片顶部为约 60px 圆形浅色图标底，右侧两行课程名称和课时。卡片下半区分为 Rate 与 Type 两列，标签浅灰，数值深色，评分左侧使用黄色五角星。

| 名称 | 课时 | Rate | Type | 图标底 / 图标 |
| --- | --- | --- | --- | --- |
| Content Writing | 12 Lessons | 4.8 | Data Research | 桃色 / 叠放纸张或写作符号 |
| Usability Testing | 15 Lessons | 5.0 | UI/UX Design | 浅绿 / 聊天气泡 |
| Photography | 8 Lessons | 4.6 | Art and Design | 浅紫 / 相机 |

标题行右侧可见下划线 **View All**。未观察到课程卡 hover 或点击后状态。

### Hours Activity

对应 `{components.activity-panel}`、`{components.chart-tooltip}`。标题 **Hours Activity** 位于左上；右上是白色描边胶囊 **Weekly** 和下箭头。下一行依次为浅底右上箭头、绿色 **+3%**、灰色 **Increase than last week**。

柱状图绘图区约为 x=436–818px、y=612–820px。水平网格旁的可见标签自下向上为 **1h、2h、4h、6h、8h**；底部标签为 **Su、Mo、Tu、We、Th、Fr、Sa**。标签转录自截图，最下方 1h 与其余刻度的间隔并不构成可确认的标准线性坐标。

七根柱的视觉高度约为 136、167、73、230、143、35、136px。周三 We 柱为黄绿色，其余柱为深色，全部细长圆头。深色提示框约 118 × 65px，显示 **8h 45 min** 与 **5 Jan 2023**，首行左侧有小圆形面部符号，第二行有小圆点。只记录当前可见高亮，不推断交互触发条件或把估计柱高作为真实业务数据。

### Daily Schedule

对应 `{components.schedule-panel}`、`{components.icon-tile}`。标题 **Daily Schedule** 下方是四行，行中心间距约 88–90px。每行左侧 60px 浅色图标块，中间课程名与灰色说明，最右侧为浅底向右箭头。

| 名称 | 次级文案 | 图标底 / 图标 |
| --- | --- | --- |
| Design System | Lecture - Class | 桃色 / 四格 |
| Typography | Group - Test | 浅紫 / 圆形徽章 |
| Color Style | Group - Test | 浅绿 / 调色盘 |
| Visual Design | Lecture - Test | 浅黄 / 三圆交叠 |

图中未显示实际时间段，不增加时间轴或时钟信息。

### Course Progress Rows

对应 `{components.course-progress-row}`。标题原文 **Course You’re Taking**，右侧白色 **Active** 筛选胶囊、下箭头和黄绿色圆形加号。两条白色列表行左侧为 64px 课程图标，随后是课程名及小圆形教师头像与姓名。中右侧独立显示灰色 **Remaining** 和深色时长；最右侧为绿色细环及百分比。

| 课程 | 教师姓名 | Remaining | 进度 | 图标底 |
| --- | --- | --- | --- | --- |
| 3D Design Course | Micheal Andrew | 8h 45 min | 45% | 紫色 |
| Development Basics | Natalia Varnan | 18h 12 min | 75% | 珊瑚粉 |

教师名按可辨认字形转录，低置信度项见 Known Gaps。课程图标为带白色中心的彩色符号，教师头像是小型照片素材。

### Premium Card

对应 `{components.premium-card}`。左上小型白色 Eduplex 标志；左侧内容依次为 **Go Premium**、两行 **Explore 25k+ courses with / lifetime membership**、黄绿色胶囊按钮 **Get Access**。按钮约 132 × 44px。

右侧约 170 × 210px 为人物插画：穿黄绿色上衣、淡紫色花纹裙，坐在叠放书籍旁，手持书或平板；人物脚部为深紫色。底部有深紫弧形装饰。插画不可由文字转录恢复，未来实现可使用实际可读取的局部原素材嵌入；缺少素材时保留人物、书堆及色块构图并明确标注近似。

### Calendar Panel

对应 `{components.calendar-panel}`。头部左右为浅底上一月 / 下一月箭头，中间标题 **August, 2023**。下一行星期缩写 **S M T W T F S** 位于浅灰圆角条中；下面七列、五行日期，列等宽，行距约 38px。选中日期 **17** 使用约 36px 黄绿色圆形底和深色加粗数字。上一月和下一月日期为很浅灰色。

可见日期排列近似为：

| S | M | T | W | T | F | S |
| --- | --- | --- | --- | --- | --- | --- |
| 28 | 29 | 30 | 1 | 2 | 3 | 4 |
| 5 | 6 | 7 | 8 | 9 | 10 | 11 |
| 12 | 13 | 14 | 15 | 16 | 16 | **17** |
| 19 | 20 | 21 | 22 | 23 | 24 | 25 |
| 26 | 27 | 28 | 29 | 30 | 31 | 1 |

该表记录截图可见排布，其中重复数字和日期对齐存在疑点，不能视为准确历法。复刻以截图呈现为参照，真实日期逻辑需另行确认；不擅自用实际 2023 年 8 月日历替换视觉排列。

### Assignment Rows

对应 `{components.assignment-row}`、`{components.status-badge}`、`{components.add-button}`。标题 **Assignments** 右侧黄绿色圆形加号。三行白色卡片包含左侧约 60px 图标块，中间标题与日期，右侧胶囊状态；标题与状态横向对齐。

| 标题 | 日期原文 | 状态 | 状态底色 | 图标 |
| --- | --- | --- | --- | --- |
| Methods of data | 02 July, 10:30 AM | In progress | 浅紫 | 深紫分枝圆点与小绿色点 |
| Market Research | 14 June, 12:45 AM | Completed | 浅绿 | 圆形 @ 式符号 |
| Data Collection | 12 May, 11:00 AM | Upcoming | 浅桃 | 黄色与紫色菱形组合 |

状态标签约 110–120px 宽，字重中等偏粗。不推断筛选、排序或作业详情。

## Do's and Don'ts

### Do

- 保留深色贯穿式左导航、浅色主画布和独立右栏的比例。
- 保留中间三张课程卡、两张面板、两条课程行，以及右栏三条作业行。
- 保留黄绿色集中强调、柔和辅助色和较大的卡片圆角。
- 保留原始英文文案、可见高亮和图表提示框位置。
- 图标使用稳定的线性图形，复杂头像与插画作为局部素材处理。
- 将观察事实、视觉估计与未来实现假设分开记录。

### Don't

- 不将桌面参考图改成手机首页构图。
- 不增加截图外的导航、页脚、课程介绍、登录或支付流程。
- 不为所有卡片加入浓重阴影、描边或渐变。
- 不用整张截图充当页面实现，也不用表情符号替代整套线性图标。
- 不把当前选中日期、筛选值和图表提示当作已验证的交互规则。
- 不将估计色值、字体和日历转录表称为精确设计源数据。

## Responsive Behavior

### Breakpoints

图中只观察到约 1792px 宽桌面布局，没有其他断点证据。未来实现应先匹配基准视口。若需适配，可将约 1500px 与 1000px 作为最少的布局调整候选，具体阈值由文本是否溢出决定；这些是实现假设，不是源产品规范。

### Touch Targets

截图中的导航行约 66px 高，搜索框约 60px 高，会员按钮约 44px 高；加号、月历箭头和日程箭头约 32–38px，日期高亮约 36px。未来触屏适配可将小控件的实际点击区域扩大至 44px，同时保持其可见尺寸和位置。按钮和搜索输入应有必要标签与键盘焦点，但截图没有显示焦点样式。

### Collapsing Strategy

实现假设：中等宽度可先收窄列间距，再把右栏移动到中间内容下方；更窄时课程卡和双面板改为单列，列表元信息允许换行，侧导航移到内容上方并保留全部可见项目。不得为了适配增加汉堡菜单、抽屉或新的导航机制。本文未生成页面，因此这些策略尚未经过实际布局验证。

## Iteration Guide

1. 先校准外壳、314px 侧栏、906px 中间区域、422px 右栏，以及主区两张面板的宽度差异。
2. 校准课程组、双面板、课程列表、推广、月历和作业列表的纵向位置，保持底部基本齐平。
3. 校准欢迎语大小、标题层级、卡片名称长度及两行辅助文案，避免字体替代导致多余换行。
4. 调整黄绿色、深蓝紫和浅灰底的关系，再微调辅助色与圆角。
5. 校准柱图高度、周三提示框、月历选中日期和课程细进度环。
6. 最后完善品牌标志、头像、插画和小型线性图标。若未来根据实测修订布局或令牌，同步更新本规范与页面实现。

## Known Gaps

- 附件显示约 1792 × 1254px；未获得可进行像素采样的本地原图，尺寸、坐标和色值均为视觉估计。CSS 基准视口为实现假设，DPR 和截图缩放未知。
- 源字体无法确认；系统字体回退可能改变字符宽度与换行。
- 教师姓名分辨率有限：第一行看似 **Micheal Andrew**，第二行看似 **Natalia Varnan**，均需原始高清素材确认。
- 月历含低清数字、重复日期和与真实月份不一致的排布；转录表保留当前观察，部分数字可能识别有误，不能作为日历业务数据。
- 图表最下方标签看似 **1h**，不能确认是否源图排版错误；柱高、网格和提示值之间也未确认严格数值关系。
- 顶部人物头像、教师照片、品牌标志、课程彩色图标和会员人物插画没有独立原始素材。未来复刻应优先使用实际可读取的原始局部素材；缺少时仅能做构图与色块近似，不假装恢复原素材。
- 阴影参数、精确圆角、线条宽度、下载卡装饰和挥手符号细节尚未实测。
- 搜索、导航、筛选、加号、会员按钮及箭头的后续行为未观察到；hover、focus、动画、空状态和错误状态未观察到。
- 移动端和其他宽度没有参考图，响应式条目仅是最小实现建议。
- 本次按用户要求只生成设计规范，未生成或修改 HTML，也未进行浏览器视觉验证。
