import { describeReference } from "./label.mjs";

function round(value) {
  return Math.round(Number(value) * 100) / 100;
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function formatRect(rect) {
  if (!rect) {
    return "(无)";
  }
  return `${rect.x}, ${rect.y}, ${rect.width} x ${rect.height}`;
}

function formatPosition(rect) {
  if (!rect) {
    return "(未知位置)";
  }
  return `x ${rect.x}, y ${rect.y}, ${rect.width} x ${rect.height}`;
}

function countBy(items, reader) {
  return items.reduce((result, item) => {
    const key = reader(item);
    if (!key) {
      return result;
    }
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});
}

function histogramSimilarity(a, b) {
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  if (keys.length === 0) {
    return 1;
  }
  const overlap = keys.reduce((sum, key) => sum + Math.min(a[key] ?? 0, b[key] ?? 0), 0);
  const total = keys.reduce((sum, key) => sum + Math.max(a[key] ?? 0, b[key] ?? 0), 0);
  return total === 0 ? 1 : overlap / total;
}

function childRole(child) {
  if (child.attributes?.role) {
    return `role:${child.attributes.role}`;
  }
  if (/^h[1-6]$/.test(child.tag)) {
    return "heading";
  }
  if (["button", "a", "input", "textarea", "select", "img", "svg", "canvas", "table"].includes(child.tag)) {
    return child.tag;
  }
  if (normalizeText(child.text)) {
    return "text";
  }
  return child.tag || "unknown";
}

function isVisibleCard(reference) {
  const styles = reference.element.styles;
  return styles.color.background !== "rgba(0, 0, 0, 0)" ||
    styles.box.borderRadius !== "0px" ||
    styles.box.boxShadow !== "none" ||
    !String(styles.box.border ?? "").startsWith("0px");
}

function collectStructure(reference, options = {}) {
  const children = reference.element.children ?? [];
  const limit = options.limit ?? 24;
  const sampledChildren = children.slice(0, limit);
  const label = describeReference(reference);
  return {
    name: label.name,
    detail: label.detail,
    selector: reference.element.selector,
    domPath: reference.element.domPath,
    tag: reference.element.tag,
    text: normalizeText(reference.element.text).slice(0, 80),
    rect: reference.element.rect,
    display: reference.element.styles.box.display,
    parentDisplay: reference.element.parent?.display ?? "",
    parent: {
      selector: reference.element.parent?.selector ?? "",
      display: reference.element.parent?.display ?? "",
      gap: reference.element.parent?.gap ?? "",
      padding: reference.element.parent?.padding ?? ""
    },
    childCount: children.length,
    sampledCount: sampledChildren.length,
    tagCounts: countBy(sampledChildren, (child) => child.tag),
    roleCounts: countBy(sampledChildren, childRole),
    textCount: sampledChildren.filter((child) => normalizeText(child.text)).length,
    interactiveCount: sampledChildren.filter((child) => ["button", "a", "input", "textarea", "select"].includes(child.tag)).length,
    mediaCount: sampledChildren.filter((child) => ["img", "svg", "canvas"].includes(child.tag)).length,
    isVisibleCard: isVisibleCard(reference),
    children: sampledChildren.map((child, index) => ({
      index: index + 1,
      tag: child.tag,
      role: childRole(child),
      text: child.text,
      rect: child.relativeRect
    }))
  };
}

function countSimilarity(a, b) {
  const max = Math.max(a, b);
  if (max === 0) {
    return 1;
  }
  return Math.min(a, b) / max;
}

function structureScore(referenceStructure, currentStructure) {
  const rootTag = referenceStructure.tag === currentStructure.tag ? 1 : 0;
  const display = referenceStructure.display === currentStructure.display ? 1 : 0;
  const childCount = countSimilarity(referenceStructure.childCount, currentStructure.childCount);
  const tags = histogramSimilarity(referenceStructure.tagCounts, currentStructure.tagCounts);
  const roles = histogramSimilarity(referenceStructure.roleCounts, currentStructure.roleCounts);
  const text = countSimilarity(referenceStructure.textCount, currentStructure.textCount);
  const media = countSimilarity(referenceStructure.mediaCount, currentStructure.mediaCount);
  const card = referenceStructure.isVisibleCard === currentStructure.isVisibleCard ? 1 : 0;

  return round(
    rootTag * 12 +
    display * 8 +
    childCount * 18 +
    tags * 24 +
    roles * 18 +
    text * 8 +
    media * 6 +
    card * 6
  );
}

function severityFromScore(score) {
  if (score < 55) {
    return "high";
  }
  if (score < 75) {
    return "medium";
  }
  return "low";
}

function tagDelta(referenceCounts, currentCounts) {
  const keys = Array.from(new Set([...Object.keys(referenceCounts), ...Object.keys(currentCounts)])).sort();
  return keys
    .map((key) => ({
      tag: key,
      reference: referenceCounts[key] ?? 0,
      current: currentCounts[key] ?? 0,
      delta: (currentCounts[key] ?? 0) - (referenceCounts[key] ?? 0)
    }))
    .filter((item) => item.delta !== 0);
}

function buildWarnings(referenceStructure, currentStructure, score) {
  const warnings = [];
  if (score < 55) {
    warnings.push("结构差异较大：当前元素可能不是参考元素的同一层级，建议先修布局或重新选择范围。");
  }
  if (referenceStructure.isVisibleCard && !currentStructure.isVisibleCard) {
    warnings.push("参考像外层卡片，但当前不像可见卡片容器，可能选到了内部文字、图标或透明容器。");
  }
  if (referenceStructure.childCount > 0 && currentStructure.childCount === 0) {
    warnings.push("参考元素有子结构，但当前元素没有采样到子元素。");
  }
  if (Math.abs(referenceStructure.childCount - currentStructure.childCount) >= 6) {
    warnings.push(`子元素数量差异较大：参考 ${referenceStructure.childCount} 个 / 当前 ${currentStructure.childCount} 个。`);
  }
  const deltas = tagDelta(referenceStructure.tagCounts, currentStructure.tagCounts);
  const largeDeltas = deltas.filter((item) => Math.abs(item.delta) >= 2).slice(0, 4);
  largeDeltas.forEach((item) => {
    warnings.push(`结构节点数量不同：${item.tag} 参考 ${item.reference} 个 / 当前 ${item.current} 个。`);
  });
  return warnings;
}

function comparePair(reference, current, index) {
  const referenceStructure = collectStructure(reference);
  const currentStructure = collectStructure(current);
  const score = structureScore(referenceStructure, currentStructure);
  const severity = severityFromScore(score);
  return {
    index: index + 1,
    score,
    severity,
    currentSelector: current.element.selector,
    reference: referenceStructure,
    current: currentStructure,
    tagDelta: tagDelta(referenceStructure.tagCounts, currentStructure.tagCounts),
    roleDelta: tagDelta(referenceStructure.roleCounts, currentStructure.roleCounts),
    warnings: buildWarnings(referenceStructure, currentStructure, score)
  };
}

export function compareStructureSets(referenceReferences, currentReferences) {
  const pairCount = Math.min(referenceReferences.length, currentReferences.length);
  const pairs = Array.from({ length: pairCount }, (_, index) => {
    return comparePair(referenceReferences[index], currentReferences[index], index);
  });
  const worstScore = pairs.length > 0 ? Math.min(...pairs.map((pair) => pair.score)) : 100;
  return {
    generatedAt: new Date().toISOString(),
    count: {
      reference: referenceReferences.length,
      current: currentReferences.length,
      compared: pairCount
    },
    pages: {
      reference: referenceReferences[0]?.page ?? null,
      current: currentReferences[0]?.page ?? null
    },
    score: worstScore,
    severity: severityFromScore(worstScore),
    pairs
  };
}

export function structureRiskLines(structureDiff) {
  if (!structureDiff) {
    return [];
  }
  const isHigh = structureDiff.severity === "high";
  const isMedium = structureDiff.severity === "medium";
  return [
    `${isHigh ? "严重提醒" : isMedium ? "注意" : "普通提示"}：结构${isHigh ? "明显不一致" : isMedium ? "可能不一致" : "基本一致"}，最低结构相似度 ${structureDiff.score}/100。`,
    isHigh
      ? "先不要修颜色、字体、间距。很可能选错了元素层级，或当前页面缺少关键容器/布局区域。"
      : isMedium
        ? "建议先确认元素层级是否一致，再处理颜色、字体、间距等样式差异。"
        : "可以继续处理样式差异；如果视觉仍然偏差较大，再回到结构对比确认层级。",
    isHigh || isMedium
      ? "请优先使用「结构对比」修正 DOM / 组件 / 布局层级；结构对齐后再做样式对比。"
      : "结构状态正常，本次主要关注尺寸、间距、颜色、字体等样式差异。",
    ...structureDiff.pairs.flatMap((pair) => pair.warnings.map((warning) => `元素 ${pair.index}: ${warning}`)).slice(0, 6)
  ];
}

function formatCounts(counts) {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return "(无)";
  }
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key} ${value}`)
    .join("; ");
}

function textSummary(structure) {
  const items = [
    structure.text,
    ...structure.children.map((child) => normalizeText(child.text))
  ]
    .map((item) => String(item ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (items.length === 0) {
    return "(无明显文本)";
  }
  const seen = new Set();
  const unique = items.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  return unique.slice(0, 6).join("、");
}

function objectLines(pair) {
  return [
    `参考元素: ${pair.reference.name}`,
    `参考位置: ${formatPosition(pair.reference.rect)}`,
    `参考文本摘要: ${textSummary(pair.reference)}`,
    `当前元素: ${pair.current.name}`,
    `当前目标 selector: ${pair.currentSelector}`,
    `当前位置: ${formatPosition(pair.current.rect)}`,
    `当前文本摘要: ${textSummary(pair.current)}`
  ];
}

function detailedLocationLines(pair) {
  return [
    `### 元素 ${pair.index}`,
    `参考 selector: ${pair.reference.selector || "(无)"}`,
    `参考 DOM path: ${pair.reference.domPath || "(无)"}`,
    `参考父级: ${pair.reference.parent.selector || "(无)"}; display ${pair.reference.parent.display || "(unknown)"}; gap ${pair.reference.parent.gap || "(unknown)"}; padding ${pair.reference.parent.padding || "(unknown)"}`,
    `当前 selector: ${pair.currentSelector || "(无)"}`,
    `当前 DOM path: ${pair.current.domPath || "(无)"}`,
    `当前父级: ${pair.current.parent.selector || "(无)"}; display ${pair.current.parent.display || "(unknown)"}; gap ${pair.current.parent.gap || "(unknown)"}; padding ${pair.current.parent.padding || "(unknown)"}`
  ].join("\n");
}

