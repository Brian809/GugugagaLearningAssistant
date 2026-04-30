# AI Learning Assistant — 解题 / 讲题 / 错题本

## TL;DR

> **Quick Summary**: Add 3 AI-driven learning features (problem solving, problem explanation, mistake notebook) to the existing GeoGebra learning app. The `learning.tsx` tab becomes a hub, with sub-pages in a new `app/(learning)/` route group. Reuses existing LLM provider infrastructure, adds SQLite (Drizzle ORM) for the mistake notebook, and introduces streaming chat (via `DirectChatTransport` + `useChat`) for the explanation feature.
>
> **Deliverables**:
> - `app/_layout.tsx` — Root Stack layout (enables sub-page navigation)
> - `app/(learning)/` — Route group with 4 pages (hub, solve, explain, notebook)
> - `utils/solveAgent.ts` — Step-by-step problem solving agent (tool calling)
> - `utils/explainAgent.ts` — Streaming explanation (DirectChatTransport + useChat)
> - `components/ChatPanel.tsx` — Shared chat component (solve & explain modes)
> - `components/StepVisualizer.tsx` — Visual step display (formulas, reasoning)
> - `db/schema.ts` + `stores/notebookStore.ts` — Mistake notebook (Drizzle ORM + Zustand)
> - `components/NotebookList.tsx` + `components/MistakeCard.tsx`
> - Rewritten `(tabs)/learning.tsx` — Hub page with 3 feature cards
>
> **Estimated Effort**: Large (20+ tasks, ~5 waves)
> **Parallel Execution**: YES — 5 waves, up to 4 parallel tasks per wave
> **Critical Path**: Root layout → Dependencies → DB schema → Agent impl → UI → Integration

---

## Context

### Original Request
Build AI-driven learning assistant features: 解题 (problem solving), 讲题 (problem explanation), 错题本 (mistake notebook).

### Interview Summary
**Key Decisions**:
- **Architecture**: New `app/(learning)/` route group + root `app/_layout.tsx` with `<Stack>`; `learning.tsx` becomes entry hub
- **Subject**: Math-focused (consistent with existing GeoGebra)
- **Input**: Text + image (multimodal)
- **Storage**: SQLite with Drizzle ORM (`expo-sqlite` + `drizzle-orm`)
- **Web**: wa-sqlite (COEP/COOP headers)
- **解题**: Tool-calling agent with visual step display (each step shows progress, formulas, geometry changes)
- **讲题**: Streaming chat using `DirectChatTransport` + `useChat` (打字机效果)
- **解题 & 讲题**: Same `ChatPanel` component, different system prompt modes
- **错题本 fields**: Problem text, correct answer, user answer, analysis, tags, review status
- **Test strategy**: Implement → browser-use QA → unit tests

### Metis Review
**Key findings incorporated**:
- Streaming in RN needs `@ai-sdk/react` + polyfills (`structuredClone`, `TextEncoderStream`) + `DirectChatTransport` (not raw `streamText`)
- Drizzle ORM recommended for expo-sqlite (type-safe, useLiveQuery, auto-migrations)
- Root layout change is HIGH RISK — must verify all 4 tabs after adding
- COEP/COOP headers needed for SQLite on web
- Scope guardrails set: no spaced repetition v1, no export/import, no LaTeX rendering MVP

**🔍 Drizzle + Expo Go Compatibility (Verified via Official Docs + GitHub)**:
- ✅ `expo-sqlite` is part of Expo SDK — Expo Go includes it natively (no dev build needed)
- ✅ Drizzle ORM is pure TypeScript — zero native code
- ✅ The `inline-import` babel plugin for `.sql` migration files works in Expo Go build pipeline
- ✅ Compatible since `drizzle-orm@0.36.2` (fixed the `expo-sqlite/next` import path issue)
- ⚠️ Notable: Drizzle Studio (dev tools plugin) requires dev build, but that's optional — the core ORM works in Expo Go
- 📖 Reference: [Drizzle Expo SQLite Guide](https://orm.drizzle.team/docs/get-started/expo-new)

---

## Work Objectives

### Core Objective
Add 3 AI-powered learning features (problem solving, explanation, mistake notebook) to the existing app by extending the navigation architecture, reusing the LLM provider infrastructure, and adding a structured database.

### Concrete Deliverables
- `app/_layout.tsx` — Root Stack navigator
- `app/(learning)/index.tsx` — Learning hub page (3 entry cards)
- `app/(learning)/solve.tsx` — Step-by-step problem solving
- `app/(learning)/explain.tsx` — Streaming AI explanation chat
- `app/(learning)/notebook.tsx` — Mistake notebook CRUD
- `utils/solveAgent.ts` — Problem solving agent with tool calling
- `utils/explainAgent.ts` — Streaming explanation infrastructure
- `db/schema.ts` — Drizzle schema for mistakes
- `stores/notebookStore.ts` — Zustand + Drizzle store
- `components/ChatPanel.tsx` — Shared solve/explain chat component
- `components/StepVisualizer.tsx` — Step-by-step result display
- `components/NotebookList.tsx` + `MistakeCard.tsx`

### Definition of Done
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] All 5 wave completion criteria met
- [ ] Hub page shows 3 functional cards → navigate to sub-pages
- [ ] 解题: user inputs problem → sees step-by-step solution with visual progress
- [ ] 讲题: user asks question → receives streaming response with typing effect + follow-up chat
- [ ] 错题本: user can add/edit/delete/review mistakes; data persists across sessions
- [ ] All features work on web + iOS/Android
- [ ] No LLM provider → clear error state with link to settings
- [ ] browser-use QA run + all scenarios pass

### Must Have
- Root `_layout.tsx` with Stack wrapping all routes (doesn't break existing tabs)
- Working `app/(learning)/` routing with navigation from hub
- Solve agent with tool calling that outputs visible step-by-step results
- Explain agent with streaming response (DirectChatTransport/useChat)
- Mistake notebook with CRUD + Drizzle ORM persistence
- Cross-platform: web + iOS + Android
- "No provider configured" error handling in all features
- Empty states, loading states for all async operations
- TypeScript strict mode compliance

### Must NOT Have (Guardrails)
- NO modification to existing GeoGebra, Profile, or Home tab files (out of scope)
- NO modification to existing LLM provider infrastructure (reuse only)
- NO spaced repetition / SM-2 algorithm in MVP (simple review toggle only)
- NO export/import/cloud sync for mistake notebook
- NO LaTeX rendering library in MVP (plain text formulas)
- NO server-side components (all client-side AI calls)
- NO Expo Go testing expectation (dev builds required for Drizzle)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (test infra not installed in project)
- **Automated tests**: Implement → browser-use QA → add unit tests
- **Framework**: bun test + Playwright (browser-use skill)
- **Process**: Each task verified by agent-executed QA scenarios first, then unit tests added

### QA Policy
Every task MUST include agent-executed QA scenarios.

- **Frontend/UI**: Playwright (browser-use skill) — Navigate, interact, assert DOM, screenshot
- **TUI/CLI**: interactive_bash (tmux) — Run command, send keystrokes, validate output
- **API/Backend**: Bash (curl) — Send requests, assert status + response fields
- **Library/Module**: Bash (bun/node REPL) — Import, call functions, compare output

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — start immediately):
├── Task 1: Add root `_layout.tsx` with Stack [HIGH RISK — verify tabs]
├── Task 2: Create `app/(learning)/` route group + layout
├── Task 3: Install all new dependencies
├── Task 4: Create polyfills for RN streaming
└── Task 5: Define Drizzle schema + DB initialization

Wave 2 (Core Logic — MAX PARALLEL, after Wave 1):
├── Task 6: Implement mistake notebook store (Drizzle + Zustand)
├── Task 7: Implement solve agent (tool calling, step-by-step)
├── Task 8: Implement streaming infrastructure (DirectChatTransport + useChat hook)
└── Task 9: Create shared ChatPanel component (solve + explain modes)

Wave 3 (UI Components — after Wave 2):
├── Task 10: Implement StepVisualizer component
├── Task 11: Implement NotebookList + MistakeCard components
└── Task 12: Implement NotebookForm (add/edit mistake modal)

Wave 4 (Pages — after Wave 3):
├── Task 13: Build solve.tsx page (wires ChatPanel + StepVisualizer + solveAgent)
├── Task 14: Build explain.tsx page (wires ChatPanel + explain infrastructure)
└── Task 15: Build notebook.tsx page (wires NotebookList + MistakeCard + store)

Wave 5 (Integration + Polish):
├── Task 16: Rewrite learning.tsx as hub page with 3 cards
├── Task 17: Add empty states + error states + no-provider handling
├── Task 18: Cross-feature integration (解题 → save to 错题本)
└── Task 19: TypeScript strict pass + browser-use QA + unit tests

Wave FINAL (Verification):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA (unspecified-high)
└── F4: Scope fidelity check (deep)
→ Present results → Get explicit user okay

