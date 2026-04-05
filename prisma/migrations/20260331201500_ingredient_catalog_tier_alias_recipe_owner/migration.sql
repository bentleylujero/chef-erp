-- CreateEnum
CREATE TYPE "IngredientCatalogTier" AS ENUM ('SYSTEM', 'USER_AD_HOC');

-- CreateEnum
CREATE TYPE "IngredientAliasSource" AS ENUM ('SEED', 'LEARNED', 'ADMIN');

-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN "catalogTier" "IngredientCatalogTier" NOT NULL DEFAULT 'USER_AD_HOC';

-- CreateTable
CREATE TABLE "IngredientAlias" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "aliasNormalized" TEXT NOT NULL,
    "displayAlias" TEXT,
    "locale" TEXT,
    "source" "IngredientAliasSource" NOT NULL DEFAULT 'SEED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngredientAlias_aliasNormalized_key" ON "IngredientAlias"("aliasNormalized");

-- CreateIndex
CREATE INDEX "IngredientAlias_ingredientId_idx" ON "IngredientAlias"("ingredientId");

-- AddForeignKey
ALTER TABLE "IngredientAlias" ADD CONSTRAINT "IngredientAlias_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN "ownerUserId" TEXT;

-- CreateIndex
CREATE INDEX "Recipe_ownerUserId_idx" ON "Recipe"("ownerUserId");

-- CreateIndex
CREATE INDEX "Ingredient_catalogTier_idx" ON "Ingredient"("catalogTier");

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill recipe owner from generation job when possible
UPDATE "Recipe" AS r
SET "ownerUserId" = gj."userId"
FROM "GenerationJob" AS gj
WHERE r."generationJobId" = gj."id"
  AND r."ownerUserId" IS NULL;
