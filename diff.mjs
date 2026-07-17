import { compareStructureSets, structureRiskLines } from "./structure.mjs";

const STYLE_FIELDS = [
  ["font.family", (item) => item.element.styles.font.family],
  ["font.size", (item) => item.element.styles.font.size],
  ["font.weight", (item) => item.element.styles.font.weight],
  ["font.lineHeight", (item) => item.element.styles.font.lineHeight],
  ["font.letterSpacing", (item) => item.element.styles.font.letterSpacing],
  ["color.text", (item) => item.element.styles.color.text],
  ["color.background", (item) => item.element.styles.color.background],
  ["box.display", (item) => item.element.styles.box.display],
  ["box.padding", (item) => item.element.styles.box.padding],
  ["box.margin", (item) => item.element.styles.box.margin],
  ["box.border", (item) => item.element.styles.box.border],
  ["box.borderRadius", (item) => item.element.styles.box.borderRadius],
  ["box.boxShadow", (item) => item.element.styles.box.boxShadow],
  ["layout.gap", (item) => item.element.styles.layout.gap],
  ["layout.alignItems", (item) => item.element.styles.layout.alignItems],
  ["layout.justifyContent", (item) => item.element.styles.layout.justifyContent],
  ["parent.display", (item) => item.element.parent?.display],
  ["parent.gap", (item) => item.element.parent?.gap],
  ["parent.padding", (item) => item.element.parent?.padding]
];
const CHILD_STYLE_FIELDS = [
  "fontFamily",
  "width",
  "minWidth",
  "maxWidth",
  "height",
  "minHeight",
  "maxHeight",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textTransform",
  "textDecorationLine",
  "whiteSpace",
  "wordBreak",
  "textOverflow",
  "color",
  "background",
  "backgroundImage",
  "backgroundSize",
  "backgroundPosition",
  "opacity",
  "display",
  "padding",
  "margin",
  "border",
  "outline",
  "borderRadius",
  "boxShadow",
  "boxSizing",
  "position",
  "inset",
  "zIndex",
  "overflow",
  "overflowX",
  "overflowY",
  "transform",
  "transformOrigin",
  "transitionDuration",
  "transitionTimingFunction",
  "transitionProperty",
  "gap",
  "rowGap",
  "columnGap",
  "alignItems",
  "justifyContent",
  "flexDirection",
  "flexWrap",
  "gridTemplateColumns",
  "gridTemplateRows",
  "objectFit",
  "objectPosition",
  "aspectRatio"
];

const VISUAL_BASELINE_FIELDS = [
  ["位置", (item) => {
    const rect = item.element.rect;
    return `${rect.x}, ${rect.y}, ${rect.width} x ${rect.height}`;
  }],
  ["字体", (item) => {
    const font = item.element.styles.font;
    return `${font.family}; ${font.size}; weight ${font.weight}; line-height ${font.lineHeight}; letter-spacing ${font.letterSpacing}`;
  }],
  ["文字色", (item) => item.element.styles.color.text],
  ["背景色", (item) => item.element.styles.color.background],
  ["背景图", (item) => item.element.styles.color.backgroundImage],
  ["display", (item) => item.element.styles.box.display],
  ["padding", (item) => item.element.styles.box.padding],
  ["margin", (item) => item.element.styles.box.margin],
  ["border", (item) => item.element.styles.box.border],
  ["圆角", (item) => item.element.styles.box.borderRadius],
  ["box-shadow", (item) => item.element.styles.box.boxShadow],
  ["position", (item) => item.element.styles.layout.position],
  ["gap", (item) => item.element.styles.layout.gap],
  ["align / justify", (item) => `${item.element.styles.layout.alignItems} / ${item.element.styles.layout.justifyContent}`],
  ["父级布局", (item) => {
    const parent = item.element.parent;
    return `${parent?.selector ?? "(none)"}; display ${parent?.display ?? "(unknown)"}; gap ${parent?.gap ?? "(unknown)"}; padding ${parent?.padding ?? "(unknown)"}`;
  }]
];

