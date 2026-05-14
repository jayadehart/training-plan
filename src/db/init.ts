import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "../../data");
mkdirSync(dataDir, { recursive: true });

const db = getDb();
const dbPath = process.env.DB_PATH ?? resolve(dataDir, "state.db");
console.log(`Initialized database at ${dbPath}`);
db.close();
