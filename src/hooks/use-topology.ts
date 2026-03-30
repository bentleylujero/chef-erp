"use client";

import { useQuery } from "@tanstack/react-query";
import type { TopologyData } from "@/lib/engines/topology-builder";

export interface TopologyFilters {
  cuisine?: string;
  pantryOnly?: boolean;
  minWeight?: number;
}

export function useTopology(filters?: TopologyFilters) {
  return useQuery<TopologyData>({
    queryKey: ["topology", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.cuisine) params.set("cuisine", filters.cuisine);
      if (filters?.pantryOnly) params.set("pantryOnly", "true");
      if (filters?.minWeight) params.set("minWeight", String(filters.minWeight));
      const res = await fetch(`/api/recipes/topology?${params}`);
      if (!res.ok) throw new Error("Failed to fetch topology data");
      return res.json();
    },
  });
}