function round(value) {
  return Math.round(Number(value) * 100) / 100;
}

function unionRect(references) {
  if (references.length === 0) {
    return null;
  }

  const rects = references.map((item) => item.element.rect);
  const left = Math.min(...rects.map((rect) => rect.left ?? rect.x));
  const top = Math.min(...rects.map((rect) => rect.top ?? rect.y));
  const right = Math.max(...rects.map((rect) => rect.right ?? rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.bottom ?? rect.y + rect.height));

  return {
    x: round(left),
    y: round(top),
    width: round(right - left),
    height: round(bottom - top),
    right: round(right),
    bottom: round(bottom)
  };
}

function diffNumber(baseline, current) {
  return {
    baseline,
    current,
    delta: round(current - baseline)
  };
}

function diffRect(baseline, current) {
  return {
    x: diffNumber(baseline.x, current.x),
    y: diffNumber(baseline.y, current.y),
    width: diffNumber(baseline.width, current.width),
    height: diffNumber(baseline.height, current.height)
  };
}

function readField(item, reader) {
  const value = reader(item);
  return value === undefined || value === null ? "" : String(value);
}

function visualBaselineSnapshot(item) {
  return VISUAL_BASELINE_FIELDS.map(([label, reader]) => ({
    label,
    value: readField(item, reader)
  }));
}

function diffStyles(baseline, current) {
  const result = {};

  STYLE_FIELDS.forEach(([name, reader]) => {
    const baselineValue = readField(baseline, reader);
    const currentValue = readField(current, reader);
    if (baselineValue !== currentValue) {
      result[name] = {
        baseline: baselineValue,
        current: currentValue
      };
    }
  });

  return result;
}

function normalizedText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function rectDistance(a, b) {
  return Math.abs((a?.x ?? 0) - (b?.x ?? 0)) + Math.abs((a?.y ?? 0) - (b?.y ?? 0));
}

function sizeDistance(a, b) {
  return Math.abs((a?.width ?? 0) - (b?.width ?? 0)) + Math.abs((a?.height ?? 0) - (b?.height ?? 0));
}

function childMatchScore(baselineChild, currentChild, fallbackIndex, currentIndex) {
  let score = 0;
  const baselineText = normalizedText(baselineChild.text);
  const currentText = normalizedText(currentChild.text);

  if (baselineChild.signature === currentChild.signature) {
    score += 120;
  }
  if (baselineText && baselineText === currentText) {
    score += 90;
  } else if (baselineText && currentText && (baselineText.includes(currentText) || currentText.includes(baselineText))) {
    score += 45;
  }
  if (baselineChild.tag && baselineChild.tag === currentChild.tag) {
    score += 25;
  }
  if (baselineChild.attributes?.role && baselineChild.attributes.role === currentChild.attributes?.role) {
    score += 25;
  }
  if (baselineChild.attributes?.ariaLabel && baselineChild.attributes.ariaLabel === currentChild.attributes?.ariaLabel) {
    score += 35;
  }

  score -= Math.min(60, rectDistance(baselineChild.relativeRect, currentChild.relativeRect) * 0.35);
  score -= Math.min(35, sizeDistance(baselineChild.relativeRect, currentChild.relativeRect) * 0.2);
  score -= Math.abs(fallbackIndex - currentIndex) * 3;

  return score;
}

