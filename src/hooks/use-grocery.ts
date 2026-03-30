"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type GroceryListStatus = "DRAFT" | "ACTIVE" | "COMPLETED";

export type GroceryItemSource =
  | "MEAL_PLAN"
  | "PAR_LEVEL"
  | "CUISINE_KIT"
  | "MANUAL";

export interface GroceryListSummary {
  id: string;
  name: string;
  status: GroceryListStatus;
  estimatedTotal: number | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  checkedCount: number;
}

export interface GroceryListIngredient {
  id: string;
  name: string;
  category: string;
  defaultUnit: string;
  avgPricePerUnit: number | null;
}

export interface GroceryListItem {
  id: string;
  listId: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  estimatedCost: number | null;
  checked: boolean;
  storeSection: string | null;
  source: GroceryItemSource;
  ingredient: GroceryListIngredient;
}

export interface GroceryListDetail {
  id: string;
  name: string;
  status: GroceryListStatus;
  estimatedTotal: number | null;
  createdAt: string;
  updatedAt: string;
  items: GroceryListItem[];
}

export type CreateGrocerySource = "manual" | "meal-plan" | "smart";

export function useGroceryLists() {
  return useQuery<GroceryListSummary[]>({
    queryKey: ["grocery-lists"],
    queryFn: async () => {
      const res = await fetch("/api/grocery");
      if (!res.ok) throw new Error("Failed to fetch grocery lists");
      return res.json();
    },
  });
}

export function useGroceryList(id: string) {
  return useQuery<GroceryListDetail>({
    queryKey: ["grocery-list", id],
    queryFn: async () => {
      const res = await fetch(`/api/grocery/${id}`);
      if (!res.ok) throw new Error("Failed to fetch grocery list");
      return res.json();
    },
    enabled: id.length > 0,
  });
}

export function useCreateGroceryList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; source?: CreateGrocerySource }) => {
      const res = await fetch("/api/grocery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: input.name,
          source: input.source ?? "manual",
        }),
      });
      if (!res.ok) throw new Error("Failed to create grocery list");
      return res.json() as Promise<GroceryListSummary>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grocery-lists"] });
    },
  });
}

export function useUpdateGroceryList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      status?: GroceryListStatus;
    }) => {
      const res = await fetch(`/api/grocery/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update grocery list");
      return res.json() as Promise<GroceryListDetail>;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["grocery-lists"] });
      qc.invalidateQueries({ queryKey: ["grocery-list", vars.id] });
    },
  });
}

export function useDeleteGroceryList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/grocery/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete grocery list");
      return res.json();
    },
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: ["grocery-list", id] });
      qc.invalidateQueries({ queryKey: ["grocery-lists"] });
    },
  });
}

export function useAddGroceryItem(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      ingredientId: string;
      quantity: number;
      unit: string;
    }) => {
      const res = await fetch(`/api/grocery/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to add item");
      return res.json() as Promise<GroceryListDetail>;
    },
    onSuccess: (data) => {
      qc.setQueryData(["grocery-list", listId], data);
      qc.invalidateQueries({ queryKey: ["grocery-lists"] });
    },
  });
}

export function useToggleGroceryItem(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { itemId: string; checked: boolean }) => {
      const res = await fetch(`/api/grocery/${listId}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: input.itemId,
          checked: input.checked,
        }),
      });
      if (!res.ok) throw new Error("Failed to update item");
      return res.json() as Promise<GroceryListDetail>;
    },
    onSuccess: (data) => {
      qc.setQueryData(["grocery-list", listId], data);
      qc.invalidateQueries({ queryKey: ["grocery-lists"] });
    },
  });
}

export function useDeleteGroceryItem(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(
        `/api/grocery/${listId}/items?itemId=${encodeURIComponent(itemId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to remove item");
      return res.json() as Promise<GroceryListDetail>;
    },
    onSuccess: (data) => {
      qc.setQueryData(["grocery-list", listId], data);
      qc.invalidateQueries({ queryKey: ["grocery-lists"] });
    },
  });
}
