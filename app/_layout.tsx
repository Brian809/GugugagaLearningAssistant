import "../polyfills";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";

// ── Font asset URI ──────────────────────────────────────────────
// Metro resolves .ttf imports to a URI string on web; SSR may give
// an asset object. Normalize to a plain string for CSS url().
const fontAsset = require("../assets/fonts/Ionicons.ttf");
const fontUri: string =
  typeof fontAsset === "string"
    ? fontAsset
    : fontAsset?.uri ?? fontAsset?.default ?? String(fontAsset ?? "");

// ── Client: kick off Font.loadAsync so ExpoFontLoader injects @font-face ──
Ionicons.loadFont();

// ── SSR: bypass silent-failing registerStaticFont ────────────────
// The .ttf asset doesn't resolve to {uri: string} in Node.js, so
// Ionicons.loadFont() → registerStaticFont → loadSingleFontAsync
// throws & is swallowed. We directly call ExpoFontLoader.loadAsync
// with a valid uri so serverContext gets populated and Font.isLoaded
// returns true during static rendering.
if (Platform.OS === "web" && typeof window === "undefined") {
  // Deep-require ExpoFontLoader — the raw object is the default
  // export during SSR (no registerWebModule wrapper).
  const ExpoFontLoader = require("expo-font/build/ExpoFontLoader").default;
  ExpoFontLoader.loadAsync("ionicons", {
    uri: fontUri || "/app/assets/fonts/Ionicons.ttf",
    display: "auto",
  });
}

export default function AppLayout() {
  return (
    <>
      <Head>
        <style id="expo-generated-fonts">{`@font-face{font-family:"ionicons";src:url("${fontUri}") format("truetype");font-display:block}`}</style>
      </Head>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(learning)" />
      </Stack>
    </>
  );
}
