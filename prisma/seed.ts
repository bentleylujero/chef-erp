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

  for (const ingredient of allIngredients) {
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
