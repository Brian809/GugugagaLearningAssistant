import { generateText, tool, ModelMessage } from "ai";
import { z } from "zod";
import { createAIClient, isOpenRouterProvider, getModelName } from "./createLearningClient";
import { LLMProvider } from "./llmProviders";

// ==================== 类型定义 ====================

export interface SolveStep {
  stepNumber: number;
  description: string;
  expression?: string;
  result?: string;
  latexFormula?: string;
  geogebraCommand?: string;
}

export interface SolveResult {
  finalAnswer: string;
  steps: SolveStep[];
  solutionType: string;
}

export type StepCallback = (step: SolveStep) => Promise<{ success: boolean; error?: string }>;

// ==================== 图片转换工具 ====================

/**
 * 将图片 URI 转换为 base64 字符串
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

// ==================== Function Calling 工具定义 ====================

// 步骤执行工具：模型返回单步解题步骤
const executeSolveStepTool = tool({
  description:
    "执行单步解题步骤。返回当前步骤的描述和计算内容，等待确认后继续下一步。",
  inputSchema: z.object({
    stepNumber: z.number().describe("当前步骤序号，从 1 开始"),
    description: z.string().describe("步骤说明，描述这一步在做什么"),
    expression: z.string().optional().describe("表达式或计算过程（可选）"),
    result: z.string().optional().describe("本步骤的中间结果（可选）"),
    latexFormula: z.string().optional().describe("LaTeX 数学公式（可选）"),
    geogebraCommand: z.string().optional().describe("GeoGebra 命令，用于几何可视化（可选）"),
  }),
  strict: true,
});

// 完成状态工具：模型返回完成状态和最终答案
const completeSolveTaskTool = tool({
  description:
    "标记解题任务完成。所有步骤执行完毕后调用，提供最终答案和完整步骤摘要。",
  inputSchema: z.object({
    finalAnswer: z.string().describe("最终答案，清晰明确地写出结果"),
    steps: z
      .array(
        z.object({
          stepNumber: z.number(),
          description: z.string(),
          expression: z.string().optional(),
          result: z.string().optional(),
          latexFormula: z.string().optional(),
          geogebraCommand: z.string().optional(),
        })
      )
      .describe("所有步骤的完整摘要列表"),
    solutionType: z.string().describe("解题类型，如：代数、几何、微积分、概率统计等"),
  }),
  strict: true,
});

// ==================== 系统提示词 ====================

const SYSTEM_PROMPT = `你是一个专业的数学解题助手。你的任务是逐步解决用户提出的数学问题。

## 执行规则（必须遵守）
1. 逐步解题：每次只执行一步，然后等待反馈再继续下一步
2. 每步说明：描述你正在做什么（如"第一步：将方程两边同时减去5"）
3. 展示计算：如果有计算过程，在 expression 字段中展示
4. 标记结果：如果有中间结果，在 result 字段中展示
5. 使用 LaTeX：在 latexFormula 字段中使用 LaTeX 格式呈现数学公式（如 \\frac{a}{b}、\\sqrt{x}、x^2 等）
6. 几何图形：如果题目涉及几何图形，可以在 geogebraCommand 中提供 GeoGebra 命令来可视化
7. 完成时调用 complete_solve_task 工具，提供最终答案和所有步骤摘要
8. 不要跳过任何步骤，即使是很简单的步骤也要明确写出
9. 不要假设用户已经知道某些概念，每一步都要解释清楚
10. 每步只包含一个核心操作，不要将多个操作合并成一步

## 解题示例

### 示例 1：解方程
问题：解方程 2x + 5 = 13

步骤1：两边同时减去5
  expression: 2x + 5 - 5 = 13 - 5
  result: 2x = 8
  latexFormula: 2x + 5 - 5 = 13 - 5

步骤2：两边同时除以2
  expression: 2x / 2 = 8 / 2
  result: x = 4
  latexFormula: \\frac{2x}{2} = \\frac{8}{2}

最终答案：x = 4

### 示例 2：几何题
问题：计算直角三角形斜边长度，两条直角边分别为 3 和 4

步骤1：使用勾股定理，列出公式
  description: 根据勾股定理 c² = a² + b²，代入 a = 3, b = 4
  expression: c² = 3² + 4²
  latexFormula: c^2 = 3^2 + 4^2

步骤2：计算平方
  expression: c² = 9 + 16
  result: c² = 25
  latexFormula: c^2 = 9 + 16

步骤3：开平方求斜边
  expression: c = √25
  result: c = 5
  latexFormula: c = \\sqrt{25}

最终答案：斜边长度为 5

### 示例 3：因式分解
问题：因式分解 x² - 9

步骤1：识别平方差公式
  description: x² - 9 是平方差形式，a² - b² = (a + b)(a - b)，其中 a = x, b = 3
  latexFormula: x^2 - 9 = x^2 - 3^2

步骤2：应用平方差公式
  expression: x² - 9 = (x + 3)(x - 3)
  latexFormula: x^2 - 9 = (x + 3)(x - 3)

最终答案：x² - 9 = (x + 3)(x - 3)

## 支持的数学领域
- 代数：方程、不等式、多项式、因式分解、函数
- 几何：平面几何、立体几何、解析几何、三角函数
- 微积分：极限、导数、积分、微分方程
- 线性代数：矩阵、向量、行列式、线性方程组
- 概率统计：概率计算、分布、假设检验、回归分析
- 数论：整除、同余、质数、最大公约数

## 重要提示
- 每个步骤只能包含一个操作
- 保持步骤描述清晰简洁
- 使用中文输出
- 确保最终答案正确
- 尽量使用 LaTeX 格式呈现数学公式
- 解题步骤要逻辑清晰，从已知条件逐步推导到最终答案`;

// ==================== 主函数 ====================

/**
 * 逐步解决数学问题（function calling 模式）
 *
 * 使用 AI SDK 的 tool-calling 特性，模型会分步调用 execute_solve_step
 * 工具来逐步解题，每步等待确认后再继续下一步，最后调用
 * complete_solve_task 标记完成。
 *
 * @param input - 用户输入的数学问题描述
 * @param provider - LLM 提供商配置
 * @param image - 可选的图片 URI（用于拍照搜题等多模态输入）
 * @param onStep - 每一步执行后的回调，用于 UI 展示步骤结果
 * @param signal - 可选的 AbortSignal，用于取消解题
 * @returns 解题结果，包含最终答案和所有步骤摘要
 */
