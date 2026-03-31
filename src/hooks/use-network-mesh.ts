"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface NetworkMeshStatus {
  canGenerate: boolean;
  reason: string;
  meshRecipeCount: number;
  hubCount: number;
  pantrySize: number;
  cooldownHoursRemaining: number | null;
}

export function useNetworkMesh() {
  return useQuery<NetworkMeshStatus>({
    queryKey: ["network-mesh"],
    queryFn: async () => {
      const res = await fetch("/api/network-mesh");
      if (!res.ok) throw new Error("Failed to load network mesh status");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useNetworkMeshGenerate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/network-mesh", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Generation failed",
        );
      }
      return data as { recipesGenerated?: number; jobId?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["network-mesh"] });
      queryClient.invalidateQueries({ queryKey: ["food-web"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["pantry-bridge"] });
    },
  });
}
