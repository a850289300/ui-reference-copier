export const STYLE_GROUPS = {
  font: [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "textAlign",
    "textTransform",
    "textDecorationLine",
    "whiteSpace",
    "wordBreak",
    "textOverflow"
  ],
  color: ["color", "backgroundColor", "backgroundImage", "backgroundSize", "backgroundPosition", "opacity"],
  box: [
    "display",
    "width",
    "height",
    "minWidth",
    "maxWidth",
    "minHeight",
    "maxHeight",
    "padding",
    "margin",
    "border",
    "outline",
    "borderRadius",
    "boxShadow",
    "boxSizing"
  ],
  layout: [
    "position",
    "top",
    "right",
    "bottom",
    "left",
    "zIndex",
    "overflow",
    "overflowX",
    "overflowY",
    "transform",
    "transformOrigin",
    "transitionDuration",
    "transitionTimingFunction",
    "transitionProperty",
    "flexDirection",
    "flexWrap",
    "alignItems",
    "justifyContent",
    "gap",
    "rowGap",
    "columnGap",
    "gridTemplateColumns",
    "gridTemplateRows"
  ],
  media: ["objectFit", "objectPosition", "aspectRatio"]
};

const CHILD_STYLE_FIELDS = [
  "fontFamily",
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
  "width",
  "minWidth",
  "maxWidth",
  "height",
  "minHeight",
  "maxHeight",
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
const STATE_STYLE_FIELDS = [
  "content",
  "color",
  "backgroundColor",
  "backgroundImage",
  "borderColor",
  "border",
  "outline",
  "boxShadow",
  "opacity",
  "display",
  "width",
  "height",
  "padding",
  "margin",
  "borderRadius",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "transform",
  "transitionDuration",
  "transitionProperty",
  "textDecorationLine"
];
const INTERACTION_STATES = [
  { token: ":hover", label: "鼠标移上去 hover" },
  { token: ":active", label: "点击/按下 active" },
  { token: ":focus", label: "聚焦 focus" },
  { token: ":focus-visible", label: "键盘聚焦 focus-visible" },
  { token: ":disabled", label: "禁用 disabled" }
];

const TEST_ATTRIBUTES = ["data-testid", "data-test", "data-cy", "data-qa"];
const CHILD_SELECTOR = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "img",
  "svg",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "span",
  "div[class]",
  "section[class]",
  "header[class]",
  "main[class]",
  "footer[class]",
  "ul[class]",
  "li[class]",
  "[role]",
  "[aria-label]",
  "[data-testid]",
  "[data-test]",
  "[data-cy]"
].join(",");
const DEFAULT_CHILD_SNAPSHOT_LIMIT = 50;

function round(value) {
  return Math.round(Number(value) * 100) / 100;
}

function normalizeText(value, limit = 180) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function toKebabCase(value) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function readStyle(style, key) {
  return style[key] || style.getPropertyValue?.(toKebabCase(key)) || "";
}