Critical Path: T1 → T2-T5 → T6-T9 → T10-T12 → T13-T15 → T16-T19 → F1-F4
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 4 (Wave 2)
```

### Dependency Matrix
- **T1**: None (start immediately) — blocks: T2
- **T2**: T1 — blocks: T13, T14, T15 (but NOT T3-T9)
- **T3**: T1 — blocks: T4, T5, T6, T7, T8
- **T4**: T3 — blocks: T8
- **T5**: T3 — blocks: T6
- **T6**: T3, T5 — blocks: T11, T12, T15
- **T7**: T3 — blocks: T9, T13
- **T8**: T3, T4 — blocks: T9, T14
- **T9**: T7, T8 — blocks: T13, T14
- **T10**: None (independent) — blocks: T13
- **T11**: T6 — blocks: T15
- **T12**: T6 — blocks: T15
- **T13**: T2, T7, T9, T10 — blocks: T16
- **T14**: T2, T8, T9 — blocks: T16
- **T15**: T2, T6, T11, T12 — blocks: T16
- **T16**: T13, T14, T15 — blocks: T17, T18, T19
- **T17**: T16 — blocks: F1-F4
- **T18**: T16 — blocks: F1-F4
- **T19**: T16 — blocks: F1-F4
- **F1-F4**: T17, T18, T19 — final verification

---

## TODOs

- [x] 1. Add root `_layout.tsx` with Stack navigator

  **What to do**:
  - Create `app/_layout.tsx` with `<Stack>` wrapping the `(tabs)` screen group
  - Configure `headerShown: false` on the Stack to preserve existing tab appearance
  - Move the existing `(tabs)/_layout.tsx` tabs into a `<Tabs>` slot screen
  - Test ALL 4 existing tabs (首页, 学习, 我的, GeoGebra) render correctly after change
  - Test on web + iOS/Android (verify no regression)

  **Must NOT do**:
  - Do NOT modify any `(tabs)/*` file content (only the routing structure changes)
  - Do NOT change tab names, icons, or order

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Navigation architecture change is high-risk; requires careful platform testing
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**: N/A

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: Task 2
  - **Blocked By**: None — start immediately

  **References**:
  - `app/(tabs)/_layout.tsx` — Existing tab layout config (must NOT change content, only nesting)
  - `package.json` — Check expo-router version for layout API
  - Expo Router docs: Stack navigator + tabs nesting pattern

  **Acceptance Criteria**:
  - [ ] `app/_layout.tsx` created with `<Stack>` containing `(tabs)` as a single screen
  - [ ] All 4 tabs render: home icon, learning tab, profile tab, geogebra tab
  - [ ] Tab navigation works: switching tabs shows correct content
  - [ ] GeoGebra page still loads WebView/canvas correctly
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Tab navigation still works after root layout change
    Tool: Playwright (browser-use)
    Preconditions: `npx expo start --web` running
    Steps:
      1. Navigate to http://localhost:8081
      2. Click each tab: 首页, 学习, 我的, GeoGebra
      3. Verify each tab shows expected content (首页 shows welcome cards, GeoGebra shows canvas)
    Expected Result: All 4 tabs render without errors
    Evidence: .sisyphus/evidence/task-1-tab-navigation.webm
  ```

  **Evidence to Capture**:
  - `task-1-tab-navigation.webm` — Screen recording of all 4 tabs working

  **Commit**: YES
  - Message: `feat(nav): add root Stack layout for sub-page navigation`
  - Files: `app/_layout.tsx`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 2. Create `app/(learning)/` route group with Stack layout

  **What to do**:
  - Create `app/(learning)/_layout.tsx` with `<Stack>` for learning sub-pages
  - Configure header styles (title, back button) consistent with app design
  - Create placeholder pages: `index.tsx` (hub), `solve.tsx`, `explain.tsx`, `notebook.tsx`
  - Each placeholder shows centered text with the page name
  - Verify routing works: `/(learning)/solve`, `/(learning)/explain`, `/(learning)/notebook`

  **Must NOT do**:
  - Do NOT hide the tab bar for sub-pages (they should push within tabs)
  - Do NOT finalize page content — these are route scaffolding only

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Boilerplate routing setup, straightforward
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (after T1)
  - **Parallel Group**: Wave 1 (with Tasks 3, 4)
  - **Blocks**: Tasks 13, 14, 15
  - **Blocked By**: Task 1

  **References**:
  - `app/(tabs)/_layout.tsx` — Stack layout pattern to follow
  - `app/(tabs)/learning.tsx` — Will be replaced later; keep as placeholder for now

  **Acceptance Criteria**:
  - [ ] `app/(learning)/_layout.tsx` created with `<Stack>` navigator
  - [ ] 4 placeholder pages created (index, solve, explain, notebook)
  - [ ] Navigating to `/solve`, `/explain`, `/notebook` shows placeholder text
  - [ ] Tab bar still visible on sub-pages
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: All learning sub-routes accessible
    Tool: Playwright (browser-use)
    Preconditions: T1 complete, `npx expo start --web` running
    Steps:
      1. Navigate to http://localhost:8081/(learning)/solve
      2. Verify placeholder text "解题" or similar appears
      3. Navigate to /(learning)/explain — verify placeholder
      4. Navigate to /(learning)/notebook — verify placeholder
      5. Navigate back to /(tabs)/learning — verify tab still works
    Expected Result: All 4 routes load without 404
    Evidence: .sisyphus/evidence/task-2-routes.webm
  ```

  **Evidence to Capture**:
  - `task-2-routes.webm`

  **Commit**: YES (groups with T1)
  - Message: `feat(nav): add learning route group with 4 sub-pages`
  - Files: `app/(learning)/_layout.tsx`, `app/(learning)/index.tsx`, `app/(learning)/solve.tsx`, `app/(learning)/explain.tsx`, `app/(learning)/notebook.tsx`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 3. Install all new dependencies

  **What to do**:
  - Run `npx expo install expo-sqlite` (project rule: use npx expo install)
  - Install Drizzle ORM + kit: `pnpm add drizzle-orm drizzle-kit`
  - Install streaming polyfills: `pnpm add @ungap/structured-clone @stardazed/streams-text-encoding`
  - Install `@ai-sdk/react`: `pnpm add @ai-sdk/react`
  - Update `metro.config.js` if needed (add `resolver.unstable_enablePackageExports: true` for `@vercel/oidc` exports)
  - Verify all imports work: `npx tsc --noEmit`

  **Must NOT do**:
  - Do NOT install with `npm install` — use `npx expo install` for expo packages, `pnpm add` for others

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Package installation is mechanical
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (after T1)
  - **Parallel Group**: Wave 1 (with T2, T4)
  - **Blocked By**: Task 1
  - **Blocks**: Tasks 4, 5, 6, 7, 8

  **References**:
  - `package.json` — Current dependency list
  - `pnpm-lock.yaml` — Lockfile to verify
  - `AGENTS.md` — Rule: "Install new packages with `npx expo install`"

  **Acceptance Criteria**:
  - [ ] `expo-sqlite` is in package.json (installed via `npx expo install expo-sqlite`)
  - [ ] `drizzle-orm` + `drizzle-kit` in devDependencies
  - [ ] `@ai-sdk/react` in dependencies
  - [ ] `@ungap/structured-clone`, `@stardazed/streams-text-encoding` in dependencies
  - [ ] `npx tsc --noEmit` passes after installation
  - [ ] Metro bundler starts without errors

  **QA Scenarios**:
  ```
  Scenario: All dependencies install and compile
    Tool: Bash
    Preconditions: Clean state
    Steps:
      1. Run `pnpm ls expo-sqlite drizzle-orm @ai-sdk/react` (verify all listed)
      2. Run `npx tsc --noEmit` (no import errors for new packages)
    Expected Result: All packages listed, TypeScript compiles
    Evidence: .sisyphus/evidence/task-3-deps.txt
  ```

  **Evidence to Capture**:
  - `task-3-deps.txt`

  **Commit**: YES
  - Message: `chore(deps): add expo-sqlite, drizzle-orm, @ai-sdk/react, streaming polyfills`
  - Files: `package.json`, `pnpm-lock.yaml`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 4. Create streaming polyfills and AI client utilities

  **What to do**:
  - Create `app/polyfills.ts` that imports polyfills at app startup:
    ```ts
    // Must be imported BEFORE anything that uses these APIs
    import "@ungap/structured-clone";
    import "@stardazed/streams-text-encoding";
    ```
  - Import `polyfills.ts` as the very first import in `app/_layout.tsx`
  - Create a shared utility `utils/createLearningClient.ts` based on the existing `createAIClient` in `geogebraAgent.ts`:
    - Export `createAIClient(provider)` — bifurcates OpenRouter vs OpenAI-compatible
    - Export `isOpenRouterProvider(provider)` — URL check
    - Export `getModelName(provider, requireMultimodal?)` — model selection
  - This utility will be shared by both solve and explain agents

  **Must NOT do**:
  - Do NOT duplicate the existing `createAIClient` from geogebraAgent — this is a separate shared instance
  - Do NOT modify `utils/geogebraAgent.ts`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Utility code, follows existing pattern
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (after T3)
  - **Parallel Group**: Wave 1 (with T2, T5)
  - **Blocks**: Task 8
  - **Blocked By**: Task 3

  **References**:
  - `utils/geogebraAgent.ts:53-70` — `createAIClient()` pattern to follow
  - `utils/geogebraAgent.ts:27-45` — `getModelName()` pattern
  - `utils/llmProviders.ts` — LLMProvider type

  **Acceptance Criteria**:
  - [ ] `app/polyfills.ts` created with correct polyfill imports
  - [ ] `app/_layout.tsx` imports polyfills as first import
  - [ ] `utils/createLearningClient.ts` exports `createAIClient`, `isOpenRouterProvider`, `getModelName`
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Polyfills and utilities work at runtime
    Tool: Bash
    Preconditions: T3 complete
    Steps:
      1. Create test file with `import "../../polyfills"` and verify bundler doesn't crash
      2. Import createLearningClient in a test; verify all exports exist
    Expected Result: Polyfills load, utilities export correctly
    Evidence: .sisyphus/evidence/task-4-utils.txt
  ```

  **Evidence to Capture**:
  - `task-4-utils.txt`

  **Commit**: YES (groups with T3)
  - Message: `feat(ai): add polyfills and shared AI client utilities`
  - Files: `app/polyfills.ts`, `app/_layout.tsx`, `utils/createLearningClient.ts`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 5. Define Drizzle schema + DB initialization for 错题本

  **What to do**:
  - Create `db/schema.ts` with Drizzle schema for mistake notebook:
    ```ts
    // MistakeRecord table
    export const mistakeRecords = sqliteTable("mistake_records", {
      id: text("id").primaryKey().$defaultFn(() => generateId()),
      problemText: text("problem_text").notNull(),
      problemImage: text("problem_image"),  // base64 or URI
      userAnswer: text("user_answer").notNull(),
      correctAnswer: text("correct_answer").notNull(),
      analysis: text("analysis"),            // AI-generated analysis
      tags: text("tags"),                    // JSON array of tag strings
      subject: text("subject"),              // "algebra", "geometry", etc.
      isReviewed: integer("is_reviewed", { mode: "boolean" }).default(false),
      reviewCount: integer("review_count").default(0),
      lastReviewedAt: integer("last_reviewed_at"),  // timestamp
      createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
      updatedAt: integer("updated_at").notNull().$defaultFn(() => Date.now()),
    });
    ```
  - **Expo Go Compatibility**: Drizzle ORM + expo-sqlite works in Expo Go (SDK 55). No dev build needed.
    - `expo-sqlite` is part of Expo SDK — Expo Go includes it natively ✅
    - Drizzle ORM is pure TypeScript — no native code ✅
    - The `inline-import` babel plugin works in Expo Go's build pipeline ✅
    - (For web: wa-sqlite via COEP/COOP headers or localStorage fallback)
  - **Babel config**: Update `babel.config.js` to add `inline-import` plugin for `.sql` migration files:
    ```js
    module.exports = function(api) {
      api.cache(true);
      return {
        presets: ['babel-preset-expo'],
        plugins: [["inline-import", { "extensions": [".sql"] }]],
      };
    };
    ```
  - **Metro config**: Create/update `metro.config.js` to add `.sql` extension:
    ```js
    const { getDefaultConfig } = require('expo/metro-config');
    const config = getDefaultConfig(__dirname);
    config.resolver.sourceExts.push('sql');
    module.exports = config;
    ```
  - Create `db/index.ts` with DB initialization + migrations (per Drizzle official Expo guide):
    ```ts
    import * as SQLite from 'expo-sqlite';
    import { drizzle } from 'drizzle-orm/expo-sqlite';
    import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
    import migrations from '../drizzle/migrations';

    const expoDb = SQLite.openDatabaseSync('learning.db');
    export const db = drizzle(expoDb);
    export { useMigrations };
    ```
  - Create `drizzle.config.ts` for drizzle-kit:
    ```ts
    import { defineConfig } from 'drizzle-kit';
    export default defineConfig({
      schema: './db/schema.ts',
      out: './drizzle',
      dialect: 'sqlite',
      driver: 'expo',
    });
    ```
  - Generate initial migration: `npx drizzle-kit generate`
  - Create `db/migrate.ts` wrapper that calls `useMigrations` on app startup

  **Must NOT do**:
  - Do NOT use complex relationships (single table is fine for MVP)
  - Do NOT add SM-2 algorithm fields (reviewCount is enough)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Schema definition + boilerplate DB setup
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (after T3)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 6
  - **Blocked By**: Task 3

  **References**:
  - `utils/llmProviders.ts:35-53` — Zod schema pattern (Drizzle is separate but concept similar)
  - Drizzle ORM docs: `https://orm.drizzle.team/docs/get-started/expo-sqlite`
  - expo-sqlite docs: Expo 55 SQLite API

  **Acceptance Criteria**:
  - [ ] `db/schema.ts` defines `mistakeRecords` table with all required columns
  - [ ] `db/index.ts` initializes and exports `db` Drizzle instance
  - [ ] `db/migrate.ts` creates table on first run
  - [ ] `drizzle.config.ts` configured for drizzle-kit migrations
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: DB initializes and creates table
    Tool: Bash (with bun test or node repl)
    Preconditions: T3 complete, `db/` directory created
    Steps:
      1. Import db instance, run migration
      2. Query: SELECT name FROM sqlite_master WHERE type='table'
      3. Verify `mistake_records` table exists
    Expected Result: Table created successfully
    Evidence: .sisyphus/evidence/task-5-db-init.txt

  Scenario: Schema correctly validates types
    Tool: Bash
    Steps: Run `npx tsc --noEmit` on db/schema.ts
    Expected Result: No type errors
    Evidence: .sisyphus/evidence/task-5-schema-valid.txt
  ```

  **Evidence to Capture**:
  - `task-5-db-init.txt`

  **Commit**: YES
  - Message: `feat(db): add Drizzle schema and initialization for mistake notebook`
  - Files: `db/schema.ts`, `db/index.ts`, `db/migrate.ts`, `drizzle.config.ts`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 6. Implement mistake notebook store (Drizzle + Zustand)

  **What to do**:
  - Create `stores/notebookStore.ts` with Zustand:
    ```ts
    interface NotebookState {
      records: MistakeRecord[];
      isLoading: boolean;
      error: string | null;
      filter: { subject?: string; isReviewed?: boolean; tag?: string };
      
      // Actions
      loadRecords: () => Promise<void>;
      addRecord: (record: NewMistakeRecord) => Promise<void>;
      updateRecord: (id: string, updates: Partial<MistakeRecord>) => Promise<void>;
      deleteRecord: (id: string) => Promise<void>;
      toggleReviewed: (id: string) => Promise<void>;
      setFilter: (filter: Partial<NotebookState['filter']>) => void;
      searchRecords: (query: string) => Promise<void>;
    }
    ```
  - All CRUD operations go through Drizzle ORM queries (not key-value storage)
  - Follow existing Zustand pattern: optimistic set() + await db operation
  - Export convenience hooks: `useNotebookRecords`, `useNotebookLoading`, `useNotebookFilter`
  - Web fallback: if wa-sqlite not available, fall back to localStorage serialization (wrap Drizzle calls in try/catch)

  **Must NOT do**:
  - Do NOT wrap Drizzle in the old `storage.ts` pattern — keep DB access in the store
  - Do NOT add search fuzzy matching in MVP (basic SQL LIKE query is fine)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Drizzle integration with Zustand; web fallback logic
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (after T3, T5)
  - **Parallel Group**: Wave 2 (with T7, T8)
  - **Blocks**: Tasks 11, 12, 15
  - **Blocked By**: Tasks 3, 5

  **References**:
  - `stores/llmProviderStore.ts:27-32` — Zustand store shape to follow
  - `stores/llmProviderStore.ts:197-201` — Convenience hook pattern
  - `db/schema.ts` — Created in T5, MistakeRecord type
  - Drizzle ORM `useLiveQuery` — For reactive UI updates

  **Acceptance Criteria**:
  - [ ] `stores/notebookStore.ts` created with CRUD actions + filter/search
  - [ ] `useNotebookRecords`, `useNotebookLoading`, `useNotebookFilter` exported
  - [ ] addRecord writes to SQLite via Drizzle
  - [ ] loadRecords reads from SQLite and hydrates state
  - [ ] deleteRecord removes from SQLite
  - [ ] toggleReviewed updates isReviewed + reviewCount + lastReviewedAt
  - [ ] Web fallback: if wa-sqlite unavailable, uses localStorage
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Add and retrieve a mistake record
    Tool: Bash (bun repl)
    Preconditions: T5 complete, store initialized
    Steps:
      1. Import store and call addRecord with test data
      2. Call loadRecords
      3. Verify record appears with correct fields
    Expected Result: Record persisted to SQLite and retrievable
    Evidence: .sisyphus/evidence/task-6-crud-add.txt

  Scenario: Delete a mistake record
    Tool: Bash
    Steps:
      1. Add two records, delete one
      2. Load all records
      3. Verify only one record remains
    Expected Result: Deletion works correctly
    Evidence: .sisyphus/evidence/task-6-crud-delete.txt

  Scenario: Toggle review status
    Tool: Bash
    Steps:
      1. Add a record, verify isReviewed=false
      2. Call toggleReviewed(id)
      3. Verify isReviewed=true, reviewCount=1, lastReviewedAt set
    Expected Result: Review toggle updates correctly
    Evidence: .sisyphus/evidence/task-6-review.txt
  ```

  **Evidence to Capture**:
  - `task-6-crud-add.txt`, `task-6-crud-delete.txt`, `task-6-review.txt`

  **Commit**: YES
  - Message: `feat(store): add mistake notebook store with Drizzle CRUD`
  - Files: `stores/notebookStore.ts`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 7. Implement solve agent (step-by-step tool calling for math problem solving)

  **What to do**:
  - Create `utils/solveAgent.ts` — step-by-step math problem solving agent
  - **AI Pattern**: Follow `geogebraAgent.ts` tool-calling loop with 2 tools:
    1. `execute_solve_step` — inputs: `{ stepNumber, description, expression?, result?, latexFormula?, geogebraCommand? }`
    2. `complete_solve_task` — inputs: `{ finalAnswer, steps: [], solutionType }`
  - **System prompt** (in Chinese, ~80+ lines):
    - Role: "你是一个专业的数学解题助手，逐步展示解题过程"
    - Execution rules: numbered must-follow rules
    - Step format: each step must include description + optional formula/expression
    - For geometry problems: can output `geogebraCommand` for potential visual display
    - Step-by-step example for common math problems
    - Anti-patterns: no skipping steps, no assumptions
  - **Functions**:
    - `export async function solveProblem(input: string, provider: LLMProvider, image?: string, onStep?: StepCallback)` — main entry point
    - Step callback type: `(step: SolveStep) => Promise<{ success: boolean; error?: string }>`
  - **Max steps**: 50 (same as GeoGebra)
  - **Multimodal**: Supports image input (photo of problem) via `imageToBase64` pattern
  - **Provider handling**: Same bifurcation (OpenRouter vs others), toolChoice same pattern

  **Must NOT do**:
  - Do NOT hardcode answers or problem domains — stay generic math solver
  - Do NOT modify GeoGebra agent file

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex agent design — system prompt must be precise, tool definitions math-aware
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (after T3, independent of T5/T6)
  - **Parallel Group**: Wave 2 (with T6, T8)
  - **Blocks**: Task 9, Task 13
  - **Blocked By**: Task 3

  **References**:
  - `utils/geogebraAgent.ts:53-70` — `createAIClient()` (already extracted to T4 utility)
  - `utils/geogebraAgent.ts:292-388` — Tool calling loop pattern
  - `utils/geogebraAgent.ts:607-628` — Tool definition with Zod inputSchema
  - `utils/geogebraAgent.ts:184-271` — System prompt structure
  - `utils/geogebraAgent.ts:94-108` — `imageToBase64()` for multimodal input

  **Acceptance Criteria**:
  - [ ] `utils/solveAgent.ts` created with export `solveProblem` function
  - [ ] Agent uses tool calling with `execute_solve_step` + `complete_solve_task`
  - [ ] Steps include description, optional formula, optional geogebra command
  - [ ] Multimodal: accepts base64 image input
  - [ ] Max steps 50 enforced
  - [ ] toolChoice: "required" for OpenAI-compat, "auto" for OpenRouter
  - [ ] Error handling: throws on no tool call, throws on max steps
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Solve a simple algebra problem
    Tool: Bash (bun repl)
    Preconditions: T3, T4 complete
    Steps:
      1. Import solveProblem
      2. Call with: "解方程: 2x + 5 = 13"
      3. Verify steps returned: step descriptions, final answer
    Expected Result: Agent returns step-by-step solution with correct answer x=4
    Evidence: .sisyphus/evidence/task-7-solve-algebra.txt

  Scenario: Solve with image input (multimodal)
    Tool: Bash (bun repl)
    Preconditions: Test image available
    Steps:
      1. Convert test image to base64
      2. Call solveProblem with image parameter
      3. Verify agent successfully processes the problem from image
    Expected Result: Agent correctly reads and solves problem from image
    Evidence: .sisyphus/evidence/task-7-solve-image.txt

  Scenario: Handle unsolvable problem gracefully
    Tool: Bash (bun repl)
    Steps:
      1. Call solveProblem with a nonsensical problem
      2. Verify error handling
    Expected Result: Agent throws meaningful error, doesn't crash
    Evidence: .sisyphus/evidence/task-7-error.txt
  ```

  **Evidence to Capture**:
  - `task-7-solve-algebra.txt`, `task-7-solve-image.txt`, `task-7-error.txt`

  **Commit**: YES
  - Message: `feat(agent): add math problem solving agent with step-by-step tool calling`
  - Files: `utils/solveAgent.ts`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 8. Implement streaming infrastructure for explanation feature

  **What to do**:
  - Create `utils/useExplainChat.ts` — custom hook based on `useChat` from `@ai-sdk/react`:
    ```ts
    import { useChat } from "@ai-sdk/react";
    
    export function useExplainChat(provider: LLMProvider | null, systemPrompt: string) {
      const baseUrl = provider?.baseUrl || "";
      const apiKey = provider?.apiKey || "";
      const modelName = provider?.modelName || "gpt-4o";
      
      return useChat({
        api: "/api/chat", // NOTE: This may need DirectChatTransport for RN
        headers: { "Content-Type": "application/json" },
        body: { provider, systemPrompt },
        onError: (error) => { console.error("Chat error:", error); },
      });
    }
    ```
    - **Critical**: Use `DirectChatTransport` from `ai/direct-chat` instead of REST API for RN
    - If `DirectChatTransport` unavailable, fall back to polling `generateText` with progressive output
  - Create `utils/explainAgent.ts` with:
    - `getExplainSystemPrompt()` — System prompt for math explanation (Chinese)
    - Multi-turn chat: maintains conversation history for follow-up questions
    - Support for image input in the chat flow
  - **System prompt** (Chinese):
    - Role: "你是一名有耐心的数学老师，擅长用通俗易懂的方式讲解数学问题和概念"
    - Rules: explain step by step, use analogies, ask if user understands
    - Format: streaming-friendly (no tool calls needed in explanation mode)
  - Verify streaming works on web (Playwright test with typing animation)

  **Must NOT do**:
  - Do NOT use tool calling for explain mode (pure text streaming)
  - Do NOT use raw `streamText()` — use `DirectChatTransport` per Metis recommendation
  - Do NOT use `ai/react` (wrong import path for v6) — use `@ai-sdk/react`

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: RN streaming is uncharted territory in this project; needs careful implementation
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (after T3, T4)
  - **Parallel Group**: Wave 2 (with T6, T7)
  - **Blocks**: Task 9, Task 14
  - **Blocked By**: Tasks 3, 4

  **References**:
  - AI SDK v6 docs — `useChat`, `DirectChatTransport`
  - `@ai-sdk/react` — `useChat` hook
  - `stores/llmProviderStore.ts` — `useActiveLLMProvider` hook to get provider
  - Metis analysis — RN polyfill requirements for streaming

  **Acceptance Criteria**:
  - [ ] `utils/useExplainChat.ts` created with custom hook wrapping `useChat` + `DirectChatTransport`
  - [ ] `utils/explainAgent.ts` created with system prompt
  - [ ] Streaming: text appears progressively in UI (打字机效果)
  - [ ] Multi-turn: can ask follow-up questions within same conversation
  - [ ] Error handling: streaming failure shows error, supports retry
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Basic explanation streams progressively
    Tool: Playwright (browser-use)
    Preconditions: T3, T4 complete, provider configured
    Steps:
      1. Mount test component with useExplainChat
      2. Send message: "请解释一下勾股定理"
      3. Observe response appears progressively (not all at once)
    Expected Result: Streaming text appears character by character
    Evidence: .sisyphus/evidence/task-8-streaming.webm

  Scenario: Multi-turn conversation
    Tool: Playwright (browser-use)
    Steps:
      1. Send first message, wait for response
      2. Send follow-up: "能给我举个例子吗？"
      3. Verify response acknowledges context of previous exchange
    Expected Result: Follow-up question gets relevant response
    Evidence: .sisyphus/evidence/task-8-multiturn.txt
  ```

  **Evidence to Capture**:
  - `task-8-streaming.webm`, `task-8-multiturn.txt`

  **Commit**: YES
  - Message: `feat(agent): add streaming explanation chat with DirectChatTransport`
  - Files: `utils/useExplainChat.ts`, `utils/explainAgent.ts`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 9. Create shared ChatPanel component (solve + explain modes)

  **What to do**:
  - Create `components/ChatPanel.tsx` — shared chat UI component
  - **Props**:
    ```ts
    type ChatPanelProps = {
      mode: "solve" | "explain";
      provider: LLMProvider | null;
      onSaveToNotebook?: (problem: string, answer: string, userAnswer: string) => void;
    };
    ```
  - **Solve mode**:
    - Input area: TextInput + ImagePicker button (camera roll + camera)
    - "开始解题" button → calls `solveProblem()` from T7
    - Displays steps progressively using StepVisualizer (T10)
    - Shows final answer + "保存到错题本" button
    - Status indicator: "正在解题第 X/50 步..."
  - **Explain mode**:
    - Input area: TextInput + ImagePicker button
    - Chat bubble UI: user messages on right, AI messages on left
    - Uses `useExplainChat` hook (T8) for streaming
    - Auto-scroll to bottom on new messages
    - Stop button to interrupt streaming
    - Copy button on AI messages
  - **Shared features**:
    - No provider state → shows "请先在设置中配置 LLM 提供商" with link to profile tab
    - Loading state during AI processing
    - Error state with retry button
    - Image preview for uploaded images
  - **UI pattern**: Follow existing app conventions (`SafeAreaView`, `StyleSheet.create()`, Ionicons)

  **Must NOT do**:
  - Do NOT add markdown rendering (plain text only)
  - Do NOT add voice input
  - Do NOT persist conversation history across app restarts (in-memory only)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Complex UI component with two modes, image input, chat bubbles, streaming text
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on T7, T8)
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 13, 14
  - **Blocked By**: Tasks 7, 8

  **References**:
  - `app/(tabs)/geogebra.tsx:210-286` — Chat UI + image picker + provider check pattern
  - `app/(tabs)/index.tsx:6-27` — SafeAreaView pattern
  - `components/SettingsSection.tsx` — Modal pattern (for notebook save dialog)
  - `utils/geogebraAgent.ts:94-108` — `imageToBase64()` for image handling
  - `stores/llmProviderStore.ts` — `useActiveLLMProvider()`

  **Acceptance Criteria**:
  - [ ] `components/ChatPanel.tsx` created with `mode: "solve" | "explain"` prop
  - [ ] Solve mode: TextInput + ImagePicker + "开始解题" button
  - [ ] Explain mode: TextInput + ImagePicker + chat bubble UI
  - [ ] Explain mode: streaming text appears progressively
  - [ ] Solve mode: steps display using StepVisualizer
  - [ ] No provider → shows error message with link to settings
  - [ ] Loading state during AI processing
  - [ ] Error state with retry button
  - [ ] Image preview for uploaded images
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Solve mode — basic flow
    Tool: Playwright (browser-use)
    Preconditions: T7, T8 complete
    Steps:
      1. Mount ChatPanel with mode="solve" and mock provider
      2. Type a problem in TextInput
      3. Click "开始解题"
      4. Verify steps appear progressively
      5. Verify "保存到错题本" button appears after completion
    Expected Result: Solve flow works end-to-end
    Evidence: .sisyphus/evidence/task-9-solve-flow.webm

  Scenario: Explain mode — streaming chat
    Tool: Playwright (browser-use)
    Steps:
      1. Mount ChatPanel with mode="explain" and mock provider
      2. Type "请解释勾股定理"
      3. Verify streaming response appears progressively
      4. Type follow-up question
      5. Verify response acknowledges context
    Expected Result: Chat works with streaming effect
    Evidence: .sisyphus/evidence/task-9-explain-chat.webm

  Scenario: No provider configured
    Tool: Playwright (browser-use)
    Steps:
      1. Mount ChatPanel with provider=null
      2. Verify "请先配置 LLM 提供商" message appears
    Expected Result: Graceful empty state
    Evidence: .sisyphus/evidence/task-9-no-provider.png
  ```

  **Evidence to Capture**:
  - `task-9-solve-flow.webm`, `task-9-explain-chat.webm`, `task-9-no-provider.png`

  **Commit**: YES
  - Message: `feat(ui): add shared ChatPanel component with solve and explain modes`
  - Files: `components/ChatPanel.tsx`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 10. Implement StepVisualizer component (step-by-step solving visualization)

  **What to do**:
  - Create `components/StepVisualizer.tsx` — displays solving steps visually
  - **Props**:
    ```ts
    type StepVisualizerProps = {
      steps: SolveStep[];
      currentStepIndex: number;   // -1 = not started, 0..n = in progress
      status: "idle" | "solving" | "completed" | "error";
      onStepClick?: (stepIndex: number) => void;  // click to see step details
    };
    ```
  - **UI design**:
    - Vertical timeline: each step is a card connected by a line
    - Current step: animated pulse/highlight (use `react-native-reanimated`)
    - Completed steps: checkmark + grayed out
    - Pending steps: dimmed
    - Each card shows: step number, description, formula/expression (if present)
    - Final step: answer card with prominent styling (green background)
    - Error step: red card with error message
  - **Animations**: Use `Animated` from React Native or `react-native-reanimated` for pulse effect
  - **Layout**: ScrollView with step cards, auto-scroll to current step

  **Must NOT do**:
  - Do NOT add LaTeX rendering (plain text formulas)
  - Do NOT add drag-to-reorder steps

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Timeline UI with animations, responsive step cards
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (independent of other UI tasks)
  - **Parallel Group**: Wave 3 (with T11, T12)
  - **Blocks**: Task 13 (solve page)
  - **Blocked By**: None (independent component)

  **References**:
  - `app/(tabs)/index.tsx:34-60` — Card pattern (shadow, borderRadius, padding)
  - `components/SettingsSection.tsx` — List item pattern
  - `react-native-reanimated` — For pulse animation on current step

  **Acceptance Criteria**:
  - [ ] `components/StepVisualizer.tsx` created with timeline UI
  - [ ] Step cards show: number, description, formula
  - [ ] Current step has pulse highlight animation
  - [ ] Completed steps show checkmark
  - [ ] Final answer card has green background
  - [ ] Auto-scrolls to current step
  - [ ] Error step shown in red
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Timeline renders steps correctly
    Tool: Playwright (browser-use)
    Preconditions: StepVisualizer mounted with mock step data
    Steps:
      1. Pass 3 steps: step 0 (completed), step 1 (current), step 2 (pending)
      2. Verify step 0 has checkmark
      3. Verify step 1 has pulse animation visible
      4. Verify step 2 is dimmed
    Expected Result: Timeline shows correct visual states per step
    Evidence: .sisyphus/evidence/task-10-timeline.webm

  Scenario: Final answer highlighted
    Tool: Playwright (browser-use)
    Steps:
      1. Pass status="completed", 3 completed steps
      2. Verify last step has green background
      3. Verify final answer text is visible
    Expected Result: Completion state visually distinct
    Evidence: .sisyphus/evidence/task-10-complete.png
  ```

  **Evidence to Capture**:
  - `task-10-timeline.webm`, `task-10-complete.png`

  **Commit**: YES (groups with T9)
  - Message: `feat(ui): add StepVisualizer with timeline and step animations`
  - Files: `components/StepVisualizer.tsx`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 11. Implement NotebookList + MistakeCard components

  **What to do**:
  - Create `components/NotebookList.tsx`:
    - FlatList of mistake records from `useNotebookRecords()`
    - Each item renders `MistakeCard`
    - Pull-to-refresh
    - Search bar at top (calls `searchRecords` from store)
    - Filter chips: "全部 / 未复习 / 已复习" ; subject filter toggle
    - Empty state: "还没有错题记录" with icon
    - FAB (+) button to add new mistake (opens NotebookForm modal)
  - Create `components/MistakeCard.tsx` (individual card):
    - Problem text preview (truncated to 2 lines)
    - Subject badge: "代数" / "几何" / "函数" etc.
    - Tags shown as small chips
    - Status: "已复习 ✓" or "待复习"
    - Date created
    - Swipe-to-delete or long-press menu
    - Tap → expands to show full details (answer, user answer, analysis)
    - Long press → context menu (edit, delete, mark reviewed)
  - **UI pattern**: White card with shadow, consistent with `index.tsx` feature cards

  **Must NOT do**:
  - Do NOT add pull-to-refresh animation (standard RN RefreshControl is fine)
  - Do NOT add swipe-to-delete gesture (long-press menu is simpler)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: List UI with cards, filters, search, expandable items
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (after T6)
  - **Parallel Group**: Wave 3 (with T10, T12)
  - **Blocks**: Task 15 (notebook page)
  - **Blocked By**: Task 6

  **References**:
  - `app/(tabs)/index.tsx:34-60` — Card shadow and layout pattern
  - `components/SettingsSection.tsx` — List + modal pattern
  - `stores/notebookStore.ts` — Store hooks

  **Acceptance Criteria**:
  - [ ] `components/NotebookList.tsx` created with FlatList + search bar + filter chips
  - [ ] `components/MistakeCard.tsx` created with expandable details
  - [ ] Empty state shown when no records
  - [ ] Pull-to-refresh reloads data
  - [ ] Search bar filters records
  - [ ] Filter chips: all/unreviewed/reviewed toggle works
  - [ ] Long-press shows context menu (edit/delete/review)
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Notebook list shows records
    Tool: Playwright (browser-use)
    Preconditions: T6 complete, some records in DB
    Steps:
      1. Mount NotebookList
      2. Verify records displayed as cards
      3. Tap a card — verify expands to show details
    Expected Result: Records rendered with expandable details
    Evidence: .sisyphus/evidence/task-11-list.webm

  Scenario: Empty state
    Tool: Playwright (browser-use)
    Steps:
      1. Mount NotebookList with empty DB
      2. Verify "还没有错题记录" empty state
    Expected Result: Graceful empty state
    Evidence: .sisyphus/evidence/task-11-empty.png

  Scenario: Filter chips work
    Tool: Playwright (browser-use)
    Steps:
      1. Add one reviewed + one unreviewed record
      2. Tap "未复习" filter
      3. Verify only unreviewed record shown
    Expected Result: Filter works correctly
    Evidence: .sisyphus/evidence/task-11-filter.webm
  ```

  **Evidence to Capture**:
  - `task-11-list.webm`, `task-11-empty.png`, `task-11-filter.webm`

  **Commit**: YES (groups with T12)
  - Message: `feat(ui): add NotebookList and MistakeCard components`
  - Files: `components/NotebookList.tsx`, `components/MistakeCard.tsx`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 12. Implement NotebookForm component (add/edit mistake modal)

  **What to do**:
  - Create `components/NotebookForm.tsx` — modal form for adding/editing mistake records
  - **Props**:
    ```ts
    type NotebookFormProps = {
      visible: boolean;
      onClose: () => void;
      editRecord?: MistakeRecord;  // if editing existing record
      prefill?: {                  // if coming from solve page
        problemText?: string;
        correctAnswer?: string;
        userAnswer?: string;
      };
    };
    ```
  - **Form fields**:
    - 题目内容 (TextInput, multiline, required)
    - 我的答案 (TextInput, multiline, required)
    - 正确答案 (TextInput, multiline, required)
    - 题目图片 (optional, ImagePicker button)
    - AI解析 (optional, TextInput multiline, editable)
    - 知识点标签 (tag input: type text + Enter to add tag chip)
    - 学科 (picker/select: 代数/几何/函数/概率/其他)
    - 已复习 (Switch toggle)
  - **Validation**: Zod schema for MistakeRecord (reuse from `db/schema.ts` or define separately)
  - **Save**: Calls `addRecord` or `updateRecord` from notebook store
  - **UI pattern**: Follow `SettingsSection.tsx` modal pattern (slide-up, rounded top, header with close)

  **Must NOT do**:
  - Do NOT add image cropping/editing
  - Do NOT add rich text formatting
  - Do NOT add auto-save draft

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Form UI with multiple field types, image picker, tag input
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (after T6)
  - **Parallel Group**: Wave 3 (with T10, T11)
  - **Blocks**: Task 15 (notebook page)
  - **Blocked By**: Task 6

  **References**:
  - `components/SettingsSection.tsx` — Modal pattern (animationType, container, header, form layout)
  - `stores/notebookStore.ts` — CRUD operations
  - `db/schema.ts` — MistakeRecord type

  **Acceptance Criteria**:
  - [ ] `components/NotebookForm.tsx` created with slide-up modal
  - [ ] All form fields: problem, answer, userAnswer, image, analysis, tags, subject, isReviewed
  - [ ] Validation before save (required fields)
  - [ ] Image picker works (for problemImage)
  - [ ] Tag input: type text + Enter creates tag chip, X removes
  - [ ] Edit mode pre-fills form with existing record data
  - [ ] Save calls store.addRecord or store.updateRecord
  - [ ] Close button works
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Add a new mistake record
    Tool: Playwright (browser-use)
    Preconditions: T6 complete
    Steps:
      1. Open NotebookForm modal
      2. Fill all fields: problem, my answer, correct answer, tag, subject
      3. Tap save
      4. Verify record appears in notebook list
    Expected Result: New record saved and visible
    Evidence: .sisyphus/evidence/task-12-add-form.webm

  Scenario: Edit existing record
    Tool: Playwright (browser-use)
    Steps:
      1. Open NotebookForm with editRecord pre-filled
      2. Change problem text
      3. Tap save
      4. Verify record updated in list
    Expected Result: Record updated correctly
    Evidence: .sisyphus/evidence/task-12-edit-form.webm

  Scenario: Validation prevents empty save
    Tool: Playwright (browser-use)
    Steps:
      1. Open form, leave problem field empty
      2. Tap save
      3. Verify validation error shown
    Expected Result: Validation prevents submit
    Evidence: .sisyphus/evidence/task-12-validation.png
  ```

  **Evidence to Capture**:
  - `task-12-add-form.webm`, `task-12-edit-form.webm`, `task-12-validation.png`

  **Commit**: YES (groups with T11)
  - Message: `feat(ui): add NotebookForm modal for add/edit mistake records`
  - Files: `components/NotebookForm.tsx`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 13. Build solve.tsx page (step-by-step problem solving)

  **What to do**:
  - Build `app/(learning)/solve.tsx` — full problem solving page
  - **Layout**:
    - SafeAreaView → ScrollView
    - Header: "解题" title with back button
    - Contains `ChatPanel` with `mode="solve"`
    - Below ChatPanel: `StepVisualizer` showing solving progress
    - After completion: "保存到错题本" button → opens NotebookForm with prefill
  - **Navigation**: Use `useRouter()` for back navigation
  - **Data flow**: User types/submits → ChatPanel → solveProblem() → StepVisualizer updates → completion → save option
  - **State management**: Local state for step data, ChatPanel handles AI conversation state
  - **Empty state**: Input prompt "输入数学题目开始解题..."
  - **No provider**: Shows error + link to profile tab to configure

  **Must NOT do**:
  - Do NOT add GeoGebra integration in MVP (noted as future enhancement)
  - Do NOT add multiple solving methods option

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Page layout composing multiple components with complex data flow
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on T2, T7, T9, T10)
  - **Parallel Group**: Wave 4 (with T14, T15)
  - **Blocks**: Task 16
  - **Blocked By**: Tasks 2, 7, 9, 10

  **References**:
  - `app/(tabs)/geogebra.tsx` — AI feature page pattern (chat + visualization)
  - `app/(tabs)/index.tsx` — SafeAreaView + ScrollView pattern
  - `components/ChatPanel.tsx` (T9) — Solve mode
  - `components/StepVisualizer.tsx` (T10) — Step display
  - `utils/solveAgent.ts` (T7) — Solve agent

  **Acceptance Criteria**:
  - [ ] `app/(learning)/solve.tsx` created with full solve layout
  - [ ] ChatPanel in solve mode renders correctly
  - [ ] StepVisualizer updates as steps come in
  - [ ] "保存到错题本" button opens NotebookForm with prefill
  - [ ] Empty state: input prompt text shown
  - [ ] No provider → error with settings link
  - [ ] Back button navigates to learning hub
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Full solve flow from page
    Tool: Playwright (browser-use)
    Preconditions: T2, T7, T9, T10 complete
    Steps:
      1. Navigate to /solve page
      2. Type "2x + 5 = 13" in input
      3. Click "开始解题"
      4. Verify steps appear in StepVisualizer
      5. Verify "保存到错题本" appears after completion
      6. Click it — verify NotebookForm opens with prefill
    Expected Result: End-to-end solve flow works
    Evidence: .sisyphus/evidence/task-13-solve-page.webm
  ```

  **Evidence to Capture**:
  - `task-13-solve-page.webm`

  **Commit**: YES (groups with T14, T15)
  - Message: `feat(page): add solve.tsx problem solving page`
  - Files: `app/(learning)/solve.tsx`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 14. Build explain.tsx page (streaming explanation chat)

  **What to do**:
  - Build `app/(learning)/explain.tsx` — full streaming explanation page
  - **Layout**:
    - SafeAreaView → View (flex: 1, no ScrollView — ChatPanel handles scrolling)
    - Header: "讲题" title with back button
    - Contains `ChatPanel` with `mode="explain"`
    - ChatPanel fills the page (flex: 1) with input bar pinned at bottom
  - **Navigation**: Use `useRouter()` for back navigation
  - **Data flow**: User types → ChatPanel → useExplainChat → streaming response → chat bubbles update
  - **State management**: ChatPanel manages useExplainChat state internally
  - **Empty state**: "输入你想了解的知识点或题目..."
  - **No provider**: Shows error + link to profile tab

  **Must NOT do**:
  - Do NOT persist chat history (in-memory only per session)
  - Do NOT add conversation list/sidebar

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Chat page layout with pinned input, scrollable bubbles, streaming text
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (after T2, T8, T9)
  - **Parallel Group**: Wave 4 (with T13, T15)
  - **Blocks**: Task 16
  - **Blocked By**: Tasks 2, 8, 9

  **References**:
  - `app/(tabs)/geogebra.tsx` — Chat layout pattern (messages area + input at bottom)
  - `components/ChatPanel.tsx` (T9) — Explain mode
  - `utils/useExplainChat.ts` (T8) — Streaming chat hook

  **Acceptance Criteria**:
  - [ ] `app/(learning)/explain.tsx` created with full chat layout
  - [ ] ChatPanel in explain mode renders with pinned input at bottom
  - [ ] Streaming text appears progressively in chat bubbles
  - [ ] Follow-up questions work (multi-turn)
  - [ ] Empty state: input prompt text shown
  - [ ] No provider → error with settings link
  - [ ] Back button navigates to learning hub
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Full explain flow from page
    Tool: Playwright (browser-use)
    Preconditions: T2, T8, T9 complete
    Steps:
      1. Navigate to /explain page
      2. Type "请解释勾股定理" in input
      3. Verify streaming response appears progressively
      4. Type follow-up "能举个例子吗？"
      5. Verify AI responds in context
    Expected Result: End-to-end streaming chat works
    Evidence: .sisyphus/evidence/task-14-explain-page.webm
  ```

  **Evidence to Capture**:
  - `task-14-explain-page.webm`

  **Commit**: YES (groups with T13, T15)
  - Message: `feat(page): add explain.tsx streaming explanation page`
  - Files: `app/(learning)/explain.tsx`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 15. Build notebook.tsx page (mistake notebook)

  **What to do**:
  - Build `app/(learning)/notebook.tsx` — full mistake notebook page
  - **Layout**:
    - SafeAreaView → ScrollView
    - Header: "错题本" title with back button
    - Contains `NotebookList` component (search, filter, list)
    - FAB (Floating Action Button): "+" icon to add new mistake
    - FAB opens `NotebookForm` modal in create mode
  - **Navigation**: Use `useRouter()` for back navigation
  - **Data flow**:
    - Page loads → store.loadRecords() → NotebookList renders
    - User taps FAB → NotebookForm opens → save → list refreshes
    - User long-presses card → context menu (edit/delete/review)
    - Edit → NotebookForm opens in edit mode → save → list refreshes
  - **State management**: notebookStore handles all data operations
  - **Empty state**: "还没有错题记录，开始解题并保存错题吧！" with illustration icon
  - **Loading state**: ActivityIndicator overlay
  - **Error state**: "加载失败" with retry button

  **Must NOT do**:
  - Do NOT add pagination (MVP uses simple FlatList)
  - Do NOT add export/import functionality

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: CRUD page composing list + modal + FAB
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (after T2, T6, T11, T12)
  - **Parallel Group**: Wave 4 (with T13, T14)
  - **Blocks**: Task 16
  - **Blocked By**: Tasks 2, 6, 11, 12

  **References**:
  - `components/NotebookList.tsx` (T11) — List component
  - `components/NotebookForm.tsx` (T12) — Add/edit form
  - `stores/notebookStore.ts` (T6) — Store hooks
  - `components/SettingsSection.tsx` — FAB pattern

  **Acceptance Criteria**:
  - [ ] `app/(learning)/notebook.tsx` created with full notebook layout
  - [ ] NotebookList renders with records from store
  - [ ] FAB opens NotebookForm in create mode
  - [ ] Long-press opens context menu (edit/delete/review)
  - [ ] Empty state shown when no records
  - [ ] Loading state shown during load
  - [ ] Error state with retry
  - [ ] Back button navigates to learning hub
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Full notebook CRUD flow
    Tool: Playwright (browser-use)
    Preconditions: T2, T6, T11, T12 complete
    Steps:
      1. Navigate to /notebook page
      2. Verify empty state (no records yet)
      3. Tap FAB, fill form, save
      4. Verify record appears in list
      5. Tap FAB again, add another record
      6. Long-press first record, tap edit, change text, save
      7. Long-press second record, tap delete
      8. Verify list updated correctly
    Expected Result: Full CRUD flow works end-to-end
    Evidence: .sisyphus/evidence/task-15-notebook-crud.webm
  ```

  **Evidence to Capture**:
  - `task-15-notebook-crud.webm`

  **Commit**: YES (groups with T13, T14)
  - Message: `feat(page): add notebook.tsx mistake notebook CRUD page`
  - Files: `app/(learning)/notebook.tsx`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 16. Rewrite learning.tsx as hub page with 3 feature cards

  **What to do**:
  - Replace the placeholder content in `app/(tabs)/learning.tsx` with a hub page
  - **Layout**:
    - SafeAreaView → ScrollView
    - Header section: "学习中心" title + subtitle "AI 助力数学学习"
    - Welcome card: brief description of the 3 features
    - 3 feature cards (follow `index.tsx` card pattern):
      1. **解题** (icon: `bulb-outline`) — "AI 逐步解题" — "输入数学题，AI 将逐步展示解题过程"
      2. **讲题** (icon: `chatbubbles-outline`) — "AI 互动讲解" — "与 AI 老师对话，深入理解数学概念"
      3. **错题本** (icon: `book-outline`) — "错题管理" — "记录和管理错题，针对性复习"
    - Each card: onPress → `router.push("/(learning)/solve")` (or explain/notebook)
    - Recent activity section (stretch goal): show last 3 notebook entries if any
  - **Navigation**: Import `useRouter()` from `expo-router`
  - **UI**: Same card styling as `index.tsx` (white bg, shadow, borderRadius, Ionicons)

  **Must NOT do**:
  - Do NOT modify other tab files (index, profile, geogebra)
  - Do NOT add animated entry effects (keep it simple)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Hub page with 3 navigation cards, welcome section
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on T13, T14, T15)
  - **Parallel Group**: Wave 5 (with T17, T18)
  - **Blocks**: Tasks 17, 18, 19
  - **Blocked By**: Tasks 13, 14, 15

  **References**:
  - `app/(tabs)/index.tsx:34-60` — Card layout pattern (shadow, elevation, borderRadius)
  - `app/(tabs)/index.tsx:1-5` — SafeAreaView + ScrollView pattern
  - `app/(learning)/solve.tsx` — Route target
  - `app/(learning)/explain.tsx` — Route target
  - `app/(learning)/notebook.tsx` — Route target

  **Acceptance Criteria**:
  - [ ] `app/(tabs)/learning.tsx` rewritten with hub layout
  - [ ] 3 feature cards: 解题, 讲题, 错题本 with icons and descriptions
  - [ ] Tapping 解题 card → navigates to `/(learning)/solve`
  - [ ] Tapping 讲题 card → navigates to `/(learning)/explain`
  - [ ] Tapping 错题本 card → navigates to `/(learning)/notebook`
  - [ ] Tab bar still visible after navigating to sub-pages
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Hub card navigation
    Tool: Playwright (browser-use)
    Preconditions: T13, T14, T15 complete
    Steps:
      1. Go to learning tab
      2. Verify 3 cards visible with correct icons and text
      3. Tap "解题" card
      4. Verify navigated to solve page
      5. Go back, tap "讲题" card
      6. Verify navigated to explain page
      7. Go back, tap "错题本" card
      8. Verify navigated to notebook page
    Expected Result: All 3 cards navigate to correct pages
    Evidence: .sisyphus/evidence/task-16-hub-nav.webm
  ```

  **Evidence to Capture**:
  - `task-16-hub-nav.webm`

  **Commit**: YES
  - Message: `feat(ui): rewrite learning tab as hub with 3 feature cards`
  - Files: `app/(tabs)/learning.tsx`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 17. Add empty states, error states, and no-provider handling

  **What to do**:
  - Audit ALL pages and components for missing edge case states:
    - **Empty states** (first-time user experience):
      - Hub page: already handled (cards always visible)
      - Solve page: "输入数学题目开始解题..." placeholder
      - Explain page: "输入你想了解的知识点或题目..." placeholder
      - Notebook page: "还没有错题记录" with icon
    - **Error states** (API failures, DB errors):
      - Solve agent failure: "解题出错，请重试" + retry button
      - Explain streaming failure: partial text + "连接中断，请重试" + retry
      - Notebook load failure: "加载失败" + retry button
      - Generate unique error IDs for each error type
    - **No provider state** (LLM not configured):
      - Solve/Explain: "请先在「我的」页面配置 LLM 提供商"
      - Clickable link to profile tab using `router.push("/(tabs)/profile")`
      - Notebook page: still functional (no AI needed for CRUD)
    - **Loading states**:
      - Solve: "正在解题第 X/50 步..." with progress indicator
      - Explain: streaming indicator (three dots animation or "思考中...")
      - Notebook: ActivityIndicator overlay on initial load
  - Ensure consistent styling across all states (font, color, icon)

  **Must NOT do**:
  - Do NOT add animated empty states (static illustrations are fine)
  - Do NOT add skeleton loading screens (ActivityIndicator is sufficient)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Enumerating + implementing edge case UI states
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (after T16)
  - **Parallel Group**: Wave 5 (with T18)
  - **Blocked By**: Task 16

  **References**:
  - Each page file (solve.tsx, explain.tsx, notebook.tsx, learning.tsx)
  - `geogebra.tsx` — Existing error handling pattern (Alert + assistant error message)
  - `stores/llmProviderStore.ts` — `useActiveLLMProvider()` for provider check

  **Acceptance Criteria**:
  - [ ] All empty states implemented for every page
  - [ ] All error states with retry buttons implemented
  - [ ] No provider → error message with clickable link to profile tab
  - [ ] Loading states during async operations
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: No provider configured — solve/explain show error
    Tool: Playwright (browser-use)
    Preconditions: No LLM provider configured
    Steps:
      1. Navigate to solve page
      2. Verify "请先配置 LLM 提供商" message with link
      3. Click link — verify navigates to profile tab
    Expected Result: No-provider state handled gracefully
    Evidence: .sisyphus/evidence/task-17-no-provider.webm

  Scenario: Empty notebook state
    Tool: Playwright (browser-use)
    Steps:
      1. Navigate to notebook page with empty DB
      2. Verify "还没有错题记录" empty state
    Expected Result: Empty state shown
    Evidence: .sisyphus/evidence/task-17-empty-notebook.png
  ```

  **Evidence to Capture**:
  - `task-17-no-provider.webm`, `task-17-empty-notebook.png`

  **Commit**: YES (groups with T18)
  - Message: `feat(ui): add empty states, error states, and no-provider handling`
  - Files: `app/(learning)/solve.tsx`, `app/(learning)/explain.tsx`, `app/(learning)/notebook.tsx`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 18. Cross-feature integration: 解题 → 错题本 save flow

  **What to do**:
  - Wire the "保存到错题本" button in ChatPanel solve mode to actually save:
    - On solve completion, capture: problem text, correct answer, user's answer (if provided)
    - Click "保存到错题本" → opens NotebookForm with prefill
    - NotebookForm pre-fills: problemText, correctAnswer, analysis (from solve steps)
    - User can edit before saving
    - Save → calls store.addRecord → notebook refreshes
  - Add a "最近错题" section to the hub page (last 3 notebook records)

  **Must NOT do**:
  - Do NOT auto-save mistakes without user confirmation (manual save only)
  - Do NOT add cross-feature hard dependencies (notebook should work without solve)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Wiring existing buttons to stores and navigation
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (after T16)
  - **Parallel Group**: Wave 5 (with T17)
  - **Blocked By**: Task 16

  **References**:
  - `components/ChatPanel.tsx` — ChatPanel solve mode with save button
  - `components/NotebookForm.tsx` — Prefill from solve result
  - `stores/notebookStore.ts` — `addRecord` action
  - `app/(learning)/solve.tsx` — Target page for "从错题本解题"

  **Acceptance Criteria**:
  - [ ] Solve completion shows "保存到错题本" button
  - [ ] Clicking it opens NotebookForm with pre-filled data
  - [ ] Saving from NotebookForm creates record in DB
  - [ ] Hub page shows "最近错题" section with last 3 records
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Save solve result to notebook
    Tool: Playwright (browser-use)
    Preconditions: T16, T17 complete
    Steps:
      1. Navigate to solve page, solve a problem
      2. Click "保存到错题本"
      3. Verify NotebookForm opens with problem pre-filled
      4. Add user answer, click save
      5. Navigate to notebook page
      6. Verify new record appears
    Expected Result: Solve → Notebook save flow works
    Evidence: .sisyphus/evidence/task-18-solve-to-notebook.webm
  ```

  **Evidence to Capture**:
  - `task-18-solve-to-notebook.webm`

  **Commit**: YES (groups with T17)
  - Message: `feat(integration): wire solve-to-notebook save flow and recent mistakes on hub`
  - Files: `components/ChatPanel.tsx`, `app/(tabs)/learning.tsx`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 19. TypeScript strict pass + browser-use QA + unit tests

  **What to do**:
  - Run `npx tsc --noEmit` and fix ALL TypeScript errors:
    - Strict mode compliance (no implicit any, strict null checks)
    - Missing type exports/imports
    - Ensure all `@/*` path alias imports resolve correctly
  - Run browser-use (Playwright) QA on ALL features:
    - 解题 full flow: input → solve → view steps → save to notebook
    - 讲题 full flow: ask → streaming response → follow-up
    - 错题本 full flow: add → edit → delete → filter → search → review
    - Hub navigation: all 3 cards → sub-pages → back
    - Edge cases: empty states, error states, no provider
  - Save comprehensive QA evidence
  - Add unit tests:
    - `__tests__/stores/notebookStore.test.ts` — CRUD operations
    - `__tests__/components/StepVisualizer.test.tsx` — Timeline rendering
    - `__tests__/utils/solveAgent.test.ts` — Agent tool calling (mock LLM)

  **Must NOT do**:
  - Do NOT add 100% test coverage (focus on critical paths)
  - Do NOT add E2E tests beyond browser-use QA (that IS the E2E)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Quality assurance — fixing TS errors, writing tests, running QA
  - **Skills**: `["browser-use"]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on all previous tasks)
  - **Parallel Group**: Wave 5
  - **Blocked By**: Tasks 16, 17, 18

  **References**:
  - `tsconfig.json` — Strict mode config
  - `stores/notebookStore.ts` — Unit test target
  - `components/StepVisualizer.tsx` — Unit test target
  - `utils/solveAgent.ts` — Unit test target
  - `AGENTS.md` — Project conventions

  **Acceptance Criteria**:
  - [ ] `npx tsc --noEmit` passes with zero errors
  - [ ] browser-use QA: all scenarios pass (evidence captured)
  - [ ] Unit tests: notebookStore CRUD tests pass
  - [ ] Unit tests: StepVisualizer renders correctly
  - [ ] Unit tests: solveAgent handles basic cases
  - [ ] All captured evidence saved to `.sisyphus/evidence/`

  **QA Scenarios**:
  ```
  Scenario: TypeScript compilation clean
    Tool: Bash
    Steps:
      1. Run `npx tsc --noEmit`
    Expected Result: No errors
    Evidence: .sisyphus/evidence/task-19-tsc.txt

  Scenario: Unit tests pass
    Tool: Bash
    Steps:
      1. Run `bun test` or equivalent
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-19-tests.txt
  ```

  **Evidence to Capture**:
  - `task-19-tsc.txt`, `task-19-tests.txt`

  **Commit**: YES
  - Message: `chore(qa): TypeScript fixes, browser-use QA, and unit tests`
  - Files: Multiple (fixes across feature files)
  - Pre-commit: `npx tsc --noEmit && bun test`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results and get explicit "okay".

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search for forbidden patterns. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npx tsc --noEmit` + linter + `bun test`. Review changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together). Test edge cases: empty state, invalid input, no provider. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Commit | Tasks | Message | Scope |
|--------|-------|---------|-------|
| 1 | T1, T2 | `feat(nav): add root Stack layout and learning route group` | Navigation |
| 2 | T3, T4 | `chore(deps): install deps; feat(ai): add polyfills + AI utils` | Infrastructure |
| 3 | T5 | `feat(db): add Drizzle schema and DB init for mistake notebook` | Database |
| 4 | T6 | `feat(store): add mistake notebook store with Drizzle CRUD` | Store |
| 5 | T7 | `feat(agent): add math problem solving agent` | Agent |
| 6 | T8 | `feat(agent): add streaming explanation chat infrastructure` | Agent |
| 7 | T9, T10 | `feat(ui): add ChatPanel and StepVisualizer components` | UI |
| 8 | T11, T12 | `feat(ui): add NotebookList, MistakeCard, and NotebookForm` | UI |
| 9 | T13, T14, T15 | `feat(page): add solve, explain, notebook pages` | Pages |
| 10 | T16 | `feat(ui): rewrite learning tab as feature hub` | Hub |
| 11 | T17, T18 | `feat(integration): edge case states + solve-to-notebook flow` | Integration |
| 12 | T19 | `chore(qa): TS fixes, browser-use QA, and unit tests` | QA |

---

## Success Criteria

### Verification Commands
```bash
npx tsc --noEmit  # Expected: No errors
npx expo start --web  # Expected: App starts, all features accessible
```

### Final Checklist
- [ ] All 19 implementation tasks complete
- [ ] All 4 final verification tasks (F1-F4) pass
- [ ] Root layout change verified: all 4 existing tabs work
- [ ] 解题: user inputs problem → sees step-by-step solution with visual timeline
- [ ] 讲题: user asks question → streaming response with typing effect
- [ ] 错题本: user can add/edit/delete/review mistakes; data persists in SQLite
- [ ] Hub page with 3 cards navigates to all 3 sub-pages
- [ ] No LLM provider → clear error state on solve/explain
- [ ] Empty states for all features
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] browser-use QA evidence captured
- [ ] User explicitly approves final verification results
