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
assert.match(prompt, /参考定位 selector: div\.stats-card（仅用于识别参考范围，不要照搬）/);
assert.match(prompt, /参考位置: x 100, y 100, 300 x 180/);
assert.match(prompt, /参考文本摘要: 访问量、总访问量/);
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
assert.doesNotMatch(lowPrompt, /组件语义差异/);

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

const noisyReference = makeReference("div.n-grid", {
  text: "访问量日26,046 日同比 93,875% 周同比 62,656% 总访问量： 72,920销售额周￥68,21682031% 总销售额： ￥61,315订单量周59,265 成交额月￥11,035 总成交额： ￥52,465",
  children: [
    child("div", { text: "访问量日26,046 日同比 93,875%" }),
    child("div", { text: "销售额周￥68,21682031%" }),
    child("div", { text: "订单量周59,265" }),
    child("div", { text: "成交额月￥11,035" })
  ]
});
const noisyCurrent = makeReference("div.dashboard-metrics", {
  url: "http://localhost:3000",
  text: "访问量日96,387 日同比 62,481% 销售额周￥75,293 订单量周87,241 成交额月¥38,660",
  children: [
    child("div", { text: "访问量日96,387" }),
    child("div", { text: "销售额周￥75,293" }),
    child("div", { text: "订单量周87,241" }),
    child("div", { text: "成交额月¥38,660" })
  ]
});
const noisyPrompt = buildStructurePrompt(compareStructureSets([noisyReference], [noisyCurrent]));
assert.match(noisyPrompt, /参考文本摘要: 访问量、销售额、订单量、成交额、日同比、周同比/);
assert.match(noisyPrompt, /当前文本摘要: 访问量、销售额、订单量、成交额、日同比/);
assert.doesNotMatch(noisyPrompt, /93,875/);
assert.doesNotMatch(noisyPrompt, /68,21682031/);

const referenceMenu = makeReference("div.reference-menu", {
  tag: "div",
  text: "dashboard 主控台 工作台 系统设置",
  children: [
    child("div", { selector: "div.menu-group", attributes: { role: "menu" }, text: "dashboard", relativeRect: { x: 0, y: 0, width: 180, height: 40 } }),
    child("div", { selector: "div.menu-item", attributes: { role: "menuitem" }, text: "主控台", relativeRect: { x: 24, y: 40, width: 160, height: 40 } }),
    child("div", { selector: "div.menu-item", attributes: { role: "menuitem" }, text: "工作台", relativeRect: { x: 24, y: 80, width: 160, height: 40 } }),
    child("div", { selector: "div.menu-item", attributes: { role: "menuitem" }, text: "系统设置", relativeRect: { x: 0, y: 120, width: 180, height: 40 } })
  ]
});

const currentMenu = makeReference("ul.current-sidebar-menu", {
  url: "http://localhost:3000",
  tag: "ul",
  text: "dashboard 主控台 工作台 系统设置 基础列表",
  children: [
    child("li", { selector: "li.menu-sub", attributes: { role: "menuitem" }, text: "dashboard", relativeRect: { x: 0, y: 0, width: 180, height: 40 } }),
    child("li", { selector: "li.menu-item", attributes: { role: "menuitem" }, text: "主控台", relativeRect: { x: 20, y: 40, width: 160, height: 40 } }),
    child("li", { selector: "li.menu-item", attributes: { role: "menuitem" }, text: "工作台", relativeRect: { x: 20, y: 80, width: 160, height: 40 } }),
    child("li", { selector: "li.menu-item", attributes: { role: "menuitem" }, text: "系统设置", relativeRect: { x: 0, y: 120, width: 180, height: 40 } }),
    child("li", { selector: "li.menu-item", attributes: { role: "menuitem" }, text: "基础列表", relativeRect: { x: 0, y: 160, width: 180, height: 40 } })
  ]
});

const menuPrompt = buildStructurePrompt(compareStructureSets([referenceMenu], [currentMenu]));
assert.match(menuPrompt, /组件语义差异/);
assert.match(menuPrompt, /菜单\/导航/);
assert.match(menuPrompt, /不要按 div\/ul\/li\/span 数量直接重写/);
assert.match(menuPrompt, /保留当前项目已有菜单组件、路由配置或菜单数据源/);
assert.match(menuPrompt, /参考菜单语义/);
assert.match(menuPrompt, /当前菜单语义/);
assert.match(menuPrompt, /- dashboard/);
assert.match(menuPrompt, /  - 主控台/);
assert.match(menuPrompt, /当前可能多出的菜单项: 基础列表/);

const detailedMenuPrompt = buildDetailedStructurePrompt(compareStructureSets([referenceMenu], [currentMenu]));
assert.match(detailedMenuPrompt, /组件语义差异/);
assert.match(detailedMenuPrompt, /逐元素结构数据/);

const longReferenceMenuChildren = Array.from({ length: 30 }, (_, index) => {
  return child("div", {
    selector: "div.menu-item",
    attributes: { role: "menuitem" },
    text: index === 29 ? "组件示例" : `菜单${index + 1}`,
    relativeRect: { x: 0, y: index * 40, width: 180, height: 40 }
  });
});
const longCurrentMenuChildren = longReferenceMenuChildren
  .filter((item) => item.text !== "组件示例")
  .map((item, index) => ({
    ...item,
    tag: "li",
    selector: "li.menu-item",
    relativeRect: { x: 0, y: index * 40, width: 180, height: 40 }
  }));
const longReferenceMenu = makeReference("div.reference-menu", {
  children: longReferenceMenuChildren
});
const longCurrentMenu = makeReference("ul.current-menu", {
  tag: "ul",
  children: longCurrentMenuChildren
});

const compactMenuPrompt = buildStructurePrompt(compareStructureSets([longReferenceMenu], [longCurrentMenu], { limit: 24 }));
assert.doesNotMatch(compactMenuPrompt, /当前可能缺少的菜单项: 组件示例/);

const fullMenuPrompt = buildStructurePrompt(compareStructureSets([longReferenceMenu], [longCurrentMenu], { limit: Number.MAX_SAFE_INTEGER }));
assert.match(fullMenuPrompt, /当前可能缺少的菜单项: 组件示例/);
