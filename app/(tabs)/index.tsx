import { useEffect } from "react";
import { StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useNotebookStore, useNotebookRecords } from "@/stores/notebookStore";

export default function HomeScreen() {
  const router = useRouter();
  const records = useNotebookRecords();
  const loadRecords = useNotebookStore((s) => s.loadRecords);
  const isLoading = useNotebookStore((s) => s.isLoading);
  const error = useNotebookStore((s) => s.error);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const recentRecords = records.slice(0, 5);

  const renderItem = ({ item }: { item: (typeof records)[0] }) => (
    <TouchableOpacity
      style={styles.recordCard}
      activeOpacity={0.7}
      onPress={() => router.push("/(learning)/notebook" as any)}
    >
      <View style={styles.recordHeader}>
        <Text style={styles.recordSubject}>{item.subject ?? "未分类"}</Text>
        {item.isReviewed && (
          <View style={styles.reviewedBadge}>
            <Text style={styles.reviewedText}>已复习</Text>
          </View>
        )}
      </View>
      <Text style={styles.recordProblem} numberOfLines={2}>
        {item.problemText}
      </Text>
      <Text style={styles.recordDate}>
        {new Date(item.createdAt).toLocaleDateString("zh-CN")}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>欢迎来到咕咕嘎嘎学习助手</Text>
        <Text style={styles.description}>
          这是一个智能学习助手应用，帮助您更好地学习和成长。
        </Text>
        <View style={styles.featureContainer}>
          <View style={styles.featureCard}>
            <Text style={styles.featureTitle}>📚 学习资源</Text>
            <Text style={styles.featureText}>丰富的学习材料和教程</Text>
          </View>
          <View style={styles.featureCard}>
            <Text style={styles.featureTitle}>🎯 学习计划</Text>
            <Text style={styles.featureText}>个性化学习计划制定</Text>
          </View>
          <View style={styles.featureCard}>
            <Text style={styles.featureTitle}>📊 进度跟踪</Text>
            <Text style={styles.featureText}>实时跟踪学习进度</Text>
          </View>
        </View>

        {/* 最近错题 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>最近错题</Text>
          <TouchableOpacity onPress={() => router.push("/(learning)/notebook" as any)}>
            <Text style={styles.seeAll}>查看全部</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="close-circle" size={20} color="#ff3b30" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              activeOpacity={0.7}
              onPress={() => loadRecords()}
            >
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={styles.retryButtonText}>重试</Text>
            </TouchableOpacity>
          </View>
        ) : isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : recentRecords.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={40} color="#ccc" />
            <Text style={styles.emptyText}>暂无错题记录</Text>
            <TouchableOpacity
              style={styles.addButton}
              activeOpacity={0.7}
              onPress={() => router.push("/(learning)/notebook" as any)}
            >
              <Text style={styles.addButtonText}>+ 添加错题</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={recentRecords}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        )}
      </View>
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
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  description: {
    fontSize: 16,
    color: "#666",
    marginBottom: 30,
  },
  featureContainer: {
    gap: 15,
  },
  featureCard: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 5,
    color: "#333",
  },
  featureText: {
    fontSize: 14,
    color: "#666",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  seeAll: {
    fontSize: 14,
    color: "#007AFF",
  },
  recordCard: {
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
  recordHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  recordSubject: {
    fontSize: 12,
    color: "#007AFF",
    fontWeight: "500",
  },
  reviewedBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reviewedText: {
    fontSize: 11,
    color: "#2E7D32",
    fontWeight: "600",
  },
  recordProblem: {
    fontSize: 15,
    color: "#333",
    lineHeight: 22,
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 12,
    color: "#999",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    marginTop: 8,
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
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
