import { generateText, tool } from "ai";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { LLMProvider, SUPPORTED_MODELS } from "./llmProviders";

// 为了保持向后兼容，保留旧版本的类型定义
export type GeoGebraAnalysis = {
  description: string;
  elements: {
    type: string;
    name: string;
    definition: string;
    properties?: Record<string, unknown>;
  }[];
  commands: {
    type: "command" | "expression";
    content: string;
    description?: string;
  }[];
  suggestedSteps: string[];
};

/**
 * 获取要使用的模型名称
 */
function getModelName(provider: LLMProvider, requireMultimodal: boolean = false): string {
  if (provider.modelName) {
    return provider.modelName;
  }
  // 从 SUPPORTED_MODELS 中找到匹配 provider 的第一个模型
  const providerType = provider.providerType.replace("Compatible", "").toLowerCase();
  const matchingModels = SUPPORTED_MODELS.filter(
    (m) => m.provider.toLowerCase() === providerType || m.provider.toLowerCase() === provider.providerName.toLowerCase()
  );
  
  if (requireMultimodal) {
    const multimodalModel = matchingModels.find((m) => m.multimodal);
    if (multimodalModel) {
      return multimodalModel.id;
    }
  }
  
  return matchingModels[0]?.id || "gpt-4o";
}

/**
 * 创建 AI 客户端
 * 
 * 对于 OpenRouter，使用专用的 @openrouter/ai-sdk-provider 以获得更好的兼容性
 * 对于其他提供商，使用通用的 @ai-sdk/openai
 */
function createAIClient(provider: LLMProvider) {
  const isOpenRouter = provider.baseUrl.includes("openrouter.ai");
  
  if (isOpenRouter) {
    return createOpenRouter({
      apiKey: provider.apiKey,
    });
  }
  
  return createOpenAI({
    baseURL: provider.baseUrl,
    apiKey: provider.apiKey,
  });
}

// 步骤信息类型
export type GeoGebraStep = {
  stepNumber: number;
  totalSteps: number;
  command: string;
  description: string;
  expectedResult: string;
};

// 步骤执行回调类型
export type StepExecutionCallback = (step: GeoGebraStep) => Promise<{ success: boolean; error?: string }>;

/**
 * 将图片转换为 base64 格式
 */
export async function imageToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 生成单步注入脚本
 * 
 * 支持多命令（用分号或换行分隔），每个命令单独执行
 */
export function generateSingleStepScript(command: string): string {
  // 清理命令
  let cleanCommand = command.trim();
  if (cleanCommand.startsWith("=")) {
    cleanCommand = cleanCommand.substring(1).trim();
  }

  // 将多命令分割成数组（支持分号和换行分隔）
  const commands = cleanCommand
    .split(/[;\n]/)
    .map(cmd => cmd.trim())
    .filter(cmd => cmd.length > 0);

  // 如果没有命令，返回空脚本
  if (commands.length === 0) {
    return "(function() { return false; })();";
  }

  // 转义每个命令
  const escapedCommands = commands.map(cmd => 
    cmd.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  );

  // 生成多命令执行脚本
  const commandCalls = escapedCommands
    .map(cmd => `      ggbApplet.evalCommand("${cmd}");`)
    .join("\n");

  // 生成自执行函数脚本
  return `
(function() {
  try {
    if (typeof ggbApplet !== 'undefined' && ggbApplet.evalCommand) {
${commandCalls}
      ggbApplet.refreshViews();
      return true;
    } else {
      console.error('ggbApplet not available');
      return false;
    }
  } catch (e) {
    console.error('GeoGebra command error:', e);
    return false;
  }
})();
  `.trim();
}

/**
 * 分析图片并逐步生成 GeoGebra 指令（手动循环模式）
 * 
 * 使用手动循环而不是 stopWhen，以确保与 OpenRouter 等提供商的兼容性
 */
