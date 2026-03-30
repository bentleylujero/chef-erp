"use client";

import Link from "next/link";
import { Clock, Flame, Star, Users, ChefHat } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const CUISINE_STYLES: Record<string, string> = {
  FRENCH: "bg-blue-500/15 text-blue-400 dark:bg-blue-400/15 dark:text-blue-300",
  ITALIAN: "bg-red-500/15 text-red-400 dark:bg-red-400/15 dark:text-red-300",
  DELI: "bg-amber-500/15 text-amber-500 dark:bg-amber-400/15 dark:text-amber-300",
  MEXICAN: "bg-orange-500/15 text-orange-500 dark:bg-orange-400/15 dark:text-orange-300",
  MEDITERRANEAN: "bg-teal-500/15 text-teal-500 dark:bg-teal-400/15 dark:text-teal-300",
  JAPANESE: "bg-indigo-500/15 text-indigo-500 dark:bg-indigo-400/15 dark:text-indigo-300",
  THAI: "bg-pink-500/15 text-pink-500 dark:bg-pink-400/15 dark:text-pink-300",
  KOREAN: "bg-rose-500/15 text-rose-500 dark:bg-rose-400/15 dark:text-rose-300",
  CHINESE: "bg-red-600/15 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  INDIAN: "bg-yellow-500/15 text-yellow-600 dark:bg-yellow-400/15 dark:text-yellow-300",
  AMERICAN: "bg-sky-500/15 text-sky-500 dark:bg-sky-400/15 dark:text-sky-300",
  MIDDLE_EASTERN: "bg-amber-600/15 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  AFRICAN: "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300",
  CARIBBEAN: "bg-cyan-500/15 text-cyan-600 dark:bg-cyan-400/15 dark:text-cyan-300",
  SOUTHEAST_ASIAN: "bg-lime-500/15 text-lime-600 dark:bg-lime-400/15 dark:text-lime-300",
  FUSION: "bg-violet-500/15 text-violet-500 dark:bg-violet-400/15 dark:text-violet-300",
  OTHER: "bg-zinc-500/15 text-zinc-500 dark:bg-zinc-400/15 dark:text-zinc-400",
};

export const CUISINE_LABELS: Record<string, string> = {
  FRENCH: "French",
  ITALIAN: "Italian",
  DELI: "Deli",
  MEXICAN: "Mexican",
  MEDITERRANEAN: "Mediterranean",
  JAPANESE: "Japanese",
  THAI: "Thai",
  KOREAN: "Korean",
  CHINESE: "Chinese",
  INDIAN: "Indian",
  AMERICAN: "American",
  MIDDLE_EASTERN: "Middle Eastern",
  AFRICAN: "African",
  CARIBBEAN: "Caribbean",
  SOUTHEAST_ASIAN: "SE Asian",
  FUSION: "Fusion",
  OTHER: "Other",
};

export const SOURCE_LABELS: Record<string, string> = {
  AI_BATCH: "AI Generated",
  AI_SINGLE: "AI Crafted",
  AI_CHAT: "Chef Chat",
  AI_CUISINE_EXPLORE: "Exploration",
  AI_EXPIRY_RESCUE: "Rescue",
  AI_PREFERENCE_DRIFT: "Evolved",
  AI_INGREDIENT_FILL: "Pantry Fill",
  USER_CREATED: "Handmade",
  IMPORTED: "Imported",
};

export function formatTechnique(technique: string): string {
  return technique
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function formatCuisine(cuisine: string): string {
  return (
    CUISINE_LABELS[cuisine] ??
    cuisine
      .split("_")
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(" ")
  );
}

export function DifficultyStars({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Flame
          key={i}
          className={cn(
            "size-3",
            i < level
              ? "fill-orange-400 text-orange-400"
              : "text-muted-foreground/30",
          )}
        />
      ))}
    </div>
  );
}

export function MatchScoreRing({ score }: { score: number }) {
  const r = 16;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 75
      ? "text-emerald-400"
      : score >= 50
        ? "text-amber-400"
        : "text-red-400";

  return (
    <div className="relative size-11 shrink-0">
      <svg className="size-11 -rotate-90" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-muted-foreground/20"
        />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn("transition-all duration-500", color)}
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums",
          color,
        )}
      >
        {score}
      </span>
    </div>
  );
}

interface RecipeCardProps {
  recipe: {
    id: string;
    title: string;
    description: string;
    cuisine: string;
    difficulty: number;
    techniques: string[];
    prepTime: number;
    cookTime: number;
    servings: number;
    avgRating: number | null;
    totalCooks: number;
    source: string;
    tags: string[];
    createdAt: string;
  };
  matchScore?: number;
}

export function RecipeCard({ recipe, matchScore }: RecipeCardProps) {
  const cuisineStyle = CUISINE_STYLES[recipe.cuisine] ?? CUISINE_STYLES.OTHER;
  const cuisineLabel = formatCuisine(recipe.cuisine);
  const sourceLabel = SOURCE_LABELS[recipe.source] ?? recipe.source;
  const totalTime = recipe.prepTime + recipe.cookTime;

  return (
    <Link href={`/cookbook/${recipe.id}`} className="group/link block h-full">
      <Card className="h-full transition-all duration-200 group-hover/link:ring-2 group-hover/link:ring-primary/20 group-hover/link:shadow-lg">
        <CardHeader className="pb-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-heading text-sm font-semibold leading-snug line-clamp-1 group-hover/link:text-primary transition-colors">
                {recipe.title}
              </h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Badge className={cn("border-0 text-[10px]", cuisineStyle)}>
                  {cuisineLabel}
                </Badge>
                <DifficultyStars level={recipe.difficulty} />
              </div>
            </div>
            {matchScore !== undefined && <MatchScoreRing score={matchScore} />}
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5 pt-1">
          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
            {recipe.description}
          </p>

          {recipe.techniques.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {recipe.techniques.slice(0, 3).map((t) => (
                <Badge
                  key={t}
                  variant="outline"
                  className="h-4 px-1.5 py-0 text-[10px] font-normal"
                >
                  {formatTechnique(t)}
                </Badge>
              ))}
              {recipe.techniques.length > 3 && (
                <Badge
                  variant="outline"
                  className="h-4 px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
                >
                  +{recipe.techniques.length - 3}
                </Badge>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {totalTime}m
              </span>
              <span className="flex items-center gap-1">
                <Users className="size-3" />
                {recipe.servings}
              </span>
            </div>
            {recipe.avgRating != null && (
              <span className="flex items-center gap-1 font-medium">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                {recipe.avgRating.toFixed(1)}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border/50 pt-2">
            <Badge
              variant="secondary"
              className="h-4 px-1.5 py-0 text-[10px]"
            >
              {sourceLabel}
            </Badge>
            {recipe.totalCooks > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <ChefHat className="size-3" />
                {recipe.totalCooks} cook{recipe.totalCooks !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
