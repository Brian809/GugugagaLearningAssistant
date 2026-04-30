import * as SQLite from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import migrations from "../drizzle/migrations";

const expoDb = SQLite.openDatabaseSync("learning.db");
export const db = drizzle(expoDb);
export { useMigrations };
