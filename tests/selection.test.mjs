import assert from "node:assert/strict";
import { resolveSelectableElement, selectableParent } from "../selection.mjs";

function makeElement(name, rect, children = [], tagName = "DIV") {
  const element = {
    name,
    tagName,
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

const dragIcon = makeElement("drag-icon", {
  left: 185,
  top: 10,
  right: 209,
  bottom: 34,
  width: 24,
  height: 24
}, [], "svg");
const title = makeElement("title", {
  left: 40,
  top: 0,
  right: 180,
  bottom: 44,
  width: 140,
  height: 44
});
const header = makeElement("header", {
  left: 0,
  top: 0,
  right: 373,
  bottom: 44,
  width: 373,
  height: 44
}, [title, dragIcon]);

const snappedIcon = resolveSelectableElement(header, { x: 197, y: 22 });
assert.equal(snappedIcon, dragIcon);
