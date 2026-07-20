function line(label, value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return `${label}: ${value}`;
}

function block(title, lines) {
  const content = lines.filter(Boolean);
  if (content.length === 0) {
    return "";
  }
  return [`## ${title}`, ...content, ""].join("\n");
}

function json(value) {
  return JSON.stringify(value, null, 2);
}

function cssBlock(styles = {}) {
  return Object.entries(styles)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
}

function inlineVars(styleVars = {}) {
  return Object.entries(styleVars)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name} ${value}`)
    .join("; ");
}

function isUsefulColorValue(value) {
  if (!value || typeof value !== "string") {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized !== "none"
    && normalized !== "normal"
    && normalized !== "auto"
    && normalized !== "transparent"
    && normalized !== "rgba(0, 0, 0, 0)"
    && normalized !== "rgb(0, 0, 0, 0)"
    && normalized !== "initial";
}

function isColorVarName(name) {
  return /color|fill|stroke|border|text|bg|background|rail|shadow|mask/i.test(name);
}

function formatColorToken(label, value) {
  return isUsefulColorValue(value) ? `- ${label}: ${value}` : null;
}

function extractColorVars(styleVars = {}) {
  return Object.entries(styleVars)
    .filter(([name, value]) => isColorVarName(name) && isUsefulColorValue(value))
    .sort(([a], [b]) => a.localeCompare(b));
}

function extractIconColorLines(element) {
  const icons = element.iconDetails ?? [];
  return icons.flatMap((icon, index) => {
    const prefix = `图标 ${index + 1}`;
    if (icon.type === "svg") {
      return [
        formatColorToken(`${prefix} fill`, icon.fill),
        formatColorToken(`${prefix} stroke`, icon.stroke),
        formatColorToken(`${prefix} color`, icon.color)
      ].filter(Boolean);
    }
    if (icon.type === "font-or-css") {
      return [
        formatColorToken(`${prefix} color`, icon.color),
        formatColorToken(`${prefix} background`, icon.backgroundImage),
        formatColorToken(`${prefix} mask`, icon.maskImage)
      ].filter(Boolean);
    }
    return [
      icon.src ? `- ${prefix} 图片源: ${icon.src}` : null
    ].filter(Boolean);
  });
}

function colorLinesForReference(reference) {
  const element = reference.element;
  const styles = element.styles ?? {};
  const color = styles.color ?? {};
  const box = styles.box ?? {};
  const vars = extractColorVars(element.styleVars);
  const rootLines = [
    formatColorToken("文本颜色", color.text),
    formatColorToken("背景色", color.background),
    formatColorToken("背景图/渐变", color.backgroundImage),
    formatColorToken("边框", box.border),
    formatColorToken("描边 outline", box.outline),
    formatColorToken("阴影", box.boxShadow),
    formatColorToken("透明度", color.opacity)
  ];
  const childLines = (element.children ?? []).flatMap((child, index) => {
    const childStyles = child.styles ?? {};
    const childVars = extractColorVars(child.styleVars);
    const lines = [
      formatColorToken(`子元素 ${index + 1} 文本`, childStyles.color),
      formatColorToken(`子元素 ${index + 1} 背景`, childStyles.background),
      formatColorToken(`子元素 ${index + 1} 背景图/渐变`, childStyles.backgroundImage),
      formatColorToken(`子元素 ${index + 1} 边框`, childStyles.border),
      formatColorToken(`子元素 ${index + 1} 阴影`, childStyles.boxShadow),
      ...childVars.map(([name, value]) => `- 子元素 ${index + 1} 变量 ${name}: ${value}`)
    ].filter(Boolean);
    return lines.length > 0 ? [`- 子元素 ${index + 1}: ${child.selector}`, ...lines] : [];
  });

  return [
    formatColorToken("目标 selector", element.selector),
    line("位置尺寸", `${element.rect?.x}, ${element.rect?.y}, ${element.rect?.width} x ${element.rect?.height}`),
    ...rootLines,
    ...extractIconColorLines(element),
    ...vars.map(([name, value]) => `- CSS 变量 ${name}: ${value}`),
    ...childLines
  ].filter(Boolean);
}

function colorSectionForReference(reference, index, total) {
  const title = total > 1 ? `元素 ${index + 1} · ${reference.element.selector}` : "参考颜色";
  return [`## ${title}`, ...colorLinesForReference(reference), ""].join("\n");
}

