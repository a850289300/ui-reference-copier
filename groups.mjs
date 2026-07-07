import { buildDiffPrompt, compareReferenceSets, summarizeDiff } from "./diff.mjs";

function fallbackId() {
  return `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone(value) {
  return structuredClone(value);
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
    const status = group.diff ? "compared" : "missing-current";
    return {
      index: index + 1,
      id: group.id,
      name: group.name,
      status,
      referenceCount: group.references?.length ?? 0,
      currentCount: group.currentReferences?.length ?? 0,
      diff: group.diff ?? null
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    count: {
      groups: normalizedGroups.length,
      compared: normalizedGroups.filter((group) => group.status === "compared").length,
      missingCurrent: normalizedGroups.filter((group) => group.status === "missing-current").length
    },
    groups: normalizedGroups
  };
}

function formatGroupSummary(group) {
  if (!group.diff) {
    return [
      `### 组 ${group.index}：${group.name}`,
      "- 还没有匹配当前实现元素。"
    ].join("\n");
  }

  const summary = summarizeDiff(group.diff, 8);
  return [
    `### 组 ${group.index}：${group.name}`,
    ...(summary.length > 0 ? summary.map((line) => `- ${line.replace(/^\d+\.\s*/, "")}`) : ["- 未发现明显关键差异。"])
  ].join("\n");
}

export function buildGroupedDiffPrompt(groupedDiff) {
  const comparedGroups = groupedDiff.groups.filter((group) => group.diff);
  return [
    "请根据下面的多组元素对比结果调整当前项目，让当前实现尽量 1:1 对齐参考页面。",
    "",
    "## 多组元素对比",
    `参考组数量: ${groupedDiff.count.groups}`,
    `已完成对比: ${groupedDiff.count.compared}`,
    `未匹配当前实现: ${groupedDiff.count.missingCurrent}`,
    "",
    "## 每组关键差异摘要",
    ...groupedDiff.groups.map(formatGroupSummary),
    "",
    "## 每组详细差异",
    ...(comparedGroups.length > 0
      ? comparedGroups.flatMap((group) => [
          `### 组 ${group.index}：${group.name}`,
          buildDiffPrompt(group.diff)
        ])
      : ["还没有任何完成对比的组。"]),
    "",
    "## 修复要求",
    "- 按组逐一修复，优先处理每组摘要里的尺寸、间距、字体、颜色和子元素差异。",
    "- 多个组共享的问题优先抽到共同父级布局、组件样式、design token 或复用 class 中。",
    "- 不要为了单个组使用大量 absolute positioning 或 transform 硬凑。",
    "- 修复后建议再次使用插件逐组对比，确认差异是否收敛。",
    ""
  ].join("\n");
}