function findCurrentChild(baselineChild, currentChildren, usedIndexes, fallbackIndex) {
  let bestIndex = -1;
  let bestScore = -Infinity;

  currentChildren.forEach((child, index) => {
    if (usedIndexes.has(index)) {
      return;
    }
    const score = childMatchScore(baselineChild, child, fallbackIndex, index);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  if (bestIndex < 0 || bestScore < -20) {
    return null;
  }

  usedIndexes.add(bestIndex);
  return currentChildren[bestIndex];
}

function diffChildStyles(baselineChild, currentChild) {
  const result = {};
  CHILD_STYLE_FIELDS.forEach((name) => {
    const baselineValue = baselineChild.styles?.[name] ?? "";
    const currentValue = currentChild.styles?.[name] ?? "";
    if (baselineValue !== currentValue) {
      result[name] = {
        baseline: baselineValue,
        current: currentValue
      };
    }
  });
  Array.from(new Set([
    ...Object.keys(baselineChild.styleVars ?? {}),
    ...Object.keys(currentChild.styleVars ?? {})
  ])).forEach((name) => {
    const baselineValue = baselineChild.styleVars?.[name] ?? "";
    const currentValue = currentChild.styleVars?.[name] ?? "";
    if (baselineValue !== currentValue) {
      result[`var.${name}`] = {
        baseline: baselineValue,
        current: currentValue
      };
    }
  });
  return result;
}

function diffChildRects(baselineChild, currentChild) {
  return diffRect(baselineChild.relativeRect, currentChild.relativeRect);
}

const ICON_FIELDS = [
  "type",
  "viewBox",
  "pathCount",
  "useHref",
  "fill",
  "stroke",
  "color",
  "src",
  "alt",
  "objectFit",
  "fontFamily",
  "backgroundImage",
  "maskImage"
];

function iconLabel(icon) {
  if (!icon) {
    return "(missing)";
  }
  if (icon.type === "svg") {
    return `svg viewBox ${icon.viewBox || "(none)"} path ${icon.pathCount ?? "(unknown)"}`;
  }
  if (icon.type === "img") {
    return `img src ${icon.src || "(none)"}`;
  }
  return `css/iconfont font ${icon.fontFamily || "(none)"}`;
}

function diffIconFields(baselineIcon, currentIcon) {
  const result = {};
  ICON_FIELDS.forEach((name) => {
    const baselineValue = baselineIcon?.[name] ?? "";
    const currentValue = currentIcon?.[name] ?? "";
    if (String(baselineValue) !== String(currentValue)) {
      result[name] = {
        baseline: String(baselineValue),
        current: String(currentValue)
      };
    }
  });
  return result;
}

function diffIconRects(baselineIcon, currentIcon) {
  if (!baselineIcon?.rect || !currentIcon?.rect) {
    return null;
  }
  return diffRect(baselineIcon.rect, currentIcon.rect);
}

function hasRectDiff(rect) {
  return Boolean(rect) && (
    rect.x.delta !== 0 ||
    rect.y.delta !== 0 ||
    rect.width.delta !== 0 ||
    rect.height.delta !== 0
  );
}

function diffIcons(baseline, current) {
  const baselineIcons = baseline.element.iconDetails ?? [];
  const currentIcons = current.element.iconDetails ?? [];
  const pairCount = Math.min(baselineIcons.length, currentIcons.length);
  const iconDiffs = [];

  for (let index = 0; index < pairCount; index += 1) {
    const baselineIcon = baselineIcons[index];
    const currentIcon = currentIcons[index];
    const rect = diffIconRects(baselineIcon, currentIcon);
    const fields = diffIconFields(baselineIcon, currentIcon);
    if (hasRectDiff(rect) || Object.keys(fields).length > 0) {
      iconDiffs.push({
        index: index + 1,
        baseline: iconLabel(baselineIcon),
        current: iconLabel(currentIcon),
        missing: false,
        rect,
        fields
      });
    }
  }

  baselineIcons.slice(pairCount).forEach((icon, offset) => {
    iconDiffs.push({
      index: pairCount + offset + 1,
      baseline: iconLabel(icon),
      current: "(missing)",
      missing: true,
      rect: null,
      fields: {}
    });
  });

  currentIcons.slice(pairCount).forEach((icon, offset) => {
    iconDiffs.push({
      index: pairCount + offset + 1,
      baseline: "(missing)",
      current: iconLabel(icon),
      extra: true,
      rect: null,
      fields: {}
    });
  });

  return {
    baselineCount: baselineIcons.length,
    currentCount: currentIcons.length,
    items: iconDiffs
  };
}

function absoluteDelta(value) {
  return Math.abs(Number(value?.delta ?? 0));
}

function scoreStyleField(name) {
  if (/width|height|padding|margin|gap|font\.size|fontSize|lineHeight|borderRadius|radius/i.test(name)) {
    return 90;
  }
  if (/color|background|shadow|border/i.test(name)) {
    return 75;
  }
  if (/display|align|justify|grid|flex|position/i.test(name)) {
    return 70;
  }
  return 45;
}

function rectSummaryItems(rect, label, context) {
  return ["width", "height", "x", "y"]
    .filter((name) => absoluteDelta(rect?.[name]) > 0)
    .map((name) => ({
      score: absoluteDelta(rect[name]) + (name === "width" || name === "height" ? 85 : 55),
      text: `${context}${label} ${name}: 参考 ${rect[name].baseline}px / 当前 ${rect[name].current}px / 差异 ${rect[name].delta > 0 ? "+" : ""}${rect[name].delta}px`
    }));
}

function styleSummaryItems(styles, context) {
  return Object.entries(styles ?? {}).map(([name, value]) => ({
    score: scoreStyleField(name),
    text: `${context}${name}: 参考 ${value.baseline || "(空)"} / 当前 ${value.current || "(空)"}`
  }));
}

function childSummaryItems(children = [], pairIndex) {
  return children.flatMap((child) => {
    const context = `元素 ${pairIndex} 的子元素 ${child.index}: `;
    if (child.missing) {
      return [{
        score: 120,
        text: `${context}参考子元素在当前实现中缺失`
      }];
    }
    return [
      ...rectSummaryItems(child.rect, "位置尺寸", context),
      ...styleSummaryItems(child.styles, context)
    ];
  });
}

function skippedChildSummaryItems(pair, pairIndex) {
  if (!pair.childComparisonSkipped) {
    return [];
  }
  return [{
    score: 140,
    text: `元素 ${pairIndex}: 已跳过子元素样式对比，仅对比选中根元素`
  }];
}

function iconSummaryItems(icons, pairIndex) {
  if (!icons || (icons.baselineCount === 0 && icons.currentCount === 0)) {
    return [];
  }

  const countItems = icons.baselineCount === icons.currentCount
    ? []
    : [{
        score: 100,
        text: `元素 ${pairIndex}: 图标数量 参考 ${icons.baselineCount} / 当前 ${icons.currentCount}`
      }];

  return [
    ...countItems,
    ...icons.items.flatMap((icon) => {
      const context = `元素 ${pairIndex} 的图标 ${icon.index}: `;
      if (icon.missing) {
        return [{
          score: 110,
          text: `${context}${icon.baseline} 在当前实现中缺失`
        }];
      }
      if (icon.extra) {
        return [{
          score: 80,
          text: `${context}当前多出 ${icon.current}`
        }];
      }
      return [
        ...rectSummaryItems(icon.rect, "位置尺寸", context),
        ...styleSummaryItems(icon.fields, context)
      ];
    })
  ];
}

function structurePairFor(diff, pair) {
  return diff.structure?.pairs?.find((item) => item.index === pair.index) ?? null;
}

function isMenuPair(diff, pair) {
  return Boolean(structurePairFor(diff, pair)?.menuSemantics);
}

function menuSummaryItems(diff, pair) {
  const structurePair = structurePairFor(diff, pair);
  const semantics = structurePair?.menuSemantics;
  if (!semantics) {
    return [];
  }
  const items = [{
    score: 130,
    text: `元素 ${pair.index}: 这是菜单/导航组件，请按菜单树和菜单状态修复，不要按 DOM 子元素顺序逐个改样式`
  }];
  if (semantics.missing?.length > 0) {
    items.push({
      score: 125,
      text: `元素 ${pair.index}: 当前可能缺少菜单项 ${semantics.missing.slice(0, 8).join("、")}`
    });
  }
  if (semantics.extra?.length > 0) {
    items.push({
      score: 110,
      text: `元素 ${pair.index}: 当前可能多出菜单项 ${semantics.extra.slice(0, 8).join("、")}`
    });
  }
  return items;
}

export function summarizeDiff(diff, limit = 10) {
  const items = [
    ...rectSummaryItems(diff.bounds, "整体边界", ""),
    ...diff.pairs.flatMap((pair) => [
      ...rectSummaryItems(pair.rect, "位置尺寸", `元素 ${pair.index}: `),
      ...styleSummaryItems(pair.styles, `元素 ${pair.index}: `),
      ...(isMenuPair(diff, pair) ? menuSummaryItems(diff, pair) : [
        ...skippedChildSummaryItems(pair, pair.index),
        ...childSummaryItems(pair.children, pair.index)
      ]),
      ...iconSummaryItems(pair.icons, pair.index)
    ])
  ];

  return items
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item, index) => `${index + 1}. ${item.text}`);
}

