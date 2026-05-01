# 项目规范

## 基本规则
- 安装新包，请使用命令 `npx expo install <package>`，而不是 `npm install <package>`。
- 你无需启动测试服务器，如果需要请提醒用户。
- 包管理器使用 `pnpm`（项目根目录有 `pnpm-lock.yaml` 和 `pnpm-workspace.yaml`）。

---

## 项目概览

**项目名称**: GugugagaLearningAssistant (咕咕嘎嘎学习助手)
**技术栈**: Expo 55 + React Native 0.83 + React 19 + TypeScript 5.9
**路由**: Expo Router (文件路由)
**状态管理**: Zustand
**AI SDK**: Vercel AI SDK v6 + @ai-sdk/openai + @openrouter/ai-sdk-provider
**跨平台**: iOS / Android / Web

---

## 目录结构

```
├── app/                          # Expo Router 路由 (文件路由)
│   ├── (learning)/               # 学习功能组
│   │   ├── explain.tsx           # AI讲解 - 对话历史 + ChatPanel
│   │   └── solve.tsx             # AI解题 - 对话历史 + StepVisualizer
│   └── (tabs)/                   # Tab 导航组
│       ├── _layout.tsx           # Tab 布局配置 (4个Tab)
│       ├── index.tsx             # 首页 - 欢迎页 + 功能卡片
│       ├── learning.tsx          # 学习页面 (占位)
│       ├── profile.tsx           # 我的页面 - 用户信息 + 设置
│       ├── geogebra.tsx          # GeoGebra 几何画板 + AI助手 (核心功能)
│       └── test-store.tsx        # LLM Provider Store 测试页
├── components/
│   ├── SettingsSection.tsx       # LLM提供商设置组件 (完整CRUD UI)
│   └── ConversationList.tsx      # 对话历史列表 Modal (通用组件)
├── stores/
│   ├── llmProviderStore.ts       # Zustand 状态管理 - LLM提供商管理
│   └── conversationStore.ts      # Zustand 状态管理 - 对话历史 CRUD
├── utils/
│   ├── llmProviders.ts           # LLM提供商类型定义 + Zod校验 + CRUD函数
│   ├── modelFetcher.ts           # 动态获取提供商模型列表
│   ├── storage.ts                # 跨平台存储封装 (SecureStore/localStorage)
│   ├── createLearningClient.ts   # 共享 AI 客户端工厂 (createOpenAI/createOpenRouter)
│   ├── geogebraAgent.ts          # AI驱动的GeoGebra指令生成 (function calling)
│   ├── solveAgent.ts             # AI解题代理 (function calling 逐步推理)
│   ├── explainAgent.ts           # AI讲解系统提示词
│   └── useExplainChat.ts         # 讲解模式 Chat Hook (带对话持久化)
├── assets/images/                # 静态资源
├── app.json                      # Expo 配置
├── eas.json                      # EAS Build 配置
├── tsconfig.json                 # TypeScript 配置 (strict mode, @/* 别名)
└── eslint.config.js              # ESLint 配置
```

---

## 核心功能模块

### 1. Tab 导航 (4个Tab)
| Tab | 路由 | 图标 | 说明 |
|-----|------|------|------|
| 首页 | `index.tsx` | home | 欢迎页，展示功能卡片（学习资源/学习计划/进度跟踪） |
| 学习 | `learning.tsx` | book | 占位页面，待开发 |
| 我的 | `profile.tsx` | person | 用户信息 + 功能菜单 + LLM提供商设置 |
| GeoGebra | `geogebra.tsx` | calculator | **核心功能** - 几何画板 + AI对话助手 |

### 2. LLM 提供商管理
- **类型定义**: `utils/llmProviders.ts` - `LLMProvider` 接口 + Zod Schema
- **状态管理**: `stores/llmProviderStore.ts` - Zustand store
- **存储**: `utils/storage.ts` - 跨平台封装 (移动端 SecureStore, Web localStorage)
- **支持的提供商类型**:
  - `openAiCompatible` - OpenAI 兼容 (OpenAI, OpenRouter, 阿里云, Moonshot, DeepSeek, 硅基流动)
  - `anthropicCompatible` - Anthropic 兼容
  - `googleCompatible` - Google Gemini 兼容
  - `qwenCompatible` - 通义千问
  - `kimiCompatible` - Kimi
- **预设提供商**: 9个预设 (OpenAI, Claude, Gemini, OpenRouter, 阿里云, Moonshot, DeepSeek, 硅基流动, 自定义)
- **模型列表**: 支持从提供商 API 动态获取模型列表，分类推荐/其他
- **SUPPORTED_MODELS**: 内置模型列表 (GPT-4.1/4o/o3/o4-mini, Claude Opus/Sonnet/Haiku, Qwen, Kimi, Gemini)
- **规则**: 只能有一个活跃的提供商

