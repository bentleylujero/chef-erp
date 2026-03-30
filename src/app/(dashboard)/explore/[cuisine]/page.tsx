"use client";

import { use, useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  ShoppingCart,
  Check,
  ChevronRight,
  Flame,
  BookOpen,
  Package,
  Route,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  formatCuisine,
  formatTechnique,
  CUISINE_STYLES,
} from "@/components/cookbook/recipe-card";

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

const STATUS_INFO: Record<
  string,
  { label: string; color: string; progress: number }
> = {
  NOT_STARTED: { label: "Not Started", color: "bg-muted text-muted-foreground", progress: 0 },
  STOCKING_PANTRY: { label: "Stocking Pantry", color: "bg-amber-500/15 text-amber-400", progress: 20 },
  LEARNING_BASICS: { label: "Learning Basics", color: "bg-blue-500/15 text-blue-400", progress: 40 },
  INTERMEDIATE: { label: "Intermediate", color: "bg-violet-500/15 text-violet-400", progress: 70 },
  COMFORTABLE: { label: "Comfortable", color: "bg-emerald-500/15 text-emerald-400", progress: 100 },
};

interface StarterItem {
  id: string;
  ingredientId: string;
  priority: string;
  purchased: boolean;
  description: string | null;
  ingredient: { id: string; name: string; category: string };
}

interface PantryKitItem {
  name: string;
  category: string;
  description: string;
  substitutes: string[];
}

interface TechniquePathItem {
  technique: string;
  order: number;
  bridgeNote: string;
  keyDishes: string[];
  difficulty: number;
}

interface RecipeLadderItem {
  title: string;
  difficulty: number;
  description: string;
  keyIngredients: string[];
  keyTechnique: string;
  accessibilityNote: string;
}

interface ExplorationData {
  id: string;
  cuisine: string;
  status: string;
  recipesCompleted: number;
  starterKitData: PantryKitItem[] | null;
  techniquePathData: TechniquePathItem[] | null;
  starterItems: StarterItem[];
  recipeLadder?: RecipeLadderItem[];
}

interface ProfileData {
  techniqueLogs: Array<{ technique: string; comfortLevel: number }>;
  cookingStyle: {
    primaryCuisines: string[];
    preferredTechniques: string[];
  } | null;
}

function useCuisineExploration(cuisine: string) {
  return useQuery<ExplorationData | null>({
    queryKey: ["cuisine-exploration", cuisine],
    queryFn: async () => {
      const res = await fetch("/api/ai/cuisine-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuisine }),
      });
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return res.json();
    },
    enabled: false,
  });
}

function useProfile() {
  return useQuery<ProfileData>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
  });
}

function DifficultyDots({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Flame
          key={i}
          className={cn(
            "size-3",
            i < level
              ? "fill-orange-400 text-orange-400"
              : "text-muted-foreground/20",
          )}
        />
      ))}
    </div>
  );
}

