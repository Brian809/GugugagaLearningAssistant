import React, { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useLLMProviderStore } from "../../stores/llmProviderStore";
import { LLMProvider } from "../../utils/llmProviders";

export default function TestStoreScreen() {
  const { providers, activeProvider, isLoading, error } = useLLMProviderStore();
  const loadProviders = useLLMProviderStore((state) => state.loadProviders);
  const addProvider = useLLMProviderStore((state) => state.addProvider);
  const updateProvider = useLLMProviderStore((state) => state.updateProvider);
  const removeProvider = useLLMProviderStore((state) => state.removeProvider);
  const setActiveProvider = useLLMProviderStore((state) => state.setActiveProvider);
  const clearProviders = useLLMProviderStore((state) => state.clearProviders);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const handleAddTestProvider = async () => {
    const testProvider: LLMProvider = {
      apiKey: "test-api-key-" + Date.now(),
      baseUrl: "https://api.example.com",
      providerName: "Test Provider",
      providerType: "openAiCompatible",
      isActive: false,
    };

    try {
      await addProvider(testProvider);
      Alert.alert("成功", "测试供应商已添加");
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "添加失败");
    }
  };

  const handleUpdateFirstProvider = async () => {
    if (providers.length === 0) {
      Alert.alert("提示", "没有供应商可更新");
      return;
    }

    try {
      await updateProvider(0, { providerName: "Updated Provider " + Date.now() });
      Alert.alert("成功", "第一个供应商已更新");
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "更新失败");
    }
  };

  const handleRemoveFirstProvider = async () => {
    if (providers.length === 0) {
      Alert.alert("提示", "没有供应商可删除");
      return;
    }

    try {
      await removeProvider(0);
      Alert.alert("成功", "第一个供应商已删除");
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "删除失败");
    }
  };

  const handleSetFirstActive = async () => {
    if (providers.length === 0) {
      Alert.alert("提示", "没有供应商可激活");
      return;
    }

    try {
      await setActiveProvider(0);
      Alert.alert("成功", "第一个供应商已设为活跃");
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "激活失败");
    }
  };

  const handleClearAll = async () => {
    try {
      await clearProviders();
      Alert.alert("成功", "所有供应商已清除");
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "清除失败");
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.title}>LLM Provider Store 测试页面</Text>
        <Text style={styles.subtitle}>验证 LLM 供应商存储功能</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>状态信息</Text>
        <Text>加载中: {isLoading ? "是" : "否"}</Text>
        <Text>错误: {error || "无"}</Text>
        <Text>活跃供应商: {activeProvider ? activeProvider.providerName : "无"}</Text>
        <Text>供应商数量: {providers.length}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions 测试</Text>
        <TouchableOpacity style={styles.button} onPress={loadProviders}>
          <Text style={styles.buttonText}>重新加载供应商</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleAddTestProvider}>
          <Text style={styles.buttonText}>添加测试供应商</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleUpdateFirstProvider}>
          <Text style={styles.buttonText}>更新第一个供应商</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleRemoveFirstProvider}>
          <Text style={styles.buttonText}>删除第一个供应商</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleSetFirstActive}>
          <Text style={styles.buttonText}>将第一个设为活跃</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.clearButton]} onPress={handleClearAll}>
          <Text style={[styles.buttonText, styles.clearButtonText]}>清除所有供应商</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>当前供应商列表</Text>
        {providers.length === 0 ? (
          <Text style={styles.emptyText}>暂无供应商</Text>
        ) : (
          providers.map((provider, index) => (
            <View key={index} style={styles.providerItem}>
              <Text style={styles.providerName}>
                {index + 1}. {provider.providerName} {provider.isActive ? "(活跃)" : ""}
              </Text>
              <Text>类型: {provider.providerType}</Text>
              <Text>API地址: {provider.baseUrl}</Text>
              <Text>API密钥: {provider.apiKey ? "已设置" : "未设置"}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  clearButton: {
    backgroundColor: "#FF3B30",
  },
  clearButtonText: {
    color: "#fff",
  },
  providerItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5ea",
  },
  providerName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  emptyText: {
    color: "#999",
    fontStyle: "italic",
  },
});
