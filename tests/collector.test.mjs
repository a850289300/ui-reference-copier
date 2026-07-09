import assert from "node:assert/strict";
import { extractReferenceFromElement, STYLE_GROUPS } from "../collector.mjs";

function createElementStub() {
  const labelChild = {
    tagName: "SPAN",
    id: "",
    classList: ["label"],
    textContent: " Start now ",
    parentElement: null,
    children: [],
    outerHTML: "<span class=\"label\">Start now</span>",
    getAttribute() {
      return null;
    },
    matches(selector) {
      return selector.includes("span");
    },
    querySelectorAll() {
      return [];
    },
    getBoundingClientRect() {
      return {
        x: 112,
        y: 212,
        width: 80,
        height: 20,
        top: 212,
        right: 192,
        bottom: 232,
        left: 112
      };
    }
  };

  const cardChild = {
    tagName: "DIV",
    id: "",
    classList: ["n-card", "n-card--content-segmented"],
    textContent: "访问量 70,510",
    parentElement: null,
    children: [],
    outerHTML: "<div class=\"n-card n-card--content-segmented\">访问量 70,510</div>",
    getAttribute() {
      return null;
    },
    matches(selector) {
      return selector.includes("div[class]");
    },
    querySelectorAll() {
      return [];
    },
    getBoundingClientRect() {
      return {
        x: 104,
        y: 208,
        width: 280,
        height: 146,
        top: 208,
        right: 384,
        bottom: 354,
        left: 104
      };
    }
  };

  const progressFillChild = {
    tagName: "DIV",
    id: "",
    classList: ["n-progress-graph-line-fill", "n-progress-graph-line-fill--processing"],
    textContent: "93%",
    parentElement: null,
    children: [],
    outerHTML: "<div class=\"n-progress-graph-line-fill n-progress-graph-line-fill--processing\">93%</div>",
    getAttribute() {
      return null;
    },
    matches(selector) {
      return selector.includes("div[class]");
    },
    querySelectorAll() {
      return [];
    },
    getBoundingClientRect() {
      return {
        x: 120,
        y: 230,
        width: 180,
        height: 16,
        top: 230,
        right: 300,
        bottom: 246,
        left: 120
      };
    }
  };

  const iconChild = {
    tagName: "svg",
    id: "",
    classList: ["icon-user"],
    textContent: "",
    parentElement: null,
    children: [],
    outerHTML: "<svg class=\"icon-user\" viewBox=\"0 0 24 24\"><path d=\"M1 2L3 4\"></path><path d=\"M5 6L7 8\"></path></svg>",
    getAttribute(name) {
      return {
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor"
      }[name] ?? null;
    },
    matches(selector) {
      return selector.includes("svg");
    },
    querySelectorAll(selector) {
      if (selector.includes("path")) {
        return [
          { tagName: "path", getAttribute: (name) => name === "d" ? "M1 2L3 4" : null },
          { tagName: "path", getAttribute: (name) => name === "d" ? "M5 6L7 8" : null }
        ];
      }
      return [];
    },
    getBoundingClientRect() {
      return {
        x: 130,
        y: 206,
        width: 24,
        height: 24,
        top: 206,
        right: 154,
        bottom: 230,
        left: 130
      };
    }
  };

  const parent = {
    tagName: "MAIN",
    id: "",
    classList: ["hero"],
    parentElement: null,
    children: [],
    getAttribute() {
      return null;
    }
  };

  const element = {
    tagName: "BUTTON",
    id: "cta",
    classList: ["primary", "large"],
    textContent: " Start now ",
    parentElement: parent,
    children: [],
    outerHTML: "<button id=\"cta\" class=\"primary large\">Start now</button>",
    matches(selector) {
      return selector.includes("button");
    },
    querySelectorAll(selector) {
      if (selector.includes("div[class]")) {
        return [labelChild, cardChild, progressFillChild, iconChild];
      }
      if (selector.includes("[class*='icon']") || selector.includes("svg")) {
        return [iconChild];
      }
      return [labelChild];
    },
    getAttribute(name) {
      return {
        role: "button",
        "aria-label": "Start now",
        "data-testid": "hero-cta"
      }[name] ?? null;
    },
    getBoundingClientRect() {
      return {
        x: 100,
        y: 200,
        width: 160,
        height: 48,
        top: 200,
        right: 260,
        bottom: 248,
        left: 100
      };
    }
  };

  labelChild.parentElement = element;
  cardChild.parentElement = element;
  progressFillChild.parentElement = element;
  iconChild.parentElement = element;
  element.children = [labelChild, cardChild, progressFillChild, iconChild];
  parent.children = [element];

  return element;
}

