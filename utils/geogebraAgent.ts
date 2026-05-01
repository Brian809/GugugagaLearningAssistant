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

// 画布对象信息
export type CanvasObject = {
  name: string;
  type: string;
  value: string;
  definition: string;
};

// 获取画布状态回调类型
export type GetCanvasStateCallback = () => Promise<{ objects: CanvasObject[] }>;

/**
 * 从 AI 响应中提取工具调用
 *
 * AI SDK 的 toolCalls 有时会为空（特别是 OpenRouter 可能将工具调用
 * 以 JSON 文本形式返回）。此函数尝试多种方式提取工具调用：
 * 1. AI SDK 的 result.toolCalls
 * 2. 纯 JSON 文本
 * 3. Markdown 代码块包裹的 JSON (```json ... ```)
 * 4. 嵌入文本中的 JSON 对象
 */
function extractToolCall(result: {
  toolCalls?: any[];
  text?: string;
}): { type: string; toolCallId: string; toolName: string; input: any } | null {
  // 方式 1：AI SDK 原生 toolCalls
  if (result.toolCalls?.[0]) {
    return result.toolCalls[0];
  }

  const text = result.text;
  if (!text) return null;

  let jsonStr: string | null = null;

  // 方式 2：整个文本就是 JSON
  try {
    JSON.parse(text);
    jsonStr = text;
  } catch {
    // 方式 3：Markdown 代码块 ```json ... ```
    const mdMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (mdMatch) {
      jsonStr = mdMatch[1].trim();
    }
  }

  // 方式 4：在文本中查找包含工具调用的 JSON 对象
  if (!jsonStr) {
    // 查找 "type":"tool-call" 或 "type":"execute_geo_gebra_step" 等
    const typePatterns = [
      '"type":"tool-call"',
      '"type":"execute_geo_gebra_step"',
      '"type":"complete_geo_gebra_task"',
      '"type":"get_canvas_state"',
      "'type':'tool-call'",
      "'type':'execute_geo_gebra_step'",
    ];
    let startIdx = -1;
    for (const pat of typePatterns) {
      const idx = text.indexOf(pat);
      if (idx !== -1) { startIdx = text.lastIndexOf("{", idx); break; }
    }
    if (startIdx !== -1) {
      let depth = 0;
      let endIdx = -1;
      for (let i = startIdx; i < text.length; i++) {
        if (text[i] === "{") depth++;
        else if (text[i] === "}") {
          depth--;
          if (depth === 0) { endIdx = i + 1; break; }
        }
      }
      if (endIdx !== -1) {
        jsonStr = text.substring(startIdx, endIdx);
      }
    }
  }

  if (!jsonStr) return null;

  // 尝试多种 JSON 解析策略
  let parsed: Record<string, any> | null = null;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // 尝试将单引号 JSON 转为双引号
    try {
      const fixed = jsonStr.replace(/'/g, '"');
      parsed = JSON.parse(fixed);
    } catch {
      // 全部失败
    }
  }

  if (!parsed) return null;

  // 方式 A：type 是 "tool-call"（标准格式）
  if (parsed.type === "tool-call") {
    const rawName: string = parsed.toolName || parsed.name || "";
    const toolName = normalizeToolName(rawName);
    if (toolName) {
      return {
        type: "tool-call",
        toolCallId: parsed.toolCallId || `call_${Date.now()}`,
        toolName,
        input: parsed.input || parsed.parameters,
      };
    }
  }

  // 方式 B：type 直接是工具名（某些模型省略 "tool-call" 包装）
  // 如 {"type":"execute_geo_gebra_step","parameters":{...}}
  const directToolName = normalizeToolName(parsed.type || "");
  if (directToolName && (parsed.input || parsed.parameters)) {
    return {
      type: "tool-call",
      toolCallId: parsed.toolCallId || `call_${Date.now()}`,
      toolName: directToolName,
      input: parsed.input || parsed.parameters,
    };
  }

  return null;
}

/**
 * 标准化工具名称：处理模型的常见拼写错误和变体
 */
