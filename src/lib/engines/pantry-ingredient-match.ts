import Fuse from "fuse.js";

export type PantryIngredientRow = { id: string; name: string };

/** Case-insensitive exact match on trimmed name. */
export function buildPantryExactMap(
  rows: PantryIngredientRow[],
): Map<string, PantryIngredientRow> {
  const m = new Map<string, PantryIngredientRow>();
  for (const r of rows) {
    const k = r.name.trim().toLowerCase();
    if (!m.has(k)) m.set(k, r);
  }
  return m;
}

export function createPantryFuse(rows: PantryIngredientRow[]) {
  return new Fuse(rows, {
    keys: ["name"],
    threshold: 0.35,
    includeScore: true,
  });
}

/**
 * Resolves AI output name to a stocked pantry ingredient only (never the global catalog).
 */
export function matchNameToPantryRow(
  rawName: string,
  exactMap: Map<string, PantryIngredientRow>,
  fuse: Fuse<PantryIngredientRow>,
  maxFuseScore: number,
): PantryIngredientRow | null {
  const trimmed = rawName.trim();
  if (!trimmed) return null;

  const exact = exactMap.get(trimmed.toLowerCase());
  if (exact) return exact;

  const hits = fuse.search(trimmed);
  if (hits.length === 0) return null;
  const best = hits[0];
  if (best.score !== undefined && best.score > maxFuseScore) return null;
  return best.item;
}