function createIconElementStub() {
  const parent = {
    tagName: "SPAN",
    id: "",
    classList: ["metric-trend"],
    parentElement: null,
    children: [],
    getAttribute() {
      return null;
    }
  };

  const element = {
    tagName: "I",
    id: "",
    classList: ["trend-up", "iconfont"],
    textContent: "",
    parentElement: parent,
    children: [],
    outerHTML: "<i class=\"trend-up iconfont\"></i>",
    matches(selector) {
      return selector.includes("i") || selector.includes("[class*='icon']");
    },
    querySelectorAll() {
      return [];
    },
    getAttribute() {
      return null;
    },
    getBoundingClientRect() {
      return {
        x: 336,
        y: 229,
        width: 8,
        height: 8,
        top: 229,
        right: 344,
        bottom: 237,
        left: 336
      };
    }
  };

  parent.children = [element];
  return element;
}

globalThis.window = {
  innerWidth: 1440,
  innerHeight: 900,
  devicePixelRatio: 2,
  getComputedStyle(target) {
    const isParent = target.tagName === "MAIN";
    const isIcon = target.tagName === "I";
    const isProgressFill = target.classList?.includes?.("n-progress-graph-line-fill");
    return {
      fontFamily: isIcon ? "iconfont" : "Inter, sans-serif",
      fontSize: isIcon ? "14px" : isParent ? "18px" : "16px",
      fontWeight: "600",
      lineHeight: "24px",
      letterSpacing: "0px",
      textAlign: "center",
      textTransform: "none",
      textDecorationLine: "none",
      whiteSpace: isProgressFill ? "nowrap" : "normal",
      wordBreak: "normal",
      textOverflow: isProgressFill ? "ellipsis" : "clip",
      color: isIcon ? "rgb(51, 54, 57)" : "rgb(255, 255, 255)",
      backgroundColor: isProgressFill ? "rgb(32, 128, 240)" : "rgb(37, 99, 235)",
      backgroundImage: isProgressFill ? "linear-gradient(90deg, rgb(32, 128, 240), rgb(64, 158, 255))" : "none",
      backgroundSize: isProgressFill ? "200% 100%" : "auto",
      backgroundPosition: "0% 50%",
      opacity: "1",
      display: isIcon ? "inline-block" : isParent ? "flex" : "inline-flex",
      width: isIcon ? "8px" : isParent ? "1200px" : isProgressFill ? "180px" : "160px",
      height: isIcon ? "8px" : isParent ? "400px" : isProgressFill ? "16px" : "48px",
      minWidth: "0px",
      maxWidth: isProgressFill ? "93%" : "none",
      minHeight: "0px",
      maxHeight: "none",
      padding: isParent ? "64px" : "10px 18px",
      margin: "0px",
      border: "0px none rgb(255, 255, 255)",
      outline: "0px none rgb(255, 255, 255)",
      borderRadius: isProgressFill ? "10px" : "8px",
      boxShadow: "none",
      boxSizing: "border-box",
      position: "relative",
      top: "auto",
      right: "auto",
      bottom: "auto",
      left: "auto",
      zIndex: "auto",
      overflow: "visible",
      overflowX: "visible",
      overflowY: "visible",
      transform: isProgressFill ? "translateX(0px)" : "none",
      transformOrigin: isProgressFill ? "0px 8px" : "50% 50%",
      transitionDuration: isProgressFill ? "0.3s" : "0s",
      transitionTimingFunction: "ease",
      transitionProperty: isProgressFill ? "max-width" : "all",
      flexDirection: "row",
      flexWrap: "nowrap",
      alignItems: "center",
      justifyContent: "center",
      gap: isParent ? "24px" : "8px",
      rowGap: isParent ? "24px" : "8px",
      columnGap: isParent ? "24px" : "8px",
      gridTemplateColumns: "none",
      gridTemplateRows: "none",
      objectFit: "fill",
      objectPosition: "50% 50%",
      aspectRatio: "auto",
      maskImage: "none",
      length: 10,
      0: "font-size",
      1: "font-weight",
      2: "background-color",
      3: "border-radius",
      4: "padding",
      5: "display",
      6: "--n-fill-color",
      7: "--n-rail-color",
      8: "max-width",
      9: "transition-duration",
      getPropertyValue(name) {
        return {
          "font-size": isParent ? "18px" : "16px",
          "font-weight": "600",
          "background-color": isProgressFill ? "rgb(32, 128, 240)" : "rgb(37, 99, 235)",
          "border-radius": isProgressFill ? "10px" : "8px",
          padding: isParent ? "64px" : "10px 18px",
          display: isParent ? "flex" : "inline-flex",
          "max-width": isProgressFill ? "93%" : "none",
          "transition-duration": isProgressFill ? "0.3s" : "0s",
          "--n-fill-color": isProgressFill ? "rgb(32, 128, 240)" : "",
          "--n-rail-color": isProgressFill ? "rgb(235, 235, 235)" : ""
        }[name] ?? "";
      }
    };
  }
};

