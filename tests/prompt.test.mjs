import assert from "node:assert/strict";
import {
  buildAiPrompt,
  buildColorPrompt,
  buildColorSamplePrompt,
  buildColorSampleValues,
  buildColorValues,
  buildColorVars,
  buildMultiAiPrompt
} from "../prompt.mjs";

const reference = {
  page: {
    url: "https://example.com/prototype",
    title: "Prototype",
    viewport: {
      width: 1440,
      height: 900,
      devicePixelRatio: 2
    }
  },
  element: {
    tag: "button",
    text: "Start now",
    selector: "button.primary",
    domPath: "html > body > main > button.primary",
    rect: {
      x: 120,
      y: 240,
      width: 128,
      height: 44
    },
    attributes: {
      role: "button",
      ariaLabel: "Start now"
    },
    outerHTML: "<button class=\"primary\">Start now</button>",
    styles: {
      font: {
        family: "Inter, sans-serif",
        size: "16px",
        weight: "600",
        lineHeight: "24px",
        letterSpacing: "0px"
      },
      color: {
        text: "rgb(255, 255, 255)",
        background: "rgb(37, 99, 235)",
        backgroundImage: "linear-gradient(90deg, rgb(37, 99, 235), rgb(79, 70, 229))",
        opacity: "1"
      },
      box: {
        display: "inline-flex",
        padding: "10px 18px",
        margin: "0px",
        border: "0px none rgb(255, 255, 255)",
        outline: "2px solid rgb(147, 197, 253)",
        borderRadius: "8px",
        boxShadow: "rgba(0, 0, 0, 0.2) 0px 8px 24px"
      },
      layout: {
        position: "relative",
        gap: "8px",
        alignItems: "center",
        justifyContent: "center"
      }
    },
    parent: {
      selector: "main.hero",
      display: "flex",
      gap: "24px",
      padding: "64px"
    },
    children: [
      {
        selector: "span.label",
        tag: "span",
        text: "Start now",
        relativeRect: { x: 12, y: 10, width: 88, height: 20 },
        styles: {
          width: "auto",
          minWidth: "0px",
          height: "20px",
          fontSize: "16px",
          fontWeight: "600",
          lineHeight: "20px",
          textAlign: "center",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          color: "rgb(255, 255, 255)",
          background: "rgba(0, 0, 0, 0)",
          backgroundImage: "linear-gradient(90deg, red, blue)",
          backgroundSize: "200% 100%",
          backgroundPosition: "0% 50%",
          display: "inline",
          padding: "0px 12px",
          margin: "0px",
          borderRadius: "0px",
          boxShadow: "none",
          boxSizing: "border-box",
          position: "relative",
          overflow: "hidden",
          transform: "translateX(0px)",
          transformOrigin: "0px 10px",
          transitionDuration: "0.3s",
          transitionTimingFunction: "ease",
          transitionProperty: "max-width",
          objectFit: "cover",
          aspectRatio: "16 / 9"
        },
        styleVars: {
          "--n-fill-color": "rgb(32, 128, 240)",
          "--n-rail-color": "rgb(235, 235, 235)",
          "--n-padding": "12px"
        }
      }
    ],
    styleVars: {
      "--button-color": "rgb(37, 99, 235)",
      "--button-text-color": "rgb(255, 255, 255)",
      "--button-padding": "10px 18px"
    },
    iconDetails: [
      {
        type: "svg",
        selector: "svg.icon",
        rect: { x: 130, y: 250, width: 16, height: 16 },
        viewBox: "0 0 16 16",
        pathCount: 1,
        fill: "rgb(255, 255, 255)",
        stroke: "rgb(191, 219, 254)",
        color: "rgb(255, 255, 255)"
      },
      {
        type: "font-or-css",
        selector: "i.mask-icon",
        rect: { x: 150, y: 250, width: 16, height: 16 },
        className: "mask-icon",
        fontFamily: "iconfont",
        color: "rgb(37, 99, 235)",
        backgroundImage: "linear-gradient(red, blue)",
        maskImage: "url(icon.svg)"
      }
    ],
    ancestorTrail: ["main.hero", "body"],
    fullComputedStyle: {
      "font-size": "16px",
      "font-weight": "600",
      "background-color": "rgb(37, 99, 235)",
      "border-radius": "8px",
      padding: "10px 18px",
      display: "inline-flex"
    }
  }
};

const prompt = buildAiPrompt(reference);

assert.match(prompt, /1:1/);
assert.match(prompt, /https:\/\/example\.com\/prototype/);
assert.match(prompt, /button\.primary/);
assert.match(prompt, /128 x 44/);
assert.match(prompt, /Inter, sans-serif/);
assert.match(prompt, /rgb\(37, 99, 235\)/);
assert.match(prompt, /关键子元素采样/);
assert.match(prompt, /span\.label/);
assert.match(prompt, /width auto; min-width 0px; height 20px/);
assert.match(prompt, /padding 0px 12px/);
assert.match(prompt, /Text: .*white-space nowrap; text-overflow ellipsis/);
assert.match(prompt, /Visual: .*background-image linear-gradient\(90deg, red, blue\)/);
assert.match(prompt, /Layout\/Motion: position relative; overflow hidden; transform translateX\(0px\)/);
assert.match(prompt, /Media: object-fit cover; aspect-ratio 16 \/ 9/);
assert.match(prompt, /Component vars: --n-fill-color rgb\(32, 128, 240\)/);
assert.match(prompt, /--n-padding 12px/);
assert.match(prompt, /--n-rail-color rgb\(235, 235, 235\)/);
assert.match(prompt, /不要盲目复制无关 inline style/);
assert.doesNotMatch(prompt, /外部参考页模式/);
assert.doesNotMatch(prompt, /结构化 JSON/);
assert.doesNotMatch(prompt, /"capturedAt"/);