function normalizeReferences(input) {
  return Array.isArray(input) ? input : [input].filter(Boolean);
}

function normalizeColorSamples(input) {
  return Array.isArray(input) ? input : [input].filter(Boolean);
}

function colorSampleLine(sample, index) {
  const hex = sample.hex && sample.hex !== sample.value ? ` / ${sample.hex}` : "";
  const source = [sample.kind, sample.selector].filter(Boolean).join(" · ");
  return `${index + 1}. ${sample.value}${hex}${source ? ` (${source})` : ""}`;
}

function targetColorLines(targetReference) {
  if (!targetReference?.element) {
    return [];
  }
  const element = targetReference.element;
  const rect = element.rect ?? {};
  const styles = element.styles ?? {};
  return [
    line("目标页面", targetReference.page?.url),
    line("当前项目要修改的目标 selector", element.selector),
    line("目标 DOM path", element.domPath),
    line("目标元素文本", element.text),
    line("目标位置尺寸", `${rect.x}, ${rect.y}, ${rect.width} x ${rect.height}`),
    line("目标当前文本色", styles.color?.text),
    line("目标当前背景色", styles.color?.background),
    line("目标当前边框", styles.box?.border),
    line("目标当前阴影", styles.box?.boxShadow),
    line("目标父级", element.parent?.selector)
  ];
}

const COLOR_APPLY_MODES = {
  auto: {
    label: "自动判断",
    instruction: "请根据目标元素类型和当前样式判断颜色应应用到 background-color、color、border-color、fill/stroke、box-shadow 或主题变量。按钮、卡片、标签、色块、进度条和容器优先作为背景色；文字、数字、标题和链接优先作为文本色；图标优先作为 fill/stroke。"
  },
  background: {
    label: "背景色",
    instruction: "请把吸取颜色应用到目标元素背景：优先修改 background-color、background、组件背景变量或主题主色。不要把它当作文本色，除非需要同步调整可读性配色。"
  },
  text: {
    label: "文字色",
    instruction: "请把吸取颜色应用到目标元素文字：优先修改 color、文本颜色变量或组件 text color token。不要修改背景色。"
  },
  border: {
    label: "边框色",
    instruction: "请把吸取颜色应用到目标元素边框或描边：优先修改 border-color、outline-color、分割线颜色或组件 border token。"
  },
  icon: {
    label: "图标色",
    instruction: "请把吸取颜色应用到目标图标：优先修改 SVG fill/stroke、iconfont color、mask/background-color 或图标颜色变量。"
  },
  shadow: {
    label: "阴影色",
    instruction: "请把吸取颜色应用到阴影或发光效果：优先修改 box-shadow、drop-shadow 或 shadow token 中的颜色部分，不要改变阴影尺寸和偏移。"
  },
  token: {
    label: "主题变量",
    instruction: "请优先把吸取颜色映射到当前项目已有 design token、CSS 变量、Tailwind theme 或组件库主题变量；只在没有合适变量时才改具体 selector 样式。"
  }
};

function colorApplyModeLines(mode = "auto") {
  const config = COLOR_APPLY_MODES[mode] ?? COLOR_APPLY_MODES.auto;
  return [
    line("颜色应用方式", config.label),
    `应用规则: ${config.instruction}`
  ];
}

