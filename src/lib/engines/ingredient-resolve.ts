import Fuse from "fuse.js";
import type { IngredientCatalogTier, PrismaClient } from "@prisma/client";
import { normalizeIngredientQuery } from "@/lib/engines/ingredient-normalize";

export type ResolveVia = "exact_name" | "alias" | "fuzzy";

export type IngredientResolveMatch = {
  ingredientId: string;
  name: string;
  catalogTier: IngredientCatalogTier;
  via: ResolveVia;
  /** Lower is better (Fuse); 0 for exact/alias */
  score: number;
};

type FuseRow = {
  ingredientId: string;
  name: string;
  catalogTier: IngredientCatalogTier;
  searchLabel: string;
};

const FUSE_THRESHOLD = 0.34;
/** Max Fuse score (distance) to accept fuzzy match on write paths */
export const RESOLVE_FUZZY_MAX_SCORE = 0.38;

let fuseCache: {
  fuse: Fuse<FuseRow>;
  rows: FuseRow[];
} | null = null;

export function clearIngredientFuseCache() {
  fuseCache = null;
}

async function buildFuseRows(prisma: PrismaClient): Promise<FuseRow[]> {
  const [ingredients, aliases] = await Promise.all([
    prisma.ingredient.findMany({
      select: { id: true, name: true, catalogTier: true },
    }),
    prisma.ingredientAlias.findMany({
      include: {
        ingredient: { select: { id: true, name: true, catalogTier: true } },
      },
    }),
  ]);

  const rows: FuseRow[] = ingredients.map((i) => ({
    ingredientId: i.id,
    name: i.name,
    catalogTier: i.catalogTier,
    searchLabel: i.name,
  }));

  for (const a of aliases) {
    rows.push({
      ingredientId: a.ingredient.id,
      name: a.ingredient.name,
      catalogTier: a.ingredient.catalogTier,
      searchLabel: a.displayAlias ?? a.aliasNormalized,
    });
  }

  return rows;
}

async function getFuse(prisma: PrismaClient): Promise<Fuse<FuseRow>> {
  if (!fuseCache) {
    const rows = await buildFuseRows(prisma);
    fuseCache = {
      rows,
      fuse: new Fuse(rows, {
        keys: ["searchLabel"],
        threshold: FUSE_THRESHOLD,
        includeScore: true,
      }),
    };
  }
  return fuseCache.fuse;
}

/** Refresh in-process fuse index (call after ingredient/alias writes). */
export async function refreshIngredientFuseCache(prisma: PrismaClient) {
  const rows = await buildFuseRows(prisma);
  fuseCache = {
    rows,
    fuse: new Fuse(rows, {
      keys: ["searchLabel"],
      threshold: FUSE_THRESHOLD,
      includeScore: true,
    }),
  };
}

function tierRank(t: IngredientCatalogTier): number {
  return t === "SYSTEM" ? 0 : 1;
}

function sortMatches(a: IngredientResolveMatch, b: IngredientResolveMatch): number {
  const byTier = tierRank(a.catalogTier) - tierRank(b.catalogTier);
  if (byTier !== 0) return byTier;
  if (a.score !== b.score) return a.score - b.score;
  return a.name.localeCompare(b.name);
}

/**
 * Ranked suggestions for autocomplete (SYSTEM first, then fuzzy score).
 */