function PantrySection({
  starterItems,
  pantryKit,
}: {
  starterItems: StarterItem[];
  pantryKit: PantryKitItem[] | null;
}) {
  const items = starterItems.length > 0 ? starterItems : [];
  const purchased = items.filter((i) => i.purchased).length;
  const total = items.length;

  const kitItems = pantryKit ?? [];

  const priorityOrder = { ESSENTIAL: 0, RECOMMENDED: 1, NICE_TO_HAVE: 2 };
  const sortedKit = [...kitItems].sort(
    (a, b) =>
      (priorityOrder[a.category as keyof typeof priorityOrder] ?? 2) -
      (priorityOrder[b.category as keyof typeof priorityOrder] ?? 2),
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="size-4" />
            Pantry Starter Kit
          </CardTitle>
          {total > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {purchased}/{total} purchased
            </Badge>
          )}
        </div>
        {total > 0 && (
          <Progress value={(purchased / total) * 100} className="h-1.5 mt-2" />
        )}
      </CardHeader>
      <CardContent>
        {sortedKit.length > 0 ? (
          <div className="space-y-1">
            {sortedKit.map((item, idx) => {
              const matchedStarter = items.find(
                (s) =>
                  s.ingredient.name.toLowerCase() ===
                  item.name.toLowerCase(),
              );
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
                    matchedStarter?.purchased && "bg-emerald-500/5",
                  )}
                >
                  <Checkbox
                    checked={matchedStarter?.purchased ?? false}
                    disabled
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">
                        {item.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] border-0",
                          item.category === "ESSENTIAL" &&
                            "bg-red-500/10 text-red-400",
                          item.category === "RECOMMENDED" &&
                            "bg-amber-500/10 text-amber-400",
                          item.category === "NICE_TO_HAVE" &&
                            "bg-muted text-muted-foreground",
                        )}
                      >
                        {item.category === "NICE_TO_HAVE"
                          ? "Nice to Have"
                          : item.category === "ESSENTIAL"
                            ? "Essential"
                            : "Recommended"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.description}
                    </p>
                    {item.substitutes.length > 0 && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                        Substitutes: {item.substitutes.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Generate a starter kit to see ingredient recommendations.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TechniquePathSection({
  techniques,
  userTechniques,
}: {
  techniques: TechniquePathItem[];
  userTechniques: Map<string, number>;
}) {
  if (techniques.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Route className="size-4" />
            Technique Progression
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Generate a starter kit to see technique progression.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sorted = [...techniques].sort((a, b) => a.order - b.order);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Route className="size-4" />
          Technique Progression
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {sorted.map((tech, idx) => {
            const normalizedTechnique = tech.technique
              .toUpperCase()
              .replace(/\s+/g, "_");
            const comfort = userTechniques.get(normalizedTechnique) ?? 0;
            const mastered = comfort >= 3;
            const isLast = idx === sorted.length - 1;

            return (
              <div key={idx} className="relative flex gap-4 pb-6">
                {!isLast && (
                  <div className="absolute left-[15px] top-8 h-[calc(100%-16px)] w-px bg-border" />
                )}
                <div
                  className={cn(
                    "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                    mastered
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                      : "border-muted-foreground/30 bg-background text-muted-foreground",
                  )}
                >
                  {mastered ? (
                    <Check className="size-4" />
                  ) : (
                    tech.order
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">
                      {tech.technique}
                    </h4>
                    <DifficultyDots level={tech.difficulty} />
                    {mastered && (
                      <Badge className="border-0 bg-emerald-500/10 text-emerald-400 text-[9px]">
                        Mastered
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tech.bridgeNote}
                  </p>
                  {tech.keyDishes.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {tech.keyDishes.map((dish) => (
                        <Badge
                          key={dish}
                          variant="outline"
                          className="text-[10px] font-normal"
                        >
                          {dish}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function RecipeLadderSection({
  recipes,
}: {
  recipes: RecipeLadderItem[];
}) {
  if (recipes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4" />
            Recipe Ladder
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Generate a starter kit to see recommended recipes.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="size-4" />
          Recipe Ladder
          <Badge variant="secondary" className="text-[10px]">
            {recipes.length} recipes
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {recipes.map((recipe, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30"
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold tabular-nums">
                {idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">{recipe.title}</h4>
                  <DifficultyDots level={recipe.difficulty} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {recipe.description}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="text-[9px] font-normal"
                  >
                    {recipe.keyTechnique}
                  </Badge>
                  {recipe.keyIngredients.slice(0, 3).map((ing) => (
                    <span
                      key={ing}
                      className="text-[10px] text-muted-foreground"
                    >
                      {ing}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground/70 italic">
                  {recipe.accessibilityNote}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CuisineDetailPage({
  params,
}: {
  params: Promise<{ cuisine: string }>;
}) {
  const { cuisine } = use(params);
  const decodedCuisine = decodeURIComponent(cuisine);
  const queryClient = useQueryClient();
  const [hasGenerated, setHasGenerated] = useState(false);

  const { data: profile } = useProfile();

  const {
    data: exploration,
    isLoading: expLoading,
    refetch: fetchExploration,
  } = useQuery<ExplorationData | null>({
    queryKey: ["cuisine-exploration", decodedCuisine],
    queryFn: async () => {
      const res = await fetch("/api/ai/cuisine-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuisine: decodedCuisine }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: hasGenerated,
  });

  const generateKit = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/cuisine-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuisine: decodedCuisine }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["cuisine-exploration", decodedCuisine],
        data,
      );
      setHasGenerated(true);
      toast.success("Cuisine kit generated!");
    },
    onError: () => {
      toast.error("Failed to generate cuisine kit");
    },
  });

  const userTechniqueMap = new Map<string, number>();
  if (profile?.techniqueLogs) {
    for (const log of profile.techniqueLogs) {
      const existing = userTechniqueMap.get(log.technique) ?? 0;
      if (log.comfortLevel > existing) {
        userTechniqueMap.set(log.technique, log.comfortLevel);
      }
    }
  }

  const icon = CUISINE_ICONS[decodedCuisine] ?? "🍽️";
  const cuisineStyle =
    CUISINE_STYLES[decodedCuisine] ?? CUISINE_STYLES.OTHER;
  const status = exploration?.status ?? "NOT_STARTED";
  const statusInfo = STATUS_INFO[status] ?? STATUS_INFO.NOT_STARTED;
  const hasData =
    exploration?.starterKitData || exploration?.techniquePathData;

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/explore"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Back to Explorer
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-xl bg-muted/50 text-4xl">
            {icon}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {formatCuisine(decodedCuisine)}
            </h1>
            <div className="mt-1.5 flex items-center gap-2">
              <Badge className={cn("border-0", statusInfo.color)}>
                {statusInfo.label}
              </Badge>
              {exploration && (
                <span className="text-xs text-muted-foreground">
                  {exploration.recipesCompleted} recipes completed
                </span>
              )}
            </div>
          </div>
        </div>

        {!hasData && (
          <Button
            onClick={() => generateKit.mutate()}
            disabled={generateKit.isPending}
            className="shrink-0"
          >
            {generateKit.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" />
                Start Exploring
              </>
            )}
          </Button>
        )}
      </div>

      {/* Progress Bar */}
      {hasData && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Exploration Progress</span>
            <span className="font-medium">{statusInfo.progress}%</span>
          </div>
          <Progress value={statusInfo.progress} className="h-2" />
        </div>
      )}

      {/* Loading State */}
      {generateKit.isPending && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Loader2 className="size-10 animate-spin text-primary mb-4" />
          <h3 className="text-lg font-semibold">
            Crafting Your {formatCuisine(decodedCuisine)} Exploration Kit
          </h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Our AI is analyzing your cooking style and building a personalized
            starter kit with ingredients, techniques, and recipes...
          </p>
        </div>
      )}

      {/* Empty State */}
      {!hasData && !generateKit.isPending && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
          <div className="text-5xl mb-4">{icon}</div>
          <h3 className="text-lg font-semibold">
            Ready to Explore {formatCuisine(decodedCuisine)} Cuisine?
          </h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Generate an AI-powered starter kit with essential ingredients,
            a technique progression path, and a recipe ladder from
            accessible to advanced.
          </p>
          <Button
            onClick={() => generateKit.mutate()}
            className="mt-6"
            size="lg"
          >
            <Sparkles className="mr-2 size-4" />
            Generate Starter Kit
          </Button>
        </div>
      )}

      {/* Content */}
      {hasData && !generateKit.isPending && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <PantrySection
              starterItems={exploration?.starterItems ?? []}
              pantryKit={
                exploration?.starterKitData as PantryKitItem[] | null
              }
            />
          </div>
          <div className="space-y-6">
            <TechniquePathSection
              techniques={
                (exploration?.techniquePathData as TechniquePathItem[]) ??
                []
              }
              userTechniques={userTechniqueMap}
            />
            <RecipeLadderSection
              recipes={
                (exploration?.recipeLadder as RecipeLadderItem[]) ?? []
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
