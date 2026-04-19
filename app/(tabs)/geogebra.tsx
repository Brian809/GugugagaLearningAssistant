import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  analyzeImageWithSteps,
  generateFromDescriptionWithSteps,
  generateSingleStepScript,
  type GeoGebraStep,
} from "../../utils/geogebraAgent";
import { useActiveLLMProvider, useLLMProviderStore } from "../../stores/llmProviderStore";

// GeoGebra 嵌入 URL
const GEOGEBRA_URL = "https://www.geogebra.org/classic#geometry";

// 动态导入 WebView（只在移动端使用）
let WebView: any = null;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WebView = require("react-native-webview").default;
}

// 消息类型
interface Message {
  id: string;
  role: "user" | "assistant" | "step";
  content: string;
  imageUri?: string;
  stepInfo?: {
    stepNumber: number;
    totalSteps: number;
  };
}

// 工具按钮组件
function ToolButton({
  icon,
  label,
  onPress,
  color = "#007AFF",
}: {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <TouchableOpacity style={styles.toolButton} onPress={onPress}>
      <View style={[styles.toolIconContainer, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.toolLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// AI 对话框组件
function AIChatPanel({
  webViewRef,
}: {
  webViewRef: React.RefObject<any>;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "你好！我是你的数学几何助手。\n\n我可以：\n• 分析几何图片并逐步绘制\n• 根据描述分步构建图形\n• 每步执行后你都能看到效果",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const activeProvider = useActiveLLMProvider();
  const loadProviders = useLLMProviderStore((state) => state.loadProviders);

  // 组件加载时从 storage 加载 providers
  React.useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  // 选择图片
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

  // 拍照
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("权限错误", "需要相机权限才能拍照");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
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

  // 添加消息（使用函数式更新，不需要依赖）
  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  // 更新消息（用于更新现有消息，如错误状态）
  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg))
    );
  }, []);

  // 逐步执行回调
  const handleStepExecution = useCallback(async (step: GeoGebraStep) => {
    try {
      // 1. 生成注入脚本
      const script = generateSingleStepScript(step.command);

      // 2. 注入到 WebView 执行
      if (webViewRef.current) {
        if (Platform.OS === "web") {
          // Web 端通过 postMessage
          const iframe = document.querySelector("iframe");
          iframe?.contentWindow?.postMessage(
            { type: "evalCommand", script },
            "*"
          );
        } else {
          // 移动端通过 injectJavaScript
          webViewRef.current.injectJavaScript(script);
        }
      }

      // 3. 添加步骤消息到聊天界面
      addMessage({
        id: Date.now().toString(),
        role: "step",
        content: `**步骤 ${step.stepNumber}/${step.totalSteps}**: ${step.description}\n\`\`\`\n${step.command}\n\`\`\``,
        stepInfo: {
          stepNumber: step.stepNumber,
          totalSteps: step.totalSteps,
        },
      });

      setCurrentStep(step.stepNumber);
      setTotalSteps(step.totalSteps);

      // 4. 延迟让用户看到效果
      await new Promise((resolve) => setTimeout(resolve, 800));

      // 5. 返回执行结果（必须匹配 outputSchema）
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "执行失败";
      console.error("步骤执行错误:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [webViewRef, addMessage]);

  // 处理发送消息
  const handleSend = async () => {
    console.log("handleSend called", { inputText, selectedImage, hasProvider: !!activeProvider });

    if (!inputText.trim() && !selectedImage) {
      console.log("handleSend: no content, returning");
      return;
    }

    if (!activeProvider) {
      console.log("handleSend: no provider");
      Alert.alert("错误", "请先配置 LLM 提供商");
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputText.trim() || "请分析这张几何图片",
      imageUri: selectedImage || undefined,
    };

    addMessage(userMessage);
    setInputText("");
    setSelectedImage(null);
    setIsLoading(true);
    setCurrentStep(0);
    setTotalSteps(0);

    try {
      // 显示开始消息
      addMessage({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "🎨 开始分析并绘制图形，请稍候...",
      });

      let result;

      if (selectedImage) {
        // 多模态图片分析 - 逐步执行
        result = await analyzeImageWithSteps(
          selectedImage,
          activeProvider,
          handleStepExecution,
          inputText.trim()
        );
      } else {
        // 文本描述生成 - 逐步执行
        result = await generateFromDescriptionWithSteps(
          inputText.trim(),
          activeProvider,
          handleStepExecution
        );
      }

      // 完成后显示总结
      addMessage({
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content:
          `✅ **绘图完成！**\n\n` +
          `${result.description}\n\n` +
          `共执行 ${result.suggestedSteps.length} 个步骤。`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "处理失败";
      addMessage({
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: `❌ 抱歉，处理过程中出现错误：${errorMessage}`,
      });
    } finally {
      setIsLoading(false);
      setCurrentStep(0);
      setTotalSteps(0);
    }
  };

  // 渲染消息
  const renderMessage = (message: Message) => {
    if (message.role === "step") {
      return (
        <View key={message.id} style={styles.stepBubble}>
          <View style={styles.stepIndicator}>
            <Text style={styles.stepNumber}>
              {message.stepInfo?.stepNumber}/{message.stepInfo?.totalSteps}
            </Text>
          </View>
          <Text style={styles.stepText}>{message.content}</Text>
        </View>
      );
    }

    return (
      <View
        key={message.id}
        style={[
          styles.messageBubble,
          message.role === "user" ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            message.role === "user" ? styles.userText : styles.assistantText,
          ]}
        >
          {message.content}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.chatContainer}>
      {/* 头部 */}
      <View style={styles.chatHeader}>
        <Ionicons name="chatbubble-ellipses" size={24} color="#007AFF" />
        <Text style={styles.chatTitle}>AI 几何助手</Text>
        {isLoading && currentStep > 0 && (
          <View style={styles.stepProgress}>
            <Text style={styles.stepProgressText}>
              步骤 {currentStep}/{totalSteps || "?"}
            </Text>
          </View>
        )}
        {isLoading && <ActivityIndicator size="small" color="#007AFF" style={styles.loadingIndicator} />}
      </View>

      {/* 工具栏 */}
      <View style={styles.toolsContainer}>
        <ToolButton icon="image" label="相册" onPress={pickImage} color="#34C759" />
        <ToolButton icon="camera" label="拍照" onPress={takePhoto} color="#FF9500" />
      </View>

      {/* 消息列表 */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {messages.map((message) => (
          <View key={message.id} style={styles.messageWrapper}>
            {message.imageUri && (
              <Image source={{ uri: message.imageUri }} style={styles.messageImage} />
            )}
            {renderMessage(message)}
          </View>
        ))}
      </ScrollView>

      {/* 图片预览 */}
      {selectedImage && (
        <View style={styles.imagePreviewContainer}>
          <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
          <TouchableOpacity style={styles.cancelImageButton} onPress={cancelImage}>
            <Ionicons name="close-circle" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      )}

      {/* 输入区域 */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="描述几何图形或上传图片..."
          multiline
          maxLength={500}
          editable={!isLoading}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!inputText.trim() && !selectedImage) || isLoading
              ? styles.sendButtonDisabled
              : null,
          ]}
          onPress={handleSend}
          disabled={(!inputText.trim() && !selectedImage) || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Web 端使用的 iframe 组件
function GeoGebraWebView({
  injectScript,
}: {
  injectScript?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 当脚本变化时注入
  React.useEffect(() => {
    if (injectScript && iframeRef.current) {
      const iframe = iframeRef.current;
      const handleLoad = () => {
        try {
          iframe.contentWindow?.postMessage(
            { type: "evalCommand", script: injectScript },
            "*"
          );
        } catch (e) {
          console.error("Failed to inject script:", e);
        }
      };
      iframe.addEventListener("load", handleLoad);
      return () => iframe.removeEventListener("load", handleLoad);
    }
  }, [injectScript]);

  return (
    <View style={styles.webviewContainer}>
      {/* @ts-ignore - iframe 在 web 平台可用 */}
      <iframe
        ref={iframeRef}
        src={GEOGEBRA_URL}
        style={styles.iframe}
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    </View>
  );
}

// GeoGebra 画板组件
function GeoGebraPanel({
  webViewRef,
}: {
  webViewRef: React.RefObject<any>;
}) {
  return (
    <View style={styles.geogebraContainer}>
      <View style={styles.geogebraHeader}>
        <Ionicons name="shapes" size={24} color="#34C759" />
        <Text style={styles.geogebraTitle}>GeoGebra 画板</Text>
      </View>
      {Platform.OS === "web" ? (
        <GeoGebraWebView />
      ) : (
        WebView && (
          <WebView
            ref={webViewRef}
            source={{ uri: GEOGEBRA_URL }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
          />
        )
      )}
    </View>
  );
}

export default function GeoGebraScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isLargeScreen = width >= 768;
  const webViewRef = useRef<any>(null);

  // 大屏幕使用左右布局，小屏幕使用上下布局
  if (isLargeScreen || isLandscape) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.horizontalContainer}>
            <View style={[styles.leftPanel, { width: width * 0.35 }]}>
              <AIChatPanel webViewRef={webViewRef} />
            </View>
            <View style={[styles.rightPanel, { width: width * 0.65 }]}>
              <GeoGebraPanel webViewRef={webViewRef} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // 上下布局
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.verticalContainer}>
          <View style={styles.topPanel}>
            <GeoGebraPanel webViewRef={webViewRef} />
          </View>
          <View style={styles.bottomPanel}>
            <AIChatPanel webViewRef={webViewRef} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  keyboardContainer: {
    flex: 1,
  },
  // 水平布局样式
  horizontalContainer: {
    flex: 1,
    flexDirection: "row",
  },
  leftPanel: {
    borderRightWidth: 1,
    borderRightColor: "#e5e5ea",
  },
  rightPanel: {
    flex: 1,
  },
  // 垂直布局样式
  verticalContainer: {
    flex: 1,
    flexDirection: "column",
  },
  topPanel: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5ea",
  },
  bottomPanel: {
    flex: 1,
  },
  // GeoGebra 面板样式
  geogebraContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  geogebraHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5ea",
    gap: 8,
  },
  geogebraTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  webview: {
    flex: 1,
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  iframe: {
    width: "100%",
    height: "100%",
    borderWidth: 0,
  } as any,
  // AI 聊天面板样式
  chatContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5ea",
    gap: 8,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  stepProgress: {
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
  },
  stepProgressText: {
    fontSize: 12,
    color: "#1976D2",
    fontWeight: "600",
  },
  loadingIndicator: {
    marginLeft: "auto",
  },
  // 工具栏
  toolsContainer: {
    flexDirection: "row",
    padding: 8,
    gap: 12,
    backgroundColor: "#f8f8f8",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5ea",
  },
  toolButton: {
    alignItems: "center",
    gap: 4,
  },
  toolIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  toolLabel: {
    fontSize: 11,
    color: "#666",
  },
  // 消息列表
  messagesContainer: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },
  messagesContent: {
    padding: 12,
    gap: 8,
  },
  messageWrapper: {
    gap: 4,
  },
  messageImage: {
    width: 150,
    height: 112,
    borderRadius: 8,
    alignSelf: "flex-end",
  },
  messageBubble: {
    maxWidth: "90%",
    padding: 10,
    borderRadius: 12,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#007AFF",
    borderBottomRightRadius: 4,
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
    lineHeight: 18,
  },
  userText: {
    color: "#fff",
  },
  assistantText: {
    color: "#333",
  },
  // 步骤消息样式
  stepBubble: {
    flexDirection: "row",
    alignItems: "flex-start",
    maxWidth: "90%",
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#FFF8E1",
    borderWidth: 1,
    borderColor: "#FFECB3",
    borderBottomLeftRadius: 4,
    alignSelf: "flex-start",
    gap: 8,
  },
  stepIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFB300",
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: "#5D4037",
    lineHeight: 18,
  },
  // 图片预览
  imagePreviewContainer: {
    padding: 8,
    backgroundColor: "#f8f8f8",
    borderTopWidth: 1,
    borderTopColor: "#e5e5ea",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  imagePreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  cancelImageButton: {
    padding: 4,
  },
  // 输入区域
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 8,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e5ea",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 80,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f2f2f7",
    borderRadius: 18,
    fontSize: 14,
    color: "#333",
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#c7c7cc",
  },
});
