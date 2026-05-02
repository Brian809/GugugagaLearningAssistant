# 咕咕嘎嘎学习助手

AI 驱动的数学学习伴侣 —— 说一句话，画出你想要的几何图形。

支持 AI 解题、AI 讲解、错题本管理，以及通过 GeoGebra 画板实时构造几何图形。跨平台运行于 iOS、Android、Web。

## 功能

### 核心功能

| 功能 | 说明 | 状态 |
|------|------|------|
| **GeoGebra AI 助手** | 通过文字描述或拍照上传，AI 在 GeoGebra 画板中逐步构造几何图形 | 可用，Agent 机制仍在优化 |
| **AI 解题** | 拍照或输入题目，AI 分步推理给出解答 | 可用 |
| **AI 讲解** | 对话式讲解数学概念，支持多轮追问 | 可用 |
| **错题本** | 保存错题并分类管理，支持回顾复习 | 可用 |
| **多 AI 提供商** | 支持 OpenAI、Claude、Gemini、DeepSeek、通义千问、Kimi 等 9 家预设 | 可用 |
| **对话历史** | 所有对话自动保存，支持回看和切换 | 可用 |

### 路线图

| 阶段 | 内容 | 说明 |
|------|------|------|
| **GeoGebra Agent 完善** | 优化 AI 生成 GeoGebra 命令的准确率，覆盖更多几何场景（辅助线、动点轨迹、不等式区域等），减少无效构造和冗余命令 | 核心画图能力打磨 |
| **学习区画板集成** | 将 GeoGebra 画板嵌入解题、讲题流程中，AI 根据题目内容判断是否需要几何构造，按需打开画板辅助理解 | 画板从独立 Tab 融入学习闭环 |
| **错题分析** | 为每道错题自动生成知识标签（由 AI 打标），系统根据标签分布和题目信息评估各知识点的掌握程度，形成薄弱点热力图 | 从"记错题"到"懂错题" |
| **错题打印** | 支持错题导出为可打印格式，兼容 iOS / Android / Web 多端预览与分享 | 线上刷题 + 线下复习 |
| **PDF to Markdown** | 题目 PDF 转 Markdown，基于 MarkitDown 开源项目实现，保留图片与公式，统一排版以便 AI 读取和结构化存储 | 打通纸质资料数字化入口 |

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Expo 55 + React Native 0.83 + React 19 |
| 语言 | TypeScript 5.9 (strict mode) |
| 路由 | Expo Router (文件路由) |
| 状态管理 | Zustand |
| AI SDK | Vercel AI SDK v6 + @ai-sdk/openai + @openrouter/ai-sdk-provider |
| 数据库 | expo-sqlite + Drizzle ORM (移动端), localStorage (Web) |
| 几何画板 | GeoGebra JS API (Web 端嵌入 / 移动端 WebView) |
| 安全存储 | expo-secure-store |
| 构建 | EAS Build |

## 快速开始

### 环境要求

- Node.js 18+
- pnpm（项目使用 pnpm 作为包管理器）
- Expo CLI

### 安装与运行

```bash
# 1. 安装依赖
pnpm install

# 2. 启动开发服务器
npx expo start
```

启动后可以选择：
- 按 `a` 打开 Android 模拟器
- 按 `i` 打开 iOS 模拟器
- 按 `w` 在浏览器中打开 Web 版
- 扫码在 Expo Go 中运行（功能受限，建议使用 development build）

### 配置 AI 提供商

本应用**无需配置 `.env` 文件**。所有 AI 提供商的 API Key 通过应用内设置页面配置：

1. 进入「我的」Tab
2. 在「LLM 提供商设置」中添加或选择提供商
3. 填入 API Key 和接口地址
4. 启用该提供商即可使用

API Key 通过 `expo-secure-store` 安全存储在设备本地，不会上传到任何第三方服务器。

支持的 AI 提供商：OpenAI、Anthropic Claude、Google Gemini、OpenRouter、阿里云百炼、Moonshot、DeepSeek、硅基流动，以及任意 OpenAI 兼容接口的自定义服务。

## 项目结构

```
app/                         # Expo Router 路由
├── (tabs)/                  # Tab 导航组
│   ├── _layout.tsx          # 4 个 Tab：首页/学习/我的/GeoGebra
│   ├── index.tsx            # 首页
│   ├── learning.tsx         # 学习功能入口
│   ├── profile.tsx          # 个人中心 + 设置
│   └── geogebra.tsx         # GeoGebra 几何画板 + AI 助手
├── (learning)/              # 学习功能组
│   ├── solve.tsx            # AI 解题
│   ├── explain.tsx          # AI 讲解
│   └── notebook.tsx         # 错题本
components/                  # 通用组件
stores/                      # Zustand 状态管理
utils/                       # 工具函数与 AI Agent
drizzle/                     # 数据库 schema 与迁移
```

## 当前局限

- **GeoGebra Agent**：AI 生成的 GeoGebra 命令在某些复杂图形上可能不够准确，正在持续优化
- **学习区**：首页的学习计划和进度跟踪功能尚未完成；学习区与 GeoGebra 画板的集成仍在开发中
- **Expo Go 兼容性**：部分功能（如 SQLite 对话持久化）依赖原生模块，建议使用 development build 而非 Expo Go
- **移动端适配**：iOS / Android 端尚未充分测试，可能存在较多 UI 兼容性问题和功能缺陷
- **稳定性**：项目处于早期开发阶段，bug 较多，API 和架构可能频繁变动，暂不建议用于生产环境

## License

MIT
