"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  ChefHat,
  Loader2,
  Star,
  Timer,
  X,
} from "lucide-react";
import type { RecipeDetail } from "@/hooks/use-recipes";
import { useRecipeDetail } from "@/hooks/use-recipes";
import {
  parseTimingToSeconds,
  useCookingMode,
} from "@/hooks/use-cooking-mode";
import { formatTechnique } from "@/components/cookbook/recipe-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type CookingLogPayload = {
  recipeId: string;
  actualPrepTime?: number;
  actualCookTime?: number;
  servingsCooked?: number;
  notes?: string;
  rating?: number;
};

function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function CookingModeContent({
  recipe,
  logMutation,
}: {
  recipe: RecipeDetail;
  logMutation: UseMutationResult<unknown, Error, CookingLogPayload>;
}) {
  const cooking = useCookingMode(recipe);

  const {
    phase,
    miseItems,
    checkedMise,
    toggleMise,
    allMiseChecked,
    skipMiseValidation,
    setSkipMiseValidation,
    startCooking,
    sortedInstructions,
    currentStep,
    totalSteps,
    currentInstruction,
    goNext,
    goPrev,
    goToStep,
    timerSnapshots,
    startTimerForCurrentStep,
    dismissTimer,
    finishCooking,
    rating,
    setRating,
    actualPrepTime,
    setActualPrepTime,
    actualCookTime,
    setActualCookTime,
    servingsCooked,
    setServingsCooked,
    completionNotes,
    setCompletionNotes,
  } = cooking;

  const canStart =
    allMiseChecked || skipMiseValidation || miseItems.length === 0;
  const stepTimingSeconds = currentInstruction
    ? parseTimingToSeconds(currentInstruction.timing)
    : null;
  const isLastStep = totalSteps > 0 && currentStep >= totalSteps - 1;

  const handleLogFinish = () => {
    if (rating < 1 || rating > 5) return;
    const prep = parseInt(actualPrepTime, 10);
    const cook = parseInt(actualCookTime, 10);
    const servings = parseInt(servingsCooked, 10);
    logMutation.mutate({
      recipeId: recipe.id,
      rating,
      notes: completionNotes.trim() || undefined,
      ...(Number.isFinite(prep) ? { actualPrepTime: prep } : {}),
      ...(Number.isFinite(cook) ? { actualCookTime: cook } : {}),
      ...(Number.isFinite(servings) ? { servingsCooked: servings } : {}),
    });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-zinc-950 text-zinc-50">
      {/* Timer rail */}
      {timerSnapshots.length > 0 && (
        <div className="sticky top-0 z-40 border-b border-amber-500/30 bg-zinc-900/95 shadow-lg backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl flex-wrap items-stretch gap-2 px-3 py-3 md:gap-3 md:px-6">
            {timerSnapshots.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "flex min-w-[140px] flex-1 items-center justify-between gap-3 rounded-xl border px-4 py-3 md:min-w-[200px]",
                  t.remainingSeconds === 0
                    ? "border-amber-400 bg-amber-500/20"
                    : "border-zinc-700 bg-zinc-800/80",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium uppercase tracking-wide text-amber-200/90">
                    Step {sortedInstructions[t.stepIndex]?.step ?? t.stepIndex + 1}
                  </p>
                  <p className="truncate text-sm text-zinc-400">{t.label}</p>
                  <p
                    className={cn(
                      "font-mono text-3xl font-bold tabular-nums tracking-tight md:text-4xl",
                      t.remainingSeconds === 0
                        ? "text-amber-300"
                        : "text-zinc-50",
                    )}
                  >
                    {formatCountdown(t.remainingSeconds)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-12 shrink-0 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                  onClick={() => dismissTimer(t.id)}
                  aria-label="Dismiss timer"
                >
                  <X className="size-6" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href={`/cookbook/${recipe.id}`}
              className="mb-3 inline-flex items-center gap-2 text-sm text-amber-200/80 hover:text-amber-100"
            >
              <ArrowLeft className="size-4" />
              Recipe
            </Link>
            <div className="flex items-center gap-3">
              <ChefHat className="size-10 shrink-0 text-amber-400 md:size-12" />
              <div>
                <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
                  {recipe.title}
                </h1>
                <p className="mt-1 text-lg text-zinc-400 md:text-xl">
                  Cooking mode
                </p>
              </div>
            </div>
          </div>
          {phase !== "complete" && (
            <Badge
              variant="outline"
              className="h-10 self-start border-amber-500/40 bg-amber-500/10 px-4 text-base text-amber-100"
            >
              {phase === "mise" ? "Mise en place" : "On the line"}
            </Badge>
          )}
        </header>

        {/* Phase 1 */}
        {phase === "mise" && (
          <section className="space-y-8">
            <p className="text-xl leading-relaxed text-zinc-300 md:text-2xl">
              Check off everything before you touch the heat. Large type so you
              can read it from across the kitchen.
            </p>
            <ul className="space-y-4">
              {miseItems.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 md:gap-6 md:p-7"
                >
                  <div className="pt-1">
                    <Checkbox
                      checked={checkedMise[item.id] ?? false}
                      onCheckedChange={(v) =>
                        toggleMise(item.id, v === true)
                      }
                      className="size-9 rounded-md border-2 border-zinc-500 data-checked:border-amber-400 data-checked:bg-amber-500"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-2xl font-medium leading-snug md:text-3xl">
                      {item.label}
                    </p>
                    {item.detail && (
                      <p className="text-lg leading-relaxed text-zinc-400 md:text-xl">
                        {item.detail}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-zinc-600 bg-zinc-900/40 p-6 md:flex-row md:items-center md:justify-between">
              <label className="flex cursor-pointer items-center gap-4 text-lg text-zinc-300 md:text-xl">
                <Checkbox
                  checked={skipMiseValidation}
                  onCheckedChange={(v) => setSkipMiseValidation(v === true)}
                  className="size-8 rounded-md border-2 border-zinc-500"
                />
                <span>I’m already prepped — skip checklist</span>
              </label>
              <Button
                type="button"
                size="lg"
                disabled={!canStart}
                onClick={startCooking}
                className="h-16 min-w-[200px] bg-amber-500 text-lg font-semibold text-zinc-950 hover:bg-amber-400 md:h-20 md:min-w-[280px] md:text-xl"
              >
                Start cooking
                <ArrowRight className="ml-2 size-6" />
              </Button>
            </div>
          </section>
        )}

        {/* Phase 2 */}
        {phase === "cooking" && currentInstruction && (
          <section className="space-y-10">
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
              {sortedInstructions.map((_, i) => (
                <button
                  key={sortedInstructions[i].step}
                  type="button"
                  onClick={() => goToStep(i)}
                  className={cn(
                    "size-4 rounded-full transition-all md:size-5",
                    i === currentStep
                      ? "scale-125 bg-amber-400 ring-4 ring-amber-400/30"
                      : "bg-zinc-600 hover:bg-zinc-500",
                  )}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl md:p-12">
              <p className="text-center text-xl font-medium text-amber-200/90 md:text-2xl">
                Step {currentInstruction.step} of{" "}
                {sortedInstructions[sortedInstructions.length - 1]?.step ??
                  totalSteps}
              </p>
              <p className="mx-auto mt-8 max-w-4xl text-center text-[1.35rem] leading-relaxed md:text-3xl md:leading-relaxed">
                {currentInstruction.text}
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                {currentInstruction.technique && (
                  <Badge className="h-10 border-0 bg-zinc-800 px-4 text-base text-zinc-100">
                    {formatTechnique(currentInstruction.technique)}
                  </Badge>
                )}
                {stepTimingSeconds != null && stepTimingSeconds > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 min-w-[160px] border-amber-500/50 bg-amber-500/10 text-lg text-amber-100 hover:bg-amber-500/20"
                    onClick={startTimerForCurrentStep}
                  >
                    <Timer className="mr-2 size-5" />
                    Start timer
                  </Button>
                )}
              </div>

              {currentInstruction.notes?.trim() && (
                <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-zinc-700 bg-zinc-950/80 p-5 md:p-7">
                  <p className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                    Notes
                  </p>
                  <p className="mt-2 text-lg text-zinc-300 md:text-xl">
                    {currentInstruction.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={goPrev}
                disabled={currentStep === 0}
                className="h-16 min-h-[4rem] flex-1 border-zinc-600 bg-zinc-900 text-lg text-zinc-100 hover:bg-zinc-800 md:text-xl"
              >
                <ArrowLeft className="mr-2 size-6" />
                Previous
              </Button>
              {isLastStep ? (
                <Button
                  type="button"
                  size="lg"
                  onClick={finishCooking}
                  className="h-16 min-h-[4rem] flex-1 bg-amber-500 text-lg font-semibold text-zinc-950 hover:bg-amber-400 md:text-xl"
                >
                  Complete
                  <ArrowRight className="ml-2 size-6" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  onClick={goNext}
                  className="h-16 min-h-[4rem] flex-1 bg-zinc-100 text-lg font-semibold text-zinc-950 hover:bg-white md:text-xl"
                >
                  Next step
                  <ArrowRight className="ml-2 size-6" />
                </Button>
              )}
            </div>
          </section>
        )}

        {phase === "cooking" && !currentInstruction && (
          <p className="text-center text-xl text-zinc-400">
            This recipe has no instructions.{" "}
            <Button
              type="button"
              variant="link"
              className="text-amber-300"
              onClick={finishCooking}
            >
              Finish
            </Button>
          </p>
        )}

        {/* Phase 3 */}
        {phase === "complete" && (
          <section className="mx-auto max-w-2xl space-y-10">
            <h2 className="text-center text-3xl font-semibold md:text-4xl">
              How did it go?
            </h2>

            <div className="space-y-3">
              <Label className="text-lg text-zinc-300">Rating</Label>
              <div className="flex justify-center gap-3 md:gap-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className="rounded-xl p-2 transition-transform hover:scale-110 active:scale-95"
                    aria-label={`${n} stars`}
                  >
                    <Star
                      className={cn(
                        "size-12 md:size-14",
                        n <= rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-zinc-600",
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="prep" className="text-lg text-zinc-300">
                  Actual prep (minutes)
                </Label>
                <Input
                  id="prep"
                  inputMode="numeric"
                  value={actualPrepTime}
                  onChange={(e) => setActualPrepTime(e.target.value)}
                  className="h-14 border-zinc-600 bg-zinc-900 text-xl text-zinc-50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cook" className="text-lg text-zinc-300">
                  Actual cook (minutes)
                </Label>
                <Input
                  id="cook"
                  inputMode="numeric"
                  value={actualCookTime}
                  onChange={(e) => setActualCookTime(e.target.value)}
                  className="h-14 border-zinc-600 bg-zinc-900 text-xl text-zinc-50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="servings" className="text-lg text-zinc-300">
                Servings cooked
              </Label>
              <Input
                id="servings"
                inputMode="numeric"
                value={servingsCooked}
                onChange={(e) => setServingsCooked(e.target.value)}
                className="h-14 border-zinc-600 bg-zinc-900 text-xl text-zinc-50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-lg text-zinc-300">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                rows={5}
                className="resize-none border-zinc-600 bg-zinc-900 text-lg text-zinc-50 md:text-xl"
                placeholder="Adjustments, wins, ideas for next time…"
              />
            </div>

            {logMutation.isError && (
              <p className="text-center text-lg text-red-400">
                {logMutation.error.message}
              </p>
            )}

            <Button
              type="button"
              size="lg"
              disabled={rating < 1 || logMutation.isPending}
              onClick={handleLogFinish}
              className="min-h-[4.5rem] w-full bg-amber-500 py-7 text-xl font-semibold text-zinc-950 hover:bg-amber-400"
            >
              {logMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-6 animate-spin" />
                  Saving…
                </>
              ) : (
                "Log & finish"
              )}
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}

export default function CookingModePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: recipe, isLoading, error } = useRecipeDetail(id);

  const logMutation = useMutation({
    mutationFn: async (body: CookingLogPayload) => {
      const res = await fetch("/api/cooking-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          typeof err.error === "string"
            ? err.error
            : "Failed to log session",
        );
      }
      return res.json();
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["recipe", variables.recipeId] });
      await queryClient.invalidateQueries({ queryKey: ["recipes"] });
      router.push(`/cookbook/${variables.recipeId}`);
    },
  });

  if (isLoading || !id) {
    return (
      <div className="min-h-[70vh] space-y-4 p-4 md:p-6">
        <Skeleton className="h-12 w-2/3 max-w-md" />
        <Skeleton className="h-96 w-full max-w-3xl rounded-2xl" />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg text-muted-foreground">
          Could not load this recipe.
        </p>
        <Link
          href="/cookbook"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          Back to cookbook
        </Link>
      </div>
    );
  }

  return <CookingModeContent recipe={recipe} logMutation={logMutation} />;
}