export async function analyzeImageWithSteps(
  imageUri: string,
  provider: LLMProvider,
  onStepExecution: StepExecutionCallback,
  userPrompt?: string
): Promise<{ description: string; elements: unknown[]; suggestedSteps: string[] }> {
  const client = createAIClient(provider);
  const base64Image = await imageToBase64(imageUri);
  const mimeType = imageUri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const modelName = getModelName(provider, true);

  const userMessageContent = userPrompt
    ? `${userPrompt}\n\n请分析这张几何图片，然后分步生成 GeoGebra 指令。一次执行一条命令，等待执行结果后再继续。`
    : "请分析这张几何图片，然后分步生成 GeoGebra 指令来重建这个图形。一次执行一条命令，等待执行结果后再继续。";

  // 系统提示
  const systemPrompt = `你是一个专业的几何绘图助手，使用 GeoGebra 重建几何图形。

## 执行规则（必须遵守）
1. 分析图片后，规划作图步骤
2. 生成一条 GeoGebra 命令（以 JSON 格式返回）
3. 等待用户返回执行结果
4. 如果成功，继续执行下一条命令
5. 如果失败，分析原因并调整
6. 所有命令执行完毕后，返回完成状态

## 作图原则
- 从基础元素开始：先创建点（如 A = (0, 0)）
- 逐步构建：点 → 线 → 圆 → 多边形
- 依赖关系：确保引用已创建的元素
- 一次一条：禁止一次返回多条命令（不要用分号分隔）

## 响应格式
你必须以 JSON 格式响应，包含以下字段：
- stepNumber: 当前步骤序号
- totalSteps: 预计总步骤数
- command: GeoGebra 命令（仅一条，不要用分号分隔多条命令）
- description: 命令说明
- expectedResult: 预期结果
- isComplete: 是否完成（true/false）
- finalDescription: 完成时的图形描述（仅 isComplete=true 时需要）
- finalElements: 完成时的元素列表（仅 isComplete=true 时需要）
- finalSteps: 完成时的步骤总结（仅 isComplete=true 时需要）

## GeoGebra 常用命令（每条命令单独执行）
- 创建点：A = (0, 0)  或  B = (3, 4)
- 创建线段：s = Segment(A, B)
- 创建直线：l = Line(A, B)
- 创建圆：c = Circle(A, 5)
- 创建多边形：poly = Polygon(A, B, C, D)
- 创建交点：E = Intersect(c, l)
- 创建角度：α = Angle(A, B, C)

## 重要提示
- 每个步骤只能包含一条 GeoGebra 命令
- 错误示例：A = (0, 0); B = (3, 0); C = (3, 3)  （这是三条命令）
- 正确示例：A = (0, 0)  （这是单条命令）`

  // 存储最终结果
  let finalResult: { description: string; elements: unknown[]; suggestedSteps: string[] } | null = null;
  const allSteps: string[] = [];
  let stepCount = 0;
  const maxSteps = 50;

  // 第一轮：发送图片 + 获取分析
  console.log("\n=== 第 1 步：分析图片 ===");
  
  const firstResult = await generateText({
    model: client(modelName),
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userMessageContent },
          { 
            type: "image", 
            image: base64Image,
            mediaType: mimeType,
          },
        ],
      },
    ],
  });

  // 解析第一轮响应
  let stepData: {
    stepNumber: number;
    totalSteps: number;
    command: string;
    description: string;
    expectedResult: string;
    isComplete: boolean;
    finalDescription?: string;
    finalElements?: unknown[];
    finalSteps?: string[];
  };

  try {
    const jsonMatch = firstResult.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      stepData = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("无法解析模型响应");
    }
  } catch {
    console.error("第一轮解析失败:", firstResult.text);
    throw new Error("模型未返回有效的 JSON 格式");
  }

  // 初始化消息历史，保持一致性
  // 包含：system + 带图片的 user 消息 + assistant 回复
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { 
      role: "user" as const, 
      content: [
        { type: "text" as const, text: userMessageContent },
        { type: "image" as const, image: base64Image, mediaType: mimeType },
      ],
    },
    { role: "assistant" as const, content: firstResult.text },
  ];

  // 手动循环执行
  while (stepCount < maxSteps) {
    stepCount++;
    console.log(`\n=== 开始第 ${stepCount} 步 ===`);

    // 检查是否完成
    if (stepData.isComplete) {
      finalResult = {
        description: stepData.finalDescription || "绘图完成",
        elements: stepData.finalElements || [],
        suggestedSteps: stepData.finalSteps || allSteps,
      };
      break;
    }

    // 执行命令
    console.log(`执行步骤 ${stepData.stepNumber}/${stepData.totalSteps}: ${stepData.command}`);
    allSteps.push(`${stepData.stepNumber}. ${stepData.description}: ${stepData.command}`);

    const executionResult = await onStepExecution({
      stepNumber: stepData.stepNumber,
      totalSteps: stepData.totalSteps,
      command: stepData.command,
      description: stepData.description,
      expectedResult: stepData.expectedResult,
    });

    // 将执行结果添加到消息历史
    messages.push({
      role: "user" as const,
      content: [{ type: "text" as const, text: `执行结果: ${executionResult.success ? "成功" : "失败"}${executionResult.error ? `, 错误: ${executionResult.error}` : ""}\n\n请继续下一步，以 JSON 格式返回。` }],
    });

    // 调用模型获取下一步
    const result = await generateText({
      model: client(modelName),
      messages,
    });

    // 解析模型响应
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        stepData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("无法解析模型响应");
      }
    } catch {
      console.error("解析响应失败:", result.text);
      // 如果解析失败，提示模型重新返回
      messages.push({ role: "assistant" as const, content: result.text });
      messages.push({ role: "user" as const, content: [{ type: "text" as const, text: "请以上述 JSON 格式返回下一步命令。" }] });
      continue;
    }

    // 将模型响应添加到消息历史
    messages.push({
      role: "assistant" as const,
      content: result.text,
    });
  }

  if (!finalResult) {
    throw new Error(`绘图未完成，已达到最大步骤数 (${maxSteps})`);
  }

  return finalResult;
}