function formatDeltas(items, label) {
  if (items.length === 0) {
    return [`- ${label}: 未发现明显数量差异。`];
  }
  return items.map((item) => {
    return `- ${label} ${item.tag}: 参考 ${item.reference} / 当前 ${item.current}`;
  });
}

function riskLabel(severity) {
  if (severity === "high") {
    return "明显不一致";
  }
  if (severity === "medium") {
    return "可能不一致";
  }
  return "基本一致";
}

function riskTitle(severity) {
  if (severity === "high") {
    return "结构状态：明显不一致，先不要修样式";
  }
  if (severity === "medium") {
    return "结构状态：可能不一致，建议先确认层级";
  }
  return "结构状态：基本一致，可继续修样式";
}

function maxInsightCount(severity) {
  if (severity === "high") {
    return 8;
  }
  if (severity === "medium") {
    return 6;
  }
  return 4;
}

function deltaLines(deltas, label, options = {}) {
  const threshold = options.threshold ?? 1;
  const limit = options.limit ?? 4;
  return deltas
    .filter((item) => Math.abs(item.delta) >= threshold)
    .slice(0, limit)
    .map((item) => {
      const direction = item.delta > 0 ? "当前更多" : "当前缺少";
      return `${label} ${item.tag}: 参考 ${item.reference} / 当前 ${item.current}，${direction} ${Math.abs(item.delta)} 个。`;
    });
}