function diffChildren(baseline, current) {
  const baselineChildren = baseline.element.children ?? [];
  const currentChildren = current.element.children ?? [];
  const usedIndexes = new Set();

  return baselineChildren.map((baselineChild, index) => {
    const currentChild = findCurrentChild(baselineChild, currentChildren, usedIndexes, index);
    if (!currentChild) {
      return {
        index: index + 1,
        baselineSelector: baselineChild.selector,
        currentSelector: "(missing)",
        baselineText: baselineChild.text,
        currentText: "",
        missing: true,
        rect: null,
        styles: {}
      };
    }

    return {
      index: index + 1,
      baselineSelector: baselineChild.selector,
      currentSelector: currentChild.selector,
      baselineText: baselineChild.text,
      currentText: currentChild.text,
      missing: false,
      rect: diffChildRects(baselineChild, currentChild),
      styles: diffChildStyles(baselineChild, currentChild)
    };
  }).filter((childDiff) => {
    return childDiff.missing || Object.keys(childDiff.styles).length > 0 || (childDiff.rect && (
      childDiff.rect.x.delta !== 0 ||
      childDiff.rect.y.delta !== 0 ||
      childDiff.rect.width.delta !== 0 ||
      childDiff.rect.height.delta !== 0
    ));
  });
}

