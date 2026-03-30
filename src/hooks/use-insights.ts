"use client";

import { useQuery } from "@tanstack/react-query";

/** Matches GET /api/insights; `growthStackedBySource` powers the stacked cookbook chart. */
export interface InsightsData {
  cookbook: {
    totalRecipes: number;
    recipesByCuisine: { cuisine: string; count: number }[];
    recipesBySource: { source: string; count: number }[];
    growthOverTime: { date: string; cumulative: number }[];
    growthStackedBySource: {
      date: string;
      aiBatch: number;
      aiSingle: number;
      userCreated: number;
      cumulative: number;
    }[];
  };
  cooking: {
    totalCooks: number;
    cooksThisMonth: number;
    avgRating: number;
    topRecipes: { title: string; cooks: number; avgRating: number }[];
    cookingFrequency: { date: string; count: number }[];
  };
  cost: {
    totalSpent: number;
    spentThisMonth: number;
    avgCostPerRecipe: number;
    spendingOverTime: { date: string; amount: number }[];
    topExpenseIngredients: { name: string; totalSpent: number }[];
  };
  waste: {
    totalExpired: number;
    wasteRate: number;
    expiringItems: { name: string; expiryDate: string; daysLeft: number }[];
  };
  ai: {
    totalGenerationJobs: number;
    totalRecipesGenerated: number;
    totalTokensUsed: number;
    estimatedTotalCost: number;
    generationOverTime: { date: string; recipes: number; cost: number }[];
    cacheHitRate: number;
  };
  techniques: {
    totalTechniquesLogged: number;
    techniqueDistribution: { technique: string; count: number }[];
    cuisineDiversity: { cuisine: string; recipesCooked: number }[];
  };
}

export function useInsights() {
  return useQuery<InsightsData>({
    queryKey: ["insights"],
    queryFn: async () => {
      const res = await fetch("/api/insights");
      if (!res.ok) throw new Error("Failed to load insights");
      return res.json();
    },
  });
}
