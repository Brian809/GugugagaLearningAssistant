import { generateText, tool, ModelMessage } from "ai";
import { z } from "zod";
import { LLMProvider } from "./llmProviders";
import { createAIClient, isOpenRouterProvider, getModelName } from "./createLearningClient";

export type GeoGebraAnalysis = {
  description: string;
  elements: { type: string; name: string; definition: string; properties?: Record<string, unknown> }[];
  commands: { type: "command" | "expression"; content: string; description?: string }[];
  suggestedSteps: string[];
};

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
 * 分析图片并逐步生成 GeoGebra 指令（function calling 模式）
 * 
 * 使用 ai SDK 的 function calling 特性，模型会调用工具而不是返回 JSON 文本
 */
export async function analyzeImageWithSteps(
  imageUri: string,
  provider: LLMProvider,
  onStepExecution: StepExecutionCallback,
  userPrompt?: string,
  signal?: AbortSignal,
  historyMessages?: ModelMessage[]
): Promise<{ description: string; elements: unknown[]; suggestedSteps: string[] }> {
  const client = createAIClient(provider);
  const base64Image = await imageToBase64(imageUri);
  const mimeType = imageUri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const modelName = getModelName(provider, true);
  const useOpenRouter = isOpenRouterProvider(provider);

  const isFollowUp = historyMessages && historyMessages.length > 0;
  const followUpNote = isFollowUp
    ? "\n\n[注意：这是对现有图形的修改/补充。请基于当前画布上已有的内容进行操作，不要重新创建。]"
    : "";

  const userMessageContent = userPrompt
    ? `${userPrompt}\n\n请分析这张几何图片，然后分步生成 GeoGebra 指令。一次执行一条命令，等待执行结果后再继续。${followUpNote}`
    : "请分析这张几何图片，然后分步生成 GeoGebra 指令来重建这个图形。一次执行一条命令，等待执行结果后再继续。" + followUpNote;

  const systemPrompt = `你是一个专业的几何绘图助手，使用 GeoGebra 重建几何图形。

## 执行规则（必须遵守）
1. 分析图片后，规划作图步骤
2. 调用 execute_geo_gebra_step 工具返回当前步骤的命令
3. 等待执行结果后，继续调用工具返回下一步
4. 如果执行失败，分析原因并调整命令
5. 所有命令执行完毕后，调用 complete_geo_gebra_task 工具标记完成

## 作图原则
- 从基础元素开始：先创建点（如 A = (0, 0)）
- 逐步构建：点 → 线 → 圆 → 多边形
- 依赖关系：确保引用已创建的元素
- 一次一条：禁止一次返回多条命令（不要用分号分隔）

## GeoGebra 完整命令参考

### 点（Point）
- 自由点：A = (0, 0)  或  B = (3, 4)
- 线段上的点（可拖动）：E = Point(s)  其中 s 是线段
- 直线上的点（可拖动）：E = Point(l)  其中 l 是直线
- 指定位置的点：E = Point(s, 0.5)  参数 0-1 表示在线段上的位置
- 中点：M = Midpoint(A, B)  或  M = Midpoint(s)

### 线段和直线
- 线段：s = Segment(A, B)
- 无限直线：l = Line(A, B)
- 射线：r = Ray(A, B)

### 垂直线（正确命令）
- 过点垂直于直线：p = PerpendicularLine(P, l)
- 过点垂直于线段：p = PerpendicularLine(P, s)
- 垂足（交点）：F = Intersect(p, s)  或  F = Intersect(p, l)

### 圆
- 圆心和半径：c = Circle(A, 5)
- 圆心和过点：c = Circle(A, B)
- 过三点：c = Circle(A, B, C)

### 多边形
- 多边形：poly = Polygon(A, B, C, D)
- 正多边形：poly = Polygon(A, B, 6)  以 AB 为边的六边形

### 交点
命令：Intersect(A, B) 返回 A 和 B 的所有交点
- 两线交点：I = Intersect(l1, l2)
- 线与圆交点：I = Intersect(l, c)
- 两圆交点：I = Intersect(c1, c2)
- 垂足：F = Intersect(p, s)  其中 p 是 PerpendicularLine
- 如果 Intersect 返回多个点且只需要其中一个，可以用：F = Intersect(p, s, 1)
- 重要：Intersect 只接受两个几何对象参数。不要用 Intersect(A, B, C)

### 角度
- 角度：α = Angle(A, B, C)  顶点在 B
- 角度（带方向）：α = Angle(A, B, C, direction)

### 其他常用命令
- 距离：d = Distance(A, B)
- 长度：len = Length(s)
- 面积：area = Area(poly)
- 斜率：m = Slope(l)

## 重要提示
- 每个步骤只能包含一条 GeoGebra 命令
- 错误示例：A = (0, 0); B = (3, 0); C = (3, 3)  （这是三条命令）
- 正确示例：A = (0, 0)  （这是单条命令）

## 常见错误纠正
错误: PointOnSegment(A, C)    正确: Point(Segment(A, C)) 或 Point(s)
错误: PerpendicularFoot(E, l) 正确: Intersect(PerpendicularLine(E, l), l)
错误: PointOnLine(E, l)       正确: Point(l)
错误: Intersection(A, B, C)                   正确: Intersection 只接受 2 个列表参数: Intersection({A, B}, {C, D})

## 关键规则：引用已创建的对象
必须记住你创建的对象名称，并在后续命令中正确使用。
创建了 s = Polygon(A, B, C, D) 后，正方形的边不会自动变成 AB、BC、CD、DA
如果需要使用线段，必须先显式创建：
正确: AB = Segment(A, B) 然后 PerpendicularLine(E, AB)
正确: 或者直接使用 PerpendicularLine(E, Segment(A, B))
错误: 不要假设 AB 自动存在！AB 是一个变量名，除非你创建了它，否则不存在

## 正确的作图流程示例
步骤1: A = (0, 4)           // 创建点A
步骤2: B = (0, 0)           // 创建点B  
步骤3: C = (4, 0)           // 创建点C
步骤4: D = (4, 4)           // 创建点D
步骤5: s = Polygon(A, B, C, D)  // 创建多边形s
步骤6: AB = Segment(A, B)   // 显式创建线段AB
步骤7: p = PerpendicularLine(E, AB)  // 正确引用线段AB

## 错误示例（不要这样做）
步骤5: s = Polygon(A, B, C, D)
步骤6: p = PerpendicularLine(E, AB)  // 错误！AB不存在！`;

  let finalResult: { description: string; elements: unknown[]; suggestedSteps: string[] } | null = null;
  const allSteps: string[] = [];
  const allCommands: string[] = [];
  let stepCount = 0;
  const maxSteps = 50;

  console.log("\n=== 第 1 步：分析图片 ===");

  const messages: ModelMessage[] = [
    { role: "system", content: systemPrompt },
    ...(historyMessages || []),
    {
      role: "user",
      content: [
        { type: "text", text: userMessageContent },
        { type: "image", image: base64Image, mediaType: mimeType },
      ],
    },
  ];

  while (stepCount < maxSteps) {
    if (signal?.aborted) throw new Error("AbortError");

    stepCount++;
    console.log(`\n=== 开始第 ${stepCount} 轮调用 ===`);

    const result = await generateText({
      model: client(modelName),
      messages,
      tools: {
        execute_geo_gebra_step: executeGeoGebraStepTool,
        complete_geo_gebra_task: completeGeoGebraTaskTool,
      },
      toolChoice: useOpenRouter ? "auto" : "required",
      abortSignal: signal,
    });

    // 尝试从 toolCalls 获取工具调用
    let toolCall = result.toolCalls?.[0];
    
    // 如果 toolCalls 为空但 result.text 包含工具调用信息，尝试解析
    if (!toolCall && result.text) {
      try {
        // 尝试解析 JSON 格式的工具调用
        const parsed = JSON.parse(result.text);
        if (parsed.type === "tool-call" && parsed.toolName) {
          toolCall = {
            type: "tool-call",
            toolCallId: parsed.toolCallId,
            toolName: parsed.toolName,
            input: parsed.input,
          };
        }
      } catch {
        // 如果不是 JSON，可能是普通文本响应
      }
    }

    if (!toolCall) {
      console.error("模型未调用工具，响应:", result.text);
      throw new Error("模型未返回有效的工具调用");
    }

    if (toolCall.toolName === "execute_geo_gebra_step") {
      const args = toolCall.input as {
        stepNumber: number;
        totalSteps: number;
        command: string;
        description: string;
        expectedResult: string;
      };

      console.log(`执行步骤 ${args.stepNumber}/${args.totalSteps}: ${args.command}`);
      allSteps.push(`${args.stepNumber}. ${args.description}: ${args.command}`);
      allCommands.push(args.command);

      const executionResult = await onStepExecution({
        stepNumber: args.stepNumber,
        totalSteps: args.totalSteps,
        command: args.command,
        description: args.description,
        expectedResult: args.expectedResult,
      });

      const definedVariables = allCommands
        .map(cmd => {
          const match = cmd.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
          return match ? match[1] : null;
        })
        .filter(Boolean);

      messages.push({
        role: "assistant",
        content: result.text || JSON.stringify(toolCall),
      });

      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: `执行结果: ${executionResult.success ? "成功" : "失败"}${executionResult.error ? `, 错误: ${executionResult.error}` : ""}\n\n已创建的对象：${definedVariables.join(", ") || "无"}。请继续下一步。`,
          },
        ],
      });
    } else if (toolCall.toolName === "complete_geo_gebra_task") {
      const args = toolCall.input as {
        finalDescription: string;
        finalElements: string[];
        finalSteps: string[];
      };

      finalResult = {
        description: args.finalDescription,
        elements: args.finalElements,
        suggestedSteps: args.finalSteps,
      };
      break;
    }
  }

  if (!finalResult) {
    throw new Error(`绘图未完成，已达到最大步骤数 (${maxSteps})`);
  }

  return finalResult;
}

