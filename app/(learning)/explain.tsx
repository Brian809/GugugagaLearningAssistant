import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ChatPanel from "../../components/ChatPanel";
import {
  useActiveLLMProvider,
  useLLMProvidersLoading,
} from "../../stores/llmProviderStore";
import { ActivityIndicator, View, Text } from "react-native";

export default function ExplainPage() {
  const provider = useActiveLLMProvider();
  const isLoadingProviders = useLLMProvidersLoading();

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
      <ChatPanel mode="explain" provider={provider} />
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
});
