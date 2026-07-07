import assert from "node:assert/strict";
import { describeReference, describeReferences } from "../label.mjs";

function reference(overrides = {}) {
  return {
    element: {
      tag: overrides.tag ?? "div",
      text: overrides.text ?? "访问量 日 70,510",
      selector: overrides.selector ?? "div.n-card",
      domPath: overrides.domPath ?? "div.console > div.n-card",
      rect: {
        width: overrides.width ?? 240,
        height: overrides.height ?? 160
      },
      attributes: overrides.attributes ?? {},
      children: overrides.children ?? [
        {
          text: "访问量"
        },
        {
          text: "70,510"
        }
      ]
    }
  };
}

const card = describeReference(reference());
assert.equal(card.name, "访问量卡片");
assert.equal(card.kind, "卡片");
assert.match(card.detail, /240 x 160/);
assert.equal(card.technical, "div.n-card");

const progress = describeReference(reference({
  selector: "div.n-progress",
  domPath: "div.console > div.n-progress",
  text: "",
  children: []
}));
assert.equal(progress.name, "进度条");

const button = describeReference(reference({
  tag: "button",
  selector: "button.primary",
  text: "保存",
  children: []
}));
assert.equal(button.name, "保存按钮");

const multi = describeReferences([reference(), reference({ selector: "div.n-progress", text: "", children: [] })]);
assert.equal(multi.title, "已选择 2 个元素");
assert.match(multi.detail, /访问量卡片、进度条/);
