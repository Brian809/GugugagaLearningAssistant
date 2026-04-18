import React, { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useSettingsStore } from "../../stores/settingsStore";
import { Setting } from "../../utils/settings";

export default function TestStoreScreen() {
  const { settings, activeSetting, isLoading, error } = useSettingsStore();
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const addSetting = useSettingsStore((state) => state.addSetting);
  const updateSetting = useSettingsStore((state) => state.updateSetting);
  const removeSetting = useSettingsStore((state) => state.removeSetting);
  const setActiveSetting = useSettingsStore((state) => state.setActiveSetting);
  const clearSettings = useSettingsStore((state) => state.clearSettings);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleAddTestSetting = async () => {
    const testSetting: Setting = {
      apiKey: "test-api-key-" + Date.now(),
      baseUrl: "https://api.example.com",
      providerName: "Test Provider",
      providerType: "openAiCompatible",
      isActive: false,
    };

    try {
      await addSetting(testSetting);
      Alert.alert("成功", "测试设置已添加");
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "添加失败");
    }
  };

  const handleUpdateFirstSetting = async () => {
    if (settings.length === 0) {
      Alert.alert("提示", "没有设置可更新");
      return;
    }

    try {
      await updateSetting(0, { providerName: "Updated Provider " + Date.now() });
      Alert.alert("成功", "第一个设置已更新");
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "更新失败");
    }
  };

  const handleRemoveFirstSetting = async () => {
    if (settings.length === 0) {
      Alert.alert("提示", "没有设置可删除");
      return;
    }

    try {
      await removeSetting(0);
      Alert.alert("成功", "第一个设置已删除");
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "删除失败");
    }
  };

  const handleSetFirstActive = async () => {
    if (settings.length === 0) {
      Alert.alert("提示", "没有设置可激活");
      return;
    }

    try {
      await setActiveSetting(0);
      Alert.alert("成功", "第一个设置已设为活跃");
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "激活失败");
    }
  };

  const handleClearAll = async () => {
    try {
      await clearSettings();
      Alert.alert("成功", "所有设置已清除");
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "清除失败");
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.title}>Zustand Store 测试页面</Text>
        <Text style={styles.subtitle}>验证设置存储功能</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>状态信息</Text>
        <Text>加载中: {isLoading ? "是" : "否"}</Text>
        <Text>错误: {error || "无"}</Text>
        <Text>活跃设置: {activeSetting ? activeSetting.providerName : "无"}</Text>
        <Text>设置数量: {settings.length}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions 测试</Text>
        <TouchableOpacity style={styles.button} onPress={loadSettings}>
          <Text style={styles.buttonText}>重新加载设置</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleAddTestSetting}>
          <Text style={styles.buttonText}>添加测试设置</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleUpdateFirstSetting}>
          <Text style={styles.buttonText}>更新第一个设置</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleRemoveFirstSetting}>
          <Text style={styles.buttonText}>删除第一个设置</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleSetFirstActive}>
          <Text style={styles.buttonText}>将第一个设为活跃</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.clearButton]} onPress={handleClearAll}>
          <Text style={[styles.buttonText, styles.clearButtonText]}>清除所有设置</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>当前设置列表</Text>
        {settings.length === 0 ? (
          <Text style={styles.emptyText}>暂无设置</Text>
        ) : (
          settings.map((setting, index) => (
            <View key={index} style={styles.settingItem}>
              <Text style={styles.settingName}>
                {index + 1}. {setting.providerName} {setting.isActive ? "(活跃)" : ""}
              </Text>
              <Text>类型: {setting.providerType}</Text>
              <Text>API地址: {setting.baseUrl}</Text>
              <Text>API密钥: {setting.apiKey ? "已设置" : "未设置"}</Text>
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
  settingItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 8,
  },
  settingName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
    padding: 20,
  },
});