function normalizeToolName(raw: string): string {
  const name = raw.trim();
  if (!name) return "";
  // 精确匹配
  if (name === "execute_geo_gebra_step") return name;
  if (name === "complete_geo_gebra_task") return name;
  if (name === "get_canvas_state") return name;
  if (name === "analyze_geometry") return name;
  // 模糊匹配：execute 相关
  if (name.startsWith("execute_geo") || name.includes("execute_geo_gebra")) return "execute_geo_gebra_step";
  // 模糊匹配：complete 相关
  if (name.startsWith("complete_geo") || name.includes("complete_geo_gebra")) return "complete_geo_gebra_task";
  // 模糊匹配：canvas state
  if (name.includes("canvas_state") || name.includes("canvasState")) return "get_canvas_state";
  // 模糊匹配：analyze
  if (name.includes("analyze_geometry")) return "analyze_geometry";
  // 无法匹配，返回空
  return "";
}

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
 * 生成移动端命令注入脚本（带 postMessage 反馈）
 *
 * 移动端 injectJavaScript 是 fire-and-forget，无法获取返回值。
 * 此函数生成一个 IIFE，在 WebView 中执行每个 evalCommand，
 * 检查其返回值，并通过 window.ReactNativeWebView.postMessage
 * 将执行结果发送回 React Native 层。
 */
