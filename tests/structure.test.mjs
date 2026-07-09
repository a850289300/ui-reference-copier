import assert from "node:assert/strict";
import { buildDetailedStructurePrompt, buildStructurePrompt, compareStructureSets, structureRiskLines } from "../structure.mjs";

function child(tag, overrides = {}) {
  return {
    tag,
    selector: overrides.selector ?? tag,
    text: overrides.text ?? "",
    attributes: overrides.attributes ?? {},
    relativeRect: overrides.relativeRect ?? { x: 0, y: 0, width: 80, height: 24 }
  };
}

function makeReference(selector, overrides = {}) {
  const x = overrides.x ?? 100;
  const y = overrides.y ?? 100;
  const width = overrides.width ?? 300;
  const height = overrides.height ?? 180;
  return {
    page: {
      url: overrides.url ?? "https://example.com/reference",
      title: overrides.title ?? "Reference",
      viewport: { width: 1440, height: 900, devicePixelRatio: 2 }
    },
    element: {
      selector,
      domPath: overrides.domPath ?? `main.dashboard > ${selector}`,
      tag: overrides.tag ?? "div",
      text: overrides.text ?? "",
      rect: {
        x,
        y,
        width,
        height,
        left: x,
        top: y,
        right: x + width,
        bottom: y + height
      },
      styles: {
        font: {
          family: "Inter",
          size: "14px",
          weight: "400",
          lineHeight: "21px",
          letterSpacing: "normal"
        },
        color: {
          text: "rgb(17, 24, 39)",
          background: overrides.background ?? "rgb(255, 255, 255)"
        },
        box: {
          display: overrides.display ?? "block",
          padding: "16px",
          margin: "0px",
          border: overrides.border ?? "1px solid rgb(229, 231, 235)",
          borderRadius: overrides.borderRadius ?? "8px",
          boxShadow: overrides.boxShadow ?? "none"
        },
        layout: {
          gap: "12px",
          alignItems: "stretch",
          justifyContent: "normal"
        }
      },
      parent: {
        selector: "main.dashboard",
        display: "grid",
        gap: "16px",
        padding: "24px"
      },
      children: overrides.children ?? []
    }
  };
}

const referenceCard = makeReference("div.stats-card", {
  children: [
    child("header", { text: "访问量" }),
    child("div", { attributes: { role: "progressbar" } }),
    child("footer", { text: "总访问量 96,673" })
  ]
});

const similarCard = makeReference("div.current-card", {
  url: "http://localhost:3000",
  children: [
    child("header", { text: "访问量" }),
    child("div", { attributes: { role: "progressbar" } }),
    child("footer", { text: "总访问量 96,673" })
  ]
});

const similar = compareStructureSets([referenceCard], [similarCard]);
assert.equal(similar.severity, "low");
assert.ok(structureRiskLines(similar).some((line) => line.includes("普通提示")));
assert.ok(structureRiskLines(similar).some((line) => line.includes("结构基本一致")));

const wrongInnerText = makeReference("span.generated-text", {
  url: "http://localhost:3000",
  tag: "span",
  width: 72,
  height: 22,
  display: "inline",
  background: "rgba(0, 0, 0, 0)",
  border: "0px none",
  borderRadius: "0px",
  text: "访问量",
  children: []
});

const mismatch = compareStructureSets([referenceCard], [wrongInnerText]);
assert.equal(mismatch.severity, "high");
assert.ok(mismatch.score < 55);
assert.ok(structureRiskLines(mismatch).some((line) => line.includes("严重提醒")));
assert.ok(structureRiskLines(mismatch).some((line) => line.includes("先不要修颜色")));
assert.ok(structureRiskLines(mismatch).some((line) => line.includes("结构对比")));
assert.ok(mismatch.pairs[0].warnings.some((warning) => warning.includes("当前元素可能不是参考元素的同一层级")));

const prompt = buildStructurePrompt(mismatch);
assert.match(prompt, /结构状态：明显不一致，先不要修样式/);
assert.match(prompt, /对比对象/);
assert.match(prompt, /参考元素:/);
assert.match(prompt, /参考位置: x 100, y 100, 300 x 180/);
assert.match(prompt, /参考文本摘要: 访问量、总访问量 96,673/);
assert.match(prompt, /当前目标 selector: span\.generated-text/);
assert.match(prompt, /关键结构差异/);
assert.match(prompt, /建议/);
assert.match(prompt, /根节点不同/);
assert.doesNotMatch(prompt, /参考 tag 分布/);
assert.doesNotMatch(prompt, /逐元素结构数据/);

const detailedPrompt = buildDetailedStructurePrompt(mismatch);
assert.match(detailedPrompt, /详细结构状态/);
assert.match(detailedPrompt, /逐元素结构数据/);
assert.match(detailedPrompt, /参考 tag 分布/);
assert.match(detailedPrompt, /当前 tag 分布/);
assert.match(detailedPrompt, /详细定位信息/);
assert.match(detailedPrompt, /参考 DOM path: main\.dashboard > div\.stats-card/);
assert.match(detailedPrompt, /当前 DOM path: main\.dashboard > span\.generated-text/);

const lowPrompt = buildStructurePrompt(similar);
assert.match(lowPrompt, /结构状态：基本一致，可继续修样式/);
assert.doesNotMatch(lowPrompt, /先停一下/);

const semanticReference = makeReference("div.metrics", {
  children: [
    child("div", { attributes: { role: "heading" }, text: "访问量" }),
    child("div", { attributes: { role: "heading" }, text: "销售额" }),
    child("div", { attributes: { role: "progressbar" } }),
    child("div", { attributes: { role: "none" } })
  ]
});
const flattenedCurrent = makeReference("div.dashboard-metrics", {
  url: "http://localhost:3000",
  children: [
    child("div", { attributes: { role: "heading" }, text: "访问量" }),
    child("span", { text: "销售额" }),
    child("span", { text: "总访问量" }),
    child("span", { text: "趋势" })
  ]
});
const semanticPrompt = buildStructurePrompt(compareStructureSets([semanticReference], [flattenedCurrent]));
assert.match(semanticPrompt, /标题结构不同/);
assert.match(semanticPrompt, /检查卡片标题、分区标题或统计项标题是否被普通文本替代/);
assert.match(semanticPrompt, /进度条区域不同/);
assert.match(semanticPrompt, /普通文本结构不同/);
assert.match(semanticPrompt, /可能把标题、数值或说明拍平成了普通文本/);
assert.doesNotMatch(semanticPrompt, /role:none/);
