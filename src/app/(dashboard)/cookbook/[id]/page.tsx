"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Users,
  Star,
  Flame,
  ChefHat,
  Minus,
  Plus,
  CalendarPlus,
  UtensilsCrossed,
  ShoppingCart,
  Check,
  Info,
} from "lucide-react";
import { useRecipeDetail } from "@/hooks/use-recipes";
import { useInventory } from "@/hooks/use-inventory";
import { scaleRecipe } from "@/lib/engines/recipe-scaler";
import { formatQuantity } from "@/lib/utils/units";
import {
  CUISINE_STYLES,
  SOURCE_LABELS,
  DifficultyStars,
  formatCuisine,
  formatTechnique,
} from "@/components/cookbook/recipe-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-2/3" />
        <div className="mt-2 flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
      <div className="flex gap-6">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

function FlavorBar({
  label,
  value,
  max = 10,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const color =
    pct >= 70
      ? "bg-orange-400"
      : pct >= 40
        ? "bg-amber-400"
        : "bg-emerald-400";

  return (
    <div className="flex items-center gap-3">
      <span className="w-14 text-right text-xs capitalize text-muted-foreground">
        {label}
      </span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">
        {value}
      </span>
    </div>
  );
}

export default function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: recipe, isLoading, error } = useRecipeDetail(id);
  const { data: inventory } = useInventory();
  const [targetServings, setTargetServings] = useState<number | null>(null);

  const servings = targetServings ?? recipe?.servings ?? 4;

  const pantryIngredientIds = useMemo(
    () => new Set(inventory?.map((item) => item.ingredientId) ?? []),
    [inventory],
  );

  const scaledIngredients = useMemo(() => {
    if (!recipe) return [];
    return scaleRecipe(
      recipe.ingredients.map((ri) => ({
        quantity: ri.quantity,
        unit: ri.unit,
        name: ri.ingredient.name,
      })),
      recipe.servings,
      servings,
    );
  }, [recipe, servings]);

  const enrichedIngredients = useMemo(() => {
    if (!recipe) return [];
    return recipe.ingredients.map((ri, i) => ({
      ...ri,
      scaled: scaledIngredients[i],
      inPantry: pantryIngredientIds.has(ri.ingredientId),
    }));
  }, [recipe, scaledIngredients, pantryIngredientIds]);

  const flavorEntries = useMemo(() => {
    if (!recipe?.flavorTags) return [];
    return Object.entries(recipe.flavorTags as Record<string, number>)
      .filter(([, v]) => typeof v === "number" && v > 0)
      .sort(([, a], [, b]) => b - a);
  }, [recipe]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link
          href="/cookbook"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="size-4" />
          Back to Cookbook
        </Link>
        <DetailSkeleton />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="space-y-6">
        <Link
          href="/cookbook"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="size-4" />
          Back to Cookbook
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Info className="size-10 text-muted-foreground/50 mb-3" />
          <h2 className="text-lg font-semibold">Recipe not found</h2>
          <p className="text-sm text-muted-foreground mt-1">
            This recipe may have been archived or doesn&apos;t exist.
          </p>
        </div>
      </div>
    );
  }

  const cuisineStyle = CUISINE_STYLES[recipe.cuisine] ?? CUISINE_STYLES.OTHER;
  const sourceLabel = SOURCE_LABELS[recipe.source] ?? recipe.source;
  const totalTime = recipe.prepTime + recipe.cookTime;
  const instructions = (recipe.instructions ?? []) as Array<{
    step: number;
    technique?: string;
    timing?: string;
    notes?: string;
    text: string;
  }>;

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <Link
        href="/cookbook"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft className="size-4" />
        Back to Cookbook
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {recipe.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {recipe.description}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge className={cn("border-0", cuisineStyle)}>
            {formatCuisine(recipe.cuisine)}
          </Badge>
          <DifficultyStars level={recipe.difficulty} />
          <Badge variant="secondary" className="text-xs">
            {sourceLabel}
          </Badge>
          {recipe.avgRating != null && (
            <span className="flex items-center gap-1 text-sm">
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              <span className="font-medium">{recipe.avgRating.toFixed(1)}</span>
              <span className="text-muted-foreground">
                ({recipe.ratings.length})
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm">
          <Clock className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">Prep</span>
          <span className="font-medium">{recipe.prepTime}m</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <Flame className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">Cook</span>
          <span className="font-medium">{recipe.cookTime}m</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <Clock className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">Total</span>
          <span className="font-medium">{totalTime}m</span>
        </div>
        <Separator orientation="vertical" className="!h-5 hidden sm:block" />
        <div className="flex items-center gap-2 text-sm">
          <Users className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">Servings</span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() =>
                setTargetServings(Math.max(1, servings - 1))
              }
              disabled={servings <= 1}
            >
              <Minus className="size-3" />
            </Button>
            <span className="w-7 text-center font-mono text-sm font-bold tabular-nums">
              {servings}
            </span>
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() =>
                setTargetServings(
                  Math.min(recipe.servings * 10, servings + 1),
                )
              }
            >
              <Plus className="size-3" />
            </Button>
          </div>
          {servings !== recipe.servings && (
            <Badge variant="outline" className="text-[10px]">
              {(servings / recipe.servings).toFixed(1)}x
            </Badge>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Ingredients */}
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShoppingCart className="size-4" />
              Ingredients
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {enrichedIngredients.length} items
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <ul className="space-y-1">
              {enrichedIngredients.map((ing) => (
                <li
                  key={ing.id}
                  className={cn(
                    "flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    ing.inPantry
                      ? "bg-emerald-500/8"
                      : "bg-amber-500/8",
                  )}
                >
                  <span className="mt-0.5 shrink-0">
                    {ing.inPantry ? (
                      <Check className="size-3.5 text-emerald-500" />
                    ) : (
                      <ShoppingCart className="size-3.5 text-amber-500" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-medium">
                        {ing.scaled?.displayQuantity ??
                          formatQuantity(ing.quantity, ing.unit)}
                      </span>
                      <span>{ing.ingredient.name}</span>
                      {ing.isOptional && (
                        <Badge
                          variant="outline"
                          className="h-3.5 px-1 text-[9px] font-normal text-muted-foreground"
                        >
                          optional
                        </Badge>
                      )}
                    </div>
                    {ing.prepNote && (
                      <p className="text-xs text-muted-foreground italic">
                        {ing.prepNote}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {enrichedIngredients.length > 0 && (
              <div className="mt-3 flex items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Check className="size-3 text-emerald-500" />
                  In pantry
                </span>
                <span className="flex items-center gap-1">
                  <ShoppingCart className="size-3 text-amber-500" />
                  Need to buy
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <UtensilsCrossed className="size-4" />
              Instructions
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {instructions.length} steps
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <ol className="space-y-4">
              {instructions.map((inst, i) => (
                <li key={inst.step ?? i} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {inst.step ?? i + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-sm leading-relaxed">{inst.text}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {inst.technique && (
                        <Badge
                          variant="outline"
                          className="h-4 px-1.5 text-[10px] font-normal"
                        >
                          {formatTechnique(inst.technique)}
                        </Badge>
                      )}
                      {inst.timing && (
                        <Badge
                          variant="secondary"
                          className="h-4 px-1.5 text-[10px]"
                        >
                          <Clock className="mr-0.5 size-2.5" />
                          {inst.timing}
                        </Badge>
                      )}
                    </div>
                    {inst.notes && (
                      <p className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
                        {inst.notes}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* Flavor profile */}
      {flavorEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Flavor Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {flavorEntries.map(([key, value]) => (
                <FlavorBar key={key} label={key} value={value} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/cook/${recipe.id}`}
          className={buttonVariants({ variant: "default" })}
        >
          <ChefHat className="size-4" />
          Cook This
        </Link>
        <Button variant="outline">
          <CalendarPlus className="size-4" />
          Add to Meal Plan
        </Button>
        <Button variant="outline">
          <Star className="size-4" />
          Rate This Recipe
        </Button>
      </div>

      {/* Techniques */}
      {recipe.techniques.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Techniques Used
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {recipe.techniques.map((t) => (
              <Badge key={t} variant="outline">
                {formatTechnique(t)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {recipe.tags.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Tags
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {recipe.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Variants */}
      {recipe.variants.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Variations
          </h3>
          <div className="flex flex-wrap gap-2">
            {recipe.variants.map((v) => (
              <Link key={v.id} href={`/cookbook/${v.id}`}>
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                >
                  {v.title}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