export function generateMobileCommandScript(command: string): string {
  const cleanCommand = command.trim();
  const effectiveCommand = cleanCommand.startsWith("=")
    ? cleanCommand.substring(1).trim()
    : cleanCommand;

  const commands = effectiveCommand
    .split(/[;\n]/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  if (commands.length === 0) {
    return `(function(){try{window.ReactNativeWebView.postMessage(JSON.stringify({type:"commandResult",success:false,error:"Empty command"}));}catch(e){}})();`;
  }

  // 生成每条命令的执行代码（含 console.error 捕获和对象创建验证）
  const execStatements = commands
    .map((cmd, i) => {
      const escaped = cmd.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const safeDisplay = cmd.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const assignCheck = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(cmd.trim());
      const varName = assignCheck && !cmd.trim().startsWith("Delete") ? assignCheck[1] : null;
      // 用临时变量存 console.error 返回值以便捕获错误文本
      let stmt = `{var _oe=console.error;var _ce="";console.error=function(){_ce+=Array.prototype.slice.call(arguments).join(" ");_oe.apply(console,arguments);};`;
      stmt += `r=ggbApplet.evalCommand("${escaped}");`;
      stmt += `console.error=_oe;`;
      stmt += `if(r===false){ok=false;err=_ce||"Failed: ${safeDisplay}";}`;
      if (varName) {
        stmt += `else{var t=ggbApplet.getObjectType("${varName}");if(!t){ok=false;err="Not created: ${varName}";}}`;
      }
      stmt += `}`;
      return stmt;
    })
    .join("");

  const beforeCount = `var bc=typeof ggbApplet.getObjectNumber==="function"?ggbApplet.getObjectNumber():0;`;
  const afterCheck = `var ac=typeof ggbApplet.getObjectNumber==="function"?ggbApplet.getObjectNumber():0;`;
  const firstEscaped = commands[0].replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const countCheck = `if(ok&&bc===ac){var c="${firstEscaped}".trim();var isVisual=c.indexOf("Set")===0||c.indexOf("Delete")===0||c.indexOf("Show")===0;if(!isVisual){var hasAssign=/^\\s*[A-Za-z_][A-Za-z0-9_]*\\s*=/.test(c);if(!hasAssign){ok=false;err="No visible effect";}}}`;

  return (
    `(function(){try{` +
    `if(typeof ggbApplet!=="undefined"&&ggbApplet.evalCommand){` +
    `var ok=true;var err="";var r;` +
    beforeCount +
    execStatements +
    afterCheck +
    countCheck +
    `ggbApplet.refreshViews();` +
    `try{window.ReactNativeWebView.postMessage(JSON.stringify({type:"commandResult",success:ok,error:ok?undefined:err}));}catch(e){}` +
    `}else{try{window.ReactNativeWebView.postMessage(JSON.stringify({type:"commandResult",success:false,error:"ggbApplet not available"}));}catch(e){}}` +
    `}catch(e){try{window.ReactNativeWebView.postMessage(JSON.stringify({type:"commandResult",success:false,error:e.toString()}));}catch(e2){}}})();`
  );
}

/**
 * 生成移动端画布状态查询脚本
 *
 * 通过 postMessage 将画布上所有对象的名称、类型、值、定义返回给 RN 层。
 * 用于 get_canvas_state 工具在移动端的实现。
 */
export function generateMobileCanvasQueryScript(): string {
  return `(function(){try{if(typeof ggbApplet!=="undefined"&&ggbApplet.getAllObjectNames){var names=ggbApplet.getAllObjectNames();var objects=[];for(var i=0;i<names.length;i++){var n=names[i];try{objects.push({name:n,type:ggbApplet.getObjectType(n)||"unknown",value:ggbApplet.getValueString(n)||"",definition:ggbApplet.getDefinitionString(n)||""});}catch(e){objects.push({name:n,type:"error",value:"",definition:""});}}window.ReactNativeWebView.postMessage(JSON.stringify({type:"canvasState",objects:objects}));}else{window.ReactNativeWebView.postMessage(JSON.stringify({type:"canvasState",objects:[]}));}}catch(e){try{window.ReactNativeWebView.postMessage(JSON.stringify({type:"canvasState",objects:[],error:e.toString()}));}catch(e2){}}})();`;
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
  historyMessages?: ModelMessage[],
  onGetCanvasState?: GetCanvasStateCallback
): Promise<{ description: string; elements: unknown[]; suggestedSteps: string[] }> {
  const client = createAIClient(provider);
  const base64Image = await imageToBase64(imageUri);
  const mimeType = imageUri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const modelName = getModelName(provider, true);
  const useOpenRouter = isOpenRouterProvider(provider);

  const isFollowUp = historyMessages && historyMessages.length > 0;

  // 跟进修改时，先查询画布现有对象，避免 AI 重新创建已有对象导致画布被清空
  let existingStateHint = "";
  if (isFollowUp && onGetCanvasState) {
    try {
      const state = await onGetCanvasState();
      if (state.objects.length > 0) {
        const objectSummary = state.objects
          .map((o) => `${o.name} (${o.type}): ${o.definition || o.value}`)
          .join("\n  ");
        existingStateHint = `\n\n## 画布上已有的对象（请勿重新创建，只需修改/补充）\n  ${objectSummary}\n\n在修改之前，你也可以调用 get_canvas_state 工具重新查询画布状态。`;
      }
    } catch {
      // 查询失败不阻塞，AI 可以自己调用 get_canvas_state
    }
  }

  const followUpNote = isFollowUp
    ? `\n\n[注意：这是对现有图形的修改/补充。不要重新创建已有对象！可以直接修改对象的颜色、样式、位置，或添加新元素。如需了解画布上的对象，调用 get_canvas_state 工具。]${existingStateHint}`
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
步骤6: p = PerpendicularLine(E, AB)  // 错误！AB不存在！

## 获取画布状态
在对已有图形进行修改时，先调用 get_canvas_state 工具（无需参数）查看画布上已有的对象。
返回每个对象的名称、类型、值和定义命令。根据查询结果决定修改哪些对象。

## 修改对象
### 颜色（重要：多次尝试的常见错因）
- 颜色名：SetColor(A, "red")
  - 可用颜色名 (英文): black, dark gray, gray, dark blue, blue, dark green, green, maroon, crimson, red, magenta, indigo, purple, brown, orange, gold, lime, cyan, turquoise, light blue, pink, violet, yellow, white
- RGB（0~1 之间！）：SetColor(A, 1, 0, 0)  红色；SetColor(A, 0, 0.5, 0)  暗绿
  - 注意 RGB 范围是 0~1，不是 0~255！传 255 会得到错误的颜色。
- 十六进制（推荐）：SetColor(A, "#FF0000")  红色；SetColor(A, "#00FF00")  绿色；SetColor(A, "#0000FF")  蓝色
  - 带透明度：SetColor(A, "#80FF0000")  半透明红
- 动态颜色冲突：如果对象属性中启用了"动态颜色"，SetColor 会静默失效。此时先禁用：SetDynamicColor(A, 0, 0, 0)
- 填充色：SetFilling(s, 1)  填充多边形。如果先调 SetFilling 再调 SetColor，SetColor 控制的是边框色。

### 其他修改
- 删除对象：Delete[A]  删除点A
- 隐藏：SetVisibleInView(A, 1, false)；显示：SetVisibleInView(A, 1, true)
- 标签：SetCaption(s, "名称")；隐藏标签：ShowLabel(A, false)
- 线宽：SetLineThickness(s, 5)  范围 1-13
- 点大小：SetPointSize(A, 6)  范围 1-9
- 线型：SetLineStyle(s, 1)  0=实线, 1=虚线, 2=点线, 3=点划线
- 透明度：SetFilling(s, 0.3)  0=不透明, 1=全透明`;

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
        get_canvas_state: getCanvasStateTool,
      },
      toolChoice: useOpenRouter ? "auto" : "required",
      abortSignal: signal,
    });

    const toolCall = extractToolCall(result);

    if (!toolCall) {
      // 模型没有调用工具，给一次纠正机会
      const responseText = result.text || "(无响应)";
      console.warn("模型未调用工具，响应:", responseText.substring(0, 200));
      messages.push({
        role: "assistant",
        content: responseText,
      });
      messages.push({
        role: "user",
        content: [{
          type: "text",
          text: "你没有调用任何工具。请调用 execute_geo_gebra_step 执行下一步绘图命令，或调用 complete_geo_gebra_task 表示任务完成。如果你已完成所有步骤，请调用 complete_geo_gebra_task。",
        }],
      });
      continue;
    }

    if (toolCall.toolName === "get_canvas_state") {
      // 查询画布状态
      if (onGetCanvasState) {
        try {
          const state = await onGetCanvasState();
          const objectSummary =
            state.objects.length > 0
              ? state.objects
                  .map((o) => `${o.name} (${o.type}): ${o.definition || o.value}`)
                  .join("\n  ")
              : "(画布为空)";
          messages.push({
            role: "assistant",
            content: result.text || `query canvas state`,
          });
          messages.push({
            role: "user",
            content: [{
              type: "text",
              text: `画布上当前的对象：\n  ${objectSummary}\n\n请基于这些已有对象继续操作。`,
            }],
          });
        } catch {
          messages.push({
            role: "user",
            content: [{ type: "text", text: "查询画布状态失败。请继续操作。" }],
          });
        }
      } else {
        messages.push({
          role: "user",
          content: [{ type: "text", text: "无法查询画布状态（不支持此操作）。请继续。" }],
        });
      }
      continue;
    }

    if (toolCall.toolName === "execute_geo_gebra_step") {
      const args = toolCall.input as {
        stepNumber: number;
        totalSteps: number;
        command: string;
        description: string;
        expectedResult: string;
      } | undefined;

      if (!args?.command) {
        console.warn("execute_geo_gebra_step 缺少 input 或 command，响应:", JSON.stringify(toolCall).substring(0, 200));
        messages.push({
          role: "assistant",
          content: result.text || JSON.stringify(toolCall),
        });
        messages.push({
          role: "user",
          content: [{ type: "text", text: "工具调用缺少 command 参数。请重新调用 execute_geo_gebra_step 并提供完整的 stepNumber、totalSteps、command、description、expectedResult。" }],
        });
        continue;
      }

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

      // 从画布实时获取对象列表，而非依赖命令历史（历史在 Delete 后会过时）
      let liveObjects = "";
      if (onGetCanvasState) {
        try {
          const state = await onGetCanvasState();
          liveObjects = state.objects.length > 0
            ? state.objects.map(o => `${o.name}(${o.type})`).join(", ")
            : "无";
        } catch {
          liveObjects = "查询失败";
        }
      } else {
        const definedVariables = allCommands
          .map(cmd => { const m = cmd.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/); return m ? m[1] : null; })
          .filter(Boolean);
        liveObjects = definedVariables.join(", ") || "无";
      }

      messages.push({
        role: "assistant",
        content: result.text || JSON.stringify(toolCall),
      });

      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: `执行结果: ${executionResult.success ? "成功" : "失败"}${executionResult.error ? `, 错误: ${executionResult.error}` : ""}\n\n画布上的对象：${liveObjects}。请继续下一步。`,
          },
        ],
      });
    } else if (toolCall.toolName === "complete_geo_gebra_task") {
      const args = toolCall.input as {
        finalDescription: string;
        finalElements: string[];
        finalSteps: string[];
      } | undefined;

      if (!args?.finalDescription) {
        console.warn("complete_geo_gebra_task 缺少 input，响应:", JSON.stringify(toolCall).substring(0, 200));
        messages.push({
          role: "assistant",
          content: result.text || JSON.stringify(toolCall),
        });
        messages.push({
          role: "user",
          content: [{ type: "text", text: "工具调用缺少参数。请重新调用 complete_geo_gebra_task 并提供 finalDescription、finalElements、finalSteps。" }],
        });
        continue;
      }

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
  historyMessages?: ModelMessage[],
  onGetCanvasState?: GetCanvasStateCallback
): Promise<{ description: string; elements: unknown[]; suggestedSteps: string[] }> {
  const client = createAIClient(provider);
  const modelName = getModelName(provider, false);
  const useOpenRouter = isOpenRouterProvider(provider);

  const isFollowUp = historyMessages && historyMessages.length > 0;

  let existingStateHint = "";
  if (isFollowUp && onGetCanvasState) {
    try {
      const state = await onGetCanvasState();
      if (state.objects.length > 0) {
        const objectSummary = state.objects
          .map((o) => `${o.name} (${o.type}): ${o.definition || o.value}`)
          .join("\n  ");
        existingStateHint = `\n\n## 画布上已有的对象（请勿重新创建，只需修改/补充）\n  ${objectSummary}\n\n在修改之前，你也可以调用 get_canvas_state 工具重新查询画布状态。`;
      }
    } catch {}
  }

  const followUpNote = isFollowUp
    ? `\n\n[注意：这是对现有图形的修改/补充。不要重新创建已有对象！可以直接修改对象的颜色、样式、位置，或添加新元素。如需了解画布上的对象，调用 get_canvas_state 工具。]${existingStateHint}`
    : "";

  const systemPrompt = `你是一个专业的几何绘图助手，使用 GeoGebra 根据描述绘制几何图形。

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
步骤6: p = PerpendicularLine(E, AB)  // 错误！AB不存在！

## 获取画布状态
在对已有图形进行修改时，先调用 get_canvas_state 工具（无需参数）查看画布上已有的对象。
返回每个对象的名称、类型、值和定义命令。根据查询结果决定修改哪些对象。

## 修改对象
### 颜色（重要：多次尝试的常见错因）
- 颜色名：SetColor(A, "red")
  - 可用颜色名 (英文): black, dark gray, gray, dark blue, blue, dark green, green, maroon, crimson, red, magenta, indigo, purple, brown, orange, gold, lime, cyan, turquoise, light blue, pink, violet, yellow, white
- RGB（0~1 之间！）：SetColor(A, 1, 0, 0)  红色；SetColor(A, 0, 0.5, 0)  暗绿
  - 注意 RGB 范围是 0~1，不是 0~255！传 255 会得到错误的颜色。
- 十六进制（推荐）：SetColor(A, "#FF0000")  红色；SetColor(A, "#00FF00")  绿色；SetColor(A, "#0000FF")  蓝色
  - 带透明度：SetColor(A, "#80FF0000")  半透明红
- 动态颜色冲突：如果对象属性中启用了"动态颜色"，SetColor 会静默失效。此时先禁用：SetDynamicColor(A, 0, 0, 0)
- 填充色：SetFilling(s, 1)  填充多边形。如果先调 SetFilling 再调 SetColor，SetColor 控制的是边框色。

### 其他修改
- 删除对象：Delete[A]  删除点A
- 隐藏：SetVisibleInView(A, 1, false)；显示：SetVisibleInView(A, 1, true)
- 标签：SetCaption(s, "名称")；隐藏标签：ShowLabel(A, false)
- 线宽：SetLineThickness(s, 5)  范围 1-13
- 点大小：SetPointSize(A, 6)  范围 1-9
- 线型：SetLineStyle(s, 1)  0=实线, 1=虚线, 2=点线, 3=点划线
- 透明度：SetFilling(s, 0.3)  0=不透明, 1=全透明`;

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

    // 从画布实时获取对象列表，而非用命令历史推断（历史在 Delete 后会过时）
    let definedVariables = "";
    if (onGetCanvasState) {
      try {
        const state = await onGetCanvasState();
        definedVariables = state.objects.length > 0
          ? state.objects.map(o => `${o.name}(${o.type})`).join(", ")
          : "无";
      } catch {
        definedVariables = allCommands
          .map(cmd => { const m = cmd.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/); return m ? m[1] : null; })
          .filter(Boolean).join(", ") || "无";
      }
    } else {
      definedVariables = allCommands
        .map(cmd => { const m = cmd.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/); return m ? m[1] : null; })
        .filter(Boolean).join(", ") || "无";
    }

    const messagesWithContext: ModelMessage[] = [...messages];
    if (allCommands.length > 0) {
      messagesWithContext.push({
        role: "user",
        content: [{ type: "text", text: `[提醒]画布上的对象：${definedVariables}。请确保只引用这些存在的对象，不要引用不存在的变量。` }],
      });
    }

    const result = await generateText({
      model: client(modelName),
      messages: messagesWithContext,
      tools: {
        execute_geo_gebra_step: executeGeoGebraStepTool,
        complete_geo_gebra_task: completeGeoGebraTaskTool,
        get_canvas_state: getCanvasStateTool,
      },
      toolChoice: useOpenRouter ? "auto" : "required",
      abortSignal: signal,
    });

    const toolCall = extractToolCall(result);

    if (!toolCall) {
      const responseText = result.text || "(无响应)";
      console.warn("模型未调用工具，响应:", responseText.substring(0, 200));
      messages.push({
        role: "assistant",
        content: responseText,
      });
      messages.push({
        role: "user",
        content: [{
          type: "text",
          text: "你没有调用任何工具。请调用 execute_geo_gebra_step 执行下一步绘图命令，或调用 complete_geo_gebra_task 表示任务完成。如果你已完成所有步骤，请调用 complete_geo_gebra_task。",
        }],
      });
      continue;
    }

    if (toolCall.toolName === "get_canvas_state") {
      if (onGetCanvasState) {
        try {
          const state = await onGetCanvasState();
          const objectSummary =
            state.objects.length > 0
              ? state.objects
                  .map((o) => `${o.name} (${o.type}): ${o.definition || o.value}`)
                  .join("\n  ")
              : "(画布为空)";
          messages.push({
            role: "assistant",
            content: result.text || `query canvas state`,
          });
          messages.push({
            role: "user",
            content: [{
              type: "text",
              text: `画布上当前的对象：\n  ${objectSummary}\n\n请基于这些已有对象继续操作。`,
            }],
          });
        } catch {
          messages.push({
            role: "user",
            content: [{ type: "text", text: "查询画布状态失败。请继续操作。" }],
          });
        }
      } else {
        messages.push({
          role: "user",
          content: [{ type: "text", text: "无法查询画布状态（不支持此操作）。请继续。" }],
        });
      }
      continue;
    }

    if (toolCall.toolName === "execute_geo_gebra_step") {
      const args = toolCall.input as {
        stepNumber: number;
        totalSteps: number;
        command: string;
        description: string;
        expectedResult: string;
      } | undefined;

      if (!args?.command) {
        console.warn("execute_geo_gebra_step 缺少 input 或 command，响应:", JSON.stringify(toolCall).substring(0, 200));
        messages.push({
          role: "assistant",
          content: result.text || JSON.stringify(toolCall),
        });
        messages.push({
          role: "user",
          content: [{ type: "text", text: "工具调用缺少 command 参数。请重新调用 execute_geo_gebra_step 并提供完整的 stepNumber、totalSteps、command、description、expectedResult。" }],
        });
        continue;
      }

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

      // 从画布实时获取对象列表
      let liveObjects = "";
      if (onGetCanvasState) {
        try {
          const state = await onGetCanvasState();
          liveObjects = state.objects.length > 0
            ? state.objects.map(o => `${o.name}(${o.type})`).join(", ")
            : "无";
        } catch {
          liveObjects = "查询失败";
        }
      } else {
        liveObjects = definedVariables || "无";
      }

      messages.push({
        role: "assistant",
        content: result.text || JSON.stringify(toolCall),
      });

      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: `执行结果: ${executionResult.success ? "成功" : "失败"}${executionResult.error ? `, 错误: ${executionResult.error}` : ""}\n\n画布上的对象：${liveObjects}。请继续下一步。`,
          },
        ],
      });
    } else if (toolCall.toolName === "complete_geo_gebra_task") {
      const args = toolCall.input as {
        finalDescription: string;
        finalElements: string[];
        finalSteps: string[];
      } | undefined;

      if (!args?.finalDescription) {
        console.warn("complete_geo_gebra_task 缺少 input，响应:", JSON.stringify(toolCall).substring(0, 200));
        messages.push({
          role: "assistant",
          content: result.text || JSON.stringify(toolCall),
        });
        messages.push({
          role: "user",
          content: [{ type: "text", text: "工具调用缺少参数。请重新调用 complete_geo_gebra_task 并提供 finalDescription、finalElements、finalSteps。" }],
        });
        continue;
      }

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

// 获取画布状态工具：模型查询当前画布上的所有对象
const getCanvasStateTool = tool({
  description:
    "获取当前画布上所有对象的列表。在修改或补充现有图形之前，先调用此工具了解已有的对象，避免重复创建或引用不存在的对象。返回每个对象的名称、类型、值和定义命令。",
  inputSchema: z.object({}),
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