export function compareReferenceSets(baselineReferences, currentReferences, options = {}) {
  const baselineBounds = unionRect(baselineReferences);
  const currentBounds = unionRect(currentReferences);
  const pairCount = Math.min(baselineReferences.length, currentReferences.length);
  const structure = compareStructureSets(baselineReferences, currentReferences);
  const includeChildren = options.includeChildren !== false;

  return {
    generatedAt: new Date().toISOString(),
    count: {
      baseline: baselineReferences.length,
      current: currentReferences.length,
      compared: pairCount
    },
    pages: {
      baseline: baselineReferences[0]?.page ?? null,
      current: currentReferences[0]?.page ?? null
    },
    structure,
    bounds: baselineBounds && currentBounds ? diffRect(baselineBounds, currentBounds) : null,
    pairs: Array.from({ length: pairCount }, (_, index) => {
      const baseline = baselineReferences[index];
      const current = currentReferences[index];
      return {
        index: index + 1,
        baselineSelector: baseline.element.selector,
        currentSelector: current.element.selector,
        baselineText: baseline.element.text,
        currentText: current.element.text,
        visualBaseline: {
          baseline: visualBaselineSnapshot(baseline),
          current: visualBaselineSnapshot(current)
        },
        rect: diffRect(baseline.element.rect, current.element.rect),
        styles: diffStyles(baseline, current),
        children: includeChildren ? diffChildren(baseline, current) : [],
        childComparisonSkipped: !includeChildren,
        icons: diffIcons(baseline, current)
      };
    })
  };
}

