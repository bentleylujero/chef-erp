/** Shared normalization for ingredient names and aliases (seed + resolver). */
export function normalizeIngredientQuery(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}