function pickStyles(style) {
  return {
    font: {
      family: readStyle(style, "fontFamily"),
      size: readStyle(style, "fontSize"),
      weight: readStyle(style, "fontWeight"),
      lineHeight: readStyle(style, "lineHeight"),
      letterSpacing: readStyle(style, "letterSpacing"),
      textAlign: readStyle(style, "textAlign"),
      textTransform: readStyle(style, "textTransform"),
      textDecorationLine: readStyle(style, "textDecorationLine"),
      whiteSpace: readStyle(style, "whiteSpace"),
      wordBreak: readStyle(style, "wordBreak"),
      textOverflow: readStyle(style, "textOverflow")
    },
    color: {
      text: readStyle(style, "color"),
      background: readStyle(style, "backgroundColor"),
      backgroundImage: readStyle(style, "backgroundImage"),
      backgroundSize: readStyle(style, "backgroundSize"),
      backgroundPosition: readStyle(style, "backgroundPosition"),
      opacity: readStyle(style, "opacity")
    },
    box: {
      display: readStyle(style, "display"),
      width: readStyle(style, "width"),
      height: readStyle(style, "height"),
      minWidth: readStyle(style, "minWidth"),
      maxWidth: readStyle(style, "maxWidth"),
      minHeight: readStyle(style, "minHeight"),
      maxHeight: readStyle(style, "maxHeight"),
      padding: readStyle(style, "padding"),
      margin: readStyle(style, "margin"),
      border: readStyle(style, "border"),
      outline: readStyle(style, "outline"),
      borderRadius: readStyle(style, "borderRadius"),
      boxShadow: readStyle(style, "boxShadow"),
      boxSizing: readStyle(style, "boxSizing")
    },
    layout: {
      position: readStyle(style, "position"),
      inset: [
        readStyle(style, "top"),
        readStyle(style, "right"),
        readStyle(style, "bottom"),
        readStyle(style, "left")
      ].join(" "),
      zIndex: readStyle(style, "zIndex"),
      overflow: readStyle(style, "overflow"),
      overflowX: readStyle(style, "overflowX"),
      overflowY: readStyle(style, "overflowY"),
      transform: readStyle(style, "transform"),
      transformOrigin: readStyle(style, "transformOrigin"),
      transitionDuration: readStyle(style, "transitionDuration"),
      transitionTimingFunction: readStyle(style, "transitionTimingFunction"),
      transitionProperty: readStyle(style, "transitionProperty"),
      flexDirection: readStyle(style, "flexDirection"),
      flexWrap: readStyle(style, "flexWrap"),
      alignItems: readStyle(style, "alignItems"),
      justifyContent: readStyle(style, "justifyContent"),
      gap: readStyle(style, "gap"),
      rowGap: readStyle(style, "rowGap"),
      columnGap: readStyle(style, "columnGap"),
      gridTemplateColumns: readStyle(style, "gridTemplateColumns"),
      gridTemplateRows: readStyle(style, "gridTemplateRows")
    },
    media: {
      objectFit: readStyle(style, "objectFit"),
      objectPosition: readStyle(style, "objectPosition"),
      aspectRatio: readStyle(style, "aspectRatio")
    }
  };
}

function collectFullComputedStyle(style) {
  const result = {};
  const propertyNames = [];

  if (typeof style.length === "number" && style.length > 0) {
    for (let index = 0; index < style.length; index += 1) {
      const name = style[index];
      if (name) {
        propertyNames.push(name);
      }
    }
  } else {
    Object.values(STYLE_GROUPS).flat().forEach((name) => propertyNames.push(toKebabCase(name)));
  }

  propertyNames.forEach((name) => {
    const value = style.getPropertyValue?.(name) || readStyle(style, name);
    if (!value) {
      return;
    }
    if (value === "normal" || value === "none" || value === "auto" || value === "0px") {
      return;
    }
    result[name] = value;
  });

  return result;
}

function collectComponentStyleVars(style) {
  const result = {};
  const propertyNames = [];

  if (typeof style.length !== "number") {
    return result;
  }

  for (let index = 0; index < style.length; index += 1) {
    const name = style[index];
    if (name?.startsWith?.("--n-")) {
      propertyNames.push(name);
    }
  }

  propertyNames.forEach((name) => {
    const value = style.getPropertyValue?.(name)?.trim();
    if (value) {
      result[name] = value;
    }
  });

  return result;
}