function roleName(role) {
  const normalized = String(role ?? "").replace(/^role:/, "");
  const names = {
    heading: "标题结构",
    progressbar: "进度条区域",
    button: "按钮区域",
    a: "链接区域",
    img: "图片区域",
    svg: "图标区域",
    canvas: "图表/canvas 区域",
    table: "表格区域",
    input: "输入框区域",
    textarea: "多行输入区域",
    select: "选择器区域",
    text: "普通文本结构"
  };
  return names[normalized] ?? `${normalized} 结构`;
}

function roleAdvice(role, delta) {
  const normalized = String(role ?? "").replace(/^role:/, "");
  if (normalized === "none") {
    return null;
  }
  if (normalized === "heading") {
    return delta < 0
      ? "检查卡片标题、分区标题或统计项标题是否被普通文本替代。"
      : "当前标题节点更多，检查是否把普通文本误做成标题。";
  }
  if (normalized === "progressbar") {
    return delta < 0
      ? "参考里有进度条区域，当前没有对应结构时会影响指标卡片还原。"
      : "当前进度条区域更多，检查是否多生成了进度条。";
  }
  if (normalized === "text") {
    return delta > 0
      ? "当前普通文本节点更多，可能把标题、数值或说明拍平成了普通文本。"
      : "当前普通文本节点更少，可能缺少标题、数值或说明文本。";
  }
  if (["button", "a", "input", "textarea", "select"].includes(normalized)) {
    return delta < 0
      ? "检查操作区、筛选区或表单控件是否缺失。"
      : "检查是否多生成了交互控件。";
  }
  if (["img", "svg", "canvas"].includes(normalized)) {
    return delta < 0
      ? "检查图标、图片、图表或可视化区域是否缺失。"
      : "检查是否多生成了图标、图片或图表节点。";
  }
  if (normalized === "table") {
    return delta < 0 ? "检查表格结构是否缺失。" : "检查是否多生成了表格结构。";
  }
  return delta < 0 ? "检查对应结构区域是否缺失。" : "检查是否多生成了对应结构区域。";
}

