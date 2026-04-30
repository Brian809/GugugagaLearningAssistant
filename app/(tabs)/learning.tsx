import { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useNotebookRecords, useNotebookStore, useNotebookLoading } from "@/stores/notebookStore";

const FEATURES = [
  {
    icon: "bulb-outline" as const,
    title: "AI 解题",
    desc: "输入数学题目，AI 逐步展示解题过程",
    color: "#007AFF",
    route: "/(learning)/solve" as const,
  },
  {
    icon: "chatbubbles-outline" as const,
    title: "AI 讲题",
    desc: "与 AI 老师对话，深入理解数学概念",
    color: "#34C759",
    route: "/(learning)/explain" as const,
  },
  {
    icon: "book-outline" as const,
    title: "错题本",
    desc: "记录和管理错题，针对性复习提升",
    color: "#FF9500",
    route: "/(learning)/notebook" as const,
  },
] as const;

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function LearningScreen() {
  const router = useRouter();
  const records = useNotebookRecords();
  const loadRecords = useNotebookStore((s) => s.loadRecords);
  const isLoadingRecords = useNotebookLoading();
  const notebookError = useNotebookStore((s) => s.error);
  const recentRecords = records.slice(0, 3);

  useEffect(() => {
    loadRecords();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>学习中心</Text>
          <Text style={styles.subtitle}>AI 助力数学学习</Text>
        </View>

        {FEATURES.map((feature) => (
          <TouchableOpacity
            key={feature.route}
            style={styles.card}
            onPress={() => router.push(feature.route as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: feature.color }]}>
              <Ionicons name={feature.icon} size={24} color="#fff" />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{feature.title}</Text>
              <Text style={styles.cardDesc}>{feature.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {notebookError ? (
          <View style={styles.recentSection}>
            <Text style={styles.recentTitle}>最近错题</Text>
            <View style={styles.errorCard}>
              <Ionicons name="close-circle" size={20} color="#ff3b30" />
              <Text style={styles.errorText}>{notebookError}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                activeOpacity={0.7}
                onPress={() => loadRecords()}
              >
                <Ionicons name="refresh" size={16} color="#fff" />
                <Text style={styles.retryButtonText}>重试</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : isLoadingRecords ? (
          <View style={styles.recentSection}>
            <Text style={styles.recentTitle}>最近错题</Text>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          </View>
        ) : recentRecords.length > 0 ? (
          <View style={styles.recentSection}>
            <Text style={styles.recentTitle}>最近错题</Text>
            {recentRecords.map((record) => (
              <TouchableOpacity
                key={record.id}
                style={styles.recentCard}
                onPress={() => router.push("/(learning)/notebook" as any)}
                activeOpacity={0.7}
              >
                <View style={styles.recentCardRow}>
                  <Text style={styles.recentProblem} numberOfLines={1}>
                    {record.problemText}
                  </Text>
                  {record.createdAt && (
                    <Text style={styles.recentDate}>
                      {formatDate(record.createdAt)}
                    </Text>
                  )}
                </View>
                {record.subject && (
                  <View style={styles.subjectBadge}>
                    <Text style={styles.subjectText}>{record.subject}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#999",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  recentSection: {
    marginTop: 8,
  },
  recentTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  recentCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  recentCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recentProblem: {
    fontSize: 15,
    color: "#333",
    flex: 1,
    marginRight: 8,
  },
  recentDate: {
    fontSize: 12,
    color: "#999",
  },
  subjectBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F0F0F0",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 8,
  },
  subjectText: {
    fontSize: 12,
    color: "#666",
  },
  // 错误状态
  errorCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ffcdd2",
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  // 加载状态
  loadingCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: "#999",
  },
});