function formatDelta(item) {
  const sign = item.delta > 0 ? "+" : "";
  return `参考 ${item.baseline} / 当前 ${item.current} / 差异 ${sign}${item.delta}px`;
}

function formatBounds(bounds) {
  if (!bounds) {
    return "(无)";
  }
  return [
    `x: ${formatDelta(bounds.x)}`,
    `y: ${formatDelta(bounds.y)}`,
    `width: ${formatDelta(bounds.width)}`,
    `height: ${formatDelta(bounds.height)}`
  ].join("\n");
}

function formatPair(pair) {
  const styleLines = Object.entries(pair.styles).map(([name, value]) => {
    return `- ${name}: 参考 ${value.baseline || "(空)"} / 当前 ${value.current || "(空)"}`;
  });

  return [
    `### 元素 ${pair.index}`,
    `当前项目要修改的元素: ${pair.currentSelector}`,
    `文本: 参考 ${pair.baselineText || "(空)"} / 当前 ${pair.currentText || "(空)"}`,
    "位置尺寸:",
    `- x: ${formatDelta(pair.rect.x)}`,
    `- y: ${formatDelta(pair.rect.y)}`,
    `- width: ${formatDelta(pair.rect.width)}`,
    `- height: ${formatDelta(pair.rect.height)}`,
    "样式差异:",
    ...(styleLines.length > 0 ? styleLines : ["- 未发现关键样式差异"]),
    pair.childComparisonSkipped ? formatSkippedChildDiffs() : formatChildDiffs(pair.children),
    formatIconDiffs(pair.icons)
  ].filter(Boolean).join("\n");
}

function formatVisualBaselinePair(pair) {
  const currentByLabel = new Map((pair.visualBaseline?.current ?? []).map((item) => [item.label, item.value]));
  const rows = (pair.visualBaseline?.baseline ?? []).map((item) => {
    const baselineValue = item.value || "(空)";
    const currentValue = currentByLabel.get(item.label) || "(空)";
    return `| ${item.label} | ${baselineValue} | ${currentValue} |`;
  });

  return [
    `### 元素 ${pair.index}`,
    `当前项目要修改的元素: ${pair.currentSelector}`,
    "| 字段 | 参考 | 当前 |",
    "|---|---|---|",
    ...rows
  ].join("\n");
}

function formatChildDiffs(children = []) {
  if (children.length === 0) {
    return "子元素差异:\n- 未发现采样子元素差异";
  }

  return [
    "子元素差异:",
    ...children.flatMap((child) => {
      if (child.missing) {
        return [
          `- 子元素 ${child.index}: 参考子元素缺失`,
          `  文本: ${child.baselineText || "(空)"}`
        ];
      }

      const styleLines = Object.entries(child.styles).map(([name, value]) => {
        return `  - ${name}: 参考 ${value.baseline || "(空)"} / 当前 ${value.current || "(空)"}`;
      });
      return [
        `- 子元素 ${child.index}`,
        `  当前项目子元素: ${child.currentSelector}`,
        `  文本: 参考 ${child.baselineText || "(空)"} / 当前 ${child.currentText || "(空)"}`,
        `  位置: x ${formatDelta(child.rect.x)}; y ${formatDelta(child.rect.y)}; width ${formatDelta(child.rect.width)}; height ${formatDelta(child.rect.height)}`,
        ...styleLines
      ];
    })
  ].join("\n");
}

function formatSkippedChildDiffs() {
  return [
    "子元素差异:",
    "- 已按设置跳过子元素样式对比；本次只对比选中根元素、整体边界、图标和结构风险。",
    "- 如果需要排查内部标题、按钮、图标或菜单项样式，再把「样式对比范围」切换为「包含子元素」。"
  ].join("\n");
}

