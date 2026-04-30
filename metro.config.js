const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const config = getDefaultConfig(__dirname);

// Support .sql files for Drizzle ORM migrations
config.resolver.sourceExts.push("sql");

// Mock wa-sqlite WASM on web — not needed (localStorage used instead)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName.endsWith(".wasm")) {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "src/mocks/wa-sqlite-wasm.js"),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
