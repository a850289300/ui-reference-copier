# Implementation Notes

UI Reference Copier 是一个 Chrome MV3 内容脚本插件，核心目标是把浏览器真实渲染后的 UI 信息转成适合 AI 编程工具使用的提示词。

## Core Modules

- `content.js`: 注入页面的交互层，负责面板 UI、元素选择、跨页面状态、复制动作和设置保存。
- `collector.mjs`: 从 DOM 元素读取 computed style、尺寸、父级上下文、关键子元素、组件 CSS 变量和图标细节。
- `prompt.mjs`: 生成单个元素、多元素、取色和颜色变量提示词。
- `diff.mjs`: 对比单组参考元素和当前元素的尺寸、字体、颜色、间距、阴影、布局和关键子元素差异。
- `groups.mjs`: 管理多组参考元素和当前实现的配对对比。
- `structure.mjs`: 对比 DOM / 组件 / 布局结构，用于在样式修复前判断是否选错层级或缺少关键结构。
- `selection.mjs`: 处理可选中元素解析和选择父级逻辑。
- `label.mjs`: 把技术 selector 转成人更容易理解的元素名称。

## Structure Comparison Strategy

结构对比不是完整 DOM diff。它使用采集到的关键子元素样本，综合根节点 tag、display、子元素数量、tag 分布、role 分布、文本节点、媒体节点和可见卡片特征计算相似度。

结构对比有独立采样深度：

- 精简：24 个子元素，适合快速判断普通布局层级。
- 中等：80 个子元素，默认模式，兼顾覆盖率和提示词体积。
- 全量：使用本次采集到的所有子元素，适合长菜单、侧边栏导航和复杂导航树。

结构深度会同时影响保存结构参考/当前结构时的子元素采集上限，以及后续结构分析时参与统计和菜单语义差异计算的子元素数量。

提示词分两层：

- 默认版：只输出关键结构差异、对象定位和修复建议，避免把大量 DOM 统计直接塞给模型。
- 详细版：额外输出 tag/role 分布、逐元素结构数据、selector、DOM path 和父级布局，用于复杂问题排查。

## Menu / Navigation Semantics

菜单组件是结构对比里的特殊场景。不同 UI 库的菜单 DOM 差异可能很大，例如一个库使用 `div`，另一个库使用 `ul/li/span`。如果只输出 tag 数量差异，模型容易误以为必须照搬参考 DOM，破坏当前项目已有组件库。

`structure.mjs` 因此会在结构 pair 像菜单或导航时增加“组件语义差异”：

- 使用 selector、DOM path、tag、role 和短文本节点判断是否像菜单/导航。
- 从采样子元素中抽取菜单项文本。
- 根据相对 x 坐标估算菜单层级，生成简短菜单语义树。
- 对比参考和当前菜单项，列出可能缺失或多出的菜单项。
- 明确提示模型保留当前项目已有菜单组件、路由配置或菜单数据源，只同步菜单项文本、层级、顺序、分组、图标位置、选中态和展开态。

这个逻辑是通用的，不绑定 Naive UI、Element Plus、Ant Design、Arco 或任何具体组件库。参考页面 selector 只用于识别范围，不能作为当前项目实现目标。

`diff.mjs` 也会读取结构对比结果里的菜单语义。普通样式 diff 如果命中菜单/导航，会进入菜单组件对齐模式：

- 摘要优先输出菜单/导航组件提示、缺失菜单项和多出菜单项。
- 逐元素差异不再展开普通子元素 diff，避免把参考整行菜单项和当前内部文字列、箭头列错误匹配。
- 不输出参考 UI 库专属 CSS 变量差异，例如 `--n-*`。
- 修复要求会强调保留当前项目菜单组件、路由配置或菜单数据源，改菜单项、层级、展开/选中状态和当前组件库样式。

样式对比支持 `includeChildren` 参数：

- `true`: 默认包含采样子元素差异，适合相同组件结构或已经确认子元素层级一致的场景。
- `false`: 只对比选中根元素、整体边界、图标和结构风险，适合跨 UI 组件库或内部 DOM 差异很大的场景。

`content.js` 的「样式对比范围」会把这个参数传给单组对比和多组对比。多组对比通过 `groups.mjs` 的 `diffOptions` 继续传递给 `compareReferenceSets`。

## Interaction State Capture

交互状态采集默认关闭，由 `content.js` 的「采集交互状态」开关传入 `collector.mjs`。这个开关只保留一个入口，悬浮提示说明它适合 hover、点击、聚焦、禁用、红星和前后装饰等状态差异，避免普通用户面对太多选项。

`collector.mjs` 会采集两类信息：

- `:hover`、`:active`、`:focus`、`:focus-visible`、`:disabled`：从可访问 stylesheet 中读取匹配当前元素的 CSS 规则线索。content script 不能像 DevTools 一样强制伪类状态，所以这里不声称是 computed hover，而是输出规则线索。
- `::before`、`::after`：通过 `window.getComputedStyle(element, pseudo)` 读取浏览器 computed style，用于表单红星、装饰线、伪元素图标等场景。

`prompt.mjs` 会把采集结果输出到「交互状态样式」区块。`diff.mjs` 会对比参考和当前的状态规则、伪元素样式，并在逐元素差异里输出「交互状态样式差异」。

## Verification

主要验证命令：

```bash
npm test
npm run check
npm run pack
```

提交前需要确认这些命令通过，并注意不要提交用户本地无关改动。
