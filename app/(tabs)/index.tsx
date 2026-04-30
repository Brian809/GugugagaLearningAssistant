import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  return (
    <SafeAreaView>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
});
