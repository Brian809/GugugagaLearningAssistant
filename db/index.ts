// Native-only: uses expo-sqlite + Drizzle ORM
// Web: handled directly in notebookStore (localStorage fallback)
import { Platform } from "react-native";
import { MistakeRecord, NewMistakeRecord } from "./schema";

export let db: any;
export let useMigrations: any;

// On web, db/index is not used — notebookStore handles storage directly
if (Platform.OS !== "web") {
  const SQLite = require("expo-sqlite");
  const { drizzle: drizzleInit } = require("drizzle-orm/expo-sqlite");
  const { useMigrations: useMigrationsInit } = require("drizzle-orm/expo-sqlite/migrator");
  const migrations = require("../drizzle/migrations").default;

  const expoDb = SQLite.openDatabaseSync("learning.db");
  db = drizzleInit(expoDb);
  useMigrations = () => useMigrationsInit(db, migrations);
} else {
  // Web: minimal placeholder — notebookStore handles web path
  db = {} as any;
  useMigrations = () => ({ success: true, error: null });
}

export type { MistakeRecord, NewMistakeRecord };
