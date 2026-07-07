import assert from "node:assert/strict";
import { buildDiffPrompt, compareReferenceSets } from "../diff.mjs";

function makeReference(selector, rect, overrides = {}) {
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
      tag: "button",
      text: "Start now",
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        left: rect.x,
        top: rect.y,
        right: rect.x + rect.width,
        bottom: rect.y + rect.height
      },
      styles: {
        font: {
          family: "Inter",
          size: overrides.fontSize ?? "16px",
          weight: overrides.weight ?? "600",
          lineHeight: overrides.lineHeight ?? "24px",
          letterSpacing: "0px"
        },
        color: {
          text: overrides.color ?? "rgb(255, 255, 255)",
          background: overrides.background ?? "rgb(37, 99, 235)"
        },
        box: {
          display: "inline-flex",
          padding: overrides.padding ?? "10px 18px",
          margin: "0px",
          border: "0px none",
          borderRadius: overrides.radius ?? "8px",
          boxShadow: overrides.shadow ?? "none"
        },
        layout: {
          position: "relative",
          gap: overrides.gap ?? "8px",
          alignItems: "center",
          justifyContent: "center"
        }
      },
      parent: {
        selector: "main.hero",
        display: "flex",
        gap: overrides.parentGap ?? "24px",
        padding: "64px"
      },
      children: overrides.children ?? []
    }
  };
}

const baseline = [
  makeReference("button.primary", { x: 100, y: 200, width: 128, height: 44 }, {
    children: [
      {
        signature: "span.label|Start now",
        selector: "span.label",
        text: "Start now",
        relativeRect: { x: 18, y: 10, width: 80, height: 20 },
        styles: {
          fontSize: "16px",
          fontWeight: "600",
          lineHeight: "20px",
          color: "rgb(255, 255, 255)",
          background: "rgba(0, 0, 0, 0)",
          width: "auto",
          minWidth: "0px",
          height: "20px",
          padding: "0px 12px",
          borderRadius: "0px",
          transitionDuration: "0.3s"
        },
        styleVars: {
          "--n-fill-color": "rgb(32, 128, 240)"
        }
      }
    ]
  }),
  makeReference("h1.title", { x: 100, y: 120, width: 360, height: 56 }, { fontSize: "40px" })
];

const current = [
  makeReference(
    "button.primary",
    { x: 112, y: 208, width: 120, height: 40 },
    {
      url: "http://localhost:3000",
      title: "App",
      fontSize: "14px",
      padding: "8px 16px",
      radius: "6px",
      background: "rgb(59, 130, 246)"
      ,
      children: [
        {
          signature: "span.generated-x9|Start now",
          selector: "span.generated-x9",
          text: "Start now",
          relativeRect: { x: 14, y: 9, width: 74, height: 18 },
          styles: {
            fontSize: "14px",
            fontWeight: "500",
            lineHeight: "18px",
            color: "rgb(255, 255, 255)",
            background: "rgba(0, 0, 0, 0)",
            width: "48px",
            minWidth: "48px",
            height: "100%",
            padding: "0px",
            borderRadius: "0px",
            transitionDuration: "0s"
          },
          styleVars: {
            "--n-fill-color": "rgb(59, 130, 246)"
          }
        }
      ]
    }
  ),
  makeReference("h1.title", { x: 96, y: 126, width: 350, height: 52 }, { url: "http://localhost:3000", fontSize: "36px" })
];

const diff = compareReferenceSets(baseline, current);

assert.equal(diff.count.baseline, 2);
assert.equal(diff.count.current, 2);
assert.equal(diff.bounds.width.delta, -10);
assert.equal(diff.pairs[0].rect.width.delta, -8);
assert.equal(diff.pairs[0].styles["font.size"].baseline, "16px");
assert.equal(diff.pairs[0].styles["font.size"].current, "14px");
assert.equal(diff.pairs[0].styles["box.borderRadius"].current, "6px");
assert.equal(diff.pairs[0].children.length, 1);
assert.equal(diff.pairs[0].children[0].styles.fontSize.current, "14px");
assert.equal(diff.pairs[0].children[0].currentSelector, "span.generated-x9");
assert.equal(diff.pairs[0].children[0].styles.width.baseline, "auto");
assert.equal(diff.pairs[0].children[0].styles.width.current, "48px");
assert.equal(diff.pairs[0].children[0].styles.minWidth.current, "48px");
assert.equal(diff.pairs[0].children[0].styles.transitionDuration.baseline, "0.3s");
assert.equal(diff.pairs[0].children[0].styles["var.--n-fill-color"].current, "rgb(59, 130, 246)");

const prompt = buildDiffPrompt(diff);
assert.match(prompt, /参考页/);
assert.match(prompt, /当前实现页/);
assert.match(prompt, /font\.size: 参考 16px \/ 当前 14px/);
assert.match(prompt, /子元素差异/);
assert.match(prompt, /span\.label/);
assert.match(prompt, /transitionDuration: 参考 0\.3s \/ 当前 0s/);
assert.match(prompt, /var\.--n-fill-color: 参考 rgb\(32, 128, 240\) \/ 当前 rgb\(59, 130, 246\)/);
assert.match(prompt, /请根据这些差异调整当前项目/);
