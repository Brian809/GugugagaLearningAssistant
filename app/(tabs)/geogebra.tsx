import React, { useState, useRef, useCallback, useEffect } from "react";
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

// 全局类型声明
declare global {
  interface Window {
    GGBApplet: any;
    ggbApplet: any;
  }
}

// GeoGebra 嵌入 URL - 使用 API 版本以获得更好的控制
const GEOGEBRA_URL = "https://www.geogebra.org/classic#geometry";

// GeoGebra API 脚本 URL
const GEOGEBRA_API_SCRIPT = "https://www.geogebra.org/apps/deployggb.js";

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
  onExecuteCommand,
}: {
  webViewRef: React.RefObject<any>;
  onExecuteCommand?: (script: string) => void;
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

      // 2. 注入到 WebView/iframe 执行
      if (Platform.OS === "web" && onExecuteCommand) {
        // Web 端通过回调函数
        onExecuteCommand(script);
      } else if (webViewRef.current) {
        // 移动端通过 injectJavaScript
        webViewRef.current.injectJavaScript(script);
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
  }, [webViewRef, onExecuteCommand, addMessage]);

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

// 全局存储 GeoGebra applet 实例和待执行命令队列
let ggbAppletInstance: any = null;
let pendingCommands: string[] = [];

// 共享的 GeoGebra Classic 6 布局 CSS
// 作用：把默认的“左工具栏 + 右画板”强制改为“上工具栏 + 下画板”（Classic 5 风格）
const GGB_LAYOUT_CSS = `
  .GeoGebraFrame { display: flex !important; flex-direction: column !important; }
  .GeoGebraFrame > div { width: 100% !important; }
  .GeoGebraFrame .ggbdockpanelhack,
  .GeoGebraFrame [class*="dockPanel"],
  .GeoGebraFrame .appletPanel {
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
  }
  .GeoGebraFrame .toolbar-panel,
  .GeoGebraFrame [class*="toolbar"] {
    order: -1 !important;
    width: 100% !important;
    flex: 0 0 auto !important;
  }
  .GeoGebraFrame .euclidianPanel,
  .GeoGebraFrame [class*="euclidian"] {
    flex: 1 1 auto !important;
    width: 100% !important;
    min-height: 0 !important;
  }
  .GeoGebraFrame .algebraPanel,
  .GeoGebraFrame [class*="algebra"] {
    order: 99 !important;
    width: 100% !important;
  }
`;

// Web 端将布局 CSS 注入到 document.head（只注入一次）
function injectGgbLayoutCSS() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  if (document.getElementById("ggb-layout-override")) return;
  const style = document.createElement("style");
  style.id = "ggb-layout-override";
  style.textContent = GGB_LAYOUT_CSS;
  document.head.appendChild(style);
}

