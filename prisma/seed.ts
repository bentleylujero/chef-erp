import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { proteins } from "./seeds/ingredients/proteins";
import { produce } from "./seeds/ingredients/produce";
import { dairy } from "./seeds/ingredients/dairy";
import { spices } from "./seeds/ingredients/spices";
import { herbs } from "./seeds/ingredients/herbs";
import { pantryStaples } from "./seeds/ingredients/pantry-staples";
import { condimentsSauces } from "./seeds/ingredients/condiments-sauces";
import { grainsLegumes } from "./seeds/ingredients/grains-legumes";
import { nutsSeeds } from "./seeds/ingredients/nuts-seeds";
import { INGREDIENT_ALIAS_GROUPS } from "./seeds/ingredient-aliases";
import { normalizeIngredientQuery } from "../src/lib/engines/ingredient-normalize";
import { seedRecipes } from "./seeds/recipes";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding ingredients...\n");

  const allIngredients = [
    ...proteins,
    ...produce,
    ...dairy,
    ...spices,
    ...herbs,
    ...pantryStaples,
    ...condimentsSauces,
    ...grainsLegumes,
    ...nutsSeeds,
  ];

  console.log(`Total ingredients to seed: ${allIngredients.length}\n`);

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < allIngredients.length; i++) {
    const ingredient = allIngredients[i];
    if (i % 50 === 0) console.log(`  Processing ingredient ${i + 1}/${allIngredients.length}...`);
    try {
      await prisma.ingredient.upsert({
        where: { name: ingredient.name },
        update: {
          category: ingredient.category as any,
          defaultUnit: ingredient.defaultUnit,
          shelfLifeDays: ingredient.shelfLifeDays,
          storageType: ingredient.storageType as any,
          avgPricePerUnit: ingredient.avgPricePerUnit,
          cuisineTags: ingredient.cuisineTags as any[],
          flavorTags: ingredient.flavorTags,
          description: ingredient.description,
          catalogTier: "SYSTEM",
        },
        create: {
          name: ingredient.name,
          category: ingredient.category as any,
          defaultUnit: ingredient.defaultUnit,
          shelfLifeDays: ingredient.shelfLifeDays ?? undefined,
          storageType: (ingredient.storageType as any) ?? "PANTRY",
          avgPricePerUnit: ingredient.avgPricePerUnit ?? undefined,
          cuisineTags: ingredient.cuisineTags as any[],
          flavorTags: ingredient.flavorTags ?? {},
          description: ingredient.description ?? undefined,
          catalogTier: "SYSTEM",
        },
      });
      created++;
    } catch (error: any) {
      if (error.code === "P2002") {
        skipped++;
      } else {
        console.error(`  Failed: ${ingredient.name} - ${error.message}`);
      }
    }
  }

  console.log(`\n✅ Seeded ${created} ingredients (${skipped} duplicates skipped)`);

  console.log("\n🌱 Seeding ingredient aliases...\n");
  let aliasCount = 0;
  for (const group of INGREDIENT_ALIAS_GROUPS) {
    const ing = await prisma.ingredient.findUnique({
      where: { name: group.canonicalName },
    });
    if (!ing) {
      console.warn(`  Skip aliases — missing ingredient: ${group.canonicalName}`);
      continue;
    }
    for (const alias of group.aliases) {
      const aliasNormalized = normalizeIngredientQuery(alias);
      if (!aliasNormalized) continue;
      try {
        await prisma.ingredientAlias.upsert({
          where: { aliasNormalized },
          create: {
            ingredientId: ing.id,
            aliasNormalized,
            displayAlias: alias,
            source: "SEED",
          },
          update: {
            ingredientId: ing.id,
            displayAlias: alias,
            source: "SEED",
          },
        });
        aliasCount++;
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err.code === "P2002") {
          console.warn(`  Alias conflict skipped: ${alias}`);
        } else {
          console.error(`  Alias failed: ${alias}`, e);
        }
      }
    }
  }
  console.log(`\n✅ Upserted ${aliasCount} ingredient aliases`);

  // Seed recipes (must run after ingredients so name→id lookup works)
  await seedRecipes(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