globalThis.document = {
  title: "Prototype",
  location: {
    href: "https://example.com/prototype"
  },
  documentElement: {
    clientWidth: 1440,
    clientHeight: 900
  }
};

const reference = extractReferenceFromElement(createElementStub());
const noChildrenReference = extractReferenceFromElement(createElementStub(), { childLimit: 0 });
const iconReferenceDisabled = extractReferenceFromElement(createElementStub(), { includeIconDetails: false });
const iconReferenceEnabled = extractReferenceFromElement(createElementStub(), { includeIconDetails: true });
const selectedIconReference = extractReferenceFromElement(createIconElementStub(), { includeIconDetails: true });

assert.equal(reference.page.url, "https://example.com/prototype");
assert.equal(reference.element.tag, "button");
assert.equal(reference.element.selector, "button#cta.primary.large");
assert.equal(reference.element.rect.width, 160);
assert.equal(reference.element.styles.font.size, "16px");
assert.equal(reference.element.styles.box.padding, "10px 18px");
assert.equal(reference.element.parent.selector, "main.hero");
assert.equal(reference.element.parent.gap, "24px");
assert.ok(reference.element.outerHTML.length < 600);
assert.equal(reference.element.fullComputedStyle["font-size"], "16px");
assert.equal(reference.element.fullComputedStyle.display, "inline-flex");
assert.equal(reference.element.children.length, 4);
const labelSnapshot = reference.element.children.find((child) => child.selector === "span.label");
const cardSnapshot = reference.element.children.find((child) => child.selector === "div.n-card.n-card--content-segmented");
const progressFillSnapshot = reference.element.children.find((child) => child.selector === "div.n-progress-graph-line-fill.n-progress-graph-line-fill--processing");
assert.equal(labelSnapshot.relativeRect.x, 12);
assert.equal(cardSnapshot.relativeRect.x, 4);
assert.equal(progressFillSnapshot.styles.background, "rgb(32, 128, 240)");
assert.equal(progressFillSnapshot.styles.backgroundImage, "linear-gradient(90deg, rgb(32, 128, 240), rgb(64, 158, 255))");
assert.equal(progressFillSnapshot.styles.maxWidth, "93%");
assert.equal(progressFillSnapshot.styles.fontFamily, "Inter, sans-serif");
assert.equal(progressFillSnapshot.styles.textAlign, "center");
assert.equal(progressFillSnapshot.styles.whiteSpace, "nowrap");
assert.equal(progressFillSnapshot.styles.textOverflow, "ellipsis");
assert.equal(progressFillSnapshot.styles.outline, "0px none rgb(255, 255, 255)");
assert.equal(progressFillSnapshot.styles.position, "relative");
assert.equal(progressFillSnapshot.styles.overflowX, "visible");
assert.equal(progressFillSnapshot.styles.columnGap, "8px");
assert.equal(progressFillSnapshot.styles.objectFit, "fill");
assert.equal(progressFillSnapshot.styles.transform, "translateX(0px)");
assert.equal(progressFillSnapshot.styles.transitionDuration, "0.3s");
assert.equal(progressFillSnapshot.styleVars["--n-fill-color"], "rgb(32, 128, 240)");
assert.equal(noChildrenReference.element.children.length, 0);
assert.equal(iconReferenceDisabled.element.iconDetails, undefined);
assert.equal(iconReferenceEnabled.element.iconDetails.length, 1);
assert.equal(iconReferenceEnabled.element.iconDetails[0].type, "svg");
assert.equal(iconReferenceEnabled.element.iconDetails[0].viewBox, "0 0 24 24");
assert.equal(iconReferenceEnabled.element.iconDetails[0].pathCount, 2);
assert.equal(selectedIconReference.element.iconDetails.length, 1);
assert.equal(selectedIconReference.element.iconDetails[0].type, "font-or-css");
assert.equal(selectedIconReference.element.iconDetails[0].selector, "i.trend-up.iconfont");
assert.equal(selectedIconReference.element.iconDetails[0].className, "trend-up iconfont");
assert.equal(selectedIconReference.element.iconDetails[0].fontFamily, "iconfont");
assert.ok(STYLE_GROUPS.font.includes("fontFamily"));
