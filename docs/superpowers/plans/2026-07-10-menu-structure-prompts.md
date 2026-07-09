# Menu Structure Prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add generic menu/navigation semantic summaries to structure comparison prompts so AI tools preserve the current project's menu component while syncing menu content and hierarchy.

**Architecture:** Keep the existing structure scoring intact. Add menu semantic detection and summary helpers inside `structure.mjs`, then inject semantic lines into compact and detailed structure prompts only when a pair looks like a menu/navigation component.

**Tech Stack:** Chrome MV3 extension, plain JavaScript ES modules, Node test runner via `node tests/run.mjs`.

---

### Task 1: Menu Prompt Tests

**Files:**
- Modify: `/Users/chuanbao/Documents/Codex/2026-07-06/zhe/outputs/ui-reference-copier/tests/structure.test.mjs`

- [x] **Step 1: Add a failing test for generic menu semantic prompts**

Create reference/current menu-like structures with different DOM tags and menu items. Assert compact prompt includes:
- `组件语义差异`
- `菜单/导航`
- keep current project menu component wording
- reference/current menu semantic summaries
- missing/extra menu item signals

- [x] **Step 2: Add a non-menu guard assertion**

Assert existing card prompt does not include menu-specific wording.

### Task 2: Structure Menu Semantics

**Files:**
- Modify: `/Users/chuanbao/Documents/Codex/2026-07-06/zhe/outputs/ui-reference-copier/structure.mjs`

- [x] **Step 1: Add generic menu detection**

Detect menu/navigation from selector, DOM path, tag, role counts, and child text patterns without binding to a specific UI library.

- [x] **Step 2: Add menu semantic extraction**

Extract concise menu item labels from sampled children, estimate indentation levels from relative x position, and compute missing/extra labels.

- [x] **Step 3: Add prompt formatting**

Inject `## 组件语义差异` into compact and detailed prompts when any pair has menu semantics.

- [x] **Step 4: Preserve detailed DOM diagnostics**

Keep the existing detailed tag/role/selector/DOM path sections.

### Task 3: Documentation and Verification

**Files:**
- Create: `/Users/chuanbao/Documents/Codex/2026-07-06/zhe/outputs/ui-reference-copier/docs/IMPLEMENTATION.md`
- Modify: `/Users/chuanbao/Documents/Codex/2026-07-06/zhe/outputs/ui-reference-copier/README.md`
- Modify: `/Users/chuanbao/Documents/Codex/2026-07-06/zhe/outputs/ui-reference-copier/openspec/changes/improve-menu-structure-prompts/tasks.md`

- [x] **Step 1: Document implementation**

Describe the structure comparison pipeline and menu semantic prompt optimization.

- [x] **Step 2: Update README**

Add user-facing notes explaining menu/navigation semantic comparison.

- [x] **Step 3: Run verification**

Run:

```bash
npm test && npm run check && npm run pack
```

Expected: all commands exit 0.
