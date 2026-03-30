"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Globe,
  BookOpen,
  ChevronRight,
  Compass,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  formatCuisine,
  CUISINE_STYLES,
} from "@/components/cookbook/recipe-card";

const ALL_CUISINES = [
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

const CUISINE_ICONS: Record<string, string> = {
  FRENCH: "🇫🇷",
  ITALIAN: "🇮🇹",
  DELI: "🥪",
  MEXICAN: "🇲🇽",
  MEDITERRANEAN: "🫒",
  JAPANESE: "🇯🇵",
  THAI: "🇹🇭",
  KOREAN: "🇰🇷",
  CHINESE: "🇨🇳",
  INDIAN: "🇮🇳",
  AMERICAN: "🇺🇸",
  MIDDLE_EASTERN: "🧆",
  AFRICAN: "🌍",
  CARIBBEAN: "🏝️",
  SOUTHEAST_ASIAN: "🍜",
  FUSION: "🔀",
  OTHER: "🍽️",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NOT_STARTED: {
    label: "Not Started",
    color: "bg-muted text-muted-foreground",
  },
  STOCKING_PANTRY: {
    label: "Stocking Pantry",
    color: "bg-amber-500/15 text-amber-400",
  },
  LEARNING_BASICS: {
    label: "Learning Basics",
    color: "bg-blue-500/15 text-blue-400",
  },
  INTERMEDIATE: {
    label: "Intermediate",
    color: "bg-violet-500/15 text-violet-400",
  },
  COMFORTABLE: {
    label: "Comfortable",
    color: "bg-emerald-500/15 text-emerald-400",
  },
};

interface CuisineExploration {
  cuisine: string;
  status: string;
  recipesCompleted: number;
}

interface RecipeCounts {
  cuisine: string;
  _count: number;
}

function useExplorations() {
  return useQuery<CuisineExploration[]>({
    queryKey: ["explorations"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed to fetch");
      const profile = await res.json();
      return profile.cuisineExplorations ?? [];
    },
  });
}

function useRecipeCountsByCuisine() {
  return useQuery<RecipeCounts[]>({
    queryKey: ["recipe-counts-by-cuisine"],
    queryFn: async () => {
      const res = await fetch("/api/recipes?limit=1");
      if (!res.ok) return [];
      const data = await res.json();

      const counts: Record<string, number> = {};
      const allRes = await fetch("/api/recipes?limit=500");
      if (allRes.ok) {
        const allData = await allRes.json();
        for (const recipe of allData.recipes ?? []) {
          counts[recipe.cuisine] = (counts[recipe.cuisine] ?? 0) + 1;
        }
      }
      return Object.entries(counts).map(([cuisine, count]) => ({
        cuisine,
        _count: count,
      }));
    },
  });
}

function CuisineCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CuisineExplorerPage() {
  const { data: explorations, isLoading: expLoading } = useExplorations();
  const { data: recipeCounts, isLoading: rcLoading } =
    useRecipeCountsByCuisine();

  const isLoading = expLoading || rcLoading;

  const explorationMap = useMemo(() => {
    const map = new Map<string, CuisineExploration>();
    for (const exp of explorations ?? []) {
      map.set(exp.cuisine, exp);
    }
    return map;
  }, [explorations]);

  const recipeCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const rc of recipeCounts ?? []) {
      map.set(rc.cuisine, rc._count);
    }
    return map;
  }, [recipeCounts]);

  const activeCuisines = ALL_CUISINES.filter(
    (c) =>
      explorationMap.has(c) &&
      explorationMap.get(c)!.status !== "NOT_STARTED",
  );
  const inactiveCuisines = ALL_CUISINES.filter(
    (c) => !activeCuisines.includes(c),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Cuisine Explorer
          </h1>
          <p className="mt-1 text-muted-foreground">
            Discover new cuisines with AI-powered starter kits and recipe
            ladders.
          </p>
        </div>
        <div className="hidden shrink-0 items-center gap-3 rounded-xl bg-primary/10 px-4 py-2.5 sm:flex">
          <Compass className="size-5 text-primary" />
          <div className="text-right">
            <div className="text-2xl font-bold leading-none tabular-nums">
              {activeCuisines.length}
            </div>
            <div className="text-[11px] text-muted-foreground">exploring</div>
          </div>
        </div>
      </div>

      {/* Active Explorations */}
      {activeCuisines.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Globe className="size-4" />
            Active Explorations
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeCuisines.map((cuisine) => {
              const exp = explorationMap.get(cuisine);
              const count = recipeCountMap.get(cuisine) ?? 0;
              const statusInfo =
                STATUS_LABELS[exp?.status ?? "NOT_STARTED"];
              const cuisineStyle =
                CUISINE_STYLES[cuisine] ?? CUISINE_STYLES.OTHER;

              return (
                <Link
                  key={cuisine}
                  href={`/explore/${cuisine}`}
                  className="group block"
                >
                  <Card className="transition-all duration-200 group-hover:ring-2 group-hover:ring-primary/20 group-hover:shadow-lg">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-12 items-center justify-center rounded-lg bg-muted/50 text-2xl">
                          {CUISINE_ICONS[cuisine]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                              {formatCuisine(cuisine)}
                            </h3>
                            <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <Badge
                              className={cn(
                                "border-0 text-[10px]",
                                statusInfo.color,
                              )}
                            >
                              {statusInfo.label}
                            </Badge>
                            {count > 0 && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <BookOpen className="size-3" />
                                {count} recipe{count !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* All Cuisines */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Compass className="size-4" />
          {activeCuisines.length > 0 ? "Discover More" : "All Cuisines"}
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <CuisineCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {inactiveCuisines.map((cuisine) => {
              const count = recipeCountMap.get(cuisine) ?? 0;
              const cuisineStyle =
                CUISINE_STYLES[cuisine] ?? CUISINE_STYLES.OTHER;

              return (
                <Link
                  key={cuisine}
                  href={`/explore/${cuisine}`}
                  className="group block"
                >
                  <Card className="transition-all duration-200 group-hover:ring-2 group-hover:ring-primary/20 group-hover:shadow-lg">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-muted/50 text-xl">
                          {CUISINE_ICONS[cuisine]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                              {formatCuisine(cuisine)}
                            </h3>
                            <ChevronRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge
                              className={cn(
                                "border-0 text-[10px]",
                                STATUS_LABELS.NOT_STARTED.color,
                              )}
                            >
                              Not Started
                            </Badge>
                            {count > 0 && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <BookOpen className="size-3" />
                                {count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
