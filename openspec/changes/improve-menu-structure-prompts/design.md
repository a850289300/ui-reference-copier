# Design

## Overview

结构对比需要从纯 DOM 统计升级为“DOM 统计 + 组件语义摘要”。本次先覆盖最容易误导模型的菜单/导航场景。实现应保持通用，不绑定具体 UI 库。

## Detection

对每一组结构对比 pair 判断是否像菜单：

- 根元素 selector、DOM path、文本或子元素 selector 中包含 `menu`、`nav`、`sidebar`、`sider`、`navigation`、`layout-sider` 等常见导航线索。
- 子元素 role 中出现 `menu`、`menuitem`。
- 结构里出现多个短文本菜单项。
- 根元素 tag 是 `nav`、`aside`、`ul`，并且有多个可点击或菜单项语义子节点。

检测结果只影响提示词表达，不改变结构相似度算法本身。

## Menu Semantic Extraction

从已采样的 children 中提取菜单语义节点：

- 文本：优先使用短文本，去重，过滤过长的整段拼接文本。
- 层级：用 child relative rect 的 x 偏移估算缩进层级，最多输出两到三层的近似树。
- 图标线索：如果菜单结构里有 svg、img、icon class、空文本但小尺寸图标节点，则提示“存在图标线索”。
- 当前状态：如果能从 selector、class、role 或文本线索中看到 active、selected、expanded、open 等状态，则输出状态线索。

因为采集数据目前是关键节点采样，不是完整 DOM 树，所以菜单树应标注为“语义摘要”，避免承诺精确层级。

## Prompt Output

默认结构提示词新增：

```text
## 组件语义差异
- 这是菜单/导航结构差异。不要按 div/ul/li/span 数量直接重写。
- 请保留当前项目已有菜单组件、路由配置或菜单数据源，只同步菜单项文本、层级、顺序、分组、图标位置、选中态和展开态。
- 参考 selector 只用于识别范围，不要照搬参考页面 class/id/DOM。

参考菜单语义:
- dashboard
  - 主控台
  - 工作台
- 系统设置

当前菜单语义:
- dashboard
  - 主控台
  - 工作台
- 系统设置
- 基础列表
```

详细版继续保留 tag/role 分布和 DOM path。

## Documentation

新增 `docs/IMPLEMENTATION.md`，记录核心模块、结构对比策略和菜单语义优化说明。README 补充用户侧功能说明。

## Risks

- 菜单树层级来自采样节点和相对位置，复杂虚拟滚动菜单可能不完整。
- 不同语言或图标-only 菜单可能只能输出图标线索，无法推断完整文本。
- 菜单识别太宽可能误判普通列表，所以提示应使用“像菜单/导航”这类语气，并且不修改评分算法。