const externalPrompt = buildAiPrompt(reference, "Codex", { externalReferenceMode: true });
assert.match(externalPrompt, /外部参考页模式/);
assert.match(externalPrompt, /不要照搬到当前项目/);
assert.match(externalPrompt, /button\.primary/);

const fullPrompt = buildAiPrompt(reference, "Codex", { includeFullComputedStyle: true });
assert.match(fullPrompt, /完整 computed CSS/);
assert.match(fullPrompt, /font-size: 16px;/);
assert.doesNotMatch(fullPrompt, /结构化 JSON/);

const secondReference = structuredClone(reference);
secondReference.element.selector = "h1.title";
secondReference.element.tag = "h1";
secondReference.element.text = "Welcome";
secondReference.element.rect = {
  x: 120,
  y: 160,
  width: 320,
  height: 52
};

const multiPrompt = buildMultiAiPrompt([reference, secondReference]);
assert.match(multiPrompt, /本次选中了 2 个参考元素/);
assert.match(multiPrompt, /整体边界: 120, 160, 320 x 124/);
assert.match(multiPrompt, /1\. button\.primary/);
assert.match(multiPrompt, /2\. h1\.title/);
assert.doesNotMatch(multiPrompt, /结构化 JSON/);

const colorPrompt = buildColorPrompt(reference);
assert.match(colorPrompt, /请只同步颜色/);
assert.match(colorPrompt, /不要修改布局、尺寸、字体、DOM 结构/);
assert.match(colorPrompt, /文本颜色: rgb\(255, 255, 255\)/);
assert.match(colorPrompt, /背景色: rgb\(37, 99, 235\)/);
assert.match(colorPrompt, /背景图\/渐变: linear-gradient/);
assert.match(colorPrompt, /描边 outline: 2px solid rgb\(147, 197, 253\)/);
assert.match(colorPrompt, /阴影: rgba\(0, 0, 0, 0\.2\) 0px 8px 24px/);
assert.match(colorPrompt, /图标 1 fill: rgb\(255, 255, 255\)/);
assert.match(colorPrompt, /图标 2 mask: url\(icon.svg\)/);
assert.match(colorPrompt, /CSS 变量 --button-color: rgb\(37, 99, 235\)/);
assert.match(colorPrompt, /子元素 1 变量 --n-fill-color: rgb\(32, 128, 240\)/);
assert.doesNotMatch(colorPrompt, /--button-padding/);
assert.doesNotMatch(colorPrompt, /--n-padding/);
assert.match(colorPrompt, /不要照搬参考页 selector/);

const colorValues = buildColorValues([reference, secondReference]);
assert.match(colorValues, /元素 1: button\.primary/);
assert.match(colorValues, /元素 2: h1\.title/);
assert.match(colorValues, /子元素 1 背景图\/渐变: linear-gradient\(90deg, red, blue\)/);

const colorVars = buildColorVars(reference);
assert.match(colorVars, /--button-color: rgb\(37, 99, 235\);/);
assert.match(colorVars, /--button-text-color: rgb\(255, 255, 255\);/);
assert.match(colorVars, /--n-rail-color: rgb\(235, 235, 235\);/);
assert.doesNotMatch(colorVars, /--button-padding/);
assert.doesNotMatch(colorVars, /--n-padding/);

const colorSamples = [
  {
    kind: "背景色",
    value: "rgb(37, 99, 235)",
    hex: "#2563eb",
    selector: "button.primary",
    page: reference.page
  },
  {
    kind: "图标 fill",
    value: "rgb(255, 255, 255)",
    hex: "#ffffff",
    selector: "svg.icon",
    page: reference.page
  }
];
const colorSamplePrompt = buildColorSamplePrompt(colorSamples);
assert.match(colorSamplePrompt, /请把下面吸取到的颜色应用到当前项目的目标元素上/);
assert.match(colorSamplePrompt, /1\. rgb\(37, 99, 235\) \/ #2563eb \(背景色 · button\.primary\)/);
assert.match(colorSamplePrompt, /2\. rgb\(255, 255, 255\) \/ #ffffff \(图标 fill · svg\.icon\)/);
assert.match(colorSamplePrompt, /不要照搬颜色来源 selector/);
assert.doesNotMatch(colorSamplePrompt, /子元素 1/);

const targetReference = structuredClone(reference);
targetReference.page.url = "http://localhost:3000/home";
targetReference.element.selector = "button.cta";
targetReference.element.domPath = "html > body > main > button.cta";
targetReference.element.text = "提交";
targetReference.element.styles.color.text = "rgb(17, 24, 39)";
targetReference.element.styles.color.background = "rgb(255, 255, 255)";
const targetedColorPrompt = buildColorSamplePrompt(colorSamples, "Codex", { targetReference });
assert.match(targetedColorPrompt, /目标元素/);
assert.match(targetedColorPrompt, /目标页面: http:\/\/localhost:3000\/home/);
assert.match(targetedColorPrompt, /当前项目要修改的目标 selector: button\.cta/);
assert.match(targetedColorPrompt, /目标当前背景色: rgb\(255, 255, 255\)/);
assert.match(targetedColorPrompt, /优先修改上面标注的「当前项目要修改的目标 selector」/);

const colorSampleValues = buildColorSampleValues(colorSamples);
assert.match(colorSampleValues, /#2563eb/);
assert.match(colorSampleValues, /图标 fill/);
