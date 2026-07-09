import assert from "node:assert/strict";
import {
  attachCurrentToGroup,
  buildGroupedDiffPrompt,
  compareReferenceGroups,
  createReferenceGroup
} from "../groups.mjs";

function makeReference(selector, width, overrides = {}) {
  const x = overrides.x ?? 100;
  const y = overrides.y ?? 100;
  const height = overrides.height ?? 120;
  return {
    page: {
      url: overrides.url ?? "https://example.com/reference",
      title: overrides.title ?? "Reference",
      viewport: {
        width: 1440,
        height: 900,
        devicePixelRatio: 2
      }
    },
    element: {
      selector,
      tag: "div",
      text: overrides.text ?? "访问量",
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
          size: overrides.fontSize ?? "14px",
          weight: "400",
          lineHeight: "21px",
          letterSpacing: "normal"
        },
        color: {
          text: "rgb(51, 54, 57)",
          background: overrides.background ?? "rgba(0, 0, 0, 0)"
        },
        box: {
          display: "block",
          padding: overrides.padding ?? "0px",
          margin: "0px",
          border: "0px solid",
          borderRadius: overrides.borderRadius ?? "0px",
          boxShadow: overrides.boxShadow ?? "none"
        },
        layout: {
          gap: "normal",
          alignItems: "normal",
          justifyContent: "normal"
        }
      },
      parent: {
        selector: overrides.parentSelector ?? "div.console",
        display: overrides.parentDisplay ?? "grid",
        gap: overrides.parentGap ?? "16px",
        padding: overrides.parentPadding ?? "0px"
      },
      children: overrides.children ?? [],
      iconDetails: overrides.iconDetails ?? []
    }
  };
}

const groupA = createReferenceGroup(
  [makeReference("div.visit-card", 300, {
    text: "访问量",
    background: "rgb(255, 255, 255)",
    borderRadius: "4px",
    x: 24,
    y: 40,
    iconDetails: [
      {
        type: "svg",
        selector: "svg.visit-icon",
        rect: { x: 40, y: 56, width: 18, height: 18 },
        viewBox: "0 0 24 24",
        pathCount: 2,
        fill: "none",
        stroke: "currentColor",
        color: "rgb(24, 160, 88)"
      }
    ]
  })],
  { id: "group-a", name: "访问量卡片" }
);
const groupB = createReferenceGroup(
  [makeReference("div.sales-card", 300, {
    text: "销售额",
    background: "rgb(255, 255, 255)",
    borderRadius: "4px",
    x: 348,
    y: 40
  })],
  { id: "group-b", name: "销售额卡片" }
);

assert.equal(groupA.name, "访问量卡片");
assert.equal(groupA.references.length, 1);
assert.equal(groupA.currentReferences, null);
assert.equal(groupA.diff, null);

const matchedA = attachCurrentToGroup(groupA, [
  makeReference("div.generated-visit", 284, {
    url: "http://localhost:3000",
    title: "App",
    text: "访问量",
    fontSize: "12px",
    background: "rgba(0, 0, 0, 0)",
    borderRadius: "0px",
    parentDisplay: "flex",
    parentGap: "0px",
    iconDetails: [
      {
        type: "svg",
        selector: "svg.generated-icon",
        rect: { x: 42, y: 61, width: 14, height: 14 },
        viewBox: "0 0 20 20",
        pathCount: 1,
        fill: "currentColor",
        stroke: "none",
        color: "rgb(34, 197, 94)"
      }
    ]
  })
]);

assert.equal(matchedA.currentReferences.length, 1);
assert.equal(matchedA.diff.count.compared, 1);
assert.equal(matchedA.diff.pairs[0].rect.width.delta, -16);
assert.equal(groupA.currentReferences, null);

const result = compareReferenceGroups([matchedA, groupB]);
assert.equal(result.count.groups, 2);
assert.equal(result.count.compared, 1);
assert.equal(result.groups[0].status, "compared");
assert.equal(result.groups[1].status, "missing-current");
assert.ok(result.groups[0].warnings.some((warning) => warning.includes("范围可能不一致")));

const staleGroup = {
  ...matchedA,
  currentReferences: [
    makeReference("div.generated-visit-fixed", 300, {
      url: "http://localhost:3000",
      title: "App",
      text: "访问量",
      background: "rgb(255, 255, 255)",
      borderRadius: "4px"
    })
  ]
};
const recomputedResult = compareReferenceGroups([staleGroup]);
assert.equal(recomputedResult.groups[0].diff.pairs[0].rect.width.delta, 0);
assert.equal(recomputedResult.groups[0].diff.pairs[0].styles["color.background"], undefined);

const prompt = buildGroupedDiffPrompt(result);
assert.match(prompt, /多组元素对比/);
assert.match(prompt, /整体布局关系/);
assert.match(prompt, /参考整体边界/);
assert.match(prompt, /参考组范围快照/);
assert.match(prompt, /组 1：访问量卡片/);
assert.match(prompt, /width: 参考 300px \/ 当前 284px/);
assert.doesNotMatch(prompt, /参考范围: div\.visit-card/);
assert.match(prompt, /当前范围: 当前项目要修改: div\.generated-visit/);
assert.match(prompt, /背景 rgb\(255, 255, 255\)/);
assert.match(prompt, /父级布局: display grid; gap 16px/);
assert.match(prompt, /图标: svg viewBox 0 0 24 24 path 2/);
assert.match(prompt, /范围检查/);
assert.match(prompt, /范围可能不一致/);
assert.match(prompt, /组 2：销售额卡片/);
assert.match(prompt, /还没有匹配当前实现元素/);
assert.doesNotMatch(prompt, /## 每组详细差异/);
assert.ok(prompt.split("\n").length < 120);

const detailedPrompt = buildGroupedDiffPrompt(result, { detail: "full" });
assert.match(detailedPrompt, /## 每组详细差异/);
assert.match(detailedPrompt, /## 整体边界差异/);
assert.match(detailedPrompt, /图标差异/);
assert.match(detailedPrompt, /viewBox: 参考 0 0 24 24 \/ 当前 0 0 20 20/);
assert.ok(detailedPrompt.split("\n").length > prompt.split("\n").length);