function formatChildSnapshot(child, index) {
  const rect = child.relativeRect ?? {};
  const styles = child.styles ?? {};
  const sizeParts = [
    styles.width ? `width ${styles.width}` : null,
    styles.minWidth ? `min-width ${styles.minWidth}` : null,
    styles.maxWidth ? `max-width ${styles.maxWidth}` : null,
    styles.height ? `height ${styles.height}` : null,
    styles.minHeight ? `min-height ${styles.minHeight}` : null,
    styles.maxHeight ? `max-height ${styles.maxHeight}` : null
  ].filter(Boolean);
  const layoutParts = [
    styles.position && styles.position !== "static" ? `position ${styles.position}` : null,
    styles.inset && styles.inset !== "auto auto auto auto" ? `inset ${styles.inset}` : null,
    styles.zIndex && styles.zIndex !== "auto" ? `z-index ${styles.zIndex}` : null,
    styles.overflow ? `overflow ${styles.overflow}` : null,
    styles.overflowX && styles.overflowX !== styles.overflow ? `overflow-x ${styles.overflowX}` : null,
    styles.overflowY && styles.overflowY !== styles.overflow ? `overflow-y ${styles.overflowY}` : null,
    styles.transform && styles.transform !== "none" ? `transform ${styles.transform}` : null,
    styles.transformOrigin ? `origin ${styles.transformOrigin}` : null,
    styles.transitionProperty && styles.transitionProperty !== "all" ? `transition-property ${styles.transitionProperty}` : null,
    styles.transitionDuration && styles.transitionDuration !== "0s" ? `transition-duration ${styles.transitionDuration}` : null,
    styles.transitionTimingFunction ? `transition-timing ${styles.transitionTimingFunction}` : null,
    styles.gap ? `gap ${styles.gap}` : null,
    styles.rowGap && styles.rowGap !== styles.gap ? `row-gap ${styles.rowGap}` : null,
    styles.columnGap && styles.columnGap !== styles.gap ? `column-gap ${styles.columnGap}` : null,
    styles.alignItems ? `align ${styles.alignItems}` : null,
    styles.justifyContent ? `justify ${styles.justifyContent}` : null,
    styles.flexDirection ? `flex-direction ${styles.flexDirection}` : null,
    styles.flexWrap ? `flex-wrap ${styles.flexWrap}` : null,
    styles.gridTemplateColumns && styles.gridTemplateColumns !== "none" ? `grid ${styles.gridTemplateColumns}` : null
  ].filter(Boolean);
  const textParts = [
    styles.fontFamily ? `family ${styles.fontFamily}` : null,
    styles.fontSize ? `size ${styles.fontSize}` : null,
    styles.fontWeight ? `weight ${styles.fontWeight}` : null,
    styles.lineHeight ? `line-height ${styles.lineHeight}` : null,
    styles.letterSpacing ? `letter-spacing ${styles.letterSpacing}` : null,
    styles.textAlign ? `align ${styles.textAlign}` : null,
    styles.whiteSpace ? `white-space ${styles.whiteSpace}` : null,
    styles.textOverflow ? `text-overflow ${styles.textOverflow}` : null,
    styles.wordBreak ? `word-break ${styles.wordBreak}` : null
  ].filter(Boolean);
  const visualParts = [
    styles.color ? `color ${styles.color}` : null,
    styles.background ? `background ${styles.background}` : null,
    styles.backgroundImage && styles.backgroundImage !== "none" ? `background-image ${styles.backgroundImage}` : null,
    styles.backgroundSize && styles.backgroundSize !== "auto" ? `background-size ${styles.backgroundSize}` : null,
    styles.backgroundPosition ? `background-position ${styles.backgroundPosition}` : null,
    styles.opacity ? `opacity ${styles.opacity}` : null
  ].filter(Boolean);
  const mediaParts = [
    styles.objectFit && styles.objectFit !== "fill" ? `object-fit ${styles.objectFit}` : null,
    styles.objectPosition && styles.objectPosition !== "50% 50%" ? `object-position ${styles.objectPosition}` : null,
    styles.aspectRatio && styles.aspectRatio !== "auto" ? `aspect-ratio ${styles.aspectRatio}` : null
  ].filter(Boolean);

  return [
    `${index + 1}. ${child.selector}`,
    `   Tag/Text: ${child.tag}${child.text ? ` / ${child.text}` : ""}`,
    `   Relative rect: ${rect.x}, ${rect.y}, ${rect.width} x ${rect.height}`,
    sizeParts.length > 0 ? `   Size constraints: ${sizeParts.join("; ")}` : null,
    textParts.length > 0 ? `   Text: ${textParts.join("; ")}` : null,
    visualParts.length > 0 ? `   Visual: ${visualParts.join("; ")}` : null,
    `   Box: display ${styles.display}; padding ${styles.padding}; margin ${styles.margin}; border ${styles.border}; outline ${styles.outline}; radius ${styles.borderRadius}; shadow ${styles.boxShadow}; box-sizing ${styles.boxSizing}`,
    layoutParts.length > 0 ? `   Layout/Motion: ${layoutParts.join("; ")}` : null,
    mediaParts.length > 0 ? `   Media: ${mediaParts.join("; ")}` : null,
    Object.keys(child.styleVars ?? {}).length > 0 ? `   Component vars: ${inlineVars(child.styleVars)}` : null
  ].filter(Boolean).join("\n");
}

