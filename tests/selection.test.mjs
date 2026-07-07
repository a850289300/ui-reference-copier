import assert from "node:assert/strict";
import { resolveSelectableElement, selectableParent } from "../selection.mjs";

function makeElement(name, rect, children = []) {
  const element = {
    name,
    tagName: "DIV",
    parentElement: null,
    children,
    classList: [],
    getBoundingClientRect() {
      return rect;
    },
    closest(selector) {
      if (selector === "[data-ui-reference-copier='true']") {
        return null;
      }
      return null;
    },
    querySelectorAll() {
      const result = [];
      const visit = (child) => {
        result.push(child);
        child.children.forEach(visit);
      };
      children.forEach(visit);
      return result;
    }
  };

  children.forEach((child) => {
    child.parentElement = element;
  });

  return element;
}

const leftCard = makeElement("left-card", {
  left: 0,
  top: 0,
  right: 314,
  bottom: 198,
  width: 314,
  height: 198
});
const rightCard = makeElement("right-card", {
  left: 326,
  top: 0,
  right: 640,
  bottom: 200,
  width: 314,
  height: 200
});
const grid = makeElement("grid", {
  left: 0,
  top: 0,
  right: 640,
  bottom: 200,
  width: 640,
  height: 200
}, [leftCard, rightCard]);

const snapped = resolveSelectableElement(grid, { x: 321, y: 86 });
assert.equal(snapped, rightCard);

const direct = resolveSelectableElement(rightCard, { x: 360, y: 86 });
assert.equal(direct, rightCard);

const directParent = resolveSelectableElement(rightCard, { x: 360, y: 86 }, { preferParent: true });
assert.equal(directParent, grid);

assert.equal(selectableParent(rightCard), grid);

const farAway = resolveSelectableElement(grid, { x: 320, y: 260 });
assert.equal(farAway, grid);
