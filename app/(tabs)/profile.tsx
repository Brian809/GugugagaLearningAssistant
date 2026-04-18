import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import SettingsSection from "../../components/SettingsSection";

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        {/* 用户信息部分 */}
        <View style={styles.userSection}>
          <View style={styles.userHeader}>
            <View style={styles.avatar}>
              <Ionicons name="person-circle" size={80} color="#007AFF" />
            </View>
            <Text style={styles.userName}>用户</Text>
            <Text style={styles.userEmail}>user@example.com</Text>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>学习课程</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>学习时长</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>成就</Text>
            </View>
          </View>
        </View>

        {/* 功能菜单部分 */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>功能</Text>
          <View style={styles.menuList}>
            <View style={styles.menuItem}>
              <Ionicons name="notifications-outline" size={24} color="#333" />
              <Text style={styles.menuText}>通知设置</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
            <View style={styles.menuItem}>
              <Ionicons name="language-outline" size={24} color="#333" />
              <Text style={styles.menuText}>语言设置</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
            <View style={styles.menuItem}>
              <Ionicons name="moon-outline" size={24} color="#333" />
              <Text style={styles.menuText}>夜间模式</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
            <View style={styles.menuItem}>
              <Ionicons name="help-circle-outline" size={24} color="#333" />
              <Text style={styles.menuText}>帮助与反馈</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </View>
        </View>

        {/* LLM提供商设置部分 */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>LLM提供商设置</Text>
          <Text style={styles.sectionSubtitle}>
            管理您的API提供商，只能有一个活跃提供商
          </Text>
          <SettingsSection />
        </View>

        {/* 关于部分 */}
        <View style={styles.aboutSection}>
          <Text style={styles.sectionTitle}>关于</Text>
          <Text style={styles.aboutText}>咕咕嘎嘎学习助手 v1.0.0</Text>
          <Text style={styles.aboutText}>
            智能学习助手，帮助您更好地学习和成长
          </Text>
          <Text style={styles.copyright}>© 2024 咕咕嘎嘎学习助手</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  container: {
    flex: 1,
  },
  userSection: {
    backgroundColor: "#fff",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5ea",
  },
  userHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatar: {
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: "#666",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
  },
  menuSection: {
    backgroundColor: "#fff",
    marginTop: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  menuList: {
    gap: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    marginLeft: 12,
  },
  settingsSection: {
    backgroundColor: "#fff",
    marginTop: 16,
    padding: 20,
  },
  aboutSection: {
    backgroundColor: "#fff",
    marginTop: 16,
    marginBottom: 32,
    padding: 20,
    alignItems: "center",
  },
  aboutText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    textAlign: "center",
  },
  copyright: {
    fontSize: 12,
    color: "#999",
    marginTop: 16,
  },
});