/**
 * 根据描述逐步生成 GeoGebra 指令（手动循环模式）
 */
export async function generateFromDescriptionWithSteps(
  description: string,
  provider: LLMProvider,
  onStepExecution: StepExecutionCallback
): Promise<{ description: string; elements: unknown[]; suggestedSteps: string[] }> {
  const client = createAIClient(provider);
  const modelName = getModelName(provider, false);

  // 系统提示
  const systemPrompt = `你是一个专业的几何绘图助手，使用 GeoGebra 根据描述绘制几何图形。

## 执行规则（必须遵守）
1. 理解描述，规划作图步骤
2. 生成一条 GeoGebra 命令（以 JSON 格式返回）
3. 等待用户返回执行结果
4. 如果成功，继续执行下一条命令
5. 如果失败，分析原因并调整
6. 所有命令执行完毕后，返回完成状态

## 作图原则
- 从基础元素开始：先创建点（如 A = (0, 0)）
- 逐步构建：点 → 线 → 圆 → 多边形
- 依赖关系：确保引用已创建的元素
- 一次一条：禁止一次返回多条命令（不要用分号分隔）

## 响应格式
你必须以 JSON 格式响应，包含以下字段：
- stepNumber: 当前步骤序号
- totalSteps: 预计总步骤数
- command: GeoGebra 命令（仅一条，不要用分号分隔多条命令）
- description: 命令说明
- expectedResult: 预期结果
- isComplete: 是否完成（true/false）
- finalDescription: 完成时的图形描述（仅 isComplete=true 时需要）
- finalElements: 完成时的元素列表（仅 isComplete=true 时需要）
- finalSteps: 完成时的步骤总结（仅 isComplete=true 时需要）

## GeoGebra 常用命令（每条命令单独执行）
- 创建点：A = (0, 0)  或  B = (3, 4)
- 创建线段：s = Segment(A, B)
- 创建直线：l = Line(A, B)
- 创建圆：c = Circle(A, 5)
- 创建多边形：poly = Polygon(A, B, C, D)
- 创建交点：E = Intersect(c, l)
- 创建角度：α = Angle(A, B, C)

## 重要提示
- 每个步骤只能包含一条 GeoGebra 命令
- 错误示例：A = (0, 0); B = (3, 0); C = (3, 3)  （这是三条命令）
- 正确示例：A = (0, 0)  （这是单条命令）`;

  // 初始化消息历史
  type Message = 
    | { role: "system"; content: string }
    | { role: "user"; content: string | Array<{ type: "text"; text: string } | { type: "image"; image: string; mediaType: string }> }
    | { role: "assistant"; content: string };
  
  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `请根据以下描述绘制几何图形，分步执行：\n\n${description}` },
  ];

  // 存储最终结果
  let finalResult: { description: string; elements: unknown[]; suggestedSteps: string[] } | null = null;
  const allSteps: string[] = [];
  let stepCount = 0;
  const maxSteps = 50;

  // 手动循环执行
  while (stepCount < maxSteps) {
    stepCount++;
    console.log(`\n=== 开始第 ${stepCount} 步 ===`);

    // 调用模型获取下一步
    const result = await generateText({
      model: client(modelName),
      messages,
    });

    // 解析模型响应
    let stepData: {
      stepNumber: number;
      totalSteps: number;
      command: string;
      description: string;
      expectedResult: string;
      isComplete: boolean;
      finalDescription?: string;
      finalElements?: unknown[];
      finalSteps?: string[];
    };

    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        stepData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("无法解析模型响应");
      }
    } catch {
      console.error("解析响应失败:", result.text);
      messages.push({ role: "assistant" as const, content: result.text });
      messages.push({ role: "user" as const, content: "请以上述 JSON 格式返回下一步命令。" });
      continue;
    }

    // 检查是否完成
    if (stepData.isComplete) {
      finalResult = {
        description: stepData.finalDescription || "绘图完成",
        elements: stepData.finalElements || [],
        suggestedSteps: stepData.finalSteps || allSteps,
      };
      break;
    }

    // 执行命令
    console.log(`执行步骤 ${stepData.stepNumber}/${stepData.totalSteps}: ${stepData.command}`);
    allSteps.push(`${stepData.stepNumber}. ${stepData.description}: ${stepData.command}`);

    const executionResult = await onStepExecution({
      stepNumber: stepData.stepNumber,
      totalSteps: stepData.totalSteps,
      command: stepData.command,
      description: stepData.description,
      expectedResult: stepData.expectedResult,
    });

    // 将执行结果添加到消息历史
    messages.push({
      role: "user" as const,
      content: `执行结果: ${executionResult.success ? "成功" : "失败"}${executionResult.error ? `, 错误: ${executionResult.error}` : ""}\n\n请继续下一步，以 JSON 格式返回。`,
    });

    // 将模型响应添加到消息历史
    messages.push({
      role: "assistant" as const,
      content: result.text,
    });
  }

  if (!finalResult) {
    throw new Error(`绘图未完成，已达到最大步骤数 (${maxSteps})`);
  }

  return finalResult;
}