export async function suggestIngredients(
  prisma: PrismaClient,
  rawQuery: string,
  limit = 15,
): Promise<IngredientResolveMatch[]> {
  const q = normalizeIngredientQuery(rawQuery);
  if (q.length < 1) return [];

  const seen = new Set<string>();
  const out: IngredientResolveMatch[] = [];

  const exactIng = await prisma.ingredient.findFirst({
    where: { name: { equals: rawQuery.trim(), mode: "insensitive" } },
  });
  if (exactIng) {
    seen.add(exactIng.id);
    out.push({
      ingredientId: exactIng.id,
      name: exactIng.name,
      catalogTier: exactIng.catalogTier,
      via: "exact_name",
      score: 0,
    });
  }

  const aliasHit = await prisma.ingredientAlias.findUnique({
    where: { aliasNormalized: q },
    include: { ingredient: true },
  });
  if (aliasHit && !seen.has(aliasHit.ingredient.id)) {
    seen.add(aliasHit.ingredient.id);
    out.push({
      ingredientId: aliasHit.ingredient.id,
      name: aliasHit.ingredient.name,
      catalogTier: aliasHit.ingredient.catalogTier,
      via: "alias",
      score: 0,
    });
  }

  const fuse = await getFuse(prisma);
  const hits = fuse.search(rawQuery.trim(), { limit: limit + out.length + 5 });
  for (const h of hits) {
    const row = h.item;
    const sc = h.score ?? 1;
    if (sc > RESOLVE_FUZZY_MAX_SCORE + 0.05) continue;
    if (seen.has(row.ingredientId)) continue;
    seen.add(row.ingredientId);
    out.push({
      ingredientId: row.ingredientId,
      name: row.name,
      catalogTier: row.catalogTier,
      via: "fuzzy",
      score: sc,
    });
    if (out.length >= limit) break;
  }

  return out.sort(sortMatches).slice(0, limit);
}

export type ResolveForWriteOptions = {
  /** When no confident match, create USER_AD_HOC ingredient */
  allowCreateAdHoc: boolean;
  defaultCategory?: import("@prisma/client").IngredientCategory;
  defaultUnit?: string;
  defaultStorage?: import("@prisma/client").StorageType;
};

/**
 * Best match without creating rows (for cuisine kit mapping, etc.).
 */
export async function tryResolveIngredientName(
  prisma: PrismaClient,
  raw: string,
): Promise<IngredientResolveMatch | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const q = normalizeIngredientQuery(trimmed);

  const exactIng = await prisma.ingredient.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
  });
  if (exactIng) {
    return {
      ingredientId: exactIng.id,
      name: exactIng.name,
      catalogTier: exactIng.catalogTier,
      via: "exact_name",
      score: 0,
    };
  }

  const aliasHit = await prisma.ingredientAlias.findUnique({
    where: { aliasNormalized: q },
    include: { ingredient: true },
  });
  if (aliasHit) {
    return {
      ingredientId: aliasHit.ingredient.id,
      name: aliasHit.ingredient.name,
      catalogTier: aliasHit.ingredient.catalogTier,
      via: "alias",
      score: 0,
    };
  }

  const fuse = await getFuse(prisma);
  const hits = fuse.search(trimmed, { limit: 1 });
  const best = hits[0];
  if (
    best &&
    best.score !== undefined &&
    best.score <= RESOLVE_FUZZY_MAX_SCORE
  ) {
    const row = best.item;
    const ing = await prisma.ingredient.findUnique({
      where: { id: row.ingredientId },
    });
    if (!ing) return null;
    return {
      ingredientId: ing.id,
      name: ing.name,
      catalogTier: ing.catalogTier,
      via: "fuzzy",
      score: best.score,
    };
  }

  return null;
}

/** Resolve user/receipt input to a single ingredient row for inventory/onboarding. */
export async function resolveIngredientForWrite(
  prisma: PrismaClient,
  raw: string,
  options: ResolveForWriteOptions,
): Promise<{
  ingredientId: string;
  name: string;
  catalogTier: IngredientCatalogTier;
  via: ResolveVia;
  created: boolean;
}> {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Empty ingredient name");
  }

  const existing = await tryResolveIngredientName(prisma, trimmed);
  if (existing) {
    return {
      ingredientId: existing.ingredientId,
      name: existing.name,
      catalogTier: existing.catalogTier,
      via: existing.via,
      created: false,
    };
  }

  if (!options.allowCreateAdHoc) {
    throw new Error(`No matching ingredient for: ${trimmed}`);
  }

  const created = await prisma.ingredient.create({
    data: {
      name: trimmed,
      category: options.defaultCategory ?? "OTHER",
      defaultUnit: options.defaultUnit ?? "count",
      storageType: options.defaultStorage ?? "PANTRY",
      catalogTier: "USER_AD_HOC",
    },
  });

  await refreshIngredientFuseCache(prisma);

  return {
    ingredientId: created.id,
    name: created.name,
    catalogTier: created.catalogTier,
    via: "exact_name",
    created: true,
  };
}
