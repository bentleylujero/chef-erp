"use client";

import { useQuery } from "@tanstack/react-query";

export interface RecipeListItem {
  id: string;
  title: string;
  description: string;
  cuisine: string;
  difficulty: number;
  techniques: string[];
  prepTime: number;
  cookTime: number;
  servings: number;
  tags: string[];
  source: string;
  totalCooks: number;
  avgRating: number | null;
  status: string;
  createdAt: string;
  _count: { ingredients: number; ratings: number };
}

export interface RecipesResponse {
  recipes: RecipeListItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface RecipeFilters {
  search?: string;
  cuisine?: string;
  difficulty?: number;
  technique?: string;
  sort?: string;
  limit?: number;
}

export interface RecipeIngredientDetail {
  id: string;
  recipeId: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  isOptional: boolean;
  prepNote: string | null;
  substituteGroup: string | null;
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

export interface RecipeInstruction {
  step: number;
  technique?: string;
  timing?: string;
  notes?: string;
  text: string;
}

export interface RecipeDetail {
  id: string;
  title: string;
  description: string;
  cuisine: string;
  difficulty: number;
  techniques: string[];
  instructions: RecipeInstruction[];
  prepTime: number;
  cookTime: number;
  servings: number;
  flavorTags: Record<string, number>;
  tags: string[];
  source: string;
  parentRecipeId: string | null;
  platePrice: number | null;
  totalCooks: number;
  avgRating: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  ingredients: RecipeIngredientDetail[];
  ratings: Array<{
    id: string;
    userId: string;
    rating: number;
    difficultyFelt: number | null;
    notes: string | null;
    wouldMakeAgain: boolean | null;
    cookedAt: string;
  }>;
  cookingLogs: Array<{
    id: string;
    cookedAt: string;
    actualPrepTime: number | null;
    actualCookTime: number | null;
    servingsCooked: number | null;
    notes: string | null;
  }>;
  variants: Array<{ id: string; title: string; cuisine: string; difficulty: number }>;
  parentRecipe: { id: string; title: string } | null;
}

export interface MatchScore {
  recipeId: string;
  title: string;
  description: string;
  cuisine: string;
  difficulty: number;
  techniques: string[];
  prepTime: number;
  cookTime: number;
  servings: number;
  tags: string[];
  source: string;
  totalCooks: number;
  avgRating: number | null;
  createdAt: string;
  pantryOverlap: number;
  flavorMatch: number;
  cuisineAffinity: number;
  techniqueComfort: number;
  expiryBonus: number;
  total: number;
  _count: { ingredients: number; ratings: number };
}

export interface MatchFilters {
  cuisine?: string;
  maxDifficulty?: number;
  limit?: number;
  minPantryOverlap?: number;
}

export function useRecipes(filters?: RecipeFilters) {
  return useQuery<RecipesResponse>({
    queryKey: ["recipes", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.set("search", filters.search);
      if (filters?.cuisine) params.set("cuisine", filters.cuisine);
      if (filters?.difficulty) params.set("difficulty", String(filters.difficulty));
      if (filters?.technique) params.set("technique", filters.technique);
      if (filters?.sort) params.set("sort", filters.sort);
      if (filters?.limit) params.set("limit", String(filters.limit));
      const res = await fetch(`/api/recipes?${params}`);
      if (!res.ok) throw new Error("Failed to fetch recipes");
      return res.json();
    },
  });
}

export function useRecipeDetail(id: string) {
  return useQuery<RecipeDetail>({
    queryKey: ["recipe", id],
    queryFn: async () => {
      const res = await fetch(`/api/recipes/${id}`);
      if (!res.ok) throw new Error("Failed to fetch recipe");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useRecipeMatches(filters?: MatchFilters) {
  return useQuery<{ matches: MatchScore[]; count: number }>({
    queryKey: ["recipe-matches", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.cuisine) params.set("cuisine", filters.cuisine);
      if (filters?.maxDifficulty) params.set("maxDifficulty", String(filters.maxDifficulty));
      if (filters?.limit) params.set("limit", String(filters.limit));
      if (filters?.minPantryOverlap != null) params.set("minPantryOverlap", String(filters.minPantryOverlap));
      const res = await fetch(`/api/recipes/match?${params}`);
      if (!res.ok) throw new Error("Failed to match recipes");
      return res.json();
    },
  });
}
