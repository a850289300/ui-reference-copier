import { buildDiffPrompt, compareReferenceSets, summarizeDiff } from "./diff.mjs";
import { structureRiskLines } from "./structure.mjs";

function fallbackId() {
  return `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone(value) {
  return structuredClone(value);
}

function round(value) {
  return Math.round(Number(value) * 100) / 100;
}

function unionRectFromGroups(groups, key) {
  const rects = groups
    .flatMap((group) => group[key] ?? [])
    .map((reference) => reference.element.rect)
    .filter(Boolean);
  if (rects.length === 0) {
    return null;
  }
  const left = Math.min(...rects.map((rect) => rect.left ?? rect.x));
  const top = Math.min(...rects.map((rect) => rect.top ?? rect.y));
  const right = Math.max(...rects.map((rect) => rect.right ?? rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.bottom ?? rect.y + rect.height));
  return {
    x: round(left),
    y: round(top),
    width: round(right - left),
    height: round(bottom - top)
  };
}

function formatRect(rect) {
  if (!rect) {
    return "(无)";
  }
  return `${rect.x}, ${rect.y}, ${rect.width} x ${rect.height}`;
}

function snapshotReference(reference, options = {}) {
  const element = reference.element;
  const styles = element.styles;
  const parent = element.parent;
  return [
    options.includeSelector ? `当前项目要修改: ${element.selector}` : null,
    `rect ${formatRect(element.rect)}`,
    `display ${styles.box.display}`,
    `padding ${styles.box.padding}`,
    `margin ${styles.box.margin}`,
    `背景 ${styles.color.background}`,
    `圆角 ${styles.box.borderRadius}`,
    `阴影 ${styles.box.boxShadow}`,
    options.includeSelector
      ? `父级: ${parent?.selector ?? "(none)"}; display ${parent?.display ?? "(unknown)"}; gap ${parent?.gap ?? "(unknown)"}; padding ${parent?.padding ?? "(unknown)"}`
      : `父级布局: display ${parent?.display ?? "(unknown)"}; gap ${parent?.gap ?? "(unknown)"}; padding ${parent?.padding ?? "(unknown)"}`
  ].filter(Boolean).join("; ");
}

function iconSnapshot(reference, options = {}) {
  const icons = reference.element.iconDetails ?? [];
  if (icons.length === 0) {
    return "";
  }
  return `图标: ${icons.map((icon) => {
    if (icon.type === "svg") {
      return options.includeSelector
        ? `svg ${icon.selector} viewBox ${icon.viewBox || "(none)"} path ${icon.pathCount}`
        : `svg viewBox ${icon.viewBox || "(none)"} path ${icon.pathCount}`;
    }
    if (icon.type === "img") {
      return options.includeSelector
        ? `img ${icon.selector} src ${icon.src || "(none)"}`
        : `img src ${icon.src || "(none)"}`;
    }
    return options.includeSelector
      ? `css/iconfont ${icon.selector} class ${icon.className || "(none)"}`
      : `css/iconfont font ${icon.fontFamily || "(none)"}`;
  }).join("; ")}`;
}

function isVisibleCard(reference) {
  const styles = reference.element.styles;
  return styles.color.background !== "rgba(0, 0, 0, 0)" ||
    styles.box.borderRadius !== "0px" ||
    styles.box.boxShadow !== "none" ||
    !String(styles.box.border ?? "").startsWith("0px");
}

function scopeWarnings(group) {
  if (!group.currentReferences?.length) {
    return [];
  }

  const warnings = [];
  const pairCount = Math.min(group.references.length, group.currentReferences.length);
  for (let index = 0; index < pairCount; index += 1) {
    const reference = group.references[index];
    const current = group.currentReferences[index];
    if (isVisibleCard(reference) && !isVisibleCard(current)) {
      warnings.push(`范围可能不一致：参考像外层卡片，但当前像内部图标/文字或透明容器。请重新选择当前外层卡片。`);
    }
    if (reference.element.parent?.display !== current.element.parent?.display) {
      warnings.push(`父级布局不同：参考父级是 ${reference.element.parent?.display || "(unknown)"}，当前父级是 ${current.element.parent?.display || "(unknown)"}。`);
    }
  }
  return Array.from(new Set(warnings));
}

function groupSnapshotLines(group) {
  const referenceLabel = group.references?.length === 1 ? "参考范围" : "参考范围";
  const currentLabel = group.currentReferences?.length === 1 ? "当前范围" : "当前范围";
  const lines = [
    `### 组 ${group.index}：${group.name}`,
    ...(group.references ?? []).map((reference, index) => {
      const suffix = group.references.length === 1 ? "" : ` ${index + 1}`;
      return `- ${referenceLabel}${suffix}: ${[snapshotReference(reference), iconSnapshot(reference)].filter(Boolean).join("; ")}`;
    })
  ];
  if (group.currentReferences?.length > 0) {
    lines.push(...group.currentReferences.map((reference, index) => {
      const suffix = group.currentReferences.length === 1 ? "" : ` ${index + 1}`;
      return `- ${currentLabel}${suffix}: ${[snapshotReference(reference, { includeSelector: true }), iconSnapshot(reference, { includeSelector: true })].filter(Boolean).join("; ")}`;
    }));
  } else {
    lines.push("- 当前范围: 还没有匹配当前实现元素");
  }
  return lines.join("\n");
}