function buildChildrenBlock(element) {
  const children = element.children ?? [];
  if (children.length === 0) {
    return "";
  }

  return block("关键子元素采样", [
    `共采样 ${children.length} 个关键子元素。下面是相对当前目标元素的内部结构和样式线索：`,
    ...children.map(formatChildSnapshot)
  ]);
}

function formatIconDetail(icon, index) {
  const rect = icon.rect ?? {};
  if (icon.type === "svg") {
    return `${index + 1}. svg ${icon.selector}; rect ${rect.x}, ${rect.y}, ${rect.width} x ${rect.height}; viewBox ${icon.viewBox || "(none)"}; path ${icon.pathCount}; use ${icon.useHref || "(none)"}; fill ${icon.fill || "(auto)"}; stroke ${icon.stroke || "(auto)"}; color ${icon.color || "(auto)"}`;
  }
  if (icon.type === "img") {
    return `${index + 1}. img ${icon.selector}; rect ${rect.x}, ${rect.y}, ${rect.width} x ${rect.height}; src ${icon.src || "(none)"}; alt ${icon.alt || "(none)"}; object-fit ${icon.objectFit || "(auto)"}`;
  }
  return `${index + 1}. css/iconfont ${icon.selector}; rect ${rect.x}, ${rect.y}, ${rect.width} x ${rect.height}; class ${icon.className || "(none)"}; font ${icon.fontFamily || "(none)"}; color ${icon.color || "(auto)"}; background ${icon.backgroundImage || "(none)"}; mask ${icon.maskImage || "(none)"}`;
}

function buildIconBlock(element) {
  const icons = element.iconDetails ?? [];
  if (icons.length === 0) {
    return "";
  }
  return block("图标采集摘要", [
    `共采集 ${icons.length} 个图标。只在插件开启「采集图标细节」时出现：`,
    ...icons.map(formatIconDetail)
  ]);
}

function formatStateStyles(stateItem, index) {
  const styles = Object.entries(stateItem.styles ?? {})
    .map(([name, value]) => `${name}: ${value}`)
    .join("; ");
  const selector = stateItem.selector ? ` · CSS: ${stateItem.selector}` : "";
  return `${index + 1}. ${stateItem.label || stateItem.state}${selector}\n   ${styles}`;
}

