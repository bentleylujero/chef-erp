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
  Maximize2,
} from "lucide-react";
import { useRecipeDetail, type RecipeInstruction } from "@/hooks/use-recipes";
import { normalizeRecipeInstructions } from "@/lib/recipe-instructions";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function RecipeInstructionSteps({
  instructions,
  size = "default",
}: {
  instructions: RecipeInstruction[];
  size?: "default" | "focus";
}) {
  const isFocus = size === "focus";

  return (
    <ol className="list-none space-y-0 divide-y divide-border/60 pl-0">
      {instructions.map((inst, i) => (
        <li
          key={`instr-${inst.step}-${i}`}
          className={cn(
            "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-2 py-5 first:pt-0 last:pb-0",
            isFocus && "gap-x-5 gap-y-3 py-7 md:gap-x-6 md:py-8",
          )}
        >
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 font-semibold tabular-nums text-primary ring-1 ring-primary/15 md:h-10 md:w-10",
              isFocus &&
                "h-11 w-11 text-base md:h-14 md:w-14 md:text-lg",
            )}
            aria-hidden
          >
            {inst.step}
          </span>
          <div className="min-w-0 w-full max-w-full space-y-3">
            <p
              className={cn(
                "w-full max-w-full whitespace-normal text-pretty text-foreground [overflow-wrap:anywhere]",
                isFocus
                  ? "text-lg leading-[1.65] md:text-xl md:leading-relaxed"
                  : "text-base leading-[1.6] md:text-[1.0625rem]",
              )}
            >
              {inst.text?.trim() ? (
                inst.text
              ) : (
                <span className="italic text-muted-foreground">
                  No description for this step.
                </span>
              )}
            </p>
            {(inst.technique || inst.timing) && (
              <div className="flex flex-wrap items-center gap-2">
                {inst.technique && (
                  <Link
                    href={`/profile/techniques?focus=${encodeURIComponent(inst.technique)}`}
                    className="inline-flex max-w-full"
                  >
                    <Badge
                      variant="outline"
                      className="h-auto max-w-full whitespace-normal py-1.5 text-xs font-normal leading-snug hover:bg-muted"
                    >
                      {formatTechnique(inst.technique)}
                    </Badge>
                  </Link>
                )}
                {inst.timing && (
                  <Badge
                    variant="secondary"
                    className="h-auto max-w-full whitespace-normal py-1.5 text-xs leading-snug"
                  >
                    <Clock className="mr-1.5 size-3.5 shrink-0" />
                    {inst.timing}
                  </Badge>
                )}
              </div>
            )}
            {inst.notes && (
              <p
                className={cn(
                  "rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-pretty text-muted-foreground",
                  isFocus
                    ? "text-base leading-relaxed md:text-[1.0625rem]"
                    : "text-sm leading-relaxed",
                )}
              >
                {inst.notes}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

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
      <div className="grid gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="min-h-[20rem] rounded-xl" />
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
  const [instructionsFocusOpen, setInstructionsFocusOpen] = useState(false);

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

  const instructions = useMemo(
    () => normalizeRecipeInstructions(recipe?.instructions),
    [recipe?.instructions],
  );

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

  return (
    <div className="min-w-0 max-w-full space-y-6">
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

      {/* Ingredients (fixed-ish column) + instructions (uses remaining width) */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:items-start">
        {/* Ingredients */}
        <Card className="min-w-0 lg:max-w-md lg:justify-self-start">
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
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="space-y-3 border-b pb-3">
            <div className="flex flex-wrap items-center gap-2 gap-y-2">
              <CardTitle className="flex min-w-0 flex-1 items-center gap-2 text-base font-semibold">
                <UtensilsCrossed className="size-4 shrink-0" />
                <span className="truncate">Instructions</span>
              </CardTitle>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {instructions.length} steps
                </Badge>
                {instructions.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setInstructionsFocusOpen(true)}
                  >
                    <Maximize2 className="size-3.5" />
                    Expand
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="min-w-0 px-4 pt-2 pb-4 sm:px-6 sm:pt-4 sm:pb-6">
            {instructions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No steps yet for this recipe.
              </p>
            ) : (
              <RecipeInstructionSteps instructions={instructions} />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={instructionsFocusOpen}
        onOpenChange={setInstructionsFocusOpen}
      >
        <DialogContent
          showCloseButton
          className={cn(
            "!flex h-[min(100dvh-1rem,56rem)] w-[calc(100vw-1rem)] max-w-none !flex-col gap-0 overflow-hidden rounded-xl border border-border p-0 shadow-xl",
            "top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2",
            "sm:h-[min(100dvh-2rem,52rem)] sm:max-w-none sm:w-[min(42rem,calc(100vw-2rem))]",
            "md:w-[min(52rem,calc(100vw-2rem))]",
          )}
        >
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-5 py-4 pr-14 text-left">
            <DialogTitle className="pr-2 text-lg font-semibold leading-snug">
              {recipe.title}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Step-by-step — scroll to read. Press Esc or close when finished.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-4 sm:px-7 sm:py-6">
            {instructions.length > 0 && (
              <RecipeInstructionSteps
                instructions={instructions}
                size="focus"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Techniques — logged when you finish "Cook This" → Log & finish */}
      {recipe.techniques.length > 0 && (
        <div className="rounded-xl border bg-muted/20 px-4 py-3">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium text-foreground">
              Techniques used
            </h3>
            <Link
              href="/profile/techniques"
              className="text-xs text-primary underline-offset-4 hover:underline"
            >
              View mastery tracker
            </Link>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            Completing <strong className="font-medium text-foreground">Cook This</strong>{" "}
            and saving your cook logs each technique once per session on your{" "}
            <Link
              href="/profile/techniques"
              className="text-primary underline-offset-4 hover:underline"
            >
              Techniques
            </Link>{" "}
            page (times practiced and last cooked).
          </p>
          <div className="flex flex-wrap gap-2">
            {recipe.techniques.map((t) => (
              <Link
                key={t}
                href={`/profile/techniques?focus=${encodeURIComponent(t)}`}
                className="inline-flex"
              >
                <Badge
                  variant="outline"
                  className="cursor-pointer py-1 text-xs hover:bg-muted"
                >
                  {formatTechnique(t)}
                </Badge>
              </Link>
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