function formatIconDiffs(icons) {
  if (!icons || (icons.baselineCount === 0 && icons.currentCount === 0)) {
    return "";
  }

  const lines = [
    "图标差异:",
    `- 数量: 参考 ${icons.baselineCount} / 当前 ${icons.currentCount}`
  ];

  if (icons.items.length === 0) {
    lines.push("- 未发现采集图标差异");
    return lines.join("\n");
  }

  icons.items.forEach((icon) => {
    if (icon.missing) {
      lines.push(`- 图标 ${icon.index}: ${icon.baseline} 缺失`);
      return;
    }
    if (icon.extra) {
      lines.push(`- 图标 ${icon.index}: 当前多出 ${icon.current}`);
      return;
    }

    lines.push(`- 图标 ${icon.index}: ${icon.baseline} -> ${icon.current}`);
    if (icon.rect) {
      lines.push(`  位置: x ${formatDelta(icon.rect.x)}; y ${formatDelta(icon.rect.y)}; width ${formatDelta(icon.rect.width)}; height ${formatDelta(icon.rect.height)}`);
    }
    Object.entries(icon.fields).forEach(([name, value]) => {
      lines.push(`  - ${name}: 参考 ${value.baseline || "(空)"} / 当前 ${value.current || "(空)"}`);
    });
  });

  return lines.join("\n");
}

function formatMenuSemanticBlock(diff) {
  const menuPairs = diff.pairs
    .map((pair) => ({ pair, structure: structurePairFor(diff, pair) }))
    .filter((item) => item.structure?.menuSemantics);
  if (menuPairs.length === 0) {
    return "";
  }

  const lines = [
    "## 菜单组件对齐模式",
    "- 这是菜单/导航组件对齐任务，不要照搬参考页面 DOM、class、selector 或 UI 库变量。",
    "- 不要按 div / ul / li / span / i 的数量差异重写结构；不同组件库内部 DOM 本来就不一样。",
    "- 请保留当前项目已有菜单组件、路由配置或菜单数据源，优先同步菜单项文本、层级、顺序、展开项、选中项、图标位置和箭头位置。",
    "- 忽略参考组件库专属变量，例如 `--n-*`；请映射为当前项目已有 class、CSS 变量、组件 props 或主题 token。"
  ];

  menuPairs.forEach(({ pair, structure }) => {
    const semantics = structure.menuSemantics;
    lines.push("");
    lines.push(`### 元素 ${pair.index} 菜单语义`);
    lines.push(`当前项目要修改的菜单根: ${pair.currentSelector}`);
    lines.push("参考菜单语义:");
    lines.push(...(semantics.referenceTree ?? ["- 未采集到明确菜单项文本"]));
    lines.push("当前菜单语义:");
    lines.push(...(semantics.currentTree ?? ["- 未采集到明确菜单项文本"]));
    if (semantics.missing?.length > 0) {
      lines.push(`当前可能缺少的菜单项: ${semantics.missing.slice(0, 12).join("、")}`);
    }
    if (semantics.extra?.length > 0) {
      lines.push(`当前可能多出的菜单项: ${semantics.extra.slice(0, 12).join("、")}`);
    }
  });

  return lines.join("\n");
}

function formatMenuPair(pair) {
  const styleLines = Object.entries(pair.styles).map(([name, value]) => {
    return `- ${name}: 参考 ${value.baseline || "(空)"} / 当前 ${value.current || "(空)"}`;
  });

  return [
    `### 元素 ${pair.index}`,
    `当前项目要修改的菜单根: ${pair.currentSelector}`,
    `文本: 参考 ${pair.baselineText || "(空)"} / 当前 ${pair.currentText || "(空)"}`,
    "根容器位置尺寸:",
    `- x: ${formatDelta(pair.rect.x)}`,
    `- y: ${formatDelta(pair.rect.y)}`,
    `- width: ${formatDelta(pair.rect.width)}`,
    `- height: ${formatDelta(pair.rect.height)}`,
    "根容器样式差异:",
    ...(styleLines.length > 0 ? styleLines : ["- 未发现关键样式差异"]),
    "菜单部件修复重点:",
    "- 菜单根宽度、整体高度和滚动区域。",
    "- 一级菜单行高度、顶部间距、图标列宽、文字列宽、箭头列宽。",
    "- 子菜单行高度、缩进、展开容器高度和 overflow。",
    "- active / opened / hover 状态下的文字色、图标色、背景色和箭头色。",
    "- 如果当前内部文字列宽与参考整行宽度不一致，不要直接把文字列改成整行宽；先确认它对应的是文字、图标还是箭头区域。"
  ].join("\n");
}

