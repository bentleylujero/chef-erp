"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

/**
 * Refetch everything that reads pantry/inventory or new ingredients from bulk add.
 * Uses refetchType "all" so inactive routes (e.g. Food Web while you're on Pantry)
 * refresh in the background — navigation then sees current data, not a stale cache.
 */
export function invalidateQueriesAffectedByPantry(qc: QueryClient) {
  const refetchAll = { refetchType: "all" as const };
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["inventory"], ...refetchAll }),
    qc.invalidateQueries({ queryKey: ["food-web"], ...refetchAll }),
    qc.invalidateQueries({ queryKey: ["pantry-bridge"], ...refetchAll }),
    qc.invalidateQueries({ queryKey: ["network-mesh"], ...refetchAll }),
    qc.invalidateQueries({ queryKey: ["insights"], ...refetchAll }),
    qc.invalidateQueries({ queryKey: ["recipe-matches"], ...refetchAll }),
    qc.invalidateQueries({ queryKey: ["grocery-lists"], ...refetchAll }),
    qc.invalidateQueries({ queryKey: ["grocery-list"], ...refetchAll }),
    qc.invalidateQueries({ queryKey: ["ingredients"], ...refetchAll }),
    qc.invalidateQueries({ queryKey: ["recipes"], ...refetchAll }),
    qc.invalidateQueries({ queryKey: ["cuisine-exploration"], ...refetchAll }),
  ]);
}

export interface InventoryItem {
  id: string;
  userId: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  purchaseDate: string | null;
  expiryDate: string | null;
  cost: number | null;
  location: string;
  parLevel: number | null;
  createdAt: string;
  updatedAt: string;
  ingredient: {
    id: string;
    name: string;
    category: string;
    defaultUnit: string;
    shelfLifeDays: number | null;
    storageType: string;
    avgPricePerUnit: number | null;
    description: string | null;
  };
}

export interface Ingredient {
  id: string;
  name: string;
  category: string;
  defaultUnit: string;
  shelfLifeDays: number | null;
  storageType: string;
  avgPricePerUnit: number | null;
  description: string | null;
}

export interface InventoryFilters {
  search?: string;
  category?: string;
  location?: string;
  expiring?: boolean;
}

export function useInventory(filters?: InventoryFilters) {
  return useQuery<InventoryItem[]>({
    queryKey: ["inventory", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.set("search", filters.search);
      if (filters?.category) params.set("category", filters.category);
      if (filters?.location) params.set("location", filters.location);
      if (filters?.expiring) params.set("expiring", "true");
      const res = await fetch(`/api/inventory?${params}`);
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json();
    },
  });
}

export interface BulkInventoryItem {
  ingredientId?: string;
  newName?: string;
  category?: string;
  quantity: number;
  unit: string;
  location?: string;
}

export function useAddInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      ingredientId: string;
      quantity: number;
      unit: string;
      purchaseDate?: string;
      expiryDate?: string;
      cost?: number;
      location?: string;
      parLevel?: number;
    }) => {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add item");
      return res.json();
    },
    onSuccess: async () => {
      await invalidateQueriesAffectedByPantry(qc);
    },
  });
}

export function useBulkAddInventory(options?: {
  /** Set false when firing multiple chunks; call `invalidateQueriesAffectedByPantry` once when done. */
  cascadeInvalidation?: boolean;
}) {
  const qc = useQueryClient();
  const cascadeInvalidation = options?.cascadeInvalidation !== false;
  return useMutation({
    mutationFn: async (items: BulkInventoryItem[]) => {
      const res = await fetch("/api/inventory/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      let data: { error?: unknown } & Record<string, unknown>;
      try {
        data = await res.json();
      } catch {
        throw new Error("Bulk add failed: invalid response");
      }
      if (!res.ok) {
        const err = data.error;
        const msg =
          typeof err === "string"
            ? err
            : Array.isArray(err)
              ? err
                  .map((i) =>
                    i && typeof i === "object" && "message" in i
                      ? String((i as { message: string }).message)
                      : JSON.stringify(i),
                  )
                  .join(" · ")
              : "Bulk add failed";
        throw new Error(msg);
      }
      return data as {
        created: number;
        updated: number;
        ingredientsCreated: number;
        processed: number;
      };
    },
    onSuccess: async () => {
      if (cascadeInvalidation) await invalidateQueriesAffectedByPantry(qc);
    },
  });
}

export function useUpdateInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      quantity?: number;
      unit?: string;
      purchaseDate?: string | null;
      expiryDate?: string | null;
      cost?: number | null;
      location?: string;
      parLevel?: number | null;
    }) => {
      const res = await fetch(`/api/inventory/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update item");
      return res.json();
    },
    onSuccess: async () => {
      await invalidateQueriesAffectedByPantry(qc);
    },
  });
}

export function useDeleteInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/inventory/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete item");
      return res.json();
    },
    onSuccess: async () => {
      await invalidateQueriesAffectedByPantry(qc);
    },
  });
}

export function useIngredientSearch(search: string) {
  return useQuery<Ingredient[]>({
    queryKey: ["ingredients", search],
    queryFn: async () => {
      if (!search) return [];
      const params = new URLSearchParams({ search });
      const res = await fetch(`/api/ingredients?${params}`);
      if (!res.ok) throw new Error("Failed to search ingredients");
      return res.json();
    },
    enabled: search.length > 0,
  });
}
