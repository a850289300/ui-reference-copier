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
  return {
    selector: reference.element.selector,
    tag: reference.element.tag,
    text: normalizeText(reference.element.text).slice(0, 80),
    rect: reference.element.rect,
    display: reference.element.styles.box.display,
    parentDisplay: reference.element.parent?.display ?? "",
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

function formatDeltas(items, label) {
  if (items.length === 0) {
    return [`- ${label}: 未发现明显数量差异。`];
  }
  return items.map((item) => {
    return `- ${label} ${item.tag}: 参考 ${item.reference} / 当前 ${item.current}`;
  });
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

export function buildStructurePrompt(structureDiff) {
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
