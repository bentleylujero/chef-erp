"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface PantryBridgeUnlinked {
  id: string;
  name: string;
  category: string;
}

export interface PantryBridgeSuggestedPair {
  ingredientIdA: string;
  ingredientIdB: string;
  nameA: string;
  nameB: string;
  score: number;
}

export interface PantryBridgeStatus {
  unlinked: PantryBridgeUnlinked[];
  unlinkedCount: number;
  linkedCorpusPantryCount: number;
  totalPantryWithStock: number;
  linkedPantryCount: number;
  suggestedPairs: PantryBridgeSuggestedPair[];
  /** Pairs the next POST will send to the recipe generator (covers unlinked → graph first). */
  nextBatchPairs: PantryBridgeSuggestedPair[];
  novelPairCount: number;
  bridgeAttemptsLogged: number;
  canGenerate: boolean;
}

export function usePantryBridge() {
  return useQuery<PantryBridgeStatus>({
    queryKey: ["pantry-bridge"],
    queryFn: async () => {
      const res = await fetch("/api/pantry-bridge");
      if (!res.ok) throw new Error("Failed to load pantry bridge");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function usePantryBridgeGenerate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/pantry-bridge", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Generation failed",
        );
      }
      return data as { recipesGenerated?: number; jobId?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry-bridge"] });
      queryClient.invalidateQueries({ queryKey: ["food-web"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}
