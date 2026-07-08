const INJECTED_TABS = new Set();

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isSupportedUrl(url = "") {
  return /^https?:\/\//.test(url) || /^file:\/\//.test(url);
}

async function ensureInjected(tabId) {
  if (INJECTED_TABS.has(tabId)) {
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

async function sendToggleMessage(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "ui-reference-copier/toggle" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Receiving end does not exist")) {
      throw error;
    }
    INJECTED_TABS.delete(tabId);
    await ensureInjected(tabId);
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
