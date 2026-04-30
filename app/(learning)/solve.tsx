/**
 * solve.tsx — 解题页面
 *
 * 组成：ChatPanel (solve 模式) + StepVisualizer + solveAgent
 * 流程：输入 → solveProblem() → 逐步展示 → 完成 → 保存到错题本
 *
 * @module SolvePage
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import ChatPanel from "../../components/ChatPanel";
import StepVisualizer from "../../components/StepVisualizer";
import NotebookForm from "../../components/NotebookForm";
import {
  useActiveLLMProvider,
  useLLMProvidersLoading,
} from "../../stores/llmProviderStore";
import {
  solveProblem,
  SolveStep,
  SolveResult,
} from "../../utils/solveAgent";

// ==================== 组件 ====================

export default function SolvePage() {
  const router = useRouter();
  const provider = useActiveLLMProvider();
  const isLoadingProviders = useLLMProvidersLoading();

  // ---- 页面输入状态 ----
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // ---- 解题流程状态 ----
  const [steps, setSteps] = useState<SolveStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [status, setStatus] = useState<
    "idle" | "solving" | "completed" | "error"
  >("idle");
  const [solveResult, setSolveResult] = useState<SolveResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSolving, setIsSolving] = useState(false);

  // ---- 错题本表单 ----
  const [notebookVisible, setNotebookVisible] = useState(false);

  // ==================== 图片选择 ====================

  const pickImage = useCallback(async () => {
    const { status: permStatus } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permStatus !== "granted") {
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
  }, []);

  const cancelImage = useCallback(() => {
    setSelectedImage(null);
  }, []);

  // ==================== 核心解题逻辑 ====================

  const handleSolve = useCallback(async () => {
    if (!provider || (!inputText.trim() && !selectedImage) || isSolving)
      return;

    setIsSolving(true);
    setStatus("solving");
    setSteps([]);
    setCurrentStepIndex(0);
    setSolveResult(null);
    setErrorMessage(null);

    try {
      const result = await solveProblem(
        inputText.trim() || "请解决这个数学问题",
        provider,
        selectedImage || undefined,
        async (step: SolveStep) => {
          setSteps((prev) => [...prev, step]);
          setCurrentStepIndex((prev) => prev + 1);
          return { success: true };
        }
      );
      setSolveResult(result);
      setStatus("completed");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "解题失败，请重试";
      setErrorMessage(message);
      setStatus("error");
    } finally {
      setIsSolving(false);
    }
  }, [provider, inputText, selectedImage, isSolving]);

  // ==================== 加载中 ====================

  if (isLoadingProviders) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ==================== 渲染 ====================

  return (
    <SafeAreaView style={styles.container}>
      {/* ===== 无提供商状态 — 由 ChatPanel 处理 ===== */}
      {!provider ? (
        <ChatPanel mode="solve" provider={null} />
      ) : (
        <>
          {/* ===== 主内容区域 ===== */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* ---- 头部 ---- */}
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                activeOpacity={0.7}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={24} color="#333" />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>解题</Text>
                <Text style={styles.headerSubtitle}>
                  AI 逐步解题，展示完整过程
                </Text>
              </View>
            </View>

            {/* ---- StepVisualizer 时间线 ---- */}
            <View style={styles.visualizerWrapper}>
              <StepVisualizer
                steps={steps}
                currentStepIndex={currentStepIndex}
                status={status}
                finalAnswer={solveResult?.finalAnswer}
                errorMessage={errorMessage ?? undefined}
              />
            </View>

            {/* ---- 完成 → 保存到错题本 ---- */}
            {status === "completed" && solveResult && (
              <View style={styles.completionSection}>
                <View style={styles.completionBadge}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color="#2e7d32"
                  />
                  <Text style={styles.completionText}>解题完成</Text>
                </View>
                <View style={styles.completionMeta}>
                  <Text style={styles.solutionTypeBadge}>
                    {solveResult.solutionType}
                  </Text>
                  <Text style={styles.completionStepCount}>
                    共 {solveResult.steps.length} 步
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.saveButton}
                  activeOpacity={0.7}
                  onPress={() => setNotebookVisible(true)}
                >
                  <Ionicons
                    name="bookmark-outline"
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.saveButtonText}>保存到错题本</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ---- 错误状态 + 重试 ---- */}
            {status === "error" && errorMessage && (
              <View style={styles.errorSection}>
                <View style={styles.errorHeaderRow}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color="#ff3b30"
                  />
                  <Text style={styles.errorTitle}>解题出错</Text>
                </View>
                <Text style={styles.errorBody}>{errorMessage}</Text>
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

            {/* ---- 空状态 ---- */}
            {status === "idle" && steps.length === 0 && !isSolving && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons
                    name="calculator-outline"
                    size={56}
                    color="#d0d0d0"
                  />
                </View>
                <Text style={styles.emptyTitle}>开始解题</Text>
                <Text style={styles.emptySubtitle}>
                  在下方输入数学问题或上传题目图片，点击「开始解题」按钮
                </Text>
              </View>
            )}

            {/* ---- 加载中指示器 ---- */}
            {isSolving && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.solvingText}>
                  正在分析题目并逐步解题...
                </Text>
                {steps.length > 0 && (
                  <Text style={styles.solvingSubtext}>
                    已完成 {steps.length} 步
                  </Text>
                )}
              </View>
            )}
          </ScrollView>

          {/* ===== 底部输入区域 ===== */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
          >
            {/* 图片预览 */}
            {selectedImage && (
              <View style={styles.imagePreviewContainer}>
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.imagePreview}
                />
                <Text style={styles.imagePreviewLabel} numberOfLines={1}>
                  已选择图片
                </Text>
                <TouchableOpacity
                  onPress={cancelImage}
                  style={styles.cancelImageButton}
                >
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              </View>
            )}

            {/* 输入框 + 按钮 */}
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
                editable={!isSolving}
              />
              <TouchableOpacity
                style={[
                  styles.solveButton,
                  (!inputText.trim() && !selectedImage) || isSolving
                    ? styles.solveButtonDisabled
                    : null,
                ]}
                activeOpacity={0.7}
                onPress={handleSolve}
                disabled={
                  (!inputText.trim() && !selectedImage) || isSolving
                }
              >
                {isSolving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.solveButtonText}>开始解题</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </>
      )}

      {/* ===== 错题本表单 Modal ===== */}
      <NotebookForm
        visible={notebookVisible}
        onClose={() => setNotebookVisible(false)}
        prefill={{
          problemText: inputText,
          correctAnswer: solveResult?.finalAnswer,
          analysis: solveResult?.steps
            ?.map((s) => `步骤 ${s.stepNumber}: ${s.description}`)
            .join("\n"),
        }}
      />
    </SafeAreaView>
  );
}

