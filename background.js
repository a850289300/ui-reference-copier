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

async function isContentReady(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => globalThis.__UI_REFERENCE_COPIER_READY__ === true
  });
  return result?.result === true;
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

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      globalThis.__UI_REFERENCE_COPIER_TOGGLE__?.();
      return true;
    }
  });
  if (result?.result !== true) {
    throw new Error("UI Reference Copier toggle did not run. Try refreshing the target page.");
  }
}

chrome.action.onClicked.addListener(async () => {
  try {
    const tab = await getActiveTab();
    if (!tab?.id || !isSupportedUrl(tab.url)) {
      return;
    }

    await ensureInjected(tab.id);
    await sendToggleMessage(tab.id);
  } catch (error) {
    console.warn("UI Reference Copier failed to toggle:", error);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  INJECTED_TABS.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    INJECTED_TABS.delete(tabId);
  }
});
