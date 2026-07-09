(async () => {
  window.__UI_REFERENCE_COPIER_ABORT__?.abort?.();
  const lifecycle = new AbortController();
  window.__UI_REFERENCE_COPIER_ABORT__ = lifecycle;

  const [
    { extractReferenceFromElement },
    { buildMultiAiPrompt, buildMultiJson },
    { buildDiffPrompt, compareReferenceSets },
    { resolveSelectableElement, selectableParent },
    { describeReference, describeReferences },
    { attachCurrentToGroup, buildGroupedDiffPrompt, compareReferenceGroups, createReferenceGroup },
    { buildDetailedStructurePrompt, buildStructurePrompt, compareStructureSets }
  ] = await Promise.all([
    import(chrome.runtime.getURL("collector.mjs")),
    import(chrome.runtime.getURL("prompt.mjs")),
    import(chrome.runtime.getURL("diff.mjs")),
    import(chrome.runtime.getURL("selection.mjs")),
    import(chrome.runtime.getURL("label.mjs")),
    import(chrome.runtime.getURL("groups.mjs")),
    import(chrome.runtime.getURL("structure.mjs"))
  ]);

  const BASELINE_KEY = "ui-reference-copier.baseline";
  const GROUPS_KEY = "ui-reference-copier.groups";
  const STRUCTURE_KEY = "ui-reference-copier.structure";
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
    groups: [],
    structure: {
      reference: null,
      current: null,
      lastDiff: null
    },
    selectedGroupId: "",
    lastGroupedDiff: null,
    lastDiff: null,
    lastCopied: "",
    panelDrag: null,
    settings: {
      childDepth: "standard",
      includeIconDetails: false,
      externalReferenceMode: false,
      activeTab: "capture"
    }
  };

  const root = document.createElement("div");
  document.getElementById("ui-reference-copier-root")?.remove();
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
      <details class="urc-help">
        <summary>使用说明</summary>
        <ol>
          <li>打开参考页，点击要还原的元素。</li>
          <li>选中范围太小时，点「选择父级」。</li>
          <li>单个区域用「设为参考」和「对比参考」；可按 Cmd / Ctrl + S 快速设为参考。</li>
          <li>多个区域用「保存新参考组」和「匹配当前组」；在多组页可按 Cmd / Ctrl + S 保存组，Cmd / Ctrl + D 匹配组。</li>
          <li>如果样式差异很多，先用「结构对比」判断两个页面是不是选中了同一层级。</li>
          <li>最后复制提示词给 Codex / Claude Code 修复页面。</li>
        </ol>
      </details>
      <nav class="urc-tabs" aria-label="功能切换">
        <button class="urc-tab-button" type="button" data-action="set-tab" data-tab="capture">采集</button>
        <button class="urc-tab-button" type="button" data-action="set-tab" data-tab="compare">单组对比</button>
        <button class="urc-tab-button" type="button" data-action="set-tab" data-tab="groups">多组对比</button>
        <button class="urc-tab-button" type="button" data-action="set-tab" data-tab="structure">结构对比</button>
      </nav>
      <div class="urc-tab-panel" data-tab-panel="capture">
        <section class="urc-section">
        <div class="urc-section-heading">
          <p class="urc-label">当前目标</p>
          <button class="urc-mini-button" type="button" data-action="select-parent" disabled>选择父级</button>
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
        <label class="urc-toggle-field">
          <input type="checkbox" data-setting="include-icon-details">
          <span>采集图标细节</span>
        </label>
        <label class="urc-toggle-field">
          <input type="checkbox" data-setting="external-reference-mode">
          <span>外部参考页模式</span>
        </label>
      </section>
      <div class="urc-actions">
        <button class="urc-primary" type="button" data-action="copy-prompt" disabled>复制给 AI</button>
        <button class="urc-secondary" type="button" data-action="copy-full-style" disabled>复制完整样式</button>
        <button class="urc-secondary" type="button" data-action="copy-json" disabled>复制 JSON</button>
      </div>
      </div>
      <div class="urc-tab-panel" data-tab-panel="compare" hidden>
        <section class="urc-section">
        <div class="urc-section-heading">
          <p class="urc-label">当前选择</p>
          <button class="urc-mini-button" type="button" data-action="select-parent" disabled>选择父级</button>
        </div>
        <div class="urc-target urc-target-compact" data-compare-selection>当前未选择元素</div>
        <div class="urc-section-heading">
          <p class="urc-label">跨页面对比</p>
          <span class="urc-status-pill" data-baseline-state="empty">未设置</span>
        </div>
        <div class="urc-baseline-card">
          <div class="urc-baseline-status">未设置参考</div>
          <div class="urc-baseline-meta">先在参考页选中元素并保存，再到实现页对比。</div>
        </div>
        <div class="urc-button-row">
          <button class="urc-secondary" type="button" data-action="set-baseline" title="快捷键：Cmd / Ctrl + S" disabled>设为参考</button>
          <button class="urc-secondary" type="button" data-action="clear-baseline">清除参考</button>
        </div>
        <label class="urc-toggle-field">
          <input type="checkbox" data-setting="include-icon-details">
          <span>采集图标细节</span>
        </label>
        <div class="urc-button-row">
          <button class="urc-secondary" type="button" data-action="compare-baseline" disabled>对比参考</button>
          <button class="urc-primary" type="button" data-action="copy-diff" disabled>复制差异给 AI</button>
        </div>
        <pre class="urc-summary urc-report" data-diff-output>对比后会在这里显示差异摘要。</pre>
      </section>
      </div>
      <div class="urc-tab-panel" data-tab-panel="groups" hidden>
        <section class="urc-section">
        <div class="urc-section-heading">
          <p class="urc-label">当前选择</p>
          <button class="urc-mini-button" type="button" data-action="select-parent" disabled>选择父级</button>
        </div>
        <div class="urc-target urc-target-compact" data-group-selection>当前未选择元素</div>
        <div class="urc-section-heading">
          <p class="urc-label">多组对比</p>
          <span class="urc-status-pill" data-group-state="empty">0 组</span>
        </div>
        <div class="urc-group-card">
          <div class="urc-group-status">还没有参考组</div>
          <div class="urc-group-meta">适合分别对比访问量卡片、销售额卡片、订单量卡片等多个区域。</div>
          <select class="urc-select urc-group-select" data-group-select hidden></select>
        </div>
        <div class="urc-button-row">
          <button class="urc-secondary" type="button" data-action="add-reference-group" title="快捷键：Cmd / Ctrl + S" disabled>保存新参考组</button>
          <button class="urc-secondary" type="button" data-action="match-current-group" title="快捷键：Cmd / Ctrl + D" disabled>匹配当前组</button>
        </div>
        <label class="urc-toggle-field">
          <input type="checkbox" data-setting="include-icon-details">
          <span>采集图标细节</span>
        </label>
        <div class="urc-button-row">
          <button class="urc-secondary" type="button" data-action="compare-groups" disabled>对比全部组</button>
          <button class="urc-primary" type="button" data-action="copy-group-diff" data-detail="compact" disabled>复制精简差异</button>
        </div>
        <button class="urc-secondary urc-wide-button" type="button" data-action="copy-group-diff" data-detail="full" disabled>复制详细差异</button>
        <button class="urc-text-button" type="button" data-action="clear-groups">清空所有组</button>
        <pre class="urc-summary urc-report" data-group-diff-output>对比全部组后会在这里显示按组差异。</pre>
      </section>
      </div>
      <div class="urc-tab-panel" data-tab-panel="structure" hidden>
        <section class="urc-section">
        <div class="urc-section-heading">
          <p class="urc-label">当前选择</p>
          <button class="urc-mini-button" type="button" data-action="select-parent" disabled>选择父级</button>
        </div>
        <div class="urc-target urc-target-compact" data-structure-selection>当前未选择元素</div>
        <div class="urc-section-heading">
          <p class="urc-label">结构对比</p>
          <span class="urc-status-pill" data-structure-state="empty">未设置</span>
        </div>
        <div class="urc-structure-card">
          <div class="urc-structure-status">未设置结构参考</div>
          <div class="urc-structure-meta">用于判断两个页面是否选中了同一层级，先修 DOM / 组件 / 布局结构。</div>
        </div>
        <div class="urc-button-row">
          <button class="urc-secondary" type="button" data-action="set-structure-reference" disabled>设为结构参考</button>
          <button class="urc-secondary" type="button" data-action="set-structure-current" disabled>设为当前结构</button>
        </div>
        <label class="urc-toggle-field">
          <input type="checkbox" data-setting="include-icon-details">
          <span>采集图标细节</span>
        </label>
        <div class="urc-button-row">
          <button class="urc-secondary" type="button" data-action="compare-structure" disabled>对比结构</button>
          <button class="urc-primary" type="button" data-action="copy-structure-diff" disabled>复制结构差异点</button>
        </div>
        <button class="urc-secondary urc-wide-button" type="button" data-action="copy-structure-detail" disabled>复制详细结构数据</button>
        <button class="urc-text-button" type="button" data-action="clear-structure">清除结构对比</button>
        <pre class="urc-summary urc-report" data-structure-output>结构对比后会在这里显示层级、子元素数量和节点分布差异。</pre>
      </section>
      </div>
    </aside>
    <div class="urc-toast" role="status" hidden></div>
  `;
  document.documentElement.appendChild(root);

  const hoverBox = root.querySelector(".urc-hover");
  const selectedLayer = root.querySelector(".urc-selected-layer");
  const panel = root.querySelector(".urc-panel");
  const targetEl = root.querySelector(".urc-target");
  const compareSelectionEl = root.querySelector("[data-compare-selection]");
  const groupSelectionEl = root.querySelector("[data-group-selection]");
  const structureSelectionEl = root.querySelector("[data-structure-selection]");
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
  const diffOutputEl = root.querySelector("[data-diff-output]");
  const groupStatus = root.querySelector(".urc-group-status");
  const groupMeta = root.querySelector(".urc-group-meta");
  const groupPill = root.querySelector("[data-group-state]");
  const groupSelect = root.querySelector("[data-group-select]");
  const addReferenceGroupButton = root.querySelector("[data-action='add-reference-group']");
  const matchCurrentGroupButton = root.querySelector("[data-action='match-current-group']");
  const compareGroupsButton = root.querySelector("[data-action='compare-groups']");
  const copyGroupDiffButtons = Array.from(root.querySelectorAll("[data-action='copy-group-diff']"));
  const groupDiffOutputEl = root.querySelector("[data-group-diff-output]");
  const structureStatus = root.querySelector(".urc-structure-status");
  const structureMeta = root.querySelector(".urc-structure-meta");
  const structurePill = root.querySelector("[data-structure-state]");
  const setStructureReferenceButton = root.querySelector("[data-action='set-structure-reference']");
  const setStructureCurrentButton = root.querySelector("[data-action='set-structure-current']");
  const compareStructureButton = root.querySelector("[data-action='compare-structure']");
  const copyStructureDiffButton = root.querySelector("[data-action='copy-structure-diff']");
  const copyStructureDetailButton = root.querySelector("[data-action='copy-structure-detail']");
  const structureOutputEl = root.querySelector("[data-structure-output]");
  const childDepthSelect = root.querySelector("[data-setting='child-depth']");
  const includeIconDetailsInputs = Array.from(root.querySelectorAll("[data-setting='include-icon-details']"));
  const externalReferenceModeInput = root.querySelector("[data-setting='external-reference-mode']");
  const selectParentButtons = Array.from(root.querySelectorAll("[data-action='select-parent']"));
  const tabButtons = Array.from(root.querySelectorAll("[data-tab]"));
  const tabPanels = Array.from(root.querySelectorAll("[data-tab-panel]"));

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

  function isEditableTarget(target) {
    const element = target instanceof Element ? target : null;
    return Boolean(element?.closest("input, textarea, select, [contenteditable='true']"));
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

  async function loadGroups() {
    const result = await chrome.storage.local.get(GROUPS_KEY);
    state.groups = result[GROUPS_KEY] ?? [];
    state.selectedGroupId = state.selectedGroupId || state.groups[0]?.id || "";
    renderGroupsStatus();
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
    if (!["capture", "compare", "groups", "structure"].includes(state.settings.activeTab)) {
      state.settings.activeTab = "capture";
    }
    childDepthSelect.value = state.settings.childDepth;
    includeIconDetailsInputs.forEach((input) => {
      input.checked = Boolean(state.settings.includeIconDetails);
    });
    externalReferenceModeInput.checked = Boolean(state.settings.externalReferenceMode);
    renderActiveTab();
  }

  async function saveSettings(nextSettings) {
    state.settings = {
      ...state.settings,
      ...nextSettings
    };
    await chrome.storage.local.set({ [SETTINGS_KEY]: state.settings });
  }

  function renderActiveTab() {
    const activeTab = state.settings.activeTab;
    tabButtons.forEach((button) => {
      const active = button.dataset.tab === activeTab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    tabPanels.forEach((panelNode) => {
      panelNode.hidden = panelNode.dataset.tabPanel !== activeTab;
    });
    ensurePanelInViewport();
  }

  async function setActiveTab(tab) {
    if (!["capture", "compare", "groups", "structure"].includes(tab)) {
      return;
    }
    state.settings.activeTab = tab;
    renderActiveTab();
    await saveSettings({ activeTab: tab });
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

  function structureSnapshotFromSelection() {
    return {
      savedAt: new Date().toISOString(),
      page: state.references[0]?.page ?? null,
      references: structuredClone(state.references)
    };
  }

  async function loadStructureCompare() {
    const result = await chrome.storage.local.get(STRUCTURE_KEY);
    state.structure = {
      reference: null,
      current: null,
      lastDiff: null,
      ...(result[STRUCTURE_KEY] ?? {})
    };
    renderStructureStatus();
  }

  async function saveStructureCompare(nextStructure) {
    state.structure = {
      reference: null,
      current: null,
      lastDiff: null,
      ...nextStructure
    };
    await chrome.storage.local.set({ [STRUCTURE_KEY]: state.structure });
    renderStructureStatus();
  }

  async function setStructureReference() {
    await saveStructureCompare({
      ...state.structure,
      reference: structureSnapshotFromSelection(),
      lastDiff: null
    });
  }

  async function setStructureCurrent() {
    await saveStructureCompare({
      ...state.structure,
      current: structureSnapshotFromSelection(),
      lastDiff: null
    });
  }

  async function clearStructureCompare() {
    await chrome.storage.local.remove(STRUCTURE_KEY);
    state.structure = {
      reference: null,
      current: null,
      lastDiff: null
    };
    renderStructureStatus();
  }

  async function compareStructure() {
    if (!state.structure.reference || !state.structure.current) {
      return null;
    }
    const lastDiff = compareStructureSets(
      state.structure.reference.references,
      state.structure.current.references
    );
    await saveStructureCompare({
      ...state.structure,
      lastDiff
    });
    structureOutputEl.textContent = buildStructurePrompt(lastDiff);
    return lastDiff;
  }

  async function saveBaselineWithFeedback() {
    if (state.references.length === 0) {
      setFeedback("请先选择一个元素。", "error");
      return false;
    }
    await saveBaseline();
    setFeedback(`已保存 ${state.references.length} 个参考元素，可切换页面对比。`);
    return true;
  }

  async function saveGroups(groups) {
    state.groups = groups;
    if (!state.groups.some((group) => group.id === state.selectedGroupId)) {
      state.selectedGroupId = state.groups[0]?.id || "";
    }
    await chrome.storage.local.set({ [GROUPS_KEY]: state.groups });
    state.lastGroupedDiff = null;
    renderGroupsStatus();
  }

  async function addReferenceGroup() {
    const label = describeReferences(state.references);
    const group = createReferenceGroup(state.references, {
      name: label.title
    });
    state.selectedGroupId = group.id;
    await saveGroups([...state.groups, group]);
    return group;
  }

  async function addReferenceGroupWithFeedback() {
    if (state.references.length === 0) {
      setFeedback("请先选择一个元素。", "error");
      return null;
    }
    const group = await addReferenceGroup();
    setFeedback(`已保存参考组：${group.name}`);
    return group;
  }

  async function matchCurrentGroup() {
    const groupIndex = state.groups.findIndex((item) => item.id === state.selectedGroupId);
    const group = state.groups[groupIndex];
    if (!group) {
      return null;
    }
    const nextGroup = attachCurrentToGroup(group, state.references);
    const groups = state.groups.map((item) => item.id === group.id ? nextGroup : item);
    const nextUnmatched = [
      ...groups.slice(groupIndex + 1),
      ...groups.slice(0, groupIndex)
    ].find((item) => !item.currentReferences?.length);

    await saveGroups(groups);
    state.selectedGroupId = nextUnmatched?.id ?? nextGroup.id;
    renderGroupsStatus();
    return {
      matched: nextGroup,
      next: nextUnmatched ?? null
    };
  }

  async function matchCurrentGroupWithFeedback() {
    if (state.references.length === 0) {
      setFeedback("请先选择一个元素。", "error");
      return null;
    }
    const result = await matchCurrentGroup();
    if (!result) {
      setFeedback("请先保存一个参考组。", "error");
      return null;
    }
    setFeedback(result.next
      ? `已匹配：${result.matched.name}，已切到下一组：${result.next.name}`
      : `已匹配：${result.matched.name}，所有参考组都已匹配。`);
    return result.matched;
  }

  async function clearGroups() {
    await chrome.storage.local.remove(GROUPS_KEY);
    state.groups = [];
    state.selectedGroupId = "";
    state.lastGroupedDiff = null;
    renderGroupsStatus();
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
    const baselineLabel = describeReferences(state.baseline.references);
    baselineStatus.textContent = `已保存：${baselineLabel.title}`;
    baselineMeta.textContent = page?.url ?? "(未知页面)";
    baselinePill.textContent = state.lastDiff ? "已对比" : "已保存";
    baselinePill.dataset.baselineState = state.lastDiff ? "compared" : "saved";
    compareBaselineButton.disabled = state.references.length === 0;
    copyDiffButton.disabled = !state.lastDiff;
  }

  function renderGroupsStatus() {
    const total = state.groups.length;
    const compared = state.groups.filter((group) => group.diff).length;
    groupPill.textContent = total === 0 ? "0 组" : `${compared}/${total}`;
    groupPill.dataset.groupState = compared > 0 ? "compared" : total > 0 ? "saved" : "empty";
    groupSelect.hidden = total === 0;
    groupSelect.replaceChildren(...state.groups.map((group, index) => {
      const option = document.createElement("option");
      option.value = group.id;
      option.textContent = `${index + 1}. ${group.name}${group.diff ? " · 已匹配" : ""}`;
      return option;
    }));
    if (state.selectedGroupId) {
      groupSelect.value = state.selectedGroupId;
    }

    if (total === 0) {
      groupStatus.textContent = "还没有参考组";
      groupMeta.textContent = "适合分别对比访问量卡片、销售额卡片、订单量卡片等多个区域。";
    } else {
      const selected = state.groups.find((group) => group.id === state.selectedGroupId) ?? state.groups[0];
      groupStatus.textContent = `当前组：${selected.name}`;
      groupMeta.textContent = selected.diff
        ? `已匹配当前实现：参考 ${selected.references.length} 个 / 当前 ${selected.currentReferences.length} 个`
        : `等待匹配当前实现：参考 ${selected.references.length} 个元素`;
    }

    addReferenceGroupButton.disabled = state.references.length === 0;
    matchCurrentGroupButton.disabled = state.references.length === 0 || total === 0;
    compareGroupsButton.disabled = compared === 0;
    copyGroupDiffButtons.forEach((button) => {
      button.disabled = !state.lastGroupedDiff;
    });
  }

  function renderStructureStatus() {
    const hasReference = Boolean(state.structure.reference);
    const hasCurrent = Boolean(state.structure.current);
    const hasDiff = Boolean(state.structure.lastDiff);
    const referenceLabel = hasReference ? describeReferences(state.structure.reference.references).title : "未设置参考";
    const currentLabel = hasCurrent ? describeReferences(state.structure.current.references).title : "未设置当前结构";

    if (!hasReference && !hasCurrent) {
      structureStatus.textContent = "未设置结构参考";
      structureMeta.textContent = "分别保存参考结构和当前结构后，再对比层级、子元素和节点分布。";
      structurePill.textContent = "未设置";
      structurePill.dataset.structureState = "empty";
    } else {
      structureStatus.textContent = `参考：${referenceLabel} / 当前：${currentLabel}`;
      structureMeta.textContent = [
        state.structure.reference?.page?.url ? `参考 ${state.structure.reference.page.url}` : null,
        state.structure.current?.page?.url ? `当前 ${state.structure.current.page.url}` : null
      ].filter(Boolean).join(" | ") || "等待补齐两侧结构。";
      structurePill.textContent = hasDiff ? "已对比" : hasReference && hasCurrent ? "待对比" : "已保存";
      structurePill.dataset.structureState = hasDiff ? "compared" : hasReference && hasCurrent ? "ready" : "saved";
    }

    setStructureReferenceButton.disabled = state.references.length === 0;
    setStructureCurrentButton.disabled = state.references.length === 0;
    compareStructureButton.disabled = !hasReference || !hasCurrent;
    copyStructureDiffButton.disabled = !hasDiff;
    copyStructureDetailButton.disabled = !hasDiff;
  }

  function renderSelectionCard(container, references) {
    if (references.length === 0) {
      container.textContent = "当前未选择元素";
      return;
    }
    const label = describeReferences(references);
    container.replaceChildren();
    const badgeNode = document.createElement("span");
    badgeNode.className = "urc-target-badge";
    badgeNode.textContent = "当前选中";
    const titleNode = document.createElement("strong");
    titleNode.className = "urc-target-title";
    titleNode.textContent = label.title;
    const detailNode = document.createElement("span");
    detailNode.className = "urc-target-detail";
    detailNode.textContent = label.detail;
    container.append(badgeNode, titleNode, detailNode);
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

  function structureFeedbackKind(severity) {
    if (severity === "high") {
      return "error";
    }
    if (severity === "medium") {
      return "warning";
    }
    return "info";
  }

  function structureFeedbackMessage(structureDiff, prefix = "结构对比") {
    if (!structureDiff) {
      return `${prefix}完成。`;
    }
    if (structureDiff.severity === "high") {
      return `${prefix}：结构明显不一致，相似度 ${structureDiff.score}/100。先确认是否选错层级。`;
    }
    if (structureDiff.severity === "medium") {
      return `${prefix}：结构可能不一致，相似度 ${structureDiff.score}/100。建议确认层级。`;
    }
    return `${prefix}：结构基本一致，相似度 ${structureDiff.score}/100。可以继续修样式。`;
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
      compareSelectionEl.textContent = "当前未选择元素";
      groupSelectionEl.textContent = "当前未选择元素";
      structureSelectionEl.textContent = "当前未选择元素";
      summaryEl.textContent = "点击页面中的元素开始采集。";
      copyPromptButton.disabled = true;
      copyFullStyleButton.disabled = true;
      copyJsonButton.disabled = true;
      setBaselineButton.disabled = true;
      addReferenceGroupButton.disabled = true;
      setStructureReferenceButton.disabled = true;
      setStructureCurrentButton.disabled = true;
      selectParentButtons.forEach((button) => {
        button.disabled = true;
      });
      compareBaselineButton.disabled = true;
      copyDiffButton.disabled = true;
      matchCurrentGroupButton.disabled = state.groups.length === 0;
      renderGroupsStatus();
      renderStructureStatus();
      return;
    }

    renderSelectionCard(compareSelectionEl, references);
    renderSelectionCard(groupSelectionEl, references);
    renderSelectionCard(structureSelectionEl, references);
    const primary = references[references.length - 1];
    const { element } = primary;
    const selectionLabel = describeReferences(references);
    targetEl.replaceChildren();
    const badgeNode = document.createElement("span");
    badgeNode.className = "urc-target-badge";
    badgeNode.textContent = "当前选中";
    const titleNode = document.createElement("strong");
    titleNode.className = "urc-target-title";
    titleNode.textContent = selectionLabel.title;
    const detailNode = document.createElement("span");
    detailNode.className = "urc-target-detail";
    detailNode.textContent = selectionLabel.detail;
    const techNode = document.createElement("span");
    techNode.className = "urc-target-tech";
    techNode.textContent = references.length === 1
      ? describeReference(primary).technical
      : "按选择顺序复制和对比";
    targetEl.append(badgeNode, titleNode, detailNode, techNode);
    summaryEl.textContent = references.length === 1
      ? summarize(primary)
      : [
          `已选择 ${references.length} 个元素。`,
          "普通点击会替换选择；Cmd / Ctrl / Shift 点击可追加或取消选择。",
          "",
          ...references.map((item, index) => {
            const rect = item.element.rect;
            const label = describeReference(item);
            return `${index + 1}. ${label.name} | ${rect.width} x ${rect.height} @ (${rect.x}, ${rect.y}) | ${label.technical}`;
          })
        ].join("\n");
    copyPromptButton.disabled = false;
    copyFullStyleButton.disabled = false;
    copyJsonButton.disabled = false;
    setBaselineButton.disabled = false;
    addReferenceGroupButton.disabled = false;
    matchCurrentGroupButton.disabled = state.groups.length === 0;
    const canSelectParent = state.selected.some((element) => selectableParent(element));
    selectParentButtons.forEach((button) => {
      button.disabled = !canSelectParent;
    });
    compareBaselineButton.disabled = !state.baseline;
    copyDiffButton.disabled = !state.lastDiff;
    renderBaselineStatus();
    renderGroupsStatus();
    renderStructureStatus();
  }

  function setSelection(element, additive) {
    const options = captureOptions();

    if (!additive) {
      state.selected = [element];
      state.references = [extractReferenceFromElement(element, options)];
      state.lastDiff = null;
      state.lastGroupedDiff = null;
      return;
    }

    const existingIndex = state.selected.indexOf(element);
    if (existingIndex >= 0) {
      state.selected.splice(existingIndex, 1);
      state.references.splice(existingIndex, 1);
      state.lastDiff = null;
      state.lastGroupedDiff = null;
      return;
    }

    state.selected.push(element);
    state.references.push(extractReferenceFromElement(element, options));
    state.lastDiff = null;
    state.lastGroupedDiff = null;
  }

  function replaceSelectionAt(index, element) {
    const options = captureOptions();
    state.selected[index] = element;
    state.references[index] = extractReferenceFromElement(element, options);
    state.lastDiff = null;
    state.lastGroupedDiff = null;
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

  function captureOptions() {
    return {
      childLimit: CHILD_LIMITS[state.settings.childDepth] ?? CHILD_LIMITS.standard,
      includeIconDetails: Boolean(state.settings.includeIconDetails)
    };
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
    { capture: true, signal: lifecycle.signal }
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
    { capture: true, signal: lifecycle.signal }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && state.active) {
        deactivate();
        return;
      }
      if (!state.active || isEditableTarget(event.target)) {
        return;
      }
      const key = String(event.key || "").toLowerCase();
      if (key === "s" && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        const action = state.settings.activeTab === "groups" ? addReferenceGroupWithFeedback : saveBaselineWithFeedback;
        void action().catch((error) => {
          setFeedback(`保存失败：${error instanceof Error ? error.message : "未知错误"}`, "error");
        });
      }
      if (key === "d" && (event.metaKey || event.ctrlKey) && !event.altKey && state.settings.activeTab === "groups") {
        event.preventDefault();
        event.stopPropagation();
        void matchCurrentGroupWithFeedback().catch((error) => {
          setFeedback(`匹配失败：${error instanceof Error ? error.message : "未知错误"}`, "error");
        });
      }
    },
    { capture: true, signal: lifecycle.signal }
  );

  root.addEventListener("click", async (event) => {
    const action = event.target?.closest?.("[data-action]")?.dataset.action;
    if (!action) {
      return;
    }

    if (action === "set-tab") {
      await setActiveTab(event.target.closest("[data-tab]")?.dataset.tab);
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

    if (action === "clear-groups") {
      try {
        await clearGroups();
        setFeedback("已清空所有参考组。");
      } catch (error) {
        setFeedback(`清空失败：${error instanceof Error ? error.message : "未知错误"}`, "error");
      }
      return;
    }

    if (action === "clear-structure") {
      try {
        await clearStructureCompare();
        structureOutputEl.textContent = "结构对比后会在这里显示层级、子元素数量和节点分布差异。";
        setFeedback("已清除结构对比。");
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

    if (action === "copy-group-diff") {
      if (!state.lastGroupedDiff) {
        setFeedback("请先对比全部组。", "error");
        return;
      }
      try {
        const detail = event.target.closest("[data-detail]")?.dataset.detail === "full" ? "full" : "compact";
        await copyText(buildGroupedDiffPrompt(state.lastGroupedDiff, { detail }));
        setFeedback(detail === "full" ? "已复制详细多组差异。" : "已复制精简多组差异。");
      } catch (error) {
        setFeedback(`复制失败：${error instanceof Error ? error.message : "未知错误"}`, "error");
      }
      return;
    }

    if (action === "copy-structure-diff") {
      if (!state.structure.lastDiff) {
        setFeedback("请先对比结构。", "error");
        return;
      }
      try {
        await copyText(buildStructurePrompt(state.structure.lastDiff));
        setFeedback("已复制结构差异点提示词。");
      } catch (error) {
        setFeedback(`复制失败：${error instanceof Error ? error.message : "未知错误"}`, "error");
      }
      return;
    }

    if (action === "copy-structure-detail") {
      if (!state.structure.lastDiff) {
        setFeedback("请先对比结构。", "error");
        return;
      }
      try {
        await copyText(buildDetailedStructurePrompt(state.structure.lastDiff));
        setFeedback("已复制详细结构数据。");
      } catch (error) {
        setFeedback(`复制失败：${error instanceof Error ? error.message : "未知错误"}`, "error");
      }
      return;
    }

    if (action === "compare-structure") {
      try {
        const structureDiff = await compareStructure();
        if (!structureDiff) {
          setFeedback("请先保存结构参考和当前结构。", "error");
          return;
        }
        setFeedback(
          structureFeedbackMessage(structureDiff, "结构对比"),
          structureFeedbackKind(structureDiff.severity)
        );
      } catch (error) {
        setFeedback(`对比失败：${error instanceof Error ? error.message : "未知错误"}`, "error");
      }
      return;
    }

    if (action === "select-parent") {
      if (!selectParentForCurrentSelection()) {
        setFeedback("当前元素没有可选父级。", "error");
        return;
      }
      renderSelection();
      const label = describeReference(state.references[state.references.length - 1]);
      setFeedback(`已切换到父级：${label.name}`);
      return;
    }

    if (state.references.length === 0) {
      setFeedback("请先选择一个元素。", "error");
      return;
    }

    try {
      if (action === "copy-prompt") {
        await copyText(buildMultiAiPrompt(state.references, "Codex / Claude Code", {
          externalReferenceMode: Boolean(state.settings.externalReferenceMode)
        }));
        setFeedback("已复制给 AI 的提示词到剪贴板。");
      }
      if (action === "copy-full-style") {
        await copyText(buildMultiAiPrompt(state.references, "Codex / Claude Code", {
          includeFullComputedStyle: true,
          externalReferenceMode: Boolean(state.settings.externalReferenceMode)
        }));
        setFeedback("已复制完整样式提示词到剪贴板。");
      }
      if (action === "copy-json") {
        await copyText(buildMultiJson(state.references));
        setFeedback("已复制 JSON 到剪贴板。");
      }
      if (action === "set-baseline") {
        await saveBaselineWithFeedback();
      }
      if (action === "add-reference-group") {
        await addReferenceGroupWithFeedback();
      }
      if (action === "match-current-group") {
        await matchCurrentGroupWithFeedback();
      }
      if (action === "set-structure-reference") {
        await setStructureReference();
        setFeedback(`已保存结构参考：${describeReferences(state.references).title}`);
      }
      if (action === "set-structure-current") {
        await setStructureCurrent();
        setFeedback(`已保存当前结构：${describeReferences(state.references).title}`);
      }
      if (action === "compare-baseline") {
        if (!state.baseline) {
          setFeedback("请先设置参考。", "error");
          return;
        }
        state.lastDiff = compareReferenceSets(state.baseline.references, state.references);
        copyDiffButton.disabled = false;
        diffOutputEl.textContent = buildDiffPrompt(state.lastDiff);
        setFeedback(
          structureFeedbackMessage(state.lastDiff.structure, "已生成差异报告"),
          structureFeedbackKind(state.lastDiff.structure?.severity)
        );
      }
      if (action === "compare-groups") {
        state.lastGroupedDiff = compareReferenceGroups(state.groups);
        copyGroupDiffButtons.forEach((button) => {
          button.disabled = false;
        });
        groupDiffOutputEl.textContent = buildGroupedDiffPrompt(state.lastGroupedDiff);
        renderGroupsStatus();
        const severities = state.lastGroupedDiff.groups
          .map((group) => group.diff?.structure?.severity)
          .filter(Boolean);
        const worstSeverity = severities.includes("high") ? "high" : severities.includes("medium") ? "medium" : "low";
        const comparedCount = severities.length;
        setFeedback(
          worstSeverity === "high"
            ? `多组对比完成：${comparedCount} 组里有结构明显不一致，先确认层级或补布局。`
            : worstSeverity === "medium"
              ? `多组对比完成：${comparedCount} 组里有结构可能不一致，建议确认层级。`
              : `多组对比完成：${comparedCount} 组结构基本一致，可以继续修样式。`,
          structureFeedbackKind(worstSeverity)
        );
      }
    } catch (error) {
      setFeedback(`复制失败：${error instanceof Error ? error.message : "未知错误"}`, "error");
    }
  }, { signal: lifecycle.signal });

  groupSelect.addEventListener("change", () => {
    state.selectedGroupId = groupSelect.value;
    renderGroupsStatus();
  }, { signal: lifecycle.signal });

  childDepthSelect.addEventListener("change", () => {
    void saveSettings({ childDepth: childDepthSelect.value }).then(() => {
      state.lastDiff = null;
      renderBaselineStatus();
      setFeedback("已更新子元素采样设置，下一次选择元素时生效。");
    });
  }, { signal: lifecycle.signal });

  includeIconDetailsInputs.forEach((input) => {
    input.addEventListener("change", () => {
      const enabled = input.checked;
      includeIconDetailsInputs.forEach((item) => {
        item.checked = enabled;
      });
      void saveSettings({ includeIconDetails: enabled }).then(() => {
        state.lastDiff = null;
        state.lastGroupedDiff = null;
        renderBaselineStatus();
        renderGroupsStatus();
        setFeedback(enabled ? "已开启图标细节采集，下一次选择并保存/匹配元素时生效。" : "已关闭图标细节采集。");
      });
    }, { signal: lifecycle.signal });
  });

  externalReferenceModeInput.addEventListener("change", () => {
    void saveSettings({ externalReferenceMode: externalReferenceModeInput.checked }).then(() => {
      setFeedback(externalReferenceModeInput.checked
        ? "已开启外部参考页模式，复制提示词会提醒不要照搬参考类名。"
        : "已关闭外部参考页模式。");
    });
  }, { signal: lifecycle.signal });

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
  }, { signal: lifecycle.signal });

  root.addEventListener("pointermove", (event) => {
    if (!state.panelDrag) {
      return;
    }
    placePanelAt(
      state.panelDrag.originLeft + event.clientX - state.panelDrag.startX,
      state.panelDrag.originTop + event.clientY - state.panelDrag.startY
    );
  }, { signal: lifecycle.signal });

  root.addEventListener("pointerup", (event) => {
    if (!state.panelDrag) {
      return;
    }
    state.panelDrag = null;
    panel.releasePointerCapture?.(event.pointerId);
    panel.classList.remove("is-dragging");
  }, { signal: lifecycle.signal });

  window.addEventListener("resize", ensurePanelInViewport, { signal: lifecycle.signal });

  const runtimeMessageListener = (message, _sender, sendResponse) => {
    if (message?.type === "ui-reference-copier/ping") {
      sendResponse({ ready: true });
      return false;
    }
    if (message?.type === "ui-reference-copier/toggle") {
      toggle();
      sendResponse({ toggled: true });
    }
    return false;
  };
  chrome.runtime.onMessage.addListener(runtimeMessageListener);

  const storageChangedListener = (changes, areaName) => {
    if (areaName !== "local") {
      return;
    }
    if (changes[BASELINE_KEY]) {
      state.baseline = changes[BASELINE_KEY].newValue ?? null;
      state.lastDiff = null;
      renderBaselineStatus();
    }
    if (changes[GROUPS_KEY]) {
      state.groups = changes[GROUPS_KEY].newValue ?? [];
      if (!state.groups.some((group) => group.id === state.selectedGroupId)) {
        state.selectedGroupId = state.groups[0]?.id || "";
      }
      state.lastGroupedDiff = null;
      renderGroupsStatus();
    }
    if (changes[STRUCTURE_KEY]) {
      state.structure = {
        reference: null,
        current: null,
        lastDiff: null,
        ...(changes[STRUCTURE_KEY].newValue ?? {})
      };
      renderStructureStatus();
      structureOutputEl.textContent = state.structure.lastDiff
        ? buildStructurePrompt(state.structure.lastDiff)
        : "结构对比后会在这里显示层级、子元素数量和节点分布差异。";
    }
    if (changes[SETTINGS_KEY]) {
      state.settings = {
        ...state.settings,
        ...(changes[SETTINGS_KEY].newValue ?? {})
      };
      if (childDepthSelect.value !== state.settings.childDepth) {
        childDepthSelect.value = state.settings.childDepth;
      }
      includeIconDetailsInputs.forEach((input) => {
        input.checked = Boolean(state.settings.includeIconDetails);
      });
      externalReferenceModeInput.checked = Boolean(state.settings.externalReferenceMode);
      renderActiveTab();
    }
  };
  chrome.storage.onChanged.addListener(storageChangedListener);

  lifecycle.signal.addEventListener("abort", () => {
    chrome.runtime.onMessage.removeListener(runtimeMessageListener);
    chrome.storage.onChanged.removeListener(storageChangedListener);
    document.documentElement.classList.remove("urc-active-page");
    root.remove();
  }, { once: true });

  void Promise.all([loadBaseline(), loadGroups(), loadStructureCompare(), loadSettings()]);
})();