function buildStateStylesBlock(element) {
  const stateStyles = element.stateStyles;
  if (!stateStyles) {
    return "";
  }
  const pseudoElements = stateStyles.pseudoElements ?? [];
  const interactionRules = stateStyles.interactionRules ?? [];
  if (pseudoElements.length === 0 && interactionRules.length === 0) {
    return "";
  }
  return block("交互状态样式", [
    stateStyles.note ? `说明：${stateStyles.note}` : null,
    interactionRules.length > 0 ? "常用交互状态：" : null,
    ...interactionRules.map(formatStateStyles),
    pseudoElements.length > 0 ? "前后装饰内容：" : null,
    ...pseudoElements.map(formatStateStyles)
  ]);
}

function unionRect(references) {
  const rects = references.map((item) => item.element.rect);
  const left = Math.min(...rects.map((rect) => rect.left ?? rect.x));
  const top = Math.min(...rects.map((rect) => rect.top ?? rect.y));
  const right = Math.max(...rects.map((rect) => rect.right ?? rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.bottom ?? rect.y + rect.height));
  return {
    x: left,
    y: top,
    width: Math.round((right - left) * 100) / 100,
    height: Math.round((bottom - top) * 100) / 100
  };
}

function summarizeElement(reference, index) {
  const { element } = reference;
  const { rect, styles } = element;
  return [
    `${index + 1}. ${element.selector}`,
    `   Tag/Text: ${element.tag}${element.text ? ` / ${element.text}` : ""}`,
    `   Rect: ${rect.x}, ${rect.y}, ${rect.width} x ${rect.height}`,
    `   Font: ${styles.font.family}; ${styles.font.size}; weight ${styles.font.weight}; line-height ${styles.font.lineHeight}`,
    `   Color: ${styles.color.text}; background ${styles.color.background}`,
    `   Box: display ${styles.box.display}; padding ${styles.box.padding}; margin ${styles.box.margin}; radius ${styles.box.borderRadius}; shadow ${styles.box.boxShadow}`,
    `   Layout: gap ${styles.layout.gap}; align ${styles.layout.alignItems}; justify ${styles.layout.justifyContent}`,
    `   Parent: ${element.parent?.selector ?? "(none)"}; display ${element.parent?.display ?? "(unknown)"}; gap ${element.parent?.gap ?? "(unknown)"}`,
    `   HTML: ${element.outerHTML}`
  ].join("\n");
}

