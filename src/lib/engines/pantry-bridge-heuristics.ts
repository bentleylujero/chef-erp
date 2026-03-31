import type { IngredientCategory } from "@prisma/client";
import type { UnlinkedPantryIngredient } from "@/lib/engines/topology-builder";

export function sortIngredientPairIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

const DULL_PAIR = new Set<IngredientCategory>([
  "SPICE",
  "HERB",
  "PANTRY_STAPLE",
  "VINEGAR",
  "SWEETENER",
]);

const MEAT = new Set<IngredientCategory>([
  "POULTRY",
  "RED_MEAT",
  "SEAFOOD",
  "CURED_DELI",
  "PROTEIN",
]);

function isVegLike(c: IngredientCategory): boolean {
  return (
    c === "VEGETABLE" ||
    c === "MUSHROOM" ||
    c === "AROMATIC" ||
    c === "FRUIT" ||
    c === "PRODUCE"
  );
}

function isDairy(c: IngredientCategory): boolean {
  return c === "DAIRY" || c === "CHEESE";
}

/** Higher = more likely a coherent dish; ≤0 = skip for bridging. */
export function categoryBridgeScore(
  c1: IngredientCategory,
  c2: IngredientCategory,
): number {
  if (c1 === c2) {
    if (DULL_PAIR.has(c1)) return -1;
    return 1;
  }
  if (DULL_PAIR.has(c1) && DULL_PAIR.has(c2)) return -1;

  const m1 = MEAT.has(c1);
  const m2 = MEAT.has(c2);
  const v1 = isVegLike(c1);
  const v2 = isVegLike(c2);

  if ((m1 && v2) || (m2 && v1)) return 8;
  if ((m1 && c2 === "GRAIN") || (m2 && c1 === "GRAIN")) return 7;
  if ((m1 && isDairy(c2)) || (m2 && isDairy(c1))) return 6;
  if ((c1 === "LEGUME" && c2 === "GRAIN") || (c2 === "LEGUME" && c1 === "GRAIN"))
    return 7;
  if ((isDairy(c1) && v2) || (isDairy(c2) && v1)) return 5;

  if (!DULL_PAIR.has(c1) && !DULL_PAIR.has(c2)) return 3;
  if (!DULL_PAIR.has(c1) || !DULL_PAIR.has(c2)) return 2;
  return 0;
}

export interface RankedBridgePair {
  ingredientIdA: string;
  ingredientIdB: string;
  nameA: string;
  nameB: string;
  score: number;
}

export function rankPantryBridgePairs(
  unlinked: UnlinkedPantryIngredient[],
  attemptedPairKeys: Set<string>,
  /** Stocked items already on the cookbook graph — pair with unlinked to attach isolates. */
  linkedCorpusPantry?: UnlinkedPantryIngredient[],
): RankedBridgePair[] {
  const byId = new Map(unlinked.map((u) => [u.id, u]));
  const scored: RankedBridgePair[] = [];
  const seenKeys = new Set<string>();
  const pushPair = (
    idA: string,
    idB: string,
    nameA: string,
    nameB: string,
    s: number,
  ) => {
    const [sortedA, sortedB] = sortIngredientPairIds(idA, idB);
    const key = `${sortedA}::${sortedB}`;
    if (attemptedPairKeys.has(key) || seenKeys.has(key)) return;
    seenKeys.add(key);
    const nameFor = (id: string) => (id === idA ? nameA : nameB);
    scored.push({
      ingredientIdA: sortedA,
      ingredientIdB: sortedB,
      nameA: nameFor(sortedA),
      nameB: nameFor(sortedB),
      score: s,
    });
  };

  for (let i = 0; i < unlinked.length; i++) {
    for (let j = i + 1; j < unlinked.length; j++) {
      const u = unlinked[i];
      const v = unlinked[j];
      const [idA, idB] = sortIngredientPairIds(u.id, v.id);
      const a = byId.get(idA);
      const b = byId.get(idB);
      if (!a || !b) continue;

      const s = categoryBridgeScore(a.category, b.category);
      if (s < 1) continue;

      pushPair(idA, idB, a.name, b.name, s);
    }
  }

  if (linkedCorpusPantry?.length) {
    const corpusById = new Map(linkedCorpusPantry.map((c) => [c.id, c]));
    for (const u of unlinked) {
      for (const l of linkedCorpusPantry) {
        if (u.id === l.id) continue;
        let s = categoryBridgeScore(u.category, l.category);
        // Attach isolates to the main graph even when the pair is neutrally scored (still skip hard rejects).
        if (s === 0) s = 1;
        if (s < 1) continue;
        const c = corpusById.get(l.id);
        if (!c) continue;
        pushPair(u.id, c.id, u.name, c.name, s);
      }
    }
  }

  scored.sort(
    (x, y) => y.score - x.score || x.nameA.localeCompare(y.nameA),
  );
  return scored;
}

function bridgePairKey(p: RankedBridgePair): string {
  return `${p.ingredientIdA}::${p.ingredientIdB}`;
}

/**
 * Prefer recipes that attach each unlinked pantry item to the graph (unlinked–corpus or unlinked–unlinked),
 * then fill remaining batch slots with the next best pairs.
 */
export function pickBridgePairsForGeneration(
  ranked: RankedBridgePair[],
  unlinkedIds: Set<string>,
  max: number,
): RankedBridgePair[] {
  const chosen: RankedBridgePair[] = [];
  const usedKeys = new Set<string>();
  const coveredUnlinked = new Set<string>();

  for (const p of ranked) {
    if (chosen.length >= max) break;
    const k = bridgePairKey(p);
    if (usedKeys.has(k)) continue;
    const aUn = unlinkedIds.has(p.ingredientIdA);
    const bUn = unlinkedIds.has(p.ingredientIdB);
    if (!aUn && !bUn) continue;
    const addsCoverage =
      (aUn && !coveredUnlinked.has(p.ingredientIdA)) ||
      (bUn && !coveredUnlinked.has(p.ingredientIdB));
    if (!addsCoverage) continue;
    chosen.push(p);
    usedKeys.add(k);
    if (aUn) coveredUnlinked.add(p.ingredientIdA);
    if (bUn) coveredUnlinked.add(p.ingredientIdB);
  }

  for (const p of ranked) {
    if (chosen.length >= max) break;
    const k = bridgePairKey(p);
    if (usedKeys.has(k)) continue;
    const aUn = unlinkedIds.has(p.ingredientIdA);
    const bUn = unlinkedIds.has(p.ingredientIdB);
    if (!aUn && !bUn) continue;
    chosen.push(p);
    usedKeys.add(k);
  }

  return chosen;
}
