/**
 * useExplainChat.ts — 数学讲解（讲题）聊天 Hook
 *
 * 自定义 React Native 兼容的流式聊天 Hook。
 *
 * 由于 React Native 环境对 SSE / ReadableStream 支持有限，
 * 本 Hook 采用 generateText() + 渐进式文本展示的方案来模拟流式效果：
 * 1. 调用 generateText() 获取完整回答
 * 2. 将回答按句子/段落拆分
 * 3. 通过 setInterval 逐句追加到 UI，模拟打字流
 *
 * 设计原则：
 * - 不依赖 @ai-sdk/react 的 useChat（RN 兼容性问题）
 * - 不持久化聊天记录（每次返回页面重置）
 * - 支持多轮对话（完整消息历史发送给 AI）
 * - 可中止请求（AbortController）
 *
 * @module useExplainChat
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { generateText } from "ai";
import { createAIClient, getModelName, isOpenRouterProvider } from "./createLearningClient";
import { LLMProvider } from "./llmProviders";
import { getExplainSystemPrompt } from "./explainAgent";
import { useConversationStore } from "../stores/conversationStore";

// ==================== 类型定义 ====================

/** 聊天消息 */
export interface ChatMessage {
  /** 消息唯一标识 */
  id: string;
  /** 角色：user（用户）、assistant（AI 助手）、system（系统提示） */
  role: "user" | "assistant" | "system";
  /** 消息文本内容 */
  content: string;
  /** 是否正在流式输出中 */
  isStreaming?: boolean;
}

/** useExplainChat 返回值 */
export interface UseExplainChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  cancelRequest: () => void;
  conversationId: string | null;
}

// ==================== 工具函数 ====================

/**
 * 将文本按句子边界拆分为多个块，用于模拟流式展示
 *
 * 优先按中文标点（。！？\n）拆分，每块尽量控制在一行以内。
 * 兜底策略：如果拆分后块数太少（<3），按固定长度（~30字符）强制拆分。
 *
 * @param text - 要拆分的完整文本
 * @returns 拆分后的文本块数组
 */
function splitIntoChunks(text: string): string[] {
  // 按中文标点 + 换行拆分（同时保留分隔符）
  const rawChunks = text.split(/(?<=[。！？\n])/g);
  const chunks: string[] = [];

  let buffer = "";
  for (const part of rawChunks) {
    buffer += part;
    // 每积累到一定长度就切一块
    if (buffer.length >= 20 || part.endsWith("\n")) {
      chunks.push(buffer);
      buffer = "";
    }
  }
  if (buffer.trim()) {
    chunks.push(buffer);
  }

  // 兜底：如果拆分太少，按固定长度强制拆分
  if (chunks.length < 3 && text.length > 0) {
    const forced: string[] = [];
    const chunkSize = Math.max(15, Math.floor(text.length / 4));
    for (let i = 0; i < text.length; i += chunkSize) {
      forced.push(text.slice(i, i + chunkSize));
    }
    return forced;
  }

  return chunks;
}

/**
 * 生成唯一消息 ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ==================== Hook 实现 ====================

/**
 * 数学讲解（讲题）聊天 Hook
 *
 * 管理多轮对话状态，发送用户消息后调用 AI 生成回答，
 * 并以渐进式文本展示模拟流式效果。
 *
 * @param provider - 当前活跃的 LLM 提供商配置，为 null 时无法发送消息
 * @returns 聊天状态和操作方法
 *
 * @example
 * ```tsx
 * const { messages, isLoading, sendMessage, clearMessages } = useExplainChat(activeProvider);
 *
 * // 发送消息
 * await sendMessage("什么是勾股定理？");
 *
 * // 展示消息列表
 * {messages.map(msg => (
 *   <Text key={msg.id}>{msg.content}</Text>
 * ))}
 * ```
 */
export function useExplainChat(
  provider: LLMProvider | null,
  conversationId?: string | null
): UseExplainChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const appendMessages = useConversationStore((s) => s.appendMessages);

  // Load conversation history on mount if conversationId provided
  useEffect(() => {
    if (!conversationId) return;
    const conv = useConversationStore.getState().conversations.find(
      (c) => c.id === conversationId
    );
    if (!conv) return;
    try {
      const msgs = JSON.parse(conv.messages);
      setMessages(
        msgs
          .filter((m: any) => m.role !== "system")
          .map((m: any) => ({
            id: generateMessageId(),
            role: m.role,
            content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
          }))
      );
    } catch { /* ignore parse errors */ }
  }, [conversationId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!provider) {
        setError("请先配置 LLM 提供商");
        return;
      }

      if (!text.trim()) {
        return;
      }

      // 创建 AbortController 以支持取消
      const abortController = new AbortController();
      abortRef.current = abortController;

      const userMsg: ChatMessage = {
        id: generateMessageId(),
        role: "user",
        content: text.trim(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);

      try {
        const client = createAIClient(provider);
        const modelName = getModelName(provider);
        const systemPrompt = getExplainSystemPrompt();

        // 构建完整消息历史（用于多轮对话上下文）
        const conversationHistory = [
          { role: "system" as const, content: systemPrompt },
          ...messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          { role: "user" as const, content: text.trim() },
        ];

        // 检查是否已中止
        if (abortController.signal.aborted) return;

        const result = await generateText({
          model: client(modelName),
          messages: conversationHistory,
          abortSignal: abortController.signal,
        });

        // 再次检查是否已中止
        if (abortController.signal.aborted) return;

        const fullText = result.text || "抱歉，我暂时无法回答这个问题，请稍后再试。";

        // 创建助手消息（初始为空，逐步追加内容）
        const assistantId = generateMessageId();
        const assistantMsg: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: "",
          isStreaming: true,
        };
        setMessages((prev) => [...prev, assistantMsg]);

        // === 渐进式文本展示（模拟流式效果） ===
        const chunks = splitIntoChunks(fullText);
        const delayPerChunk = Math.min(80, Math.max(30, Math.floor(2000 / chunks.length)));

        for (let i = 0; i < chunks.length; i++) {
          // 每次追加前检查是否被取消
          if (abortController.signal.aborted) {
            // 取消时保留已展示的部分并标记流式结束
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
            );
            return;
          }

          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, delayPerChunk);
            // 如果请求被取消，清除定时器
            const checkAbort = setInterval(() => {
              if (abortController.signal.aborted) {
                clearTimeout(timer);
                clearInterval(checkAbort);
                resolve();
              }
            }, 50);
            // 在延迟结束后清除检查
            setTimeout(() => clearInterval(checkAbort), delayPerChunk + 10);
          });

          if (abortController.signal.aborted) {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
            );
            return;
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + chunks[i] }
                : m
            )
          );
        }

        // 流式完成，标记消息不再是 streaming 状态
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          );
          // Persist to conversation store
          if (conversationId) {
            const toPersist = [
              { role: "user", content: text.trim() },
              { role: "assistant", content: fullText },
            ];
            appendMessages(conversationId, toPersist).catch(() => {});
          }
          return updated;
        });
      } catch (err: unknown) {
        // AbortError 不做错误提示
        if (err instanceof Error && err.name === "AbortError") {
          // 请求被用户取消，静默处理
        } else {
          const message = err instanceof Error ? err.message : "请求失败，请重试";
          setError(message);
          console.error("useExplainChat: generateText failed", err);
        }
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [provider, messages, conversationId, appendMessages]
  );

  /**
   * 清空所有聊天记录和错误状态
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  /**
   * 取消当前正在进行的 AI 请求
   */
  const cancelRequest = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsLoading(false);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    cancelRequest,
    conversationId: conversationId ?? null,
  };
}