export async function solveProblem(
  input: string,
  provider: LLMProvider,
  image?: string,
  onStep?: StepCallback,
  signal?: AbortSignal
): Promise<SolveResult> {
  const client = createAIClient(provider);
  const modelName = getModelName(provider, !!image);
  const useOpenRouter = isOpenRouterProvider(provider);
  const maxSteps = 50;

  // 构建用户消息内容
  const userContent: Array<{ type: "text"; text: string } | { type: "image"; image: string; mediaType: string }> = [
    { type: "text", text: `请逐步解决以下数学问题：\n\n${input}` },
  ];

  if (image) {
    const base64Image = await imageToBase64(image);
    const mimeType = image.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    userContent.push({
      type: "image",
      image: base64Image,
      mediaType: mimeType,
    });
  }

  const messages: ModelMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: userContent,
    } as ModelMessage,
  ];

  let finalResult: SolveResult | null = null;
  let stepCount = 0;

  while (stepCount < maxSteps) {
    if (signal?.aborted) throw new Error("AbortError");

    stepCount++;
    console.log(`\n=== 解题步骤第 ${stepCount} 轮 ===`);

    const result = await generateText({
      model: client(modelName),
      messages,
      tools: {
        execute_solve_step: executeSolveStepTool,
        complete_solve_task: completeSolveTaskTool,
      },
      toolChoice: useOpenRouter ? "auto" : "required",
      abortSignal: signal,
    });

    // 获取工具调用
    let toolCall = result.toolCalls?.[0];

    // 如果 toolCalls 为空但 result.text 包含工具调用信息，尝试解析
    if (!toolCall && result.text) {
      try {
        const parsed = JSON.parse(result.text);
        if (parsed.type === "tool-call" && parsed.toolName) {
          toolCall = {
            type: "tool-call",
            toolCallId: parsed.toolCallId || `call_${Date.now()}`,
            toolName: parsed.toolName,
            input: parsed.input,
          };
        }
      } catch {
        // 如果不是 JSON，可能是普通文本响应，忽略
      }
    }

    if (!toolCall) {
      console.error("模型未调用工具，响应:", result.text);
      throw new Error("模型未返回有效的工具调用");
    }

    if (toolCall.toolName === "execute_solve_step") {
      const args = toolCall.input as SolveStep;

      console.log(`执行解题步骤 ${args.stepNumber}: ${args.description}`);

      // 如果有回调，通知调用方当前步骤
      if (onStep) {
        const stepResult = await onStep(args);
        if (!stepResult.success) {
          throw new Error(`解题步骤执行失败: ${stepResult.error}`);
        }
      }

      // 将助手响应和用户反馈推入消息历史
      messages.push({
        role: "assistant",
        content: result.text || JSON.stringify(toolCall),
      } as ModelMessage);

      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: "步骤已执行，请继续下一步。",
          },
        ],
      } as ModelMessage);
    } else if (toolCall.toolName === "complete_solve_task") {
      const args = toolCall.input as SolveResult;

      finalResult = {
        finalAnswer: args.finalAnswer,
        steps: args.steps,
        solutionType: args.solutionType,
      };
      console.log(`解题完成，类型: ${args.solutionType}，共 ${args.steps.length} 步`);
      break;
    }
  }

  if (!finalResult) {
    throw new Error(`解题未完成，已达到最大步骤数 (${maxSteps})`);
  }

  return finalResult;
}