### 3. 对话历史系统 (Conversation System)
- **Store**: `stores/conversationStore.ts` - Zustand store
- **组件**: `components/ConversationList.tsx` - Modal 列表 UI
- **数据库表**: `conversations` (id, type, title, messages, created_at, updated_at)
- **持久化**: Web = localStorage, 移动端 = SQLite (Drizzle ORM)
- **Store API**:
  - `loadConversations(type)` - 按类型加载对话列表
  - `createConversation(type, title)` → `id` - 创建新对话
  - `deleteConversation(id)` - 删除对话
  - `appendMessages(id, msgs[])` - 追加消息
  - `replaceMessages(id, msgs[])` - 替换全部消息
  - `updateTitle(id, title)` - 更新标题
- **支持三种类型**: `explain` (讲解), `solve` (解题), `geogebra` (几何绘图)
- **集成页面**: explain.tsx, solve.tsx, geogebra.tsx, ChatPanel.tsx
- **特性**:
  - 每个页面顶部 "对话历史" 按钮 → 弹出 Modal 列表
  - 长按/点击删除图标可删除对话
  - 新建对话自动生成 ID 并激活
  - 切换对话时加载对应历史消息
  - 支持取消/中止进行中的 AI 请求 (AbortController)
  - 加载中按钮变为红色停止按钮 (Stop → Abort)

### 4. GeoGebra AI 助手 (核心功能)
- **页面**: `app/(tabs)/geogebra.tsx` (~1350行)
- **AI Agent**: `utils/geogebraAgent.ts` (~500行, 已重构)
- **共享客户端**: `utils/createLearningClient.ts` - `createAIClient`, `getModelName`, `isOpenRouterProvider` (与 solveAgent/useExplainChat 共享)
- **功能**:
  - 通过 AI function calling 分步执行 GeoGebra 命令
  - 支持图片分析 (多模态) → 几何图形重建
  - 支持文本描述 → 几何图形生成
  - 逐步执行，每步等待执行结果再继续
  - Web端: 使用 GeoGebra JS API 直接嵌入
  - 移动端: 使用 WebView 加载 HTML 字符串注入 GeoGebra
- **布局**: 大屏/横屏 = 左右布局 (35%聊天 + 65%画板), 小屏 = 上下布局
- **工具定义**: `execute_geo_gebra_step` + `complete_geo_gebra_task`
- **最大步骤**: 50步
- **新增参数**: `signal` (AbortSignal 支持取消), `historyMessages` (多轮对话上下文)
- **GeoGebra 命令改进**: Intersect 用法说明, 垂足方案, 避免常见错误

### 5. 模型获取 (modelFetcher)
- 动态从提供商 API 获取可用模型列表
- 支持解析 OpenAI/Anthropic/Google 格式的响应
- 按提供商类型分类推荐模型
- 自动检测多模态能力

---

## 技术细节

### 存储方案
```typescript
// 跨平台存储 (utils/storage.ts)
// Web: localStorage
// iOS/Android: expo-secure-store
import * as Storage from "../utils/storage";
await Storage.setItemAsync("key", "value");
await Storage.getItemAsync("key");
await Storage.deleteItemAsync("key");
```

### Zustand Store 模式
```typescript
// stores/llmProviderStore.ts
// 使用 create() + 工厂函数模式
// 所有异步操作自动保存到存储
// 提供便捷 hooks: useLLMProviders, useActiveLLMProvider, useLLMProvidersLoading

// stores/conversationStore.ts
// 对话历史 CRUD store
// 跨平台持久化: Web → localStorage, 移动端 → SQLite (Drizzle ORM)
// 异步操作后自动更新内存状态 + 持久化存储
// 便捷 hooks: useConversationList, useActiveConversationId, useConversationLoading
```

### AI SDK 使用
```typescript
// utils/geogebraAgent.ts
import { generateText, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// OpenRouter 使用专用 provider
// 其他使用通用 OpenAI 兼容 provider
// function calling 模式: toolChoice = "required" (OpenRouter = "auto")
```

### GeoGebra 集成
- **Web**: 动态加载 `deployggb.js` → GGBApplet → HTML5 codebase
- **移动端**: WebView 内嵌完整 HTML → deployggb.js → 通过 postMessage 通信
- **命令执行**: `ggbApplet.evalCommand(command)` + `ggbApplet.refreshViews()`
- **脚本注入**: 通过 `injectJavaScript` 或 React state 触发

---

## 开发规范

### 代码风格
- TypeScript strict mode
- ESLint with `eslint-config-expo`
- 路径别名: `@/*` → `./*`

### Expo 配置
- **包名**: `com.brianeee.GugugagaLearningAssistant`
- **Scheme**: `gugugagalearningassistant`
- **EAS 构建**: development / preview / production 三种配置
- **实验性功能**: typedRoutes, reactCompiler
- **插件**: expo-router, expo-secure-store, expo-font, expo-web-browser, expo-splash-screen

### 构建配置 (eas.json)
- **development**: Development Client, 内部分发
- **preview**: 内部分发
- **production**: 自动递增版本号
