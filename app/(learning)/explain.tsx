import React, { useState } from "react";
import { StyleSheet, View, TouchableOpacity, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import ChatPanel from "../../components/ChatPanel";
import ConversationList from "../../components/ConversationList";
import {
  useActiveLLMProvider,
  useLLMProvidersLoading,
} from "../../stores/llmProviderStore";
import { useConversationStore } from "../../stores/conversationStore";
import { ActivityIndicator } from "react-native";

export default function ExplainPage() {
  const provider = useActiveLLMProvider();
  const isLoadingProviders = useLLMProvidersLoading();
  const createConversation = useConversationStore((s) => s.createConversation);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationListVisible, setConversationListVisible] = useState(false);

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

  return (
    <SafeAreaView style={styles.container}>
      {/* 对话历史按钮 */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.historyBtn}
          activeOpacity={0.7}
          onPress={() => setConversationListVisible(true)}
        >
          <Ionicons name="time-outline" size={22} color="#007AFF" />
          <Text style={styles.historyBtnText}>对话历史</Text>
        </TouchableOpacity>
      </View>

      <ChatPanel
        mode="explain"
        provider={provider}
        conversationId={conversationId}
        onConversationChange={(id) => setConversationId(id)}
      />

      <ConversationList
        visible={conversationListVisible}
        onClose={() => setConversationListVisible(false)}
        type="explain"
        onSelect={(id) => setConversationId(id)}
        onCreateNew={async () => {
          const id = await createConversation("explain", "新对话");
          setConversationId(id);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
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
  headerBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5ea",
  },
  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 6,
  },
  historyBtnText: {
    fontSize: 14,
    color: "#007AFF",
  },
});