function formatStructureGuidance(structure) {
  const riskLines = structureRiskLines(structure);
  if (riskLines.length === 0) {
    return "";
  }

  if (structure?.severity === "high") {
    return [
      "## 先停一下：结构明显不一致",
      "- 如果结构不一致，继续直接修样式很容易越改越偏。",
      ...riskLines.map((line) => `- ${line}`),
      "- 建议先切到插件的「结构对比」，确认两边选中的是同一层级；必要时先修 DOM / 组件布局。",
      ""
    ].join("\n");
  }

  if (structure?.severity === "medium") {
    return [
      "## 先确认：结构可能不一致",
      "- 结构存在一定风险，建议先确认两边选中的是同一层级。",
      ...riskLines.map((line) => `- ${line}`),
      "- 如果选择正确，可以先补齐缺失的 DOM / 组件布局区域，再继续修样式。",
      ""
    ].join("\n");
  }

  return [
    "## 结构状态：基本一致",
    "- 结构相似度较高，本次主要关注尺寸、间距、颜色、字体、图标和其他样式差异。",
    ...riskLines.map((line) => `- ${line}`),
    ""
  ].join("\n");
}

export function buildDiffPrompt(diff) {
  const summary = summarizeDiff(diff);
  const menuBlock = formatMenuSemanticBlock(diff);
  return [
    "请根据这些差异调整当前项目，让当前实现尽量 1:1 对齐参考页面。",
    "",
    formatStructureGuidance(diff.structure),
    "## 页面",
    `参考页: ${diff.pages.baseline?.url ?? "(未知)"}`,
    `当前实现页: ${diff.pages.current?.url ?? "(未知)"}`,
    `对比元素数量: 参考 ${diff.count.baseline} / 当前 ${diff.count.current} / 已配对 ${diff.count.compared}`,
    "",
    "## 关键差异摘要",
    ...(summary.length > 0 ? summary : ["未发现明显关键差异。"]),
    "",
    menuBlock,
    menuBlock ? "" : "",
    "## 关键视觉基准",
    "下面这些字段即使差异很小也会保留，用来给 AI 明确最终视觉目标，尤其是背景、字体、圆角和 box-shadow。",
    ...diff.pairs.map(formatVisualBaselinePair),
    "",
    "## 整体边界差异",
    formatBounds(diff.bounds),
    "",
    "## 逐元素差异",
    ...diff.pairs.map((pair) => isMenuPair(diff, pair) ? formatMenuPair(pair) : formatPair(pair)),
    "",
    "## 修复要求",
    "- 优先从共同父级容器、flex/grid、gap、padding、字体 token、颜色 token、圆角和阴影变量入手。",
    "- 参考页面的 class/id/selector 不作为实现目标；请修改上面标注的当前项目 selector，或映射到当前项目已有组件、已有 class、CSS module、Tailwind 或 design token。",
    "- 如果这是菜单/导航组件，优先修改当前项目菜单数据源、路由配置、菜单组件 props 和当前组件库主题样式；不要迁移参考页面 UI 库 DOM 或专属 CSS 变量。",
    "- 不要用 absolute positioning 或大量 transform 去硬凑，除非原组件本身就是定位布局。",
    "- 如果参考和当前的选择顺序可能不一致，请先说明你如何重新匹配元素。",
    "- 输出时先说明要改哪些源码位置，再给出 patch。",
    ""
  ].join("\n");
}