function roleDeltaLines(deltas, options = {}) {
  const limit = options.limit ?? 5;
  return deltas
    .filter((item) => item.tag !== "role:none")
    .filter((item) => Math.abs(item.delta) >= 1)
    .slice(0, limit)
    .map((item) => {
      const direction = item.delta > 0 ? "当前更多" : "当前缺少";
      const advice = roleAdvice(item.tag, item.delta);
      return `${roleName(item.tag)}不同：参考 ${item.reference} 个 / 当前 ${item.current} 个，${direction} ${Math.abs(item.delta)} 个。${advice ? ` ${advice}` : ""}`;
    });
}

function pairInsightLines(pair) {
  const lines = [];
  if (pair.reference.tag !== pair.current.tag) {
    lines.push(`根节点不同：参考是 ${pair.reference.tag}，当前是 ${pair.current.tag}，先确认是否选中同一层级。`);
  }
  if (pair.reference.display !== pair.current.display) {
    lines.push(`布局 display 不同：参考 ${pair.reference.display} / 当前 ${pair.current.display}。`);
  }
  if (Math.abs(pair.reference.childCount - pair.current.childCount) >= 6) {
    lines.push(`子元素数量不同：参考 ${pair.reference.childCount} 个 / 当前 ${pair.current.childCount} 个，优先检查是否缺少标题、进度条、图表、操作区或统计项内部结构。`);
  }
  if (pair.reference.isVisibleCard && !pair.current.isVisibleCard) {
    lines.push("参考像外层卡片，但当前不像可见卡片容器，可能选到了内部文字、图标或透明容器。");
  }
  lines.push(...roleDeltaLines(pair.roleDelta, { limit: 6 }));
  lines.push(...deltaLines(pair.tagDelta, "节点差异", { threshold: 2, limit: 4 }));
  if (pair.reference.textCount !== pair.current.textCount) {
    const direction = pair.current.textCount > pair.reference.textCount ? "当前文本节点更多，可能结构被拍平。" : "当前文本节点更少，可能缺少标题、说明或数值文本。";
    lines.push(`文本节点数量不同：参考 ${pair.reference.textCount} / 当前 ${pair.current.textCount}，${direction}`);
  }
  if (pair.reference.mediaCount !== pair.current.mediaCount) {
    lines.push(`媒体节点数量不同：参考 ${pair.reference.mediaCount} / 当前 ${pair.current.mediaCount}，检查图片、svg、canvas、图表或图标区域。`);
  }
  return Array.from(new Set(lines));
}

