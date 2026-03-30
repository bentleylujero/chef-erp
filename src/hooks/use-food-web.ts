"use client";

import { useQuery } from "@tanstack/react-query";
import type { TopologyData } from "@/lib/engines/topology-builder";
import {
  foodWebQueryKey,
  type FoodWebFilters,
} from "@/lib/food-web-query-key";

export type { FoodWebFilters };

export function useFoodWeb(filters?: FoodWebFilters) {
  return useQuery<TopologyData>({
    queryKey: foodWebQueryKey(filters),
    staleTime: 0,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.cuisine) params.set("cuisine", filters.cuisine);
      if (filters?.pantryOnly) params.set("pantryOnly", "true");
      if (filters?.minWeight) params.set("minWeight", String(filters.minWeight));
      if (filters?.mode) params.set("mode", filters.mode);
      const res = await fetch(`/api/recipes/food-web?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch food web data");
      return res.json();
    },
  });
}
