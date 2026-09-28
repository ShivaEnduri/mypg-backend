import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/* ===============================
   📂 Fix __dirname in ESM
=============================== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ===============================
   📦 Load Config
=============================== */
const projectConfig = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "./mypgtable.json"),
    "utf8"
  )
);

/* ===============================
   📦 Project Aliases
=============================== */
const PROJECT_MAP = {
  pg: "pgdb",
  mypg: "pgdb"
};

/* ===============================
   🎯 Table Resolver
=============================== */
export default function getTableName(project, alias) {
  const projectKey = PROJECT_MAP[project] || project;

  // Support both JSON formats
  let table =
    projectConfig?.[projectKey]?.tables?.[alias]?.tableName || // nested format
    projectConfig?.[projectKey]?.[alias]?.tableName ||         // flat format
    projectConfig?.shared?.tables?.[alias]?.tableName ||
    projectConfig?.shared?.[alias]?.tableName;

  if (!table) {
    console.error("❌ Table Resolver Error");
    console.error("Project :", project);
    console.error("Project Key :", projectKey);
    console.error("Alias :", alias);
    console.error(
      "Available Aliases :",
      Object.keys(projectConfig?.[projectKey] || {})
    );

    throw new Error(
      `Alias '${alias}' not found for project '${project}'`
    );
  }

  return table;
}