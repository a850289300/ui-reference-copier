const INJECTED_TABS = new Set();

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isSupportedUrl(url = "") {
  return /^https?:\/\//.test(url) || /^file:\/\//.test(url);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isReceivingEndError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Receiving end does not exist") ||
    message.includes("Could not establish connection") ||
    message.includes("No receiving end");
}

async function ensureInjected(tabId, options = {}) {
  if (!options.force && INJECTED_TABS.has(tabId)) {
    return;
  }

  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ["content.css"]
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });

  INJECTED_TABS.add(tabId);
}

async function pingContent(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "ui-reference-copier/ping" });
    return response?.ready === true;
  } catch (error) {
    if (isReceivingEndError(error)) {
      return false;
    }
    throw error;
  }
}

async function waitForContentReady(tabId, attempts = 8) {
  for (let index = 0; index < attempts; index += 1) {
    if (await pingContent(tabId)) {
      return true;
    }
    await sleep(80);
  }
  return false;
}

async function sendToggleMessage(tabId) {
  if (!await waitForContentReady(tabId)) {
    INJECTED_TABS.delete(tabId);
    await ensureInjected(tabId, { force: true });
    if (!await waitForContentReady(tabId)) {
      throw new Error("UI Reference Copier content script did not start. Try refreshing the target page.");
    }
  }

  try {
    await chrome.tabs.sendMessage(tabId, { type: "ui-reference-copier/toggle" });
  } catch (error) {
    if (!isReceivingEndError(error)) {
      throw error;
    }
    INJECTED_TABS.delete(tabId);
    await ensureInjected(tabId, { force: true });
    if (!await waitForContentReady(tabId)) {
      throw new Error("UI Reference Copier content script did not start after reinjection. Try refreshing the target page.");
    }
    await chrome.tabs.sendMessage(tabId, { type: "ui-reference-copier/toggle" });
  }
}

chrome.action.onClicked.addListener(async () => {
  const tab = await getActiveTab();
  if (!tab?.id || !isSupportedUrl(tab.url)) {
    return;
  }

  await ensureInjected(tab.id);
  await sendToggleMessage(tab.id);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  INJECTED_TABS.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    INJECTED_TABS.delete(tabId);
  }
});