export function buildAiPrompt(reference, target = "Codex / Claude Code", options = {}) {
  const { page, element } = reference;
  const { rect, styles } = element;
  const includeFullComputedStyle = Boolean(options.includeFullComputedStyle);
  const includeJson = Boolean(options.includeJson);
  const externalReferenceMode = Boolean(options.externalReferenceMode);
  const fullStyleBlock = includeFullComputedStyle ? cssBlock(element.fullComputedStyle) : "";

  return [
    "请在当前项目中 1:1 还原下面这个参考元素。",
    "",
    "你是根据浏览器真实渲染信息还原 UI，不要只凭截图猜。优先找到当前项目里对应的组件、布局容器、样式文件或 design token。",
    externalReferenceMode
      ? "外部参考页模式：下面的 class/id/selector/HTML 只用于理解参考结构，不要照搬到当前项目；请映射到当前项目已有组件和样式。"
      : "",
    "",
    block("来源页面", [
      line("URL", page.url),
      line("Title", page.title),
      line("Viewport", `${page.viewport.width} x ${page.viewport.height}`),
      line("Device pixel ratio", page.viewport.devicePixelRatio)
    ]),
    block("目标元素", [
      line("Tag", element.tag),
      line("Text", element.text),
      line("Selector", element.selector),
      line("DOM path", element.domPath),
      line("Rect", `${rect.x}, ${rect.y}, ${rect.width} x ${rect.height}`),
      line("Role", element.attributes?.role),
      line("Aria label", element.attributes?.ariaLabel),
      line("Test attributes", element.attributes?.testAttributes?.join(", "))
    ]),
    block("关键视觉样式", [
      line("Font", `${styles.font.family}; ${styles.font.size}; weight ${styles.font.weight}; line-height ${styles.font.lineHeight}`),
      line("Letter spacing", styles.font.letterSpacing),
      line("Text color", styles.color.text),
      line("Background", styles.color.background),
      line("Background image", styles.color.backgroundImage && styles.color.backgroundImage !== "none" ? styles.color.backgroundImage : ""),
      line("Display", styles.box.display),
      line("Padding", styles.box.padding),
      line("Margin", styles.box.margin),
      line("Border", styles.box.border),
      line("Border radius", styles.box.borderRadius),
      line("Box shadow", styles.box.boxShadow),
      line("Position", styles.layout.position),
      line("Gap", styles.layout.gap),
      line("Align / justify", `${styles.layout.alignItems} / ${styles.layout.justifyContent}`)
    ]),
    block("父级布局上下文", [
      line("Parent selector", element.parent?.selector),
      line("Parent display", element.parent?.display),
      line("Parent gap", element.parent?.gap),
      line("Parent padding", element.parent?.padding),
      line("Ancestor trail", element.ancestorTrail?.join(" > "))
    ]),
    buildChildrenBlock(element),
    buildIconBlock(element),
    buildStateStylesBlock(element),
    block("参考 HTML", ["```html", element.outerHTML, "```"]),
    includeFullComputedStyle
      ? block("完整 computed CSS", ["```css", `${element.selector} {`, fullStyleBlock, "}", "```"])
      : "",
    includeJson ? block("结构化 JSON", ["```json", json(reference), "```"]) : "",
    "## 实现要求",
    `- 面向 ${target} 修改当前项目源码。`,
    "- 尽量保持尺寸、字体、颜色、间距、圆角、阴影、对齐方式和父级布局关系一致。",
    externalReferenceMode
      ? "- 当前内容来自外部参考页，不要复制参考页面的 class/id/selector；优先映射到当前项目已有组件、已有 class、Tailwind class、CSS module、design token 或样式变量。"
      : "- 不要盲目复制无关 inline style；优先映射到当前项目已有组件、Tailwind class、CSS module、design token 或样式变量。",
    "- 如果参考元素内部嵌套很多无关属性、埋点属性或框架生成属性，请清理后再实现。",
    "- 如果无法完全判断，请先列出不确定项和你会如何验证视觉还原度。",
    ""
  ].join("\n");
}