// ==================== 样式 ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  // ---- 加载中 ----
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 14,
    color: "#999",
    marginTop: 12,
  },

  // ---- ScrollView ----
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },

  // ---- 头部 ----
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },

  // ---- StepVisualizer ----
  visualizerWrapper: {
    minHeight: 200,
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  // ---- 完成状态 ----
  completionSection: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  completionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  completionText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2e7d32",
  },
  completionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  solutionTypeBadge: {
    fontSize: 12,
    color: "#558B2F",
    backgroundColor: "#DCEDC8",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  completionStepCount: {
    fontSize: 12,
    color: "#666",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2e7d32",
    paddingVertical: 12,
    borderRadius: 10,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },

  // ---- 错误状态 ----
  errorSection: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ffcdd2",
  },
  errorHeaderRow: {
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

  // ---- 空状态 ----
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
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
  },

  // ---- 加载中 ----
  loadingOverlay: {
    alignItems: "center",
    paddingVertical: 24,
  },
  solvingText: {
    fontSize: 14,
    color: "#999",
    marginTop: 12,
  },
  solvingSubtext: {
    fontSize: 12,
    color: "#bbb",
    marginTop: 4,
  },

  // ---- 图片预览 ----
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

  // ---- 输入区域 ----
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
  solveButton: {
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    backgroundColor: "#007AFF",
  },
  solveButtonDisabled: {
    opacity: 0.5,
  },
  solveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