// ==================== 向后兼容的旧版本 API ====================

// 旧版工具定义（用于一次性返回）
const analyzeGeometryTool = tool({
  description: "分析几何图形并返回完整的 GeoGebra 指令",
  inputSchema: z.object({
    description: z.string(),
    elements: z.array(z.object({
      type: z.enum([
        "point", "line", "segment", "ray", "vector",
        "circle", "ellipse", "arc", "polygon", "angle",
        "function", "conic", "parabola", "hyperbola",
        "text", "slider", "locus", "implicit", "surface",
        "curve", "polyhedron", "sphere", "cylinder",
        "cone", "prism", "pyramid"
      ]),
      name: z.string(),
      definition: z.string(),
      properties: z.record(z.string(), z.unknown()).optional(),
    })),
    commands: z.array(z.object({
      type: z.enum(["command", "expression"]),
      content: z.string(),
      description: z.string().optional(),
    })),
    suggestedSteps: z.array(z.string()),
  }),
  strict: true,
});

/**
 * 生成 GeoGebra 注入脚本（旧版本 - 一次性注入所有命令）
 * @deprecated 建议使用新的多步执行 API
 */
export function generateGeoGebraInjectionScript(analysis: GeoGebraAnalysis): string {
  const commands = analysis.commands.map(cmd => {
    let content = cmd.content.trim();
    if (content.startsWith("=")) {
      content = content.substring(1).trim();
    }
    return content;
  });

  const scriptLines = [
    "// 清空现有对象",
    "ggbApplet.reset();",
    "",
    "// 创建几何图形",
    ...commands.map(cmd => `ggbApplet.evalCommand("${cmd.replace(/"/g, '\\"')}");`),
    "",
    "// 刷新视图",
    "ggbApplet.refreshViews();",
  ];

  return scriptLines.join("\n");
}