// Web 端使用的 GeoGebra 组件 - 使用官方 API
function GeoGebraWebView({
  injectScript,
}: {
  injectScript?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appletRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  // 初始化 GeoGebra applet
  React.useEffect(() => {
    if (Platform.OS !== "web" || !containerRef.current) return;

    // 等待容器有尺寸
    const container = containerRef.current;
    if (container.clientWidth === 0 || container.clientHeight === 0) {
      // 如果尺寸为0，等待一下再试
      const checkSize = setInterval(() => {
        if (container.clientWidth > 0 && container.clientHeight > 0) {
          clearInterval(checkSize);
          loadGGBApplet();
        }
      }, 100);
      
      // 5秒后超时
      setTimeout(() => clearInterval(checkSize), 5000);
      return;
    }

    loadGGBApplet();

    function loadGGBApplet() {
      if (window.GGBApplet) {
        initApplet();
      } else {
        const script = document.createElement("script");
        script.src = GEOGEBRA_API_SCRIPT;
        script.onload = initApplet;
        script.onerror = () => console.error("Failed to load GeoGebra API");
        document.head.appendChild(script);
      }
    }

    function initApplet() {
      if (!containerRef.current || !window.GGBApplet) return;

      const width = containerRef.current.clientWidth || 800;
      const height = containerRef.current.clientHeight || 600;

      console.log("Initializing GeoGebra with size:", width, height);

      // 创建一个子容器给 GeoGebra 使用，避免 React 和 GeoGebra 冲突
      const ggbContainerId = "ggb-container-" + Date.now();
      const ggbContainer = document.createElement("div");
      ggbContainer.id = ggbContainerId;
      ggbContainer.style.width = "100%";
      ggbContainer.style.height = "100%";
      
      // 将子容器添加到 React 管理的容器中
      containerRef.current.appendChild(ggbContainer);

      // 统一使用 Classic 6（HTML5 几何应用），与移动端保持一致
      const parameters = {
        appName: "geometry",
        id: "ggbApplet",
        width: width,
        height: height,
        showToolBar: true,
        showToolBarHelp: false,
        borderColor: "#FFFFFF",
        showMenuBar: false,
        showAlgebraInput: true,
        showResetIcon: false,
        enableLabelDrags: true,
        enableShiftDragZoom: true,
        enableRightClick: false,
        capturingThreshold: 10,
        showAxes: true,
        showGrid: true,
        useBrowserForJS: false,
        preventFocus: true,
        algebraInputPosition: "bottom",
      };

      // 注入全局 CSS 强制 Classic 6 使用“上工具栏 + 下画板”布局
      // （覆盖宽屏时 Classic 6 默认的左右两栏布局）
      injectGgbLayoutCSS();

      // 创建 applet 实例并注入到子容器（Classic 6: 第二参数为 true）
      const applet = new window.GGBApplet(parameters, true);
      if (typeof applet.setHTML5Codebase === "function") {
        applet.setHTML5Codebase("https://www.geogebra.org/apps/latest/web/");
      }
      applet.inject(ggbContainerId);
      appletRef.current = applet;

      // 等待 applet 准备好
      let checkCount = 0;
      const checkAppletReady = setInterval(() => {
        checkCount++;
        const ggb = window.ggbApplet;
        
        // 尝试从子容器中获取 applet
        if (!ggb && ggbContainer) {
          const appletElem = ggbContainer.querySelector("#ggbApplet");
          if (appletElem && (appletElem as any).evalCommand) {
            (window as any).ggbApplet = appletElem;
          }
        }
        
        if (ggb && typeof ggb.evalCommand === "function") {
          clearInterval(checkAppletReady);
          ggbAppletInstance = ggb;
          setIsReady(true);
          console.log("GeoGebra applet ready after", checkCount, "checks");
          
          // 执行待处理的命令
          while (pendingCommands.length > 0) {
            const cmd = pendingCommands.shift();
            if (cmd) executeCommand(cmd);
          }
        }
        
        // 60秒后放弃
        if (checkCount > 120) {
          clearInterval(checkAppletReady);
          console.error("GeoGebra applet failed to load after 60 seconds");
        }
      }, 500);

      return () => clearInterval(checkAppletReady);
    }
  }, []);

  // 处理注入脚本
  React.useEffect(() => {
    if (!injectScript) return;

    // 从脚本中提取命令
    const commandMatch = injectScript.match(/ggbApplet\.evalCommand\("(.+?)"\)/);
    if (commandMatch && commandMatch[1]) {
      const command = commandMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      
      if (ggbAppletInstance && ggbAppletInstance.evalCommand) {
        executeCommand(command);
      } else {
        pendingCommands.push(command);
      }
    }
  }, [injectScript]);

  const executeCommand = (command: string) => {
    try {
      if (ggbAppletInstance && ggbAppletInstance.evalCommand) {
        ggbAppletInstance.evalCommand(command);
        ggbAppletInstance.refreshViews();
        console.log("Executed command:", command);
      }
    } catch (e) {
      console.error("Failed to execute command:", e);
    }
  };

  return (
    <View style={styles.webviewContainer}>
      {/* 加载动画样式 */}
      <style>{`
        @keyframes ggb-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      {/* @ts-ignore - div 在 web 平台可用 */}
      <div 
        ref={containerRef} 
        style={{ 
          width: "100%", 
          height: "100%", 
          position: "relative",
          minHeight: "400px",
          overflow: "hidden",
        }} 
      >
        {!isReady && (
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f5f5f5",
            zIndex: 10,
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ 
                width: 40, 
                height: 40, 
                border: "4px solid #e5e5ea", 
                borderTop: "4px solid #007AFF",
                borderRadius: "50%",
                animation: "ggb-spin 1s linear infinite",
                margin: "0 auto 10px",
              }} />
              <span style={{ color: "#666", fontSize: 14 }}>加载 GeoGebra...</span>
            </div>
          </div>
        )}
      </div>
    </View>
  );
}

// GeoGebra 画板组件 - 移动端使用 HTML string 加载 deployggb.js API
const GEOGEBRA_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #ffffff; }
    #ggb-container { width: 100%; height: 100%; background-color: #ffffff; }
    #ggb-container canvas { display: block !important; }
    #loading-msg { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); font-family: sans-serif; color: #333; z-index: 1000; background: rgba(255,255,255,0.9); padding: 20px; border-radius: 8px; }

    /* 强制 Classic 6 使用“上工具栏 + 下画板”布局，覆盖宽屏时的左右布局 */
    .GeoGebraFrame { display: flex !important; flex-direction: column !important; }
    .GeoGebraFrame > div { width: 100% !important; }
    /* dock 容器纵向排列 */
    .GeoGebraFrame .ggbdockpanelhack,
    .GeoGebraFrame [class*="dockPanel"],
    .GeoGebraFrame .appletPanel {
      display: flex !important;
      flex-direction: column !important;
      width: 100% !important;
    }
    /* 工具栏固定在顶部 */
    .GeoGebraFrame .toolbar-panel,
    .GeoGebraFrame [class*="toolbar"] {
      order: -1 !important;
      width: 100% !important;
      flex: 0 0 auto !important;
    }
    /* 画板占据剩余空间 */
    .GeoGebraFrame .euclidianPanel,
    .GeoGebraFrame [class*="euclidian"] {
      flex: 1 1 auto !important;
      width: 100% !important;
      min-height: 0 !important;
    }
    /* 代数输入栏放底部 */
    .GeoGebraFrame .algebraPanel,
    .GeoGebraFrame [class*="algebra"] {
      order: 99 !important;
      width: 100% !important;
    }
  </style>
</head>
<body>
  <div id="loading-msg">加载 GeoGebra...</div>
  <div id="ggb-container"></div>
  <script>
    // 劫持 console 发送到 React Native（原函数 bind 避免递归）
    (function() {
      if (!window.ReactNativeWebView) return;
      var origLog = console.log.bind(console);
      var origErr = console.error.bind(console);
      function safePost(type, args) {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({type: type, message: Array.prototype.slice.call(args).join(' ')}));
        } catch(e) {}
      }
      console.log = function() { origLog.apply(null, arguments); safePost('log', arguments); };
      console.error = function() { origErr.apply(null, arguments); safePost('error', arguments); };
      window.onerror = function(msg, url, line) { safePost('error', ['window.onerror:', msg, '@', url, ':', line]); };
    })();
    console.log('[GGB] HTML page loaded, waiting for container...');

    // 等待容器有尺寸后再加载（与 web 端逻辑一致）
    function waitForContainer() {
      var container = document.getElementById('ggb-container');
      var width = window.innerWidth || document.documentElement.clientWidth;
      var height = window.innerHeight || document.documentElement.clientHeight;
      console.log('[GGB] Container size:', width, 'x', height);
      
      if (width === 0 || height === 0) {
        console.log('[GGB] Container has no size, waiting...');
        setTimeout(waitForContainer, 100);
        return;
      }
      
      loadGGBScript();
    }

    // 动态加载 GeoGebra 脚本（与 web 端逻辑一致）
    function loadGGBScript() {
      if (typeof GGBApplet !== 'undefined') {
        console.log('[GGB] GGBApplet already loaded');
        initApplet();
        return;
      }
      
      console.log('[GGB] Loading GeoGebra script...');
      var script = document.createElement('script');
      script.src = 'https://www.geogebra.org/apps/deployggb.js';
      script.onload = function() {
        console.log('[GGB] Script loaded');
        initApplet();
      };
      script.onerror = function() {
        console.error('[GGB] Failed to load script');
        document.getElementById('loading-msg').innerText = '无法加载 GeoGebra 脚本';
      };
      document.head.appendChild(script);
    }

    // 初始化 applet（与 web 端逻辑一致）
    function initApplet() {
      var container = document.getElementById('ggb-container');
      var width = window.innerWidth || 800;
      var height = window.innerHeight || 600;
      
      console.log('[GGB] Initializing applet with size:', width, 'x', height);
      
      try {
        // 使用 Classic 6（HTML5，2D canvas，不依赖 WebGL，Android 上最稳定）
        // 通过后续 CSS 注入把默认的左右布局改成上下布局（上工具栏 + 下画板）
        var params = {
          appName: "geometry",
          id: "ggbApplet",
          width: width,
          height: height,
          showToolBar: true,
          showToolBarHelp: false,
          borderColor: "#FFFFFF",
          showMenuBar: false,
          showAlgebraInput: true,
          showResetIcon: false,
          enableLabelDrags: true,
          enableShiftDragZoom: true,
          enableRightClick: false,
          capturingThreshold: 10,
          showAxes: true,
          showGrid: true,
          useBrowserForJS: false,
          preventFocus: true,
          algebraInputPosition: "bottom",
        };

        // 使用 Classic 6 HTML5 codebase
        var applet = new GGBApplet(params, true);
        applet.setHTML5Codebase('https://www.geogebra.org/apps/latest/web/');
        applet.inject("ggb-container");

        document.getElementById('loading-msg').style.display = 'none';
        console.log('[GGB] Applet injected (Classic 6 / geometry app)');
      } catch(e) {
        console.error('[GGB] Failed to inject:', e.toString());
        document.getElementById('loading-msg').innerText = '初始化失败: ' + e.message;
        return;
      }

      // 等待 applet 准备好
      var checkCount = 0;
      var readySent = false;
      var checkReady = setInterval(function() {
        checkCount++;
        var ggb = window.ggbApplet;
        var container = document.getElementById('ggb-container');
        var canvas = container ? container.querySelector('canvas') : null;

        if (ggb && typeof ggb.evalCommand === 'function' && canvas && !readySent) {
          readySent = true;
          clearInterval(checkReady);
          try { window.ReactNativeWebView.postMessage(JSON.stringify({type: 'ready'})); } catch(e) {}
          console.log('[GGB] Applet ready after', checkCount, 'checks. Canvas:', canvas.width, 'x', canvas.height);
          
          // 诊断：打印实际 DOM 类名
          var frame = document.querySelector('.GeoGebraFrame');
          if (frame) {
            console.log('[GGB] Frame found, children:', frame.children.length);
            Array.from(frame.children).forEach(function(child, i) {
              console.log('[GGB] Child', i, ':', child.tagName, child.className && child.className.substring(0, 60));
            });
          }
        } else if (checkCount % 10 === 0) {
          console.log('[GGB] Still waiting, check #' + checkCount + ', ggb=' + !!ggb + ', canvas=' + !!canvas);
        }

        if (checkCount > 240) {
          clearInterval(checkReady);
          console.error('[GGB] Timeout waiting for applet');
          var msg = document.getElementById('loading-msg');
          if (msg) msg.innerText = '加载超时 (无canvas)';
        }
      }, 500);
    }

    // 启动
    setTimeout(waitForContainer, 100);
  </script>
</body>
</html>
`;

// GeoGebra 画板组件
function GeoGebraPanel({
  webViewRef,
  injectScript,
}: {
  webViewRef: React.RefObject<any>;
  injectScript?: string;
}) {
  const [isAppletReady, setIsAppletReady] = useState(false);

  // 处理来自 WebView 的消息
  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "ready") {
        setIsAppletReady(true);
        console.log("[GGB] GeoGebra applet ready on mobile");
      } else if (data.type === "log") {
        console.log("[GGB WebView]", data.message);
      } else if (data.type === "error") {
        console.error("[GGB WebView Error]", data.message);
      }
    } catch (e) {
      console.log("[GGB] WebView message:", event.nativeEvent.data);
    }
  }, []);

  // 处理 WebView 加载事件
  const handleLoadStart = useCallback(() => {
    console.log("[GGB] WebView load start");
  }, []);

  const handleLoadEnd = useCallback(() => {
    console.log("[GGB] WebView load end");
  }, []);

  const handleLoadError = useCallback((event: any) => {
    console.error("[GGB] WebView error:", event.nativeEvent);
  }, []);

  const handleHttpError = useCallback((event: any) => {
    console.error("[GGB] WebView HTTP error:", event.nativeEvent);
  }, []);

  // 处理注入脚本 - 提取并执行命令
  useEffect(() => {
    if (!injectScript || !webViewRef.current) return;

    // 从脚本中提取命令
    const commandMatch = injectScript.match(/ggbApplet\.evalCommand\("(.+?)"\)/);
    if (commandMatch && commandMatch[1]) {
      const command = commandMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      const jsCode = `
        (function() {
          try {
            var cmd = "${command.replace(/"/g, '\\"')}";
            if (window.ggbApplet && window.ggbApplet.evalCommand) {
              window.ggbApplet.evalCommand(cmd);
              window.ggbApplet.refreshViews();
            }
            return true;
          } catch(e) {
            console.error(e);
            return false;
          }
        })()
      `;
      webViewRef.current.injectJavaScript(jsCode);
    }
  }, [injectScript, webViewRef]);

  return (
    <View style={styles.geogebraContainer}>
      <View style={styles.geogebraHeader}>
        <Ionicons name="shapes" size={24} color="#34C759" />
        <Text style={styles.geogebraTitle}>GeoGebra 画板</Text>
      </View>
      {Platform.OS === "web" ? (
        <GeoGebraWebView injectScript={injectScript} />
      ) : (
        WebView && (
          <View style={styles.webviewWrapper}>
            {!isAppletReady && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>加载 GeoGebra...</Text>
              </View>
            )}
            <WebView
              ref={webViewRef}
              source={{ html: GEOGEBRA_HTML, baseUrl: 'https://www.geogebra.org' }}
              style={styles.webview}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              onMessage={handleMessage}
              onLoadStart={handleLoadStart}
              onLoad={handleLoadEnd}
              onError={handleLoadError}
              onHttpError={handleHttpError}
              originWhitelist={['*']}
              mixedContentMode="always"
              allowFileAccess={true}
              allowUniversalAccessFromFileURLs={true}
              androidLayerType="hardware"
              setSupportMultipleWindows={false}
              thirdPartyCookiesEnabled={true}
              cacheEnabled={true}
              javaScriptCanOpenWindowsAutomatically={true}
            />
          </View>
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
  
  // 管理要注入 GeoGebra 的脚本
  const [injectScript, setInjectScript] = useState<string | undefined>(undefined);

  // 处理命令执行
  const handleExecuteCommand = useCallback((script: string) => {
    setInjectScript(script);
  }, []);

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
              <AIChatPanel 
                webViewRef={webViewRef} 
                onExecuteCommand={handleExecuteCommand}
              />
            </View>
            <View style={[styles.rightPanel, { width: width * 0.65 }]}>
              <GeoGebraPanel 
                webViewRef={webViewRef} 
                injectScript={injectScript}
              />
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
            <GeoGebraPanel 
              webViewRef={webViewRef} 
              injectScript={injectScript}
            />
          </View>
          <View style={styles.bottomPanel}>
            <AIChatPanel 
              webViewRef={webViewRef}
              onExecuteCommand={handleExecuteCommand}
            />
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
  webviewWrapper: {
    flex: 1,
    position: "relative",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
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
