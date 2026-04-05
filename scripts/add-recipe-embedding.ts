/**
 * One-time migration: add pgvector embedding column to Recipe table.
 *
 * Run:  npx tsx scripts/add-recipe-embedding.ts
 *
 * Safe to re-run — every statement uses IF NOT EXISTS / IF EXISTS guards.
 */

import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    console.log("🔧 Enabling pgvector extension...");
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

    console.log("🔧 Adding embedding column to Recipe...");
    await client.query(`
      ALTER TABLE "Recipe"
      ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
    `);

    // IVFFlat index — drop + recreate to handle dimension changes
    console.log("🔧 Creating vector similarity index...");
    await client.query(`DROP INDEX IF EXISTS "Recipe_embedding_idx";`);
    await client.query(`
      CREATE INDEX "Recipe_embedding_idx"
      ON "Recipe" USING ivfflat ("embedding" vector_cosine_ops)
      WITH (lists = 10);
    `);

    console.log("✅ pgvector migration complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