function formatLayoutOverview(groupedDiff) {
  return [
    `参考整体边界: ${formatRect(groupedDiff.layout.referenceBounds)}`,
    `当前整体边界: ${formatRect(groupedDiff.layout.currentBounds)}`,
    ...groupedDiff.groups.map((group) => {
      const referenceRect = unionRectFromGroups([group], "references");
      const currentRect = unionRectFromGroups([group], "currentReferences");
      return `组 ${group.index} ${group.name}: 参考 ${formatRect(referenceRect)} / 当前 ${formatRect(currentRect)}`;
    })
  ].join("\n");
}

function recomputeGroupDiff(group) {
  if (!group.currentReferences?.length) {
    return null;
  }
  return compareReferenceSets(group.references, group.currentReferences);
}

export function createReferenceGroup(references, options = {}) {
  const savedAt = options.savedAt ?? new Date().toISOString();
  return {
    id: options.id ?? fallbackId(),
    name: options.name ?? `参考组 ${savedAt.slice(11, 19)}`,
    savedAt,
    referencePage: references[0]?.page ?? null,
    references: clone(references),
    currentPage: null,
    currentReferences: null,
    matchedAt: null,
    diff: null
  };
}

export function attachCurrentToGroup(group, currentReferences, options = {}) {
  const diff = compareReferenceSets(group.references, currentReferences);
  return {
    ...clone(group),
    currentPage: currentReferences[0]?.page ?? null,
    currentReferences: clone(currentReferences),
    matchedAt: options.matchedAt ?? new Date().toISOString(),
    diff
  };
}