/**
 * 分析图片并生成 GeoGebra 指令（旧版本 - 一次性返回）
 * @deprecated 建议使用 analyzeImageWithSteps 进行多步执行
 */
export async function analyzeImageForGeoGebra(
  imageUri: string,
  provider: LLMProvider,
  userPrompt?: string
): Promise<GeoGebraAnalysis> {
  const client = createAIClient(provider);
  const base64Image = await imageToBase64(imageUri);
  const mimeType = imageUri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

  const userMessage = userPrompt
    ? `${userPrompt}\n\n请分析这张几何图片并生成 GeoGebra 指令。`
    : "请分析这张几何图片并生成 GeoGebra 指令来重建这个图形。";

  const modelName = getModelName(provider, true);

  const result = await generateText({
    model: client(modelName),
    tools: {
      analyzeGeometry: analyzeGeometryTool,
    },
    toolChoice: "required",
    messages: [
      {
        role: "system",
        content: "你是一个专业的数学几何助手。请使用 analyzeGeometry 工具分析几何图形。",
      },
      {
        role: "user",
        content: [
          { type: "text", text: userMessage },
          { type: "image", image: base64Image, mediaType: mimeType },
        ],
      },
    ],
  });

  const toolCall = result.toolCalls?.[0];
  if (toolCall?.toolName === "analyzeGeometry") {
    const args = (toolCall as unknown as { args: GeoGebraAnalysis }).args;
    return args;
  }

  throw new Error("模型未返回有效的几何分析结果");
}

/**
 * 根据描述生成 GeoGebra 指令（旧版本 - 一次性返回）
 * @deprecated 建议使用 generateFromDescriptionWithSteps 进行多步执行
 */
export async function generateGeoGebraFromDescription(
  description: string,
  provider: LLMProvider
): Promise<GeoGebraAnalysis> {
  const client = createAIClient(provider);
  const modelName = getModelName(provider, false);

  const result = await generateText({
    model: client(modelName),
    tools: {
      analyzeGeometry: analyzeGeometryTool,
    },
    toolChoice: "required",
    messages: [
      {
        role: "system",
        content: "你是一个专业的数学几何助手。请使用 analyzeGeometry 工具生成 GeoGebra 指令。",
      },
      {
        role: "user",
        content: `请根据以下描述生成 GeoGebra 指令：\n\n${description}`,
      },
    ],
  });

  const toolCall = result.toolCalls?.[0];
  if (toolCall?.toolName === "analyzeGeometry") {
    const args = (toolCall as unknown as { args: GeoGebraAnalysis }).args;
    return args;
  }

  throw new Error("模型未返回有效的几何分析结果");
}
