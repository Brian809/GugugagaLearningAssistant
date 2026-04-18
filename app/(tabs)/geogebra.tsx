import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function GeoGebraScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>GeoGebra 画板</Text>
      <Text style={styles.description}>
        这里是GeoGebra画板，未来可以嵌入GeoGebra交互式数学工具。
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
