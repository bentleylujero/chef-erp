/**
 * Embed all unembedded recipes in the database.
 *
 * Run:  npx tsx scripts/embed-recipes.ts
 *
 * Prerequisites:
 *  1. pgvector extension enabled (run scripts/add-recipe-embedding.ts first)
 *  2. OPENAI_API_KEY set in .env
 *  3. Recipes seeded (npx prisma db seed)
 */

import "dotenv/config";

// Force module resolution so @/ alias works from the scripts directory
import { register } from "tsconfig-paths";
import { readFileSync } from "fs";
import { resolve } from "path";

const tsconfig = JSON.parse(
  readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"),
);
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions?.paths ?? { "@/*": ["./src/*"] },
});

async function main() {
  // Dynamic import after path registration
  const { embedAllUnembeddedRecipes } = await import(
    "../src/lib/ai/embedding-service"
  );

  console.log("🔍 Finding unembedded recipes...");
  const count = await embedAllUnembeddedRecipes();
  console.log(`✅ Embedded ${count} recipes.`);
}

main().catch((e) => {
  console.error("❌ Embedding failed:", e);
  process.exit(1);
});
