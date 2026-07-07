const COMPONENT_HINTS = [
  [/n-progress|progress/i, "进度条"],
  [/n-card-header|card-header|header/i, "标题栏"],
  [/n-card|card/i, "卡片"],
  [/n-grid|grid|row|columns/i, "网格区域"],
  [/justify-between|space-between/i, "指标行"],
  [/flex|inline-flex/i, "布局行"],
  [/n-tag|tag|badge/i, "标签"],
  [/n-button|button|btn/i, "按钮"],
  [/table/i, "表格"],
  [/chart|canvas/i, "图表区域"],
  [/menu|nav/i, "导航区域"],
  [/form/i, "表单区域"],
  [/input|select|textarea/i, "输入控件"]
];

const TAG_KIND = {
  button: "按钮",
  img: "图片",
  svg: "图标",
  canvas: "图表区域",
  table: "表格",
  input: "输入控件",
  select: "选择控件",
  textarea: "输入控件",
  h1: "标题",
  h2: "标题",
  h3: "标题",
  h4: "标题",
  h5: "标题",
  h6: "标题",
  p: "文本",
  span: "文本",
  a: "链接"
};

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function isUsefulName(value) {
  const text = cleanText(value);
  if (!text || text.length > 24) {
    return false;
  }
  return /[\p{L}\p{N}]/u.test(text);
}

function findShortText(element) {
  const children = element.children ?? [];
  const child = children.find((item) => isUsefulName(item.text));
  if (child) {
    return cleanText(child.text);
  }

  const directText = cleanText(element.text);
  return isUsefulName(directText) ? directText : "";
}

function textKind(element) {
  const text = cleanText(element.text);
  const selector = cleanText(element.selector);
  const display = cleanText(element.styles?.box?.display);
  const isFlexLine = /flex|justify-between|space-between/i.test(`${selector} ${display}`);
  if (isFlexLine && /同比|环比|访问|销售|订单|成交|转化|金额|数量|率/.test(text)) {
    return "指标行";
  }
  return "";
}

function kindFromReference(reference) {
  const element = reference.element;
  const tagKind = TAG_KIND[String(element.tag ?? "").toLowerCase()];
  if (tagKind && tagKind !== "元素" && !["div", "section", "main"].includes(String(element.tag ?? "").toLowerCase())) {
    return tagKind;
  }

  const inferredTextKind = textKind(element);
  if (inferredTextKind) {
    return inferredTextKind;
  }

  const directHaystack = [
    element.selector,
    element.attributes?.role,
    element.attributes?.ariaLabel,
    element.tag,
    element.styles?.box?.display,
    element.styles?.layout?.justifyContent
  ].filter(Boolean).join(" ");

  const hint = COMPONENT_HINTS.find(([pattern]) => pattern.test(directHaystack));
  if (hint) {
    return hint[1];
  }

  const role = cleanText(element.attributes?.role).toLowerCase();
  if (role === "button") {
    return "按钮";
  }
  if (role === "img") {
    return "图片";
  }
  if (role === "progressbar") {
    return "进度条";
  }

  return tagKind ?? "元素";
}

function shouldUseTextInTitle(kind) {
  return !["指标行", "布局行", "网格区域", "图表区域", "表单区域", "导航区域"].includes(kind);
}

export function describeReference(reference) {
  const element = reference.element;
  const kind = kindFromReference(reference);
  const text = findShortText(element);
  const name = text && shouldUseTextInTitle(kind) && !kind.includes(text) ? `${text}${kind}` : kind;
  const rect = element.rect ?? {};
  const childCount = element.children?.length ?? 0;
  const textDetail = text ? `文本：${text}；` : "";

  return {
    name,
    kind,
    text,
    detail: `${textDetail}${Math.round(rect.width ?? 0)} x ${Math.round(rect.height ?? 0)}，采样 ${childCount} 个子元素`,
    technical: element.selector || element.domPath || element.tag || "unknown"
  };
}

export function describeReferences(references) {
  if (references.length === 0) {
    return {
      title: "还没有选择元素",
      detail: "点击页面中的元素开始采集。",
      items: []
    };
  }

  const items = references.map(describeReference);
  if (items.length === 1) {
    return {
      title: items[0].name,
      detail: items[0].detail,
      items
    };
  }

  return {
    title: `已选择 ${items.length} 个元素`,
    detail: items.map((item) => item.name).join("、"),
    items
  };
}
