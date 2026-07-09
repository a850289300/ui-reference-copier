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

## Verification

主要验证命令：

```bash
npm test
npm run check
npm run pack
```

提交前需要确认这些命令通过，并注意不要提交用户本地无关改动。
