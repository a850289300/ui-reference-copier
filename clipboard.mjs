function fallbackCopyText(text, doc) {
  if (!doc?.createElement || !doc?.execCommand) {
    return false;
  }

  const textarea = doc.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  textarea.setAttribute("readonly", "true");

  const parent = doc.body ?? doc.documentElement;
  if (!parent?.appendChild) {
    return false;
  }

  parent.appendChild(textarea);
  textarea.focus?.();
  textarea.select?.();

  try {
    return doc.execCommand("copy");
  } finally {
    textarea.remove?.();
  }
}

export async function copyText(text, options = {}) {
  const nav = options.navigator ?? globalThis.navigator;
  const doc = options.document ?? globalThis.document;
  let clipboardError = null;

  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(text);
      return;
    } catch (error) {
      clipboardError = error;
    }
  }

  if (fallbackCopyText(text, doc)) {
    return;
  }

  if (clipboardError) {
    throw clipboardError;
  }

  throw new Error("当前页面不支持自动复制，请手动复制面板中的内容。");
}