function structureInsightLines(structureDiff) {
  const limit = maxInsightCount(structureDiff.severity);
  const lines = structureDiff.pairs.flatMap((pair) => {
    return pairInsightLines(pair).map((line) => {
      return structureDiff.pairs.length > 1 ? `元素 ${pair.index}: ${line}` : line;
    });
  });
  if (lines.length === 0) {
    return ["未发现明显结构差异点，默认继续处理样式差异。"];
  }
  const visible = lines.slice(0, limit);
  const hiddenCount = lines.length - visible.length;
  if (hiddenCount > 0) {
    visible.push(`还有 ${hiddenCount} 条结构差异未展开，可复制详细结构数据查看。`);
  }
  return visible;
}

function recommendationLines(structureDiff) {
  if (structureDiff.severity === "high") {
    return [
      "先确认当前 selector 是否选到了参考元素对应的外层容器。",
      "如果选择正确，先重建 DOM / 组件层级和关键布局区域，再做样式对比。",
      "结构对齐后重新采集一次，再处理尺寸、颜色、字体、间距和阴影。"
    ];
  }
  if (structureDiff.severity === "medium") {
    return [
      "先确认两边是否选中同一层级，尤其是外层卡片、网格容器和内容区。",
      "如果层级正确，优先补齐关键内部结构，再继续处理样式差异。",
      "不要只根据颜色、字体、间距硬调，避免掩盖布局缺失。"
    ];
  }
  return [
    "不需要重新选择外层容器。",
    "如果视觉差异集中在标题、进度条、图表或统计项，优先检查上面的局部结构差异。",
    "然后继续处理尺寸、间距、颜色、字体等样式差异。"
  ];
}

function formatPair(pair) {
  return [
    `### 元素 ${pair.index}`,
    `结构相似度: ${pair.score}/100 (${pair.severity})`,
    `当前项目要修改的元素: ${pair.currentSelector}`,
    `参考根: ${pair.reference.tag}; rect ${formatRect(pair.reference.rect)}; display ${pair.reference.display}; 子元素 ${pair.reference.childCount}`,
    `当前根: ${pair.current.tag}; rect ${formatRect(pair.current.rect)}; display ${pair.current.display}; 子元素 ${pair.current.childCount}`,
    `参考 tag 分布: ${formatCounts(pair.reference.tagCounts)}`,
    `当前 tag 分布: ${formatCounts(pair.current.tagCounts)}`,
    ...formatDeltas(pair.tagDelta, "tag 差异"),
    ...formatDeltas(pair.roleDelta, "角色差异"),
    "结构风险:",
    ...(pair.warnings.length > 0 ? pair.warnings.map((warning) => `- ${warning}`) : ["- 未发现明显结构风险。"])
  ].join("\n");
}

