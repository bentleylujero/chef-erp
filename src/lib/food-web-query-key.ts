/** Shared with server prefetch — must not live in a `"use client"` file. */

export type GraphMode = "co-occurrence" | "flavor-affinity" | "cuisine-clusters";

export interface FoodWebFilters {
  cuisine?: string;
  pantryOnly?: boolean;
  minWeight?: number;
  mode?: GraphMode;
  search?: string;
}

/** Primitives-only key so SSR prefetch + dehydrate matches client hydration (object keys with `undefined` do not). */
export function foodWebQueryKey(filters?: FoodWebFilters) {
  return [
    "food-web",
    filters?.cuisine ?? "__all__",
    filters?.pantryOnly ?? false,
    filters?.minWeight ?? 1,
    filters?.mode ?? "co-occurrence",
  ] as const;
}
