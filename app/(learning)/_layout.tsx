import { Stack } from "expo-router";

export default function LearningLayout() {
  return (
    <Stack>
      <Stack.Screen name="solve" options={{ headerShown: false }} />
      <Stack.Screen name="explain" options={{ title: "讲题" }} />
      <Stack.Screen name="notebook" options={{ title: "错题本" }} />
    </Stack>
  );
}