export function buildStructurePrompt(structureDiff, options = {}) {
  const risks = structureRiskLines(structureDiff);
  const detail = options.detail ?? "compact";
  const insightLines = structureInsightLines(structureDiff);
  const recommendations = recommendationLines(structureDiff);
  const lines = [
    `## ${riskTitle(structureDiff.severity)}`,
    "",
    `结构相似度: ${structureDiff.score}/100`,
    `风险等级: ${riskLabel(structureDiff.severity)}`,
    "",
    "## 对比对象",
    ...(structureDiff.pairs[0] ? objectLines(structureDiff.pairs[0]) : ["参考元素: (未知)", "当前元素: (未知)"]),
    "",
    "## 页面",
    `参考页: ${structureDiff.pages.reference?.url ?? "(未知)"}`,
    `当前实现页: ${structureDiff.pages.current?.url ?? "(未知)"}`,
    `对比元素数量: 参考 ${structureDiff.count.reference} / 当前 ${structureDiff.count.current} / 已配对 ${structureDiff.count.compared}`,
    "",
    "## 关键结构差异",
    ...insightLines.map((line) => `- ${line}`),
    "",
    "## 建议",
    ...recommendations.map((line) => `- ${line}`),
    ""
  ];

  if (detail !== "full") {
    return lines.join("\n");
  }

  lines.push(
    "## 详细结构状态",
    ...(risks.length > 0 ? risks.map((line) => `- ${line}`) : ["- 未发现明显结构风险。"]),
    "",
    "## 逐元素结构数据",
    ...structureDiff.pairs.map(formatPair),
    "",
    "## 详细定位信息",
    ...structureDiff.pairs.map(detailedLocationLines),
    "",
    "## 详细版说明",
    "- 详细版用于排查复杂结构，不建议默认全部交给模型硬改。",
    "- 默认修复仍应优先参考「关键结构差异」和「建议」。",
    ""
  );

  return lines.join("\n");
}

export function buildDetailedStructurePrompt(structureDiff) {
  return buildStructurePrompt(structureDiff, { detail: "full" });
}

export function buildLegacyStructurePrompt(structureDiff) {
  const risks = structureRiskLines(structureDiff);
  return [
    "请先调整当前项目的 DOM / 组件 / 布局结构，让当前实现与参考元素的视觉结构对齐。",
    "",
    "不要先处理颜色、字体等细节样式。当前任务优先修复层级、容器、顺序和关键区域缺失。",
    "",
    risks.length > 0 ? [
      "## 先停一下：结构不一致",
      ...risks.map((line) => `- ${line}`),
      "- 如果当前选中的元素不是同一层级，请先重新选择；如果选择正确，请先补齐缺失结构，再继续。",
      ""
    ].join("\n") : "",
    "## 页面",
    `参考页: ${structureDiff.pages.reference?.url ?? "(未知)"}`,
    `当前实现页: ${structureDiff.pages.current?.url ?? "(未知)"}`,
    `对比元素数量: 参考 ${structureDiff.count.reference} / 当前 ${structureDiff.count.current} / 已配对 ${structureDiff.count.compared}`,
    `最低结构相似度: ${structureDiff.score}/100 (${structureDiff.severity})`,
    "",
    "## 结构风险摘要",
    ...(risks.length > 0 ? risks.map((line) => `- ${line}`) : ["- 未发现明显结构风险。"]),
    "",
    "## 逐元素结构对比",
    ...structureDiff.pairs.map(formatPair),
    "",
    "## 修复要求",
    "- 优先修改上面标注的当前项目 selector 对应组件或布局容器。",
    "- 先补齐缺失的 header/body/footer/chart/table/action 等结构区域，再处理样式细节。",
    "- 不要复制参考页面 class/id/selector；参考结构只作为布局目标。",
    "- 结构对齐后，再回到样式对比处理尺寸、颜色、字体、间距和阴影。",
    ""
  ].join("\n");
}
