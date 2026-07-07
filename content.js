(async () => {
  if (window.__UI_REFERENCE_COPIER_BOOTED__) {
    return;
  }
  window.__UI_REFERENCE_COPIER_BOOTED__ = true;

  const [
    { extractReferenceFromElement },
    { buildMultiAiPrompt, buildMultiJson },
    { buildDiffPrompt, compareReferenceSets },
    { resolveSelectableElement, selectableParent }
  ] = await Promise.all([
    import(chrome.runtime.getURL("collector.mjs")),
    import(chrome.runtime.getURL("prompt.mjs")),
    import(chrome.runtime.getURL("diff.mjs")),
    import(chrome.runtime.getURL("selection.mjs"))
  ]);

  const BASELINE_KEY = "ui-reference-copier.baseline";
  const SETTINGS_KEY = "ui-reference-copier.settings";
  const CHILD_LIMITS = {
    compact: 20,
    standard: 50,
    detailed: 100
  };

  const state = {
    active: false,
    hovered: null,
    selected: [],
    references: [],
    baseline: null,
    lastDiff: null,
    lastCopied: "",
    panelDrag: null,
    settings: {
      childDepth: "standard"
    }
  };

  const root = document.createElement("div");
  root.id = "ui-reference-copier-root";
  root.setAttribute("data-ui-reference-copier", "true");
  root.innerHTML = `
    <div class="urc-highlight urc-hover" hidden></div>
    <div class="urc-selected-layer"></div>
    <aside class="urc-panel" hidden>
      <header class="urc-header" data-drag-handle="true">
        <div>
          <p class="urc-eyebrow">UI Reference Copier</p>
          <h2>元素复刻采集器</h2>
        </div>
        <button class="urc-icon-button" type="button" data-action="close" title="关闭">×</button>
      </header>
      <p class="urc-note">悬停高亮，点击单选；按住 Cmd / Ctrl / Shift 点击可多选，然后复制给 Codex / Claude Code。</p>
      <section class="urc-section">
        <div class="urc-section-heading">
          <p class="urc-label">当前目标</p>
          <button class="urc-mini-button" type="button" data-action="select-parent" disabled>上选父级</button>
        </div>
        <div class="urc-target">还没有选择元素</div>
      </section>
      <section class="urc-section">
        <p class="urc-label">视觉摘要</p>
        <pre class="urc-summary">点击页面中的元素开始采集。</pre>
      </section>
      <section class="urc-section">
        <label class="urc-field">
          <span class="urc-label">子元素采样</span>
          <select class="urc-select" data-setting="child-depth">
            <option value="compact">精简 · 20 个</option>
            <option value="standard" selected>标准 · 50 个</option>
            <option value="detailed">详细 · 100 个</option>
          </select>
        </label>
      </section>
      <div class="urc-actions">
        <button class="urc-primary" type="button" data-action="copy-prompt" disabled>复制给 AI</button>
        <button class="urc-secondary" type="button" data-action="copy-full-style" disabled>复制完整样式</button>
        <button class="urc-secondary" type="button" data-action="copy-json" disabled>复制 JSON</button>
      </div>
      <section class="urc-section">
        <div class="urc-section-heading">
          <p class="urc-label">跨页面对比</p>
          <span class="urc-status-pill" data-baseline-state="empty">未设置</span>
        </div>
        <div class="urc-baseline-card">
          <div class="urc-baseline-status">未设置参考</div>
          <div class="urc-baseline-meta">先在参考页选中元素并保存，再到实现页对比。</div>
        </div>
        <div class="urc-button-row">
          <button class="urc-secondary" type="button" data-action="set-baseline" disabled>设为参考</button>
          <button class="urc-secondary" type="button" data-action="clear-baseline">清除参考</button>
        </div>
        <div class="urc-button-row">
          <button class="urc-secondary" type="button" data-action="compare-baseline" disabled>对比参考</button>
          <button class="urc-primary" type="button" data-action="copy-diff" disabled>复制差异给 AI</button>
        </div>
      </section>
    </aside>
    <div class="urc-toast" role="status" hidden></div>
  `;
  document.documentElement.appendChild(root);

  const hoverBox = root.querySelector(".urc-hover");
  const selectedLayer = root.querySelector(".urc-selected-layer");
  const panel = root.querySelector(".urc-panel");
  const targetEl = root.querySelector(".urc-target");
  const summaryEl = root.querySelector(".urc-summary");
  const feedbackEl = root.querySelector(".urc-toast");
  const copyPromptButton = root.querySelector("[data-action='copy-prompt']");
  const copyFullStyleButton = root.querySelector("[data-action='copy-full-style']");
  const copyJsonButton = root.querySelector("[data-action='copy-json']");
  const baselineStatus = root.querySelector(".urc-baseline-status");
  const baselineMeta = root.querySelector(".urc-baseline-meta");
  const baselinePill = root.querySelector(".urc-status-pill");
  const setBaselineButton = root.querySelector("[data-action='set-baseline']");
  const compareBaselineButton = root.querySelector("[data-action='compare-baseline']");
  const copyDiffButton = root.querySelector("[data-action='copy-diff']");
  const childDepthSelect = root.querySelector("[data-setting='child-depth']");
  const selectParentButton = root.querySelector("[data-action='select-parent']");

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function placePanelAt(left, top) {
    const margin = 12;
    const rect = panel.getBoundingClientRect();
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);

    panel.style.left = `${clamp(left, margin, maxLeft)}px`;
    panel.style.top = `${clamp(top, margin, maxTop)}px`;
    panel.style.right = "auto";
  }

  function ensurePanelInViewport() {
    if (panel.hidden) {
      return;
    }
    const rect = panel.getBoundingClientRect();
    placePanelAt(rect.left, rect.top);
  }

  function isOwnEvent(event) {
    return event.composedPath().some((item) => item === root);
  }

  function frameStyleFor(element) {
    const rect = element.getBoundingClientRect();
    return {
      transform: `translate(${Math.round(rect.left + window.scrollX)}px, ${Math.round(rect.top + window.scrollY)}px)`,
      width: `${Math.round(rect.width)}px`,
      height: `${Math.round(rect.height)}px`
    };
  }

  function applyFrame(box, element) {
    if (!element) {
      box.hidden = true;
      return;
    }
    const style = frameStyleFor(element);
    box.hidden = false;
    box.style.transform = style.transform;
    box.style.width = style.width;
    box.style.height = style.height;
  }

  function summarize(reference) {
    const { element } = reference;
    const { rect, styles } = element;
    return [
      `来源: ${reference.page.url}`,
      `尺寸: ${rect.width} x ${rect.height} @ (${rect.x}, ${rect.y})`,
      `字体: ${styles.font.family}; ${styles.font.size}; weight ${styles.font.weight}; line-height ${styles.font.lineHeight}`,
      `颜色: ${styles.color.text} on ${styles.color.background}`,
      `盒模型: padding ${styles.box.padding}; margin ${styles.box.margin}`,
      `边框: ${styles.box.border}; radius ${styles.box.borderRadius}`,
      `阴影: ${styles.box.boxShadow}`,
      `布局: ${styles.box.display}; gap ${styles.layout.gap}; align ${styles.layout.alignItems}; justify ${styles.layout.justifyContent}`,
      `父级: ${element.parent?.selector ?? "(none)"}; display ${element.parent?.display ?? "(unknown)"}; gap ${element.parent?.gap ?? "(unknown)"}`
    ].join("\n");
  }

  async function loadBaseline() {
    const result = await chrome.storage.local.get(BASELINE_KEY);
    state.baseline = result[BASELINE_KEY] ?? null;
    renderBaselineStatus();
  }

  async function loadSettings() {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    state.settings = {
      ...state.settings,
      ...(result[SETTINGS_KEY] ?? {})
    };
    if (!CHILD_LIMITS[state.settings.childDepth]) {
      state.settings.childDepth = "standard";
    }
    childDepthSelect.value = state.settings.childDepth;
  }

  async function saveSettings(nextSettings) {
    state.settings = {
      ...state.settings,
      ...nextSettings
    };
    await chrome.storage.local.set({ [SETTINGS_KEY]: state.settings });
  }

  async function saveBaseline() {
    const baseline = {
      savedAt: new Date().toISOString(),
      page: state.references[0]?.page ?? null,
      references: state.references
    };
    await chrome.storage.local.set({ [BASELINE_KEY]: baseline });
    state.baseline = baseline;
    state.lastDiff = null;
    renderBaselineStatus();
  }

  async function clearBaseline() {
    await chrome.storage.local.remove(BASELINE_KEY);
    state.baseline = null;
    state.lastDiff = null;
    renderBaselineStatus();
  }

  function renderBaselineStatus() {
    if (!state.baseline) {
      baselineStatus.textContent = "未设置参考";
      baselineMeta.textContent = "先在参考页选择元素并点击「设为参考」。";
      baselinePill.textContent = "未设置";
      baselinePill.dataset.baselineState = "empty";
      compareBaselineButton.disabled = true;
      copyDiffButton.disabled = true;
      return;
    }

    const page = state.baseline.page;
    baselineStatus.textContent = `已保存 ${state.baseline.references.length} 个参考元素`;
    baselineMeta.textContent = page?.url ?? "(未知页面)";
    baselinePill.textContent = state.lastDiff ? "已对比" : "已保存";
    baselinePill.dataset.baselineState = state.lastDiff ? "compared" : "saved";
    compareBaselineButton.disabled = state.references.length === 0;
    copyDiffButton.disabled = !state.lastDiff;
  }

  function setFeedback(message, kind = "success") {
    feedbackEl.hidden = false;
    feedbackEl.textContent = message;
    feedbackEl.dataset.kind = kind;
    window.setTimeout(() => {
      if (feedbackEl.textContent === message) {
        feedbackEl.textContent = "";
        feedbackEl.hidden = true;
        delete feedbackEl.dataset.kind;
      }
    }, kind === "error" ? 3200 : 1800);
  }

  function renderSelection() {
    selectedLayer.innerHTML = "";
    state.selected.forEach((element, index) => {
      const box = document.createElement("div");
      box.className = "urc-highlight urc-selected";
      box.dataset.index = String(index + 1);
      selectedLayer.appendChild(box);
      applyFrame(box, element);
    });

    const references = state.references;

    if (references.length === 0) {
      targetEl.textContent = "还没有选择元素";
      summaryEl.textContent = "点击页面中的元素开始采集。";
      copyPromptButton.disabled = true;
      copyFullStyleButton.disabled = true;
      copyJsonButton.disabled = true;
      setBaselineButton.disabled = true;
      selectParentButton.disabled = true;
      compareBaselineButton.disabled = true;
      copyDiffButton.disabled = true;
      return;
    }

    const primary = references[references.length - 1];
    const { element } = primary;
    targetEl.replaceChildren();
    const countNode = document.createElement("strong");
    countNode.textContent = `已选择 ${references.length} 个元素`;
    const summaryNode = document.createElement("span");
    summaryNode.textContent = `${element.selector}${element.text ? ` · ${element.text}` : ""}`;
    targetEl.append(countNode, summaryNode);
    summaryEl.textContent = references.length === 1
      ? summarize(primary)
      : [
          `已选择 ${references.length} 个元素。`,
          "普通点击会替换选择；Cmd / Ctrl / Shift 点击可追加或取消选择。",
          "",
          ...references.map((item, index) => {
            const rect = item.element.rect;
            return `${index + 1}. ${item.element.selector} | ${rect.width} x ${rect.height} @ (${rect.x}, ${rect.y}) | ${item.element.text || item.element.tag}`;
          })
        ].join("\n");
    copyPromptButton.disabled = false;
    copyFullStyleButton.disabled = false;
    copyJsonButton.disabled = false;
    setBaselineButton.disabled = false;
    selectParentButton.disabled = !state.selected.some((element) => selectableParent(element));
    compareBaselineButton.disabled = !state.baseline;
    copyDiffButton.disabled = !state.lastDiff;
    renderBaselineStatus();
  }

  function setSelection(element, additive) {
    const options = {
      childLimit: CHILD_LIMITS[state.settings.childDepth] ?? CHILD_LIMITS.standard
    };

    if (!additive) {
      state.selected = [element];
      state.references = [extractReferenceFromElement(element, options)];
      return;
    }

    const existingIndex = state.selected.indexOf(element);
    if (existingIndex >= 0) {
      state.selected.splice(existingIndex, 1);
      state.references.splice(existingIndex, 1);
      return;
    }

    state.selected.push(element);
    state.references.push(extractReferenceFromElement(element, options));
  }

  function replaceSelectionAt(index, element) {
    const options = {
      childLimit: CHILD_LIMITS[state.settings.childDepth] ?? CHILD_LIMITS.standard
    };
    state.selected[index] = element;
    state.references[index] = extractReferenceFromElement(element, options);
    state.lastDiff = null;
  }

  function selectParentForCurrentSelection() {
    if (state.selected.length === 0) {
      return false;
    }
    const index = state.selected.length - 1;
    const parent = selectableParent(state.selected[index]);
    if (!parent) {
      return false;
    }
    replaceSelectionAt(index, parent);
    return true;
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.setAttribute("readonly", "true");
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function activate() {
    state.active = true;
    panel.hidden = false;
    ensurePanelInViewport();
    document.documentElement.classList.add("urc-active-page");
    setFeedback("采集模式已开启，点击一个参考元素。");
  }

  function deactivate() {
    state.active = false;
    hoverBox.hidden = true;
    state.hovered = null;
    state.selected = [];
    state.references = [];
    state.lastDiff = null;
    selectedLayer.innerHTML = "";
    panel.hidden = true;
    document.documentElement.classList.remove("urc-active-page");
    renderSelection();
  }

  function toggle() {
    if (state.active) {
      deactivate();
    } else {
      activate();
    }
  }

  document.addEventListener(
    "mousemove",
    (event) => {
      if (!state.active || isOwnEvent(event)) {
        return;
      }
      state.hovered = resolveSelectableElement(
        event.target,
        { x: event.clientX, y: event.clientY }
      );
      applyFrame(hoverBox, state.hovered);
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
      if (!state.active || isOwnEvent(event)) {
        return;
      }
      const element = resolveSelectableElement(
        event.target,
        { x: event.clientX, y: event.clientY }
      );
      if (!element) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setSelection(element, event.metaKey || event.ctrlKey || event.shiftKey);
      renderSelection();
      setFeedback(state.references.length > 1 ? `已选择 ${state.references.length} 个元素。` : "已采集元素，可复制给 AI。");
    },
    true
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && state.active) {
        deactivate();
      }
    },
    true
  );

  root.addEventListener("click", async (event) => {
    const action = event.target?.closest?.("[data-action]")?.dataset.action;
    if (!action) {
      return;
    }

    if (action === "close") {
      deactivate();
      return;
    }

    if (action === "clear-baseline") {
      try {
        await clearBaseline();
        setFeedback("已清除参考。");
      } catch (error) {
        setFeedback(`清除失败：${error instanceof Error ? error.message : "未知错误"}`, "error");
      }
      return;
    }

    if (action === "copy-diff") {
      if (!state.lastDiff) {
        setFeedback("请先对比参考。", "error");
        return;
      }
      try {
        await copyText(buildDiffPrompt(state.lastDiff));
        setFeedback("已复制差异提示词到剪贴板。");
      } catch (error) {
        setFeedback(`复制失败：${error instanceof Error ? error.message : "未知错误"}`, "error");
      }
      return;
    }

    if (action === "select-parent") {
      if (!selectParentForCurrentSelection()) {
        setFeedback("当前元素没有可选父级。", "error");
        return;
      }
      renderSelection();
      setFeedback("已切换到父级元素。");
      return;
    }

    if (state.references.length === 0) {
      setFeedback("请先选择一个元素。", "error");
      return;
    }

    try {
      if (action === "copy-prompt") {
        await copyText(buildMultiAiPrompt(state.references));
        setFeedback("已复制给 AI 的提示词到剪贴板。");
      }
      if (action === "copy-full-style") {
        await copyText(buildMultiAiPrompt(state.references, "Codex / Claude Code", { includeFullComputedStyle: true }));
        setFeedback("已复制完整样式提示词到剪贴板。");
      }
      if (action === "copy-json") {
        await copyText(buildMultiJson(state.references));
        setFeedback("已复制 JSON 到剪贴板。");
      }
      if (action === "set-baseline") {
        await saveBaseline();
        setFeedback(`已保存 ${state.references.length} 个参考元素，可切换页面对比。`);
      }
      if (action === "compare-baseline") {
        if (!state.baseline) {
          setFeedback("请先设置参考。", "error");
          return;
        }
        state.lastDiff = compareReferenceSets(state.baseline.references, state.references);
        copyDiffButton.disabled = false;
        summaryEl.textContent = buildDiffPrompt(state.lastDiff);
        setFeedback("已生成差异报告，可复制给 AI。");
      }
    } catch (error) {
      setFeedback(`复制失败：${error instanceof Error ? error.message : "未知错误"}`, "error");
    }
  });

  childDepthSelect.addEventListener("change", () => {
    void saveSettings({ childDepth: childDepthSelect.value }).then(() => {
      state.lastDiff = null;
      renderBaselineStatus();
      setFeedback("已更新子元素采样设置，下一次选择元素时生效。");
    });
  });

  root.addEventListener("pointerdown", (event) => {
    if (event.target?.closest?.("[data-action]")) {
      return;
    }
    const handle = event.target?.closest?.("[data-drag-handle='true']");
    if (!handle) {
      return;
    }
    const rect = panel.getBoundingClientRect();
    state.panelDrag = {
      startX: event.clientX,
      startY: event.clientY,
      originLeft: rect.left,
      originTop: rect.top
    };
    panel.setPointerCapture?.(event.pointerId);
    panel.classList.add("is-dragging");
    event.preventDefault();
  });

  root.addEventListener("pointermove", (event) => {
    if (!state.panelDrag) {
      return;
    }
    placePanelAt(
      state.panelDrag.originLeft + event.clientX - state.panelDrag.startX,
      state.panelDrag.originTop + event.clientY - state.panelDrag.startY
    );
  });

  root.addEventListener("pointerup", (event) => {
    if (!state.panelDrag) {
      return;
    }
    state.panelDrag = null;
    panel.releasePointerCapture?.(event.pointerId);
    panel.classList.remove("is-dragging");
  });

  window.addEventListener("resize", ensurePanelInViewport);

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "ui-reference-copier/toggle") {
      toggle();
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }
    if (changes[BASELINE_KEY]) {
      state.baseline = changes[BASELINE_KEY].newValue ?? null;
      state.lastDiff = null;
      renderBaselineStatus();
    }
    if (changes[SETTINGS_KEY]) {
      state.settings = {
        ...state.settings,
        ...(changes[SETTINGS_KEY].newValue ?? {})
      };
      if (childDepthSelect.value !== state.settings.childDepth) {
        childDepthSelect.value = state.settings.childDepth;
      }
    }
  });

  void Promise.all([loadBaseline(), loadSettings()]);
})();
