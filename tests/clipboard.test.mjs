import assert from "node:assert/strict";
import { copyText } from "../clipboard.mjs";

function makeDocument() {
  const appended = [];
  const doc = {
    copied: "",
    appended,
    body: {
      appendChild(node) {
        appended.push(node);
      }
    },
    createElement(tag) {
      assert.equal(tag, "textarea");
      return {
        value: "",
        style: {},
        removed: false,
        selected: false,
        focused: false,
        setAttribute(name, value) {
          this[name] = value;
        },
        focus() {
          this.focused = true;
        },
        select() {
          this.selected = true;
        },
        remove() {
          this.removed = true;
        }
      };
    },
    execCommand(command) {
      assert.equal(command, "copy");
      const node = appended.at(-1);
      assert.ok(node.selected);
      this.copied = node.value;
      return true;
    }
  };
  return doc;
}

let clipboardValue = "";
await copyText("hello", {
  navigator: {
    clipboard: {
      async writeText(text) {
        clipboardValue = text;
      }
    }
  },
  document: makeDocument()
});
assert.equal(clipboardValue, "hello");

const fallbackDocument = makeDocument();
await copyText("structure prompt", {
  navigator: {
    clipboard: {
      async writeText() {
        throw new Error("Extension context invalidated.");
      }
    }
  },
  document: fallbackDocument
});
assert.equal(fallbackDocument.copied, "structure prompt");
assert.equal(fallbackDocument.appended[0].removed, true);

await assert.rejects(
  () => copyText("cannot copy", {
    navigator: {
      clipboard: {
        async writeText() {
          throw new Error("Extension context invalidated.");
        }
      }
    },
    document: {}
  }),
  /Extension context invalidated/
);
