1: # Learnings
2: 
3: ## 2026-04-30: Root Stack Layout
4: 
5: - Created `app/_layout.tsx` with `<Stack>` wrapping `(tabs)` route group.
6: - No existing `_layout.tsx` at root — `app/` only had `(tabs)/` directory.
7: - `(tabs)/_layout.tsx` uses `Tabs` from `expo-router/tabs` (not `expo-router`).
8: - The 4 tabs are: index (首页/home), learning (学习/book), profile (我的/person), geogebra (GeoGebra/calculator).
9: - `headerShown: false` is set on Tabs `screenOptions`, so root Stack also needs `headerShown: false` to avoid double headers.
10: - Expo Router auto-detects `app/_layout.tsx` as root layout — no configuration needed.
11: - Route groups (parenthesized dirs) are referenced by their directory name in `Stack.Screen`, e.g., `name="(tabs)"`.
12: - Line ending warning: Git detected LF→CRLF conversion on first commit.
13: 
14: ## 2026-04-30: Learning Route Group
15: 
16: - Created `app/(learning)/` route group with Stack layout (`_layout.tsx`).
17: - Stack screens: `index` (学习中心), `solve` (解题), `explain` (讲题), `notebook` (错题本).
18: - Each page uses `SafeAreaView → View → centered Text` pattern with `StyleSheet.create()`.
19: - Style convention: bg `#f5f5f5`, title `fontSize: 24, fontWeight: "600", color: "#333"`, subtitle `fontSize: 14, color: "#999"`.
20: - TypeScript check (`npx tsc --noEmit`) passed with no errors.
21: - Commit: `feat(nav): add learning route group with 4 sub-pages`.
22: 
23: ## 2026-04-30: Dependency Installation
24: 
25: - Installed `expo-sqlite@~55.0.15` via `npx expo install expo-sqlite` (follows project rule for expo packages).
26: - Installed `drizzle-orm@^0.45.2`, `@ai-sdk/react@^3.0.172`, `@ungap/structured-clone@^1.3.0`, `@stardazed/streams-text-encoding@^1.0.2` via `pnpm add`.
27: - Installed `drizzle-kit@^0.31.10` as devDependency via `pnpm add -D`.
28: - TypeScript compilation (`npx tsc --noEmit`) passed with no errors after installation.
29: - Peer dependency warning: `@ai-sdk/react` expects React `^18 || ~19.0.1 || ~19.1.2 || ^19.2.1` but found `19.2.0` — this is a minor version mismatch, not blocking.
30: - Commit: `chore(deps): add expo-sqlite, drizzle-orm, @ai-sdk/react, streaming polyfills`.
31: 
32: ## 2026-04-30: Drizzle ORM Schema and Database Initialization
33: 
34: - Created `db/schema.ts` with `mistake_records` table using Drizzle ORM `sqlite-core`.
35: - Schema fields: id (auto-generated), problemText, problemImage, userAnswer, correctAnswer, analysis, tags, subject, isReviewed, reviewCount, lastReviewedAt, createdAt, updatedAt.
36: - Created `db/index.ts` initializing Drizzle with `expo-sqlite` (`openDatabaseSync("learning.db")`), exporting `db` and `useMigrations`.
37: - Created `drizzle.config.ts` with `driver: "expo"` and output to `./drizzle`.
38: - Created `babel.config.js` with `babel-preset-expo` preset and `inline-import` plugin for `.sql` files (required for Drizzle migration imports).
39: - Created `metro.config.js` extending Expo default config, adding `sql` to `sourceExts`.
40: - Ran `npx drizzle-kit generate` → generated `drizzle/0000_eager_galactus.sql` + migration JS/JSON.
41: - TypeScript check (`npx tsc --noEmit`) passed with no errors.
42: - Commit: `feat(db): add Drizzle schema and initialization for mistake notebook`.
43: - Note: No existing `babel.config.js` or `metro.config.js` — both created from scratch. Expo handles defaults internally when these files are absent, but Drizzle requires explicit `.sql` support.
44: 
45: ## 2026-04-30: Math Solving Agent (solveAgent.ts)
46: 
47: - Created `utils/solveAgent.ts` — step-by-step math problem solving agent using Vercel AI SDK tool-calling loop.
48: - Exports: `solveProblem()`, `imageToBase64()`, `SolveStep`, `SolveResult`, `StepCallback`.
49: - Pattern mirrors `geogebraAgent.ts` exactly: `generateText` + tool-calling loop, 2 tools (`execute_solve_step` + `complete_solve_task`), `maxSteps=50`, `toolChoice "required"/"auto"`.
50: - Imports from `createLearningClient` (`createAIClient`, `isOpenRouterProvider`, `getModelName`) instead of defining inline.
51: - System prompt in Chinese with 3 worked examples (algebra, geometry, factoring), covers 7 math domains.
52: - `solveProblem` supports optional image input (multimodal — photo search) and optional `onStep` callback for UI feedback.
53: - Fallback JSON parsing for tool calls (same pattern as geogebraAgent.ts) for providers that return tool info in text field.
54: - TypeScript `npx tsc --noEmit` passed cleanly, LSP diagnostics clear.
55: - Commit: `feat(agent): add math problem solving agent with step-by-step tool calling`.
56: 
57: ## 2026-04-30: Polyfills and Shared AI Client
58: 
59: - Created `app/polyfills.ts` importing `@ungap/structured-clone` and `@stardazed/streams-text-encoding` — must be imported before any code using these APIs.
60: - Imported `app/polyfills.ts` as the VERY FIRST import in `app/_layout.tsx` (before `import { Stack } from "expo-router"`).
61: - Created `utils/createLearningClient.ts` with shared AI client factory:
62:   - `isOpenRouterProvider(provider)` — checks if provider baseUrl contains `openrouter.ai`.
63:   - `createAIClient(provider)` — returns `createOpenRouter(...)` for OpenRouter, else `createOpenAI({ baseURL, apiKey })`.
64:   - `getModelName(provider, requireMultimodal?)` — returns `provider.modelName` if set, else falls back to sensible defaults per provider type (openai→gpt-4o, anthropic→claude-sonnet-4-20250514, google→gemini-2.0-flash, qwen→qwen-max, kimi→moonshot-v1-8k).
65: - Did NOT modify `utils/geogebraAgent.ts` — this is a separate shared utility for future learning features.
66: - TypeScript check (`npx tsc --noEmit`) passed with no errors.
67: - Commit: `feat(ai): add polyfills and shared AI client utilities`.
68: 
69: ## 2026-04-30: Explain Chat Agent (explainAgent + useExplainChat)
70: 
71: - Created `utils/explainAgent.ts` — exports `getExplainSystemPrompt()` returning a ~80-line Chinese system prompt.
72: - Created `utils/useExplainChat.ts` — custom React Native-compatible chat hook.
73: - System prompt pattern: role (咕咕老师) → teaching philosophy → execution rules → answer format → worked example (勾股定理) → supported domains → important tips → anti-patterns.
74: - Chat hook uses `generateText()` (no tool calling) with simulated streaming via chunk-by-chunk progressive display.
75: - Multi-turn conversations: full message history sent as context on each call.
76: - AbortController support for canceling in-flight requests.
77: - Imports `createAIClient`, `getModelName`, `isOpenRouterProvider` from `createLearningClient.ts`.
78: - TypeScript `npx tsc --noEmit` passed with zero errors (had to fix `role: string` → `role: "system" as const` and remove unsupported `maxTokens` param).
79: - Commit: `feat(agent): add streaming explanation chat infrastructure`.
80: 
81: ## 2026-04-30: Mistake Notebook Store (notebookStore.ts)
82: 
83: - Created `stores/notebookStore.ts` — Zustand store for mistake notebook CRUD using Drizzle ORM for persistence.
84: - Design pattern follows `llmProviderStore.ts` exactly: `create<Interface>((set, get) => ({...}))`, async try/catch/finally with loading/error states.
85: - Schema: `MistakeRecord` (select) and `NewMistakeRecord` (insert) from `db/schema.ts`.
86: - Drizzle sync API used throughout: `.all()` for selects, `.get()` for insert returning, `.run()` for update/delete.
87: - **Gotcha**: Drizzle's select query builder has different types before/after `.where()`, so you cannot reassign `query = query.where(...)`. Must call `.all()` on each branch separately (ternary with full chain).
88: - CRUD operations: `loadRecords` (with filter support), `addRecord` (insert + returning + prepend to state), `updateRecord` (update + touch updatedAt), `deleteRecord` (delete + filter state), `toggleReviewed` (flip isReviewed, increment reviewCount, set lastReviewedAt).
89: - `searchRecords` uses `or(like(...), like(...))` on problemText and analysis fields — standalone query, doesn't modify store state.
90: - `setFilter` updates filter state and triggers `loadRecords()`.
91: - Exported hooks: `useNotebookRecords`, `useNotebookLoading`, `useNotebookFilter`.
92: - Drizzle import note: `eq`, `like`, `and`, `or`, `desc` are from `drizzle-orm` (not `drizzle-orm/sqlite-core`).
93: - TypeScript `npx tsc --noEmit` passed cleanly.
94: 
95: ## 2026-04-30: NotebookForm.tsx created
96: 
97: - **Pattern**: Modal form follows `SettingsSection.tsx` exactly — `Modal animationType="slide" transparent` with dark overlay, white card with `borderTopLeftRadius: 20`, `borderTopRightRadius: 20`, `maxHeight: "85%"`.
98: - **Store usage**: `useNotebookStore` selectors for `addRecord` and `updateRecord`. Add mode passes `NewMistakeRecord`, edit mode passes `Partial<MistakeRecord>` with the record's `id`.
99: - **Schema**: `MistakeRecord` fields: `problemText`, `userAnswer`, `correctAnswer` are `notNull()`. `analysis`, `tags`, `subject` are optional. `isReviewed` uses `integer({ mode: "boolean" })`.
100: - **Tags**: Stored as comma-separated text string in DB. Form uses single `TextInput` with placeholder hint "多个标签用逗号分隔".
101: - **Validation**: Client-side check on `problemText`, `userAnswer`, `correctAnswer` — red border (`borderColor: "#FF3B30"`, pink bg) + error text below input. State is cleared on modal open via `useEffect`.
102: - **Subject picker**: Horizontal pill buttons — tap to select, tap again to deselect. Active state uses `#007AFF` border/background.
103: - **Props pattern**: `visible`, `onClose`, `editRecord?`, `prefill?` — `useEffect` resets form on `visible` change, prioritizing `editRecord` over `prefill`.
104: 
105: ## 2026-04-30: MistakeCard and NotebookList components
106: 
107: - **MistakeCard.tsx**: Expandable card for a single `MistakeRecord`. Collapsed shows 2-line truncated problem, subject badge (colored pill), review status badge ("已复习 ✓" green or "待复习" amber), date, chevron. Expanded shows full problem, userAnswer (red `#D32F2F`), correctAnswer (green `#2E7D32`), analysis, tag chips, action row.
108: - **NotebookList.tsx**: `FlatList`-based list view pulling from `useNotebookRecords()`. Search bar calls `store.searchRecords` on submit, stores results in local `searchResults` state (not in store). Filter chips "全部/未复习/已复习" call `store.setFilter({ isReviewed })`. Empty state: centered Ionicons icon + Chinese text. Pull-to-refresh via `RefreshControl` calling `loadRecords`. Loading overlay via `ActivityIndicator`.
109: - **Subject color mapping**: algebra → `#007AFF`, geometry → `#34C759`, trigonometry → `#FF9500`, calculus → `#AF52DE`, statistics → `#FF2D55`, default → `#8E8E93`.
110: - **Tags parsing**: `parseTags` handles both JSON array strings and comma-separated text (two formats in case data comes from different sources).
111: - **Style**: Card `borderRadius: 12`, `elevation: 2`, `marginBottom: 8`. Follows existing white card + shadow pattern from `index.tsx` but with task-specific values.
112: - **Store pattern**: NotebookList does NOT pass `onEdit`/`onSolve` to MistakeCard — those are left for the consuming page to wire up. Only `onDelete` and `onToggleReview` are connected via store methods.
113: - **Search flow**: Local `searchResults` state overrides FlatList data when non-null. Clearing search resets to store records. This avoids mutating store state for search results.
114: 
115: ## 2026-04-30: ChatPanel shared component
116: 
117: - Created `components/ChatPanel.tsx` — shared chat component with two modes: "solve" and "explain".
118: - **Props**: `{ mode: "solve" | "explain", provider: LLMProvider | null, image?: string }` — minimal, self-contained API.
119: - **Solve mode**: imports `solveProblem` directly from `utils/solveAgent.ts`. Internal `onStep` callback updates `SolveStep[]` state progressively. "开始解题" button triggers the solve loop. Shows step cards (numbered badge, description, expression box, result box, LaTeX, GeoGebra), followed by a green "final answer" card on completion.
120: - **Explain mode**: uses `useExplainChat(provider)` hook from `utils/useExplainChat.ts`. Chat bubbles with user (right, blue) and assistant (left, white with "咕咕老师" label). Auto-scroll via `scrollViewRef.scrollToEnd` in a `useEffect` watching `explainChat.messages`. Streaming cursor (`▊`) when `msg.isStreaming`.
121: - **No-provider state**: Full-screen centered view with "cloud-offline" icon, descriptive Chinese text, and a `TouchableOpacity` → `router.push("/(tabs)/profile")` to navigate to profile tab for configuration.
122: - **Image picker**: Shared between both modes — `expo-image-picker` library picker. Shows a 48×48 thumbnail preview with X close button above the input area.
123: - **Input area**: Same layout for both modes — image picker icon (left), `TextInput` (#f2f2f7 bg, rounded), action button (right). Solve mode shows "开始解题" text button, explain mode shows a send icon button.
124: - **Loading state**: `ActivityIndicator` + text ("正在分析题目并逐步解题..." / "正在思考中..."). Solve mode also shows step count while solving.
125: - **Error state**: Red error card with retry button ("重新解题" for solve, "清空重试" for explain, which calls `explainChat.clearMessages()`).
126: - **Mode switching**: `useEffect` watches `mode` prop and resets all state (input, image, steps, messages) when mode changes, preventing stale state across modes.
127: - **TypeScript**: `npx tsc --noEmit` clean, LSP diagnostics clean.
128: - **Commit**: `feat(ui): add shared ChatPanel component with solve and explain modes`.
129: 
130: ## 2026-04-30: StepVisualizer component
131: 
132: - Created `components/StepVisualizer.tsx` — vertical timeline component for step-by-step UI.
133: - **Props**: `{ steps: SolveStep[], currentStepIndex: number, status, finalAnswer?, errorMessage? }`.
134: - **Layout**: flexible row: fixed 40px gutter + flexible card with `marginLeft: 12`.
135: - **Timeline**: two absolute-positioned line segments per step (upper from prev dot, lower to next) meeting at `DOT_CENTER` (18px paddingTop + 14px half-dot = 32px from top). Upper segment color = prev step state, lower segment color = this step state.
136: - **Dot**: 28px circle with white text (step number or ✓ for completed). Current step uses `Animated.loop` pulse (opacity 0.35→1 + scale 0.88→1.08, 900ms cycle). Uses `useNativeDriver: true`.
137: - **Card**: white bg, borderRadius 12, padding 16, shadow (matching `index.tsx` pattern), borderWidth 1. State-specific border colors: current=blue, error=red, completed=green.
138: - **States**: pending → dimmed (opacity 0.6), current → pulse anim dot + blue border, completed → green dot + green left accent, error → red dot + red border.
139: - **Final answer card**: green bg (`#E8F5E9`), green border 1.5, "最终答案" uppercase label, bold 18px answer text.
140: - **Empty/loading states**: idle → centered icon + text, solving with no steps → `ActivityIndicator` + text.
141: - **Auto-scroll**: `scrollRef.scrollTo` on `currentStepIndex` change, using `onLayout` y positions stored in `useRef`.
142: - **RN 0.83 gotcha**: `LayoutChangeEvent` is `NativeSyntheticEvent<{layout: LayoutRectangle}>` — use `LayoutChangeEvent` type directly, access `event.nativeEvent.layout.y`.
143: - **Line overlap trick**: lower segment overrides upper segment in overlap region [DOT_CENTER, H-DOT_CENTER], creating clean color transition at dot center. First step has no upper segment; last step connects to final answer via `showLowerLine` flag.
144: - **TypeScript**: `npx tsc --noEmit` clean, LSP diagnostics clean.
145: - **Commit**: `feat(ui): add StepVisualizer with timeline and step animations`.
146: 
147: ## 2026-04-30: explain.tsx page built
148: 
149: - Rewrote `app/(learning)/explain.tsx` replacing placeholder with full-page ChatPanel in "explain" mode
150: - Pattern: SafeAreaView → ChatPanel `mode="explain"` with `provider={provider}` from `useActiveLLMProvider()`
151: - Also handles loading state via `useLLMProvidersLoading()` with a spinner
152: - ChatPanel internally handles streaming, message bubbles, input, no-provider state — page stays thin
153: - Verification: `npx tsc --noEmit` passes with zero errors
154: - Commit: `833e2cf feat(page): add explain.tsx streaming explanation page`
155: 
156: ## 2026-04-30: solve.tsx page built
157: 
158: - Rewrote `app/(learning)/solve.tsx` replacing placeholder with full problem solving page
159: - **Architecture**: Two-branch conditional rendering:
160:   - No provider → `ChatPanel mode="solve" provider={null}` handles the no-provider state with "cloud-offline" icon + link to profile tab
161:   - Provider exists → Custom solve UI with header (back button), StepVisualizer timeline, completion section, and pinned input area at bottom
162: - **State management**: Page manages its own solve state (`steps`, `currentStepIndex`, `status`, `solveResult`, `errorMessage`) independently of ChatPanel
163: - **Solve flow**: `solveProblem()` is called directly by the page with an `onStep` callback that updates `steps` + `currentStepIndex` progressively, feeding StepVisualizer in real-time
164: - **Image support**: `expo-image-picker` library picker, preview thumbnail above input area
165: - **Completion section**: Green card ("解题完成") with solution type badge, step count, and "保存到错题本" button → opens NotebookForm modal with `prefill` containing problemText, correctAnswer, and analysis (step descriptions joined)
166: - **States handled**: idle (calculator icon + prompt), solving (ActivityIndicator + step count), completed (green card + save), error (red card + retry button)
167: - **Style patterns**: Follows project conventions — bg `#f5f5f5`, white cards with `borderRadius: 12` and shadows, iOS-style input bar with `#f2f2f7` input bg
168: - **Gotcha**: `errorMessage: string | null` must be narrowed to `string | undefined` with `??` for StepVisualizer's `errorMessage?: string` prop (TS strict mode)
169: - **Verification**: `npx tsc --noEmit` passes with zero errors, LSP diagnostics clean
170: - **Commit**: `feat(page): add solve.tsx problem solving page`
171: 
172: ## 2026-04-30: Final QA (T19)
173: 
174: - **tsc --noEmit**: passes with zero errors across all source files (stores/, utils/, components/, app/)
175: - **LSP diagnostics**: zero errors in all directories
176: - **Tests**: 33 pass, 0 fail, 128 expect() calls across 3 test files, 281ms runtime
177:   - `__tests__/notebookStore.test.ts` — CRUD contract tests (add, load/filter, update, delete, toggleReview, search, setFilter)
178:   - `__tests__/StepVisualizer.test.ts` — helper function tests (getStepState, getStepColor, getStepBgColor, COLORS, SolveStep structure)
179:   - `__tests__/solveAgent.test.ts` — export/type structure tests (solveProblem, imageToBase64, SolveStep, SolveResult, StepCallback)
180: - **Test approach**: Pure logic tests using `bun:test`, no React Native dependencies, minimal types matching source interfaces
181: - **Evidence**: Saved to `.sisyphus/evidence/tsc-pass.txt` and `.sisyphus/evidence/unit-tests-pass.txt`
182: - **Orphaned files**: `components/StepVisualizer.tsx` and `stores/notebookStore.ts` were untracked (not committed by previous tasks) — included in this commit
183: - **Commit**: `chore(qa): TypeScript fixes and unit tests`