export function compareReferenceGroups(groups) {
  const normalizedGroups = groups.map((group, index) => {
    const diff = recomputeGroupDiff(group);
    const status = diff ? "compared" : "missing-current";
    return {
      index: index + 1,
      id: group.id,
      name: group.name,
      status,
      referenceCount: group.references?.length ?? 0,
      currentCount: group.currentReferences?.length ?? 0,
      references: group.references ?? [],
      currentReferences: group.currentReferences ?? [],
      warnings: scopeWarnings(group),
      diff
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    count: {
      groups: normalizedGroups.length,
      compared: normalizedGroups.filter((group) => group.status === "compared").length,
      missingCurrent: normalizedGroups.filter((group) => group.status === "missing-current").length
    },
    layout: {
      referenceBounds: unionRectFromGroups(normalizedGroups, "references"),
      currentBounds: unionRectFromGroups(normalizedGroups, "currentReferences")
    },
    groups: normalizedGroups
  };
}

function formatGroupWarnings(group) {
  if (!group.warnings?.length) {
    return [
      `### 组 ${group.index}：${group.name}`,
      "- 未发现明显范围风险。"
    ].join("\n");
  }
  return [
    `### 组 ${group.index}：${group.name}`,
    ...group.warnings.map((warning) => `- ${warning}`)
  ].join("\n");
}

function formatGroupSummary(group) {
  if (!group.diff) {
    return [
      `### 组 ${group.index}：${group.name}`,
      "- 还没有匹配当前实现元素。"
    ].join("\n");
  }

  const summary = summarizeDiff(group.diff, 8);
  const structureRisks = structureRiskLines(group.diff.structure);
  return [
    `### 组 ${group.index}：${group.name}`,
    ...(structureRisks.length > 0 ? structureRisks.slice(0, 3).map((line) => `- ${line}`) : []),
    ...(summary.length > 0 ? summary.map((line) => `- ${line.replace(/^\d+\.\s*/, "")}`) : ["- 未发现明显关键差异。"])
  ].join("\n");
}

function formatGroupStructureRisks(group) {
  const risks = structureRiskLines(group.diff?.structure);
  if (risks.length === 0) {
    return [
      `### 组 ${group.index}：${group.name}`,
      "- 未发现明显结构风险。"
    ].join("\n");
  }
  return [
    `### 组 ${group.index}：${group.name}`,
    ...risks.map((risk) => `- ${risk}`)
  ].join("\n");
}

function formatDetailedDiffs(comparedGroups) {
  if (comparedGroups.length === 0) {
    return ["还没有任何完成对比的组。"];
  }
  return comparedGroups.flatMap((group) => [
    `### 组 ${group.index}：${group.name}`,
    buildDiffPrompt(group.diff)
  ]);
}

export function buildGroupedDiffPrompt(groupedDiff, options = {}) {
  const comparedGroups = groupedDiff.groups.filter((group) => group.diff);
  const detail = options.detail ?? "compact";
  const lines = [
    "请根据下面的多组元素对比结果调整当前项目，让当前实现尽量 1:1 对齐参考页面。",
    "",
    "## 多组元素对比",
    `参考组数量: ${groupedDiff.count.groups}`,
    `已完成对比: ${groupedDiff.count.compared}`,
    `未匹配当前实现: ${groupedDiff.count.missingCurrent}`,
    "",
    "## 整体布局关系",
    formatLayoutOverview(groupedDiff),
    "",
    "## 参考组范围快照",
    ...groupedDiff.groups.map(groupSnapshotLines),
    "",
    "## 范围检查",
    ...groupedDiff.groups.map(formatGroupWarnings),
    "",
    "## 结构风险提示",
    ...groupedDiff.groups.map(formatGroupStructureRisks),
    "",
    "## 每组关键差异摘要",
    ...groupedDiff.groups.map(formatGroupSummary),
    ""
  ];

  if (detail === "full") {
    lines.push(
      "## 每组详细差异",
      ...formatDetailedDiffs(comparedGroups),
      ""
    );
  }

  lines.push(
    "## 修复要求",
    "- 先确认每组选择范围是否一致。如果参考是白色卡片，当前也必须匹配外层卡片，不要只匹配内部图标或文字。",
    "- 多组共同布局要整体还原，例如卡片外框、背景色、横向/网格排列、每组宽高和组间 gap。",
    "- 按组逐一修复，优先处理每组摘要里的尺寸、间距、字体、颜色和子元素差异。",
    "- 参考范围的 class/id/selector 不作为实现目标；请优先修改每组“当前项目要修改”的 selector，或映射到当前项目已有组件、样式、design token 或复用 class 中。",
    "- 不要为了单个组使用大量 absolute positioning 或 transform 硬凑。",
    "- 修复后建议再次使用插件逐组对比，确认差异是否收敛。",
    ""
  );

  return lines.join("\n");
}