export function buildMultiAiPrompt(references, target = "Codex / Claude Code", options = {}) {
  if (references.length === 0) {
    return "请先选择至少一个参考元素。";
  }
  if (references.length === 1) {
    return buildAiPrompt(references[0], target, options);
  }

  const page = references[0].page;
  const rect = unionRect(references);
  const includeFullComputedStyle = Boolean(options.includeFullComputedStyle);
  const externalReferenceMode = Boolean(options.externalReferenceMode);
  const fullStyles = includeFullComputedStyle
    ? references.flatMap((reference, index) => [
        `/* ${index + 1}. ${reference.element.selector} */`,
        `${reference.element.selector} {`,
        cssBlock(reference.element.fullComputedStyle),
        "}"
      ])
    : [];

  return [
    `请在当前项目中 1:1 还原下面这一组参考元素。本次选中了 ${references.length} 个参考元素。`,
    "",
    "你是根据浏览器真实渲染信息还原 UI，不要只凭截图猜。优先找到共同父级布局容器，再处理子元素样式。",
    externalReferenceMode
      ? "外部参考页模式：下面的 class/id/selector/HTML 只用于理解参考结构，不要照搬到当前项目；请映射到当前项目已有组件和样式。"
      : "",
    "",
    block("来源页面", [
      line("URL", page.url),
      line("Title", page.title),
      line("Viewport", `${page.viewport.width} x ${page.viewport.height}`),
      line("整体边界", `${rect.x}, ${rect.y}, ${rect.width} x ${rect.height}`)
    ]),
    block("选中元素", references.map((reference, index) => summarizeElement(reference, index))),
    block(
      "关键子元素采样",
      references.flatMap((reference, referenceIndex) => {
        const children = reference.element.children ?? [];
        if (children.length === 0) {
          return [];
        }
        return [
          `目标 ${referenceIndex + 1} · ${reference.element.selector} · 子元素 ${children.length} 个：`,
          ...children.map((child, childIndex) => formatChildSnapshot(child, childIndex))
        ];
      })
    ),
    block(
      "图标采集摘要",
      references.flatMap((reference, referenceIndex) => {
        const icons = reference.element.iconDetails ?? [];
        if (icons.length === 0) {
          return [];
        }
        return [
          `目标 ${referenceIndex + 1} · ${reference.element.selector} · 图标 ${icons.length} 个：`,
          ...icons.map(formatIconDetail)
        ];
      })
    ),
    block(
      "交互状态样式",
      references.flatMap((reference, referenceIndex) => {
        const stateStyles = reference.element.stateStyles;
        const items = [
          ...(stateStyles?.interactionRules ?? []),
          ...(stateStyles?.pseudoElements ?? [])
        ];
        if (items.length === 0) {
          return [];
        }
        return [
          `目标 ${referenceIndex + 1} · ${reference.element.selector}：`,
          stateStyles?.note ? `说明：${stateStyles.note}` : null,
          ...items.map(formatStateStyles)
        ].filter(Boolean);
      })
    ),
    includeFullComputedStyle ? block("完整 computed CSS", ["```css", ...fullStyles, "```"]) : "",
    "## 实现要求",
    `- 面向 ${target} 修改当前项目源码。`,
    "- 优先从共同父级布局、grid/flex、gap、padding、对齐关系入手，而不是分别给每个元素写定位 hack。",
    "- 尽量保持每个元素的尺寸、字体、颜色、间距、圆角、阴影、对齐方式一致。",
    externalReferenceMode
      ? "- 当前内容来自外部参考页，不要复制参考页面的 class/id/selector；优先映射到当前项目已有组件、已有 class、Tailwind class、CSS module、design token 或样式变量。"
      : "- 不要盲目复制无关 inline style；优先映射到当前项目已有组件、Tailwind class、CSS module、design token 或样式变量。",
    "- 如果无法完全判断，请先列出不确定项和你会如何验证视觉还原度。",
    ""
  ].join("\n");
}

export function buildJson(reference) {
  return json(reference);
}

export function buildMultiJson(references) {
  return json({
    capturedAt: new Date().toISOString(),
    count: references.length,
    page: references[0]?.page ?? null,
    bounds: references.length > 0 ? unionRect(references) : null,
    elements: references.map((reference) => reference.element)
  });
}

export function buildColorPrompt(input, target = "Codex / Claude Code") {
  const references = normalizeReferences(input);
  if (references.length === 0) {
    return "请先选择至少一个元素。";
  }
  const page = references[0].page;
  return [
    "请只同步颜色，不要修改布局、尺寸、字体、DOM 结构和交互逻辑。",
    "",
    "你是根据浏览器真实渲染颜色来调整当前项目。请优先映射到当前项目已有 class、CSS module、Tailwind class、design token 或样式变量；不要照搬参考页 selector。",
    "",
    block("来源页面", [
      line("URL", page.url),
      line("Title", page.title)
    ]),
    ...references.map((reference, index) => colorSectionForReference(reference, index, references.length)),
    "## 修改要求",
    `- 面向 ${target} 修改当前项目源码。`,
    "- 只处理颜色相关内容：文本色、背景色、边框色、阴影、渐变、图标颜色和颜色变量。",
    "- 不要因为参考 selector 存在就新建同名 class；参考 selector 只用于识别取色范围。",
    "- 如果当前项目已有主题变量或 design token，优先改变量；否则再改对应组件样式。",
    ""
  ].join("\n");
}

