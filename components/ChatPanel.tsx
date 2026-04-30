/**
 * ChatPanel.tsx — 共享聊天面板组件
 *
 * 两种模式：
 * - "solve"：解题模式，逐步解题，显示 step-by-step 步骤
 * - "explain"：讲解模式，流式聊天，模拟逐句输出
 *
 * 依赖：
 * - utils/solveAgent.ts — solveProblem 函数、SolveStep/SolveResult 类型
 * - utils/useExplainChat.ts — useExplainChat Hook、ChatMessage 类型
 * - expo-image-picker — 图片选择
 *
 * @module ChatPanel
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { solveProblem, SolveStep, SolveResult } from "../utils/solveAgent";
import { useExplainChat, ChatMessage } from "../utils/useExplainChat";
import { LLMProvider } from "../utils/llmProviders";

// ==================== 类型定义 ====================

interface ChatPanelProps {
  /** 模式：解题 | 讲解 */
  mode: "solve" | "explain";
  /** 当前活跃的 LLM 提供商，null 时显示无提供商状态 */
  provider: LLMProvider | null;
  /** 外部传入的图片 URI（如拍照搜题），会预选为已选图片 */
  image?: string;
}

// ==================== 组件实现 ====================

export default function ChatPanel({ mode, provider, image: externalImage }: ChatPanelProps) {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const prevModeRef = useRef(mode);

  // 共享状态
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(externalImage || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 解题模式状态
  const [steps, setSteps] = useState<SolveStep[]>([]);
  const [solveResult, setSolveResult] = useState<SolveResult | null>(null);

  // 讲解模式 Hook
  const explainChat = useExplainChat(provider);

  // 同步外部图片
  useEffect(() => {
    if (externalImage) {
      setSelectedImage(externalImage);
    }
  }, [externalImage]);

  // 切换模式时重置状态
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      prevModeRef.current = mode;
      setInputText("");
      setSelectedImage(externalImage || null);
      setSteps([]);
      setSolveResult(null);
      setError(null);
      explainChat.clearMessages();
    }
  }, [mode, externalImage, explainChat]);

  // 自动滚动到最新消息（讲解模式）
  useEffect(() => {
    if (mode === "explain" && explainChat.messages.length > 0 && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [explainChat.messages, mode]);

  // ==================== 图片选择 ====================

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("权限错误", "需要访问相册权限才能选择图片");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  // 取消图片选择
  const cancelImage = () => {
    setSelectedImage(null);
  };

  // ==================== 解题模式逻辑 ====================

  const handleSolve = async () => {
    if (!inputText.trim() && !selectedImage) return;
    if (!provider) return;

    setIsLoading(true);
    setError(null);
    setSteps([]);
    setSolveResult(null);

    try {
      const result = await solveProblem(
        inputText.trim() || "请解决这个数学问题",
        provider,
        selectedImage || undefined,
        async (step: SolveStep) => {
          setSteps((prev) => [...prev, step]);
          return { success: true };
        }
      );
      setSolveResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "解题失败，请重试";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== 讲解模式逻辑 ====================

  const handleSendMessage = async () => {
    if (!inputText.trim() || explainChat.isLoading) return;
    const text = inputText.trim();
    setInputText("");
    await explainChat.sendMessage(text);
  };

  // ==================== 无提供商状态 ====================

  if (!provider) {
    return (
      <View style={styles.noProviderContainer}>
        <View style={styles.noProviderIcon}>
          <Ionicons name="cloud-offline-outline" size={48} color="#ccc" />
        </View>
        <Text style={styles.noProviderTitle}>未配置 LLM 提供商</Text>
        <Text style={styles.noProviderText}>
          请先在「我的」页面配置 LLM 提供商才能使用{mode === "solve" ? "解题" : "讲解"}功能
        </Text>
        <TouchableOpacity
          style={styles.noProviderButton}
          activeOpacity={0.7}
          onPress={() => router.push("/(tabs)/profile")}
        >
          <Ionicons name="settings-outline" size={18} color="#fff" />
          <Text style={styles.noProviderButtonText}>前往配置</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ==================== 解题模式渲染 ====================

  if (mode === "solve") {
    return (
      <View style={styles.container}>
        {/* 步骤列表区域 */}
        <ScrollView
          style={styles.contentArea}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 空状态提示 */}
          {steps.length === 0 && !isLoading && !error && !solveResult && (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIcon}>
                <Ionicons name="calculator-outline" size={56} color="#d0d0d0" />
              </View>
              <Text style={styles.emptyTitle}>开始解题</Text>
              <Text style={styles.emptySubtitle}>
                输入数学问题或选择图片，点击「开始解题」按钮
              </Text>
            </View>
          )}

          {/* 解题步骤卡片 */}
          {steps.map((step) => (
            <View key={step.stepNumber} style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{step.stepNumber}</Text>
                </View>
                <View style={styles.stepHeaderText}>
                  <Text style={styles.stepLabel}>步骤 {step.stepNumber}</Text>
                </View>
              </View>
              <Text style={styles.stepDescription}>{step.description}</Text>
              {step.expression && (
                <View style={styles.expressionBox}>
                  <Text style={styles.expressionText}>{step.expression}</Text>
                </View>
              )}
              {step.result && (
                <View style={styles.resultBox}>
                  <Text style={styles.resultLabel}>中间结果</Text>
                  <Text style={styles.resultText}>{step.result}</Text>
                </View>
              )}
              {step.latexFormula && (
                <View style={styles.latexBox}>
                  <Text style={styles.latexText}>{step.latexFormula}</Text>
                </View>
              )}
              {step.geogebraCommand && (
                <View style={styles.geogebraBox}>
                  <Ionicons name="git-merge-outline" size={14} color="#FF6D00" />
                  <Text style={styles.geogebraText} numberOfLines={2}>
                    {step.geogebraCommand}
                  </Text>
                </View>
              )}
            </View>
          ))}

          {/* 最终答案 */}
          {solveResult && (
            <View style={styles.finalAnswerCard}>
              <View style={styles.finalAnswerHeader}>
                <Ionicons name="checkmark-circle" size={22} color="#2e7d32" />
                <Text style={styles.finalAnswerTitle}>解题完成</Text>
              </View>
              <Text style={styles.finalAnswerText}>{solveResult.finalAnswer}</Text>
              <View style={styles.finalAnswerMeta}>
                <Text style={styles.solutionType}>{solveResult.solutionType}</Text>
                <Text style={styles.stepCount}>共 {solveResult.steps.length} 步</Text>
              </View>
            </View>
          )}

          {/* 错误状态 */}
          {error && (
            <View style={styles.errorCard}>
              <View style={styles.errorHeader}>
                <Ionicons name="close-circle" size={20} color="#ff3b30" />
                <Text style={styles.errorTitle}>解题出错</Text>
              </View>
              <Text style={styles.errorBody}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                activeOpacity={0.7}
                onPress={handleSolve}
              >
                <Ionicons name="refresh" size={16} color="#fff" />
                <Text style={styles.retryButtonText}>重新解题</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 加载指示器 */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>正在分析题目并逐步解题...</Text>
              {steps.length > 0 && (
                <Text style={styles.loadingSubtext}>已完成 {steps.length} 步</Text>
              )}
            </View>
          )}
        </ScrollView>

        {/* 图片预览 */}
        {selectedImage && (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
            <Text style={styles.imagePreviewLabel} numberOfLines={1}>
              已选择图片
            </Text>
            <TouchableOpacity onPress={cancelImage} style={styles.cancelImageButton}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          </View>
        )}

        {/* 输入区域 */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.imagePickerButton}
              activeOpacity={0.6}
              onPress={pickImage}
            >
              <Ionicons name="image-outline" size={22} color="#007AFF" />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="输入数学问题..."
              placeholderTextColor="#999"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.solveButton,
                (!inputText.trim() && !selectedImage) || isLoading
                  ? styles.actionButtonDisabled
                  : null,
              ]}
              activeOpacity={0.7}
              onPress={handleSolve}
              disabled={(!inputText.trim() && !selectedImage) || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>开始解题</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ==================== 讲解模式渲染 ====================

  return (
    <View style={styles.container}>
      {/* 聊天消息区域 */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.contentArea}
        contentContainerStyle={styles.chatScrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* 空状态提示 */}
        {explainChat.messages.length === 0 && !explainChat.isLoading && (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
              <Ionicons name="chatbubbles-outline" size={56} color="#d0d0d0" />
            </View>
            <Text style={styles.emptyTitle}>向 AI 老师提问</Text>
            <Text style={styles.emptySubtitle}>
              输入数学问题开始讲解，可搭配图片一起提问
            </Text>
          </View>
        )}

        {/* 聊天消息列表 */}
        {explainChat.messages.map((msg) => (
          <View key={msg.id} style={styles.chatRow}>
            {msg.role === "assistant" && (
              <View style={styles.assistantAvatar}>
                <Ionicons name="school-outline" size={16} color="#007AFF" />
              </View>
            )}
            <View
              style={[
                styles.messageBubble,
                msg.role === "user" ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              {msg.role === "assistant" && (
                <Text style={styles.assistantName}>咕咕老师</Text>
              )}
              <Text
                style={[
                  styles.messageText,
                  msg.role === "user" ? styles.userText : styles.assistantText,
                ]}
              >
                {msg.content}
                {msg.isStreaming && <Text style={styles.cursor}> ▊</Text>}
              </Text>
            </View>
          </View>
        ))}

        {/* 加载指示器 */}
        {explainChat.isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>正在思考中...</Text>
          </View>
        )}

        {/* 错误状态 */}
        {explainChat.error && (
          <View style={styles.errorCard}>
            <View style={styles.errorHeader}>
              <Ionicons name="close-circle" size={20} color="#ff3b30" />
              <Text style={styles.errorTitle}>请求失败</Text>
            </View>
            <Text style={styles.errorBody}>{explainChat.error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              activeOpacity={0.7}
              onPress={() => explainChat.clearMessages()}
            >
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={styles.retryButtonText}>清空重试</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* 图片预览 */}
      {selectedImage && (
        <View style={styles.imagePreviewContainer}>
          <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
          <Text style={styles.imagePreviewLabel} numberOfLines={1}>
            已选择图片
          </Text>
          <TouchableOpacity onPress={cancelImage} style={styles.cancelImageButton}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        </View>
      )}

      {/* 输入区域 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.imagePickerButton}
            activeOpacity={0.6}
            onPress={pickImage}
          >
            <Ionicons name="image-outline" size={22} color="#007AFF" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="输入问题..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            editable={!explainChat.isLoading}
          />
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.sendButton,
              !inputText.trim() || explainChat.isLoading
                ? styles.actionButtonDisabled
                : null,
            ]}
            activeOpacity={0.7}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || explainChat.isLoading}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ==================== 样式 ====================

const styles = StyleSheet.create({
  // ===== 容器 =====
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  contentArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 8,
  },
  chatScrollContent: {
    padding: 12,
    paddingBottom: 8,
  },

  // ===== 无提供商状态 =====
  noProviderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 32,
  },
  noProviderIcon: {
    marginBottom: 16,
  },
  noProviderTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  noProviderText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  noProviderButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  noProviderButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },

  // ===== 空状态 =====
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateIcon: {
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 32,
  },

  // ===== 解题步骤卡片 =====
  stepCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFB300",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  stepHeaderText: {
    flex: 1,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  stepDescription: {
    fontSize: 14,
    color: "#555",
    lineHeight: 22,
    marginBottom: 8,
  },
  expressionBox: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#007AFF",
  },
  expressionText: {
    fontSize: 14,
    color: "#333",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  resultBox: {
    backgroundColor: "#F0F8FF",
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  resultLabel: {
    fontSize: 11,
    color: "#007AFF",
    fontWeight: "600",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  resultText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0056b3",
  },
  latexBox: {
    backgroundColor: "#fefefe",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e8e8e8",
    marginBottom: 6,
  },
  latexText: {
    fontSize: 13,
    color: "#666",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  geogebraBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF3E0",
    borderRadius: 8,
    padding: 8,
  },
  geogebraText: {
    flex: 1,
    fontSize: 12,
    color: "#E65100",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  // ===== 最终答案 =====
  finalAnswerCard: {
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  finalAnswerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  finalAnswerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2e7d32",
  },
  finalAnswerText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1b5e20",
    lineHeight: 26,
    marginBottom: 8,
  },
  finalAnswerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  solutionType: {
    fontSize: 12,
    color: "#558B2F",
    backgroundColor: "#DCEDC8",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  stepCount: {
    fontSize: 12,
    color: "#666",
  },

  // ===== 错误卡片 =====
  errorCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ffcdd2",
  },
  errorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ff3b30",
  },
  errorBody: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 12,
  },

  // ===== 重试按钮 =====
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },

  // ===== 加载状态 =====
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 14,
    color: "#999",
    marginTop: 12,
  },
  loadingSubtext: {
    fontSize: 12,
    color: "#bbb",
    marginTop: 4,
  },

  // ===== 图片预览 =====
  imagePreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f8f8f8",
    borderTopWidth: 1,
    borderTopColor: "#e5e5ea",
    gap: 8,
  },
  imagePreview: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#e8e8e8",
  },
  imagePreviewLabel: {
    flex: 1,
    fontSize: 13,
    color: "#666",
  },
  cancelImageButton: {
    padding: 4,
  },

  // ===== 输入区域 =====
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e5ea",
    gap: 6,
  },
  imagePickerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 80,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#f2f2f7",
    borderRadius: 18,
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },

  // ===== 操作按钮 =====
  actionButton: {
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  solveButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 14,
  },
  sendButton: {
    width: 36,
    backgroundColor: "#007AFF",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },

  // ===== 讲解模式 - 聊天消息 =====
  chatRow: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-end",
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EBF5FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: "82%",
    padding: 12,
    borderRadius: 14,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#007AFF",
    borderBottomRightRadius: 4,
    marginLeft: "auto",
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e5ea",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: "#fff",
  },
  assistantText: {
    color: "#333",
  },
  assistantName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#007AFF",
    marginBottom: 4,
  },
  cursor: {
    color: "#007AFF",
    opacity: 0.8,
  },
});
