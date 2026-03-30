"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface MealPlanRecipe {
  id: string;
  title: string;
  cuisine: string;
  difficulty: number;
  prepTime: number;
  cookTime: number;
  servings: number;
  platePrice: number | null;
  tags: string[];
  ingredients?: Array<{
    id: string;
    quantity: number;
    unit: string;
    ingredient: {
      id: string;
      name: string;
      category: string;
      avgPricePerUnit: number | null;
    };
  }>;
}

export interface MealPlanEntry {
  id: string;
  planId: string;
  recipeId: string;
  date: string;
  mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  scaledServings: number | null;
  recipe: MealPlanRecipe;
}

export interface MealPlan {
  id: string;
  userId: string;
  weekStart: string;
  notes: string | null;
  createdAt: string;
  entries: MealPlanEntry[];
}

export function useMealPlan(weekStart?: string) {
  return useQuery<MealPlan>({
    queryKey: ["meal-plan", weekStart],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (weekStart) params.set("weekStart", weekStart);
      const res = await fetch(`/api/meal-plan?${params}`);
      if (!res.ok) throw new Error("Failed to fetch meal plan");
      return res.json();
    },
  });
}

export function useAddMealPlanEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      recipeId: string;
      date: string;
      mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
      scaledServings?: number;
    }) => {
      const res = await fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add meal plan entry");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meal-plan"] }),
  });
}

export function useUpdateMealPlanEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      recipeId?: string;
      date?: string;
      mealType?: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
      scaledServings?: number | null;
    }) => {
      const res = await fetch(`/api/meal-plan/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update meal plan entry");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meal-plan"] }),
  });
}

export function useDeleteMealPlanEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/meal-plan/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete meal plan entry");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meal-plan"] }),
  });
}
