"use client";

import { useState, useEffect, useMemo } from "react";
import { BookOpen, Search, BookOpenCheck } from "lucide-react";
import {
  useRecipes,
  useRecipeMatches,
  type RecipeListItem,
} from "@/hooks/use-recipes";
import { RecipeCard } from "@/components/cookbook/recipe-card";
import { formatCuisine, formatTechnique } from "@/components/cookbook/recipe-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const CUISINES = [
  "FRENCH",
  "ITALIAN",
  "DELI",
  "MEXICAN",
  "MEDITERRANEAN",
  "JAPANESE",
  "THAI",
  "KOREAN",
  "CHINESE",
  "INDIAN",
  "AMERICAN",
  "MIDDLE_EASTERN",
  "AFRICAN",
  "CARIBBEAN",
  "SOUTHEAST_ASIAN",
  "FUSION",
  "OTHER",
] as const;

const TECHNIQUES = [
  "BRAISE",
  "SAUTE",
  "ROAST",
  "GRILL",
  "POACH",
  "STEAM",
  "FRY",
  "DEEP_FRY",
  "SOUS_VIDE",
  "SEAR",
  "STEW",
  "BAKE",
  "BROIL",
  "SMOKE",
  "CONFIT",
  "FLAMBE",
  "REDUCE",
  "CARAMELIZE",
  "BRAISE",
  "MARINATE",
  "FERMENT",
  "EMULSIFY",
  "BLANCH",
  "DEGLAZE",
  "PICKLE",
  "BRINE",
  "WHISK",
  "KNEAD",
  "FOLD",
  "TEMPER",
  "CURE",
  "LAMINATE",
  "CLARIFY",
  "RENDER",
  "CHIFFONADE",
  "BRUNOISE",
  "JULIENNE",
  "MINCE",
] as const;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "rating", label: "Highest Rated" },
  { value: "cooks", label: "Most Cooked" },
];

function RecipeGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-4 w-3/4" />
            <div className="mt-2 flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex gap-1">
              <Skeleton className="h-4 w-14 rounded-full" />
              <Skeleton className="h-4 w-14 rounded-full" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-12" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-20 text-center">
      <div className="rounded-full bg-muted/50 p-4 mb-4">
        <BookOpen className="size-8 text-muted-foreground/60" />
      </div>
      <h3 className="text-base font-semibold">Your cookbook is empty</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        {message ??
          "Complete onboarding to generate your first recipes."}
      </p>
    </div>
  );
}

export default function CookbookPage() {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [cuisine, setCuisine] = useState("ALL");
  const [difficulty, setDifficulty] = useState("ALL");
  const [technique, setTechnique] = useState("ALL");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const effectiveSort = activeTab === "recent" ? "newest" : sort;

  const recipeFilters = useMemo(
    () => ({
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(cuisine !== "ALL" ? { cuisine } : {}),
      ...(difficulty !== "ALL" ? { difficulty: parseInt(difficulty) } : {}),
      ...(technique !== "ALL" ? { technique } : {}),
      sort: effectiveSort,
      limit: 50,
    }),
    [debouncedSearch, cuisine, difficulty, technique, effectiveSort],
  );

  const matchFilters = useMemo(
    () => ({
      ...(cuisine !== "ALL" ? { cuisine } : {}),
      ...(difficulty !== "ALL" ? { maxDifficulty: parseInt(difficulty) } : {}),
      limit: 30,
    }),
    [cuisine, difficulty],
  );

  const { data: recipesData, isLoading: recipesLoading } =
    useRecipes(recipeFilters);
  const { data: matchData, isLoading: matchesLoading } =
    useRecipeMatches(matchFilters);

  const recipes = recipesData?.recipes ?? [];
  const total = recipesData?.total ?? 0;

  const matchedRecipes = useMemo(() => {
    if (!matchData?.matches?.length || !recipes.length) return [];
    const recipeMap = new Map(recipes.map((r) => [r.id, r]));
    return matchData.matches
      .map((match) => {
        const recipe = recipeMap.get(match.recipeId);
        if (!recipe) return null;
        return { recipe, matchScore: Math.round(match.total) };
      })
      .filter(
        (item): item is { recipe: RecipeListItem; matchScore: number } =>
          item !== null,
      );
  }, [matchData, recipes]);

  const recentRecipes = useMemo(() => {
    return [...recipes].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [recipes]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cookbook</h1>
          <p className="mt-1 text-muted-foreground">
            Your growing recipe library, generated from your ingredients and
            cooking style.
          </p>
        </div>
        {total > 0 && (
          <div className="hidden shrink-0 items-center gap-3 rounded-xl bg-primary/10 px-4 py-2.5 sm:flex">
            <BookOpenCheck className="size-5 text-primary" />
            <div className="text-right">
              <div className="text-2xl font-bold leading-none tabular-nums">
                {total}
              </div>
              <div className="text-[11px] text-muted-foreground">recipes</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs, Filters, Content */}
      <Tabs
        defaultValue="all"
        value={activeTab}
        onValueChange={(v) => setActiveTab(String(v))}
      >
        <TabsList>
          <TabsTrigger value="all">
            All Recipes
            {total > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
                {total}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="matches">Best Matches</TabsTrigger>
          <TabsTrigger value="recent">Recently Added</TabsTrigger>
        </TabsList>

        {/* Filter bar */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search recipes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select
            value={cuisine}
            onValueChange={(v) => setCuisine(String(v))}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Cuisines</SelectItem>
              {CUISINES.map((c) => (
                <SelectItem key={c} value={c}>
                  {formatCuisine(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={difficulty}
            onValueChange={(v) => setDifficulty(String(v))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Any Difficulty</SelectItem>
              {[1, 2, 3, 4, 5].map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {"🔥".repeat(d)} Level {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={technique}
            onValueChange={(v) => setTechnique(String(v))}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Techniques</SelectItem>
              {[...new Set(TECHNIQUES)].map((t) => (
                <SelectItem key={t} value={t}>
                  {formatTechnique(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeTab === "all" && (
            <Select value={sort} onValueChange={(v) => setSort(String(v))}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* All Recipes */}
        <TabsContent value="all" className="mt-4">
          {recipesLoading ? (
            <RecipeGridSkeleton />
          ) : recipes.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recipes.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Best Matches */}
        <TabsContent value="matches" className="mt-4">
          {matchesLoading || recipesLoading ? (
            <RecipeGridSkeleton />
          ) : matchedRecipes.length === 0 ? (
            <EmptyState message="No matches found. Add ingredients to your pantry to get personalized recipe recommendations." />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {matchedRecipes.map(({ recipe, matchScore }) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  matchScore={matchScore}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Recently Added */}
        <TabsContent value="recent" className="mt-4">
          {recipesLoading ? (
            <RecipeGridSkeleton />
          ) : recentRecipes.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentRecipes.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