function isUsefulStateValue(value) {
  if (!value || typeof value !== "string") {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized !== "normal"
    && normalized !== "none"
    && normalized !== "auto"
    && normalized !== "0px"
    && normalized !== "rgba(0, 0, 0, 0)"
    && normalized !== "transparent"
    && normalized !== "initial";
}

function stateStyleSnapshot(style, options = {}) {
  const includeContent = Boolean(options.includeContent);
  return Object.fromEntries(STATE_STYLE_FIELDS.flatMap((name) => {
    const value = readStyle(style, name);
    if (name === "content") {
      return includeContent && isUsefulStateValue(value) ? [[name, value]] : [];
    }
    return isUsefulStateValue(value) ? [[toKebabCase(name), value]] : [];
  }));
}

function collectPseudoElementState(element, pseudo) {
  const style = window.getComputedStyle(element, pseudo);
  const styles = stateStyleSnapshot(style, { includeContent: true });
  if (Object.keys(styles).length === 0) {
    return null;
  }
  return {
    state: pseudo,
    label: pseudo === "::before" ? "前置装饰 ::before" : "后置装饰 ::after",
    styles
  };
}

function splitSelectors(selectorText) {
  return String(selectorText ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function stripInteractionSelector(selector, token) {
  return selector
    .replaceAll(token, "")
    .replace(/::before|::after/g, "")
    .trim();
}

function selectorMatchesElement(element, selector, token) {
  const baseSelector = stripInteractionSelector(selector, token);
  if (!baseSelector || baseSelector === token) {
    return false;
  }
  try {
    return Boolean(element.matches?.(baseSelector));
  } catch {
    return false;
  }
}

function collectStyleRules(sheet, result = []) {
  let rules = [];
  try {
    rules = Array.from(sheet.cssRules ?? sheet.rules ?? []);
  } catch {
    return result;
  }

  rules.forEach((rule) => {
    if (rule.cssRules) {
      collectStyleRules(rule, result);
      return;
    }
    if (rule.selectorText && rule.style) {
      result.push(rule);
    }
  });
  return result;
}

function collectInteractionStateRules(element) {
  const rules = Array.from(document.styleSheets ?? []).flatMap((sheet) => collectStyleRules(sheet));
  const matches = [];

  rules.forEach((rule) => {
    const selectors = splitSelectors(rule.selectorText);
    INTERACTION_STATES.forEach((state) => {
      if (!selectors.some((selector) => selector.includes(state.token) && selectorMatchesElement(element, selector, state.token))) {
        return;
      }
      const styles = stateStyleSnapshot(rule.style);
      if (Object.keys(styles).length === 0) {
        return;
      }
      matches.push({
        state: state.token,
        label: state.label,
        selector: rule.selectorText,
        styles
      });
    });
  });

  return matches.slice(0, 12);
}

function collectStateStyles(element) {
  return {
    note: "hover/focus/active/disabled 来自匹配 CSS 规则线索；::before/::after 来自浏览器 computed style。",
    pseudoElements: ["::before", "::after"]
      .map((pseudo) => collectPseudoElementState(element, pseudo))
      .filter(Boolean),
    interactionRules: collectInteractionStateRules(element)
  };
}

function getRect(element) {
  const rect = element.getBoundingClientRect();
  return {
    x: round(rect.x ?? rect.left),
    y: round(rect.y ?? rect.top),
    width: round(rect.width),
    height: round(rect.height),
    top: round(rect.top),
    right: round(rect.right),
    bottom: round(rect.bottom),
    left: round(rect.left)
  };
}

function classList(element) {
  return Array.from(element.classList ?? []).filter(Boolean);
}

function escapeSelectorPart(value) {
  if (globalThis.CSS?.escape) {
    return globalThis.CSS.escape(value);
  }
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function buildSelectorSegment(element) {
  const tag = String(element.tagName || "element").toLowerCase();
  const id = element.id ? `#${escapeSelectorPart(element.id)}` : "";
  const classes = classList(element)
    .slice(0, 3)
    .map((item) => `.${escapeSelectorPart(item)}`)
    .join("");
  return `${tag}${id}${classes}`;
}

function buildDomPath(element) {
  const parts = [];
  let current = element;
  let depth = 0;

  while (current && current.tagName && depth < 8) {
    parts.unshift(buildSelectorSegment(current));
    current = current.parentElement;
    depth += 1;
  }

  return parts.join(" > ");
}

function buildAncestorTrail(element) {
  const trail = [];
  let current = element.parentElement;
  let depth = 0;

  while (current && current.tagName && depth < 5) {
    trail.push(buildSelectorSegment(current));
    current = current.parentElement;
    depth += 1;
  }

  return trail;
}

function getAttribute(element, name) {
  return normalizeText(element.getAttribute?.(name), 120) || undefined;
}

function getTestAttributes(element) {
  return TEST_ATTRIBUTES.map((name) => {
    const value = getAttribute(element, name);
    return value ? `${name}=${value}` : null;
  }).filter(Boolean);
}

function clipOuterHTML(element) {
  const html = normalizeText(element.outerHTML, 2200);
  return html.replace(/ style="[^"]*"/gi, "");
}

function parentSummary(element) {
  const parent = element.parentElement;
  if (!parent) {
    return null;
  }

  const style = window.getComputedStyle(parent);
  return {
    selector: buildSelectorSegment(parent),
    display: readStyle(style, "display"),
    gap: readStyle(style, "gap"),
    padding: readStyle(style, "padding"),
    alignItems: readStyle(style, "alignItems"),
    justifyContent: readStyle(style, "justifyContent"),
    flexDirection: readStyle(style, "flexDirection"),
    gridTemplateColumns: readStyle(style, "gridTemplateColumns")
  };
}

function isVisibleChild(element) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function isElementLike(value) {
  if (typeof Element !== "undefined" && value instanceof Element) {
    return true;
  }
  if (typeof HTMLElement !== "undefined" && value instanceof HTMLElement) {
    return true;
  }
  return Boolean(value?.tagName && value?.getBoundingClientRect);
}

function childImportance(element) {
  const rect = element.getBoundingClientRect();
  const text = normalizeText(element.textContent, 80);
  const interactive = element.matches?.("button,a,input,textarea,select,[role],[aria-label]") ? 10000 : 0;
  const semantic = element.matches?.("h1,h2,h3,h4,h5,h6,p,img,svg") ? 5000 : 0;
  const componentContainer = element.matches?.("div[class],section[class],header[class],main[class],footer[class],ul[class],li[class]")
    ? 2400
    : 0;
  return interactive + semantic + componentContainer + rect.width * rect.height + (text ? 1200 : 0);
}

function childSignature(element) {
  const text = normalizeText(element.textContent, 40);
  return `${buildSelectorSegment(element)}|${text}`;
}

function childStyleSnapshot(style) {
  return Object.fromEntries(CHILD_STYLE_FIELDS.map((name) => {
    if (name === "background") {
      return [name, readStyle(style, "backgroundColor")];
    }
    if (name === "inset") {
      return [name, [
        readStyle(style, "top"),
        readStyle(style, "right"),
        readStyle(style, "bottom"),
        readStyle(style, "left")
      ].join(" ")];
    }
    return [name, readStyle(style, name)];
  }));
}

function collectChildSnapshots(element, parentRect, limit = DEFAULT_CHILD_SNAPSHOT_LIMIT) {
  if (limit <= 0) {
    return [];
  }

  const candidates = Array.from(element.querySelectorAll?.(CHILD_SELECTOR) ?? [])
    .filter((child) => isElementLike(child) && child !== element && isVisibleChild(child));

  return candidates
    .sort((a, b) => childImportance(b) - childImportance(a))
    .slice(0, limit)
    .map((child) => {
      const rect = getRect(child);
      return {
        signature: childSignature(child),
        selector: buildSelectorSegment(child),
        tag: String(child.tagName || "").toLowerCase(),
        text: normalizeText(child.textContent, 120),
        relativeRect: {
          x: round(rect.x - parentRect.x),
          y: round(rect.y - parentRect.y),
          width: rect.width,
          height: rect.height
        },
        attributes: {
          role: getAttribute(child, "role"),
          ariaLabel: getAttribute(child, "aria-label"),
          testAttributes: getTestAttributes(child)
        },
        styles: childStyleSnapshot(window.getComputedStyle(child)),
        styleVars: collectComponentStyleVars(window.getComputedStyle(child))
      };
    });
}

function collectIconDetails(element) {
  const icons = [];
  const iconSelector = "svg,img,[class*='icon'],[class*='Icon'],i";
  const elementStyle = window.getComputedStyle(element);
  const elementTag = String(element.tagName || "").toLowerCase();
  const elementClass = classList(element).join(" ");
  const selfLooksLikeIcon = ["svg", "img", "i"].includes(elementTag) ||
    /(^|\s|-)icon/i.test(elementClass) ||
    readStyle(elementStyle, "maskImage") !== "none" ||
    readStyle(elementStyle, "backgroundImage") !== "none";
  const candidates = [
    ...(selfLooksLikeIcon ? [element] : []),
    ...Array.from(element.querySelectorAll?.(iconSelector) ?? [])
  ]
    .filter((child, index, list) => list.indexOf(child) === index)
    .filter((child) => isElementLike(child) && isVisibleChild(child))
    .slice(0, 12);

  candidates.forEach((icon) => {
    const tag = String(icon.tagName || "").toLowerCase();
    const rect = getRect(icon);
    const style = window.getComputedStyle(icon);
    if (tag === "svg") {
      const paths = Array.from(icon.querySelectorAll?.("path") ?? []);
      const uses = Array.from(icon.querySelectorAll?.("use") ?? []);
      icons.push({
        type: "svg",
        selector: buildSelectorSegment(icon),
        rect,
        viewBox: getAttribute(icon, "viewBox"),
        pathCount: paths.length,
        useHref: uses.map((item) => getAttribute(item, "href") || getAttribute(item, "xlink:href")).filter(Boolean).join(", "),
        fill: getAttribute(icon, "fill") || readStyle(style, "fill"),
        stroke: getAttribute(icon, "stroke") || readStyle(style, "stroke"),
        color: readStyle(style, "color")
      });
      return;
    }
    if (tag === "img") {
      icons.push({
        type: "img",
        selector: buildSelectorSegment(icon),
        rect,
        src: getAttribute(icon, "src"),
        alt: getAttribute(icon, "alt"),
        objectFit: readStyle(style, "objectFit")
      });
      return;
    }
    icons.push({
      type: "font-or-css",
      selector: buildSelectorSegment(icon),
      rect,
      className: classList(icon).join(" "),
      color: readStyle(style, "color"),
      fontFamily: readStyle(style, "fontFamily"),
      backgroundImage: readStyle(style, "backgroundImage"),
      maskImage: readStyle(style, "maskImage")
    });
  });

  return icons;
}

export function extractReferenceFromElement(element, options = {}) {
  if (!element) {
    throw new Error("Missing element");
  }

  const style = window.getComputedStyle(element);
  const pageWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
  const pageHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
  const rect = getRect(element);

  return {
    capturedAt: new Date().toISOString(),
    page: {
      url: document.location?.href ?? "",
      title: document.title ?? "",
      viewport: {
        width: pageWidth,
        height: pageHeight,
        devicePixelRatio: window.devicePixelRatio || 1
      }
    },
    element: {
      tag: String(element.tagName || "").toLowerCase(),
      text: normalizeText(element.textContent),
      selector: buildSelectorSegment(element),
      domPath: buildDomPath(element),
      rect,
      attributes: {
        id: element.id || undefined,
        role: getAttribute(element, "role"),
        ariaLabel: getAttribute(element, "aria-label"),
        title: getAttribute(element, "title"),
        testAttributes: getTestAttributes(element)
      },
      outerHTML: clipOuterHTML(element),
      styles: pickStyles(style),
      fullComputedStyle: collectFullComputedStyle(style),
      styleVars: collectComponentStyleVars(style),
      children: collectChildSnapshots(element, rect, options.childLimit ?? DEFAULT_CHILD_SNAPSHOT_LIMIT),
      iconDetails: options.includeIconDetails ? collectIconDetails(element) : undefined,
      stateStyles: options.includeStateStyles ? collectStateStyles(element) : undefined,
      parent: parentSummary(element),
      ancestorTrail: buildAncestorTrail(element)
    }
  };
}