/**
 * 根据描述逐步生成 GeoGebra 指令（function calling 模式）
 */
export async function generateFromDescriptionWithSteps(
  description: string,
  provider: LLMProvider,
  onStepExecution: StepExecutionCallback,
  signal?: AbortSignal,
  historyMessages?: ModelMessage[]
): Promise<{ description: string; elements: unknown[]; suggestedSteps: string[] }> {
  const client = createAIClient(provider);
  const modelName = getModelName(provider, false);
  const useOpenRouter = isOpenRouterProvider(provider);

  const isFollowUp = historyMessages && historyMessages.length > 0;
  const followUpNote = isFollowUp
    ? "\n\n[注意：这是对现有图形的修改/补充。请基于当前画布上已有的内容进行操作，不要重新创建。]"
    : "";

  const systemPrompt = `你是一个专业的几何绘图助手，使用 GeoGebra 根据描述绘制几何图形。${followUpNote}

## 执行规则（必须遵守）
1. 理解描述，规划作图步骤
2. 调用 execute_geo_gebra_step 工具返回当前步骤的命令
3. 等待执行结果后，继续调用工具返回下一步
4. 如果执行失败，分析原因并调整命令
5. 所有命令执行完毕后，调用 complete_geo_gebra_task 工具标记完成

## 作图原则
- 从基础元素开始：先创建点（如 A = (0, 0)）
- 逐步构建：点 → 线 → 圆 → 多边形
- 依赖关系：确保引用已创建的元素
- 一次一条：禁止一次返回多条命令（不要用分号分隔）

## GeoGebra 完整命令参考

### 点（Point）
- 自由点：A = (0, 0)  或  B = (3, 4)
- 线段上的点（可拖动）：E = Point(s)  其中 s 是线段
- 直线上的点（可拖动）：E = Point(l)  其中 l 是直线
- 指定位置的点：E = Point(s, 0.5)  参数 0-1 表示在线段上的位置
- 中点：M = Midpoint(A, B)  或  M = Midpoint(s)

### 线段和直线
- 线段：s = Segment(A, B)
- 无限直线：l = Line(A, B)
- 射线：r = Ray(A, B)

### 垂直线（正确命令）
- 过点垂直于直线：p = PerpendicularLine(P, l)
- 过点垂直于线段：p = PerpendicularLine(P, s)
- 垂足（交点）：F = Intersect(p, s)  或  F = Intersect(p, l)

### 圆
- 圆心和半径：c = Circle(A, 5)
- 圆心和过点：c = Circle(A, B)
- 过三点：c = Circle(A, B, C)

### 多边形
- 多边形：poly = Polygon(A, B, C, D)
- 正多边形：poly = Polygon(A, B, 6)  以 AB 为边的六边形

### 交点
命令：Intersect(A, B) 返回 A 和 B 的所有交点
- 两线交点：I = Intersect(l1, l2)
- 线与圆交点：I = Intersect(l, c)
- 两圆交点：I = Intersect(c1, c2)
- 垂足：F = Intersect(p, s)  其中 p 是 PerpendicularLine
- 如果 Intersect 返回多个点且只需要其中一个，可以用：F = Intersect(p, s, 1)
- 重要：Intersect 只接受两个几何对象参数。不要用 Intersect(A, B, C)

### 角度
- 角度：α = Angle(A, B, C)  顶点在 B
- 角度（带方向）：α = Angle(A, B, C, direction)

### 其他常用命令
- 距离：d = Distance(A, B)
- 长度：len = Length(s)
- 面积：area = Area(poly)
- 斜率：m = Slope(l)

## 重要提示
- 每个步骤只能包含一条 GeoGebra 命令
- 错误示例：A = (0, 0); B = (3, 0); C = (3, 3)  （这是三条命令）
- 正确示例：A = (0, 0)  （这是单条命令）

## 常见错误纠正
错误: PointOnSegment(A, C)    正确: Point(Segment(A, C)) 或 Point(s)
错误: PerpendicularFoot(E, l) 正确: Intersect(PerpendicularLine(E, l), l)
错误: PointOnLine(E, l)       正确: Point(l)
错误: Intersection(A, B, C)                   正确: Intersection 只接受 2 个列表参数: Intersection({A, B}, {C, D})

## 关键规则：引用已创建的对象
必须记住你创建的对象名称，并在后续命令中正确使用。
创建了 s = Polygon(A, B, C, D) 后，正方形的边不会自动变成 AB、BC、CD、DA
如果需要使用线段，必须先显式创建：
正确: AB = Segment(A, B) 然后 PerpendicularLine(E, AB)
正确: 或者直接使用 PerpendicularLine(E, Segment(A, B))
错误: 不要假设 AB 自动存在！AB 是一个变量名，除非你创建了它，否则不存在

## 正确的作图流程示例
步骤1: A = (0, 4)           // 创建点A
步骤2: B = (0, 0)           // 创建点B  
步骤3: C = (4, 0)           // 创建点C
步骤4: D = (4, 4)           // 创建点D
步骤5: s = Polygon(A, B, C, D)  // 创建多边形s
步骤6: AB = Segment(A, B)   // 显式创建线段AB
步骤7: p = PerpendicularLine(E, AB)  // 正确引用线段AB

## 错误示例（不要这样做）
步骤5: s = Polygon(A, B, C, D)
步骤6: p = PerpendicularLine(E, AB)  // 错误！AB不存在！`;

  let finalResult: { description: string; elements: unknown[]; suggestedSteps: string[] } | null = null;
  const allSteps: string[] = [];
  const allCommands: string[] = [];
  let stepCount = 0;
  const maxSteps = 50;

  const messages: ModelMessage[] = [
    { role: "system", content: systemPrompt },
    ...(historyMessages || []),
    { role: "user", content: [{ type: "text", text: "请根据以下描述绘制几何图形，分步执行：\n\n" + description }] },
  ];

  while (stepCount < maxSteps) {
    if (signal?.aborted) throw new Error("AbortError");

    stepCount++;
    console.log(`\n=== 开始第 ${stepCount} 轮调用 ===`);

    const definedVariables = allCommands
      .map(cmd => {
        const match = cmd.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
        return match ? match[1] : null;
      })
      .filter(Boolean);

    const messagesWithContext: ModelMessage[] = [...messages];
    if (allCommands.length > 0) {
      messagesWithContext.push({
        role: "user",
        content: [{ type: "text", text: `[提醒]已创建的对象：${definedVariables.join(", ")}。请确保只引用这些已定义的对象，不要引用不存在的变量。` }],
      });
    }

    const result = await generateText({
      model: client(modelName),
      messages: messagesWithContext,
      tools: {
        execute_geo_gebra_step: executeGeoGebraStepTool,
        complete_geo_gebra_task: completeGeoGebraTaskTool,
      },
      toolChoice: useOpenRouter ? "auto" : "required",
      abortSignal: signal,
    });

    const toolCall = result.toolCalls?.[0];
    if (!toolCall) {
      console.error("模型未调用工具，响应:", result.text);
      throw new Error("模型未返回有效的工具调用");
    }

    if (toolCall.toolName === "execute_geo_gebra_step") {
      const args = toolCall.input as {
        stepNumber: number;
        totalSteps: number;
        command: string;
        description: string;
        expectedResult: string;
      };

      console.log(`执行步骤 ${args.stepNumber}/${args.totalSteps}: ${args.command}`);
      allSteps.push(`${args.stepNumber}. ${args.description}: ${args.command}`);
      allCommands.push(args.command);

      const executionResult = await onStepExecution({
        stepNumber: args.stepNumber,
        totalSteps: args.totalSteps,
        command: args.command,
        description: args.description,
        expectedResult: args.expectedResult,
      });

      messages.push({
        role: "assistant",
        content: result.text || JSON.stringify(toolCall),
      });

      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: `执行结果: ${executionResult.success ? "成功" : "失败"}${executionResult.error ? `, 错误: ${executionResult.error}` : ""}\n\n已创建的对象：${definedVariables.join(", ") || "无"}。请继续下一步。`,
          },
        ],
      });
    } else if (toolCall.toolName === "complete_geo_gebra_task") {
      const args = toolCall.input as {
        finalDescription: string;
        finalElements: string[];
        finalSteps: string[];
      };

      finalResult = {
        description: args.finalDescription,
        elements: args.finalElements,
        suggestedSteps: args.finalSteps,
      };
      break;
    }
  }

  if (!finalResult) {
    throw new Error(`绘图未完成，已达到最大步骤数 (${maxSteps})`);
  }

  return finalResult;
}

// ==================== 向后兼容的旧版本 API ====================

// ==================== Function Calling 工具定义 ====================

// 步骤执行工具：模型返回单步命令，等待执行结果
const executeGeoGebraStepTool = tool({
  description: "执行单步 GeoGebra 命令。返回当前步骤的命令，等待执行结果后继续下一步。",
  inputSchema: z.object({
    stepNumber: z.number().describe("当前步骤序号，从 1 开始"),
    totalSteps: z.number().describe("预计总步骤数"),
    command: z.string().describe("GeoGebra 命令，一次只能一条，不要用分号分隔多条"),
    description: z.string().describe("命令说明，解释这步在做什么"),
    expectedResult: z.string().describe("预期结果，描述这步完成后应该看到什么"),
  }),
  strict: true,
});

// 完成状态工具：模型返回完成状态
const completeGeoGebraTaskTool = tool({
  description: "标记 GeoGebra 绘图任务完成。当所有步骤执行完毕后调用。",
  inputSchema: z.object({
    finalDescription: z.string().describe("完成后的图形描述"),
    finalElements: z.array(z.string()).describe("最终创建的元素名称列表"),
    finalSteps: z.array(z.string()).describe("步骤总结列表"),
  }),
  strict: true,
});

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
