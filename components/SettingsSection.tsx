import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Switch,
} from "react-native";
import { useLLMProviderStore } from "../stores/llmProviderStore";
import { LLMProvider } from "../utils/llmProviders";
import { Ionicons } from "@expo/vector-icons";

export default function SettingsSection() {
  const { providers, activeProvider } = useLLMProviderStore();
  const loadProviders = useLLMProviderStore((state) => state.loadProviders);
  const addProvider = useLLMProviderStore((state) => state.addProvider);
  const updateProvider = useLLMProviderStore((state) => state.updateProvider);
  const removeProvider = useLLMProviderStore((state) => state.removeProvider);
  const setActiveProvider = useLLMProviderStore((state) => state.setActiveProvider);
  const clearProviders = useLLMProviderStore((state) => state.clearProviders);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<LLMProvider>>({
    apiKey: "",
    baseUrl: "",
    providerName: "",
    providerType: "openAiCompatible",
    isActive: false,
  });

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const handleSaveProvider = async () => {
    try {
      if (editingIndex !== null) {
        // 更新现有供应商
        await updateProvider(editingIndex, formData as LLMProvider);
      } else {
        // 添加新供应商
        await addProvider(formData as LLMProvider);
      }
      setModalVisible(false);
      resetForm();
    } catch {
      Alert.alert("错误", "保存供应商失败");
    }
  };

  const handleEditProvider = (index: number) => {
    const provider = providers[index];
    setFormData({ ...provider });
    setEditingIndex(index);
    setModalVisible(true);
  };

  const handleDeleteProvider = (index: number) => {
    Alert.alert("删除供应商", "确定要删除这个供应商吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await removeProvider(index);
          } catch {
            Alert.alert("错误", "删除供应商失败");
          }
        },
      },
    ]);
  };

  const handleSetActive = async (index: number) => {
    try {
      await setActiveProvider(index);
    } catch {
      Alert.alert("错误", "设置活跃失败");
    }
  };

  const resetForm = () => {
    setFormData({
      apiKey: "",
      baseUrl: "",
      providerName: "",
      providerType: "openAiCompatible",
      isActive: false,
    });
    setEditingIndex(null);
  };

  const handleAddNew = () => {
    resetForm();
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>LLM提供商设置</Text>
          <Text style={styles.subtitle}>
            管理您的API提供商设置，只能有一个活跃提供商。
          </Text>
        </View>

        {activeProvider && (
          <View style={styles.activeCard}>
            <View style={styles.activeHeader}>
              <Ionicons name="star" size={24} color="#FFD700" />
              <Text style={styles.activeTitle}>当前活跃提供商</Text>
            </View>
            <Text style={styles.activeName}>{activeProvider.providerName}</Text>
            <Text style={styles.activeType}>
              类型: {activeProvider.providerType}
            </Text>
            <Text style={styles.activeUrl} numberOfLines={1}>
              地址: {activeProvider.baseUrl}
            </Text>
          </View>
        )}

        <View style={styles.providersList}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>所有提供商</Text>
            <TouchableOpacity style={styles.addButton} onPress={handleAddNew}>
              <Ionicons name="add" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>

          {providers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="settings-outline" size={48} color="#CCCCCC" />
              <Text style={styles.emptyText}>暂无供应商</Text>
              <Text style={styles.emptySubtext}>
                点击右上角添加按钮创建新供应商
              </Text>
            </View>
          ) : (
            providers.map((provider, index) => (
              <View key={index} style={styles.providerCard}>
                <View style={styles.providerHeader}>
                  <View style={styles.providerInfo}>
                    <Text style={styles.providerName}>
                      {provider.providerName}
                    </Text>
                    <Text style={styles.providerType}>
                      {provider.providerType}
                    </Text>
                  </View>
                  <View style={styles.providerActions}>
                    {provider.isActive ? (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>活跃</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.activateButton}
                        onPress={() => handleSetActive(index)}
                      >
                        <Text style={styles.activateButtonText}>设为活跃</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View style={styles.providerDetails}>
                  <Text style={styles.providerDetail} numberOfLines={1}>
                    <Text style={styles.detailLabel}>API地址: </Text>
                    {provider.baseUrl}
                  </Text>
                  <Text style={styles.providerDetail} numberOfLines={1}>
                    <Text style={styles.detailLabel}>API密钥: </Text>
                    {provider.apiKey ? "••••••••" : "未设置"}
                  </Text>
                </View>

                <View style={styles.providerFooter}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEditProvider(index)}
                  >
                    <Ionicons name="pencil" size={20} color="#007AFF" />
                    <Text style={styles.actionButtonText}>编辑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteProvider(index)}
                  >
                    <Ionicons name="trash" size={20} color="#FF3B30" />
                    <Text
                      style={[styles.actionButtonText, { color: "#FF3B30" }]}
                    >
                      删除
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {providers.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => clearProviders()}
          >
            <Text style={styles.clearButtonText}>清除所有供应商</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* 添加/编辑供应商模态框 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingIndex !== null ? "编辑供应商" : "添加新供应商"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>提供商名称</Text>
                <TextInput
                  style={styles.input}
                  value={formData.providerName}
                  onChangeText={(text) =>
                    setFormData({ ...formData, providerName: text })
                  }
                  placeholder="例如: OpenAI"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>提供商类型</Text>
                <View style={styles.radioGroup}>
                  {[
                    "openAiCompatible",
                    "anthropicCompatible",
                    "googleCompatible",
                  ].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={styles.radioOption}
                      onPress={() =>
                        setFormData({ ...formData, providerType: type as any })
                      }
                    >
                      <View style={styles.radioCircle}>
                        {formData.providerType === type && (
                          <View style={styles.radioInnerCircle} />
                        )}
                      </View>
                      <Text style={styles.radioLabel}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>API地址</Text>
                <TextInput
                  style={styles.input}
                  value={formData.baseUrl}
                  onChangeText={(text) =>
                    setFormData({ ...formData, baseUrl: text })
                  }
                  placeholder="例如: https://api.openai.com/v1"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoCorrect={false}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>API密钥</Text>
                <TextInput
                  style={styles.input}
                  value={formData.apiKey}
                  onChangeText={(text) =>
                    setFormData({ ...formData, apiKey: text })
                  }
                  placeholder="输入您的API密钥"
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>设为活跃提供商</Text>
                  <Switch
                    value={formData.isActive}
                    onValueChange={(value) =>
                      setFormData({ ...formData, isActive: value })
                    }
                  />
                </View>
                <Text style={styles.helperText}>
                  注意：如果启用，将自动禁用其他所有提供商
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveProvider}
              >
                <Text style={styles.saveButtonText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5ea",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
  activeCard: {
    margin: 20,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  activeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  activeTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginLeft: 8,
  },
  activeName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  activeType: {
    fontSize: 16,
    color: "#666",
    marginBottom: 4,
  },
  activeUrl: {
    fontSize: 14,
    color: "#999",
  },
  providersList: {
    margin: 20,
    marginTop: 0,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
  },
  addButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#999",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#ccc",
    textAlign: "center",
  },
  providerCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  providerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  providerType: {
    fontSize: 14,
    color: "#666",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  providerActions: {
    marginLeft: 12,
  },
  activeBadge: {
    backgroundColor: "#34C759",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  activeBadgeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  activateButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  activateButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  providerDetails: {
    marginBottom: 12,
  },
  providerDetail: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  detailLabel: {
    fontWeight: "500",
    color: "#333",
  },
  providerFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 20,
  },
  actionButtonText: {
    fontSize: 14,
    color: "#007AFF",
    marginLeft: 4,
  },
  clearButton: {
    margin: 20,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FF3B30",
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF3B30",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5ea",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
  },
  form: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  radioGroup: {
    flexDirection: "column",
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  radioInnerCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#007AFF",
  },
  radioLabel: {
    fontSize: 16,
    color: "#333",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  helperText: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
  },
  modalFooter: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#e5e5ea",
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    marginRight: 12,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  saveButton: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    marginLeft: 12,
    borderRadius: 8,
    backgroundColor: "#007AFF",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