export function buildColorValues(input) {
  const references = normalizeReferences(input);
  if (references.length === 0) {
    return "请先选择至少一个元素。";
  }
  return references.map((reference, index) => {
    const header = references.length > 1 ? `元素 ${index + 1}: ${reference.element.selector}` : reference.element.selector;
    return [header, ...colorLinesForReference(reference)].join("\n");
  }).join("\n\n");
}

export function buildColorVars(input) {
  const references = normalizeReferences(input);
  if (references.length === 0) {
    return "请先选择至少一个元素。";
  }
  const blocks = references.map((reference, index) => {
    const rootVars = extractColorVars(reference.element.styleVars)
      .map(([name, value]) => `${name}: ${value};`);
    const childVars = (reference.element.children ?? []).flatMap((child, childIndex) => {
      const vars = extractColorVars(child.styleVars)
        .map(([name, value]) => `${name}: ${value};`);
      return vars.length > 0 ? [`/* 子元素 ${childIndex + 1}: ${child.selector} */`, ...vars] : [];
    });
    const lines = [...rootVars, ...childVars];
    const header = references.length > 1 ? `/* 元素 ${index + 1}: ${reference.element.selector} */` : `/* ${reference.element.selector} */`;
    return [header, ...(lines.length > 0 ? lines : ["/* 未采集到明显颜色变量 */"])].join("\n");
  });
  return blocks.join("\n\n");
}

export function buildColorSamplePrompt(input, target = "Codex / Claude Code", options = {}) {
  const samples = normalizeColorSamples(input);
  if (samples.length === 0) {
    return "请先吸取至少一个颜色。";
  }
  const page = samples[0].page ?? {};
  const targetReference = options.targetReference ?? null;
  const applyMode = options.applyMode ?? "auto";
  return [
    "请把下面吸取到的颜色应用到当前项目的目标元素上。",
    "",
    "只同步颜色，不要修改布局、尺寸、字体、DOM 结构和交互逻辑。请优先映射到当前项目已有 class、CSS module、Tailwind class、design token 或样式变量。",
    "",
    block("颜色来源页面", [
      line("URL", page.url),
      line("Title", page.title)
    ]),
    block("吸取颜色", samples.map(colorSampleLine)),
    block("目标元素", targetColorLines(targetReference)),
    block("颜色应用方式", colorApplyModeLines(applyMode)),
    "## 修改要求",
    `- 面向 ${target} 修改当前项目源码。`,
    targetReference
      ? "- 优先修改上面标注的「当前项目要修改的目标 selector」对应组件或样式。"
      : "- 当前还没有提供目标元素；如果无法定位，请先询问用户目标元素在哪里。",
    "- 吸取颜色不是默认改文本色；必须遵循上面的「颜色应用方式」。",
    "- 可修改的颜色属性包括但不限于：background-color / background / color / border-color / outline-color / box-shadow 颜色 / SVG fill / SVG stroke / iconfont color / mask 背景色 / 主题变量。",
    "- 如果目标是按钮、卡片、标签、色块、进度条或容器，优先考虑背景色或组件主题色；如果目标是文字或图标，再考虑 color、fill 或 stroke。",
    "- 只改颜色相关内容，不要改尺寸、间距、布局、字体、DOM 结构或交互逻辑。",
    "- 不要照搬颜色来源 selector；来源 selector 只用于理解颜色来自哪里。",
    "- 如果只需要一个颜色，请优先使用第 1 个颜色。",
    ""
  ].join("\n");
}

export function buildColorSampleValues(input) {
  const samples = normalizeColorSamples(input);
  if (samples.length === 0) {
    return "请先吸取至少一个颜色。";
  }
  return samples.map(colorSampleLine).join("\n");
}
