import assert from "node:assert/strict";
import { buildStructurePrompt, compareStructureSets, structureRiskLines } from "../structure.mjs";

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
assert.equal(structureRiskLines(similar).length, 0);

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
assert.ok(structureRiskLines(mismatch).some((line) => line.includes("结构风险: 高")));
assert.ok(structureRiskLines(mismatch).some((line) => line.includes("结构对比")));
assert.ok(mismatch.pairs[0].warnings.some((warning) => warning.includes("当前元素可能不是参考元素的同一层级")));

const prompt = buildStructurePrompt(mismatch);
assert.match(prompt, /请先调整当前项目的 DOM \/ 组件 \/ 布局结构/);
assert.match(prompt, /不要先处理颜色、字体等细节样式/);
assert.match(prompt, /当前项目要修改的元素: span\.generated-text/);
assert.match(prompt, /参考 tag 分布/);
assert.match(prompt, /当前 tag 分布/);
assert.match(prompt, /先补齐缺失的 header\/body\/footer\/chart\/table\/action 等结构区域/);
