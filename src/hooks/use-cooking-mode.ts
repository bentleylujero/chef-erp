"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RecipeDetail, RecipeInstruction } from "@/hooks/use-recipes";
import { normalizeRecipeInstructions } from "@/lib/recipe-instructions";
import { formatQuantity } from "@/lib/utils/units";

export type CookingPhase = "mise" | "cooking" | "complete";

export type MiseItemSource = "ingredient" | "instruction";

export interface MiseItem {
  id: string;
  source: MiseItemSource;
  label: string;
  detail?: string;
}

export interface KitchenTimer {
  id: string;
  stepIndex: number;
  label: string;
  totalSeconds: number;
  /** Wall-clock expiry for stable countdowns */
  expiresAt: number;
  done: boolean;
}

function buildMiseItems(recipe: RecipeDetail): MiseItem[] {
  const items: MiseItem[] = [];

  for (const ri of recipe.ingredients) {
    const name = ri.ingredient.name;
    const qty = formatQuantity(ri.quantity, ri.unit);
    const base = ri.prepNote?.trim()
      ? `${name} — ${ri.prepNote.trim()}`
      : `${qty} ${name}`;
    items.push({
      id: `ing-${ri.id}`,
      source: "ingredient",
      label: base,
      detail: ri.prepNote?.trim()
        ? `${qty} · ${ri.isOptional ? "optional" : "required"}`
        : undefined,
    });
  }

  const steps = normalizeRecipeInstructions(recipe.instructions);
  steps.forEach((step, i) => {
    items.push({
      id: `instruction-step-${i}`,
      source: "instruction",
      label: `Step ${step.step}`,
      detail: step.text?.trim() || undefined,
    });
  });

  return items;
}

/** Parse human-readable timing strings into seconds */
export function parseTimingToSeconds(timing: string | undefined | null): number | null {
  if (!timing?.trim()) return null;
  const t = timing.toLowerCase();
  let seconds = 0;
  const hr = t.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/);
  const min = t.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/);
  const sec = t.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)\b/);
  if (hr) seconds += Math.round(parseFloat(hr[1]) * 3600);
  if (min) seconds += Math.round(parseFloat(min[1]) * 60);
  if (sec) seconds += Math.round(parseFloat(sec[1]));
  if (seconds > 0) return seconds;
  const bareMin = t.match(/^(\d+)\s*$/);
  if (bareMin) return parseInt(bareMin[1], 10) * 60;
  return null;
}

export interface UseCookingModeResult {
  phase: CookingPhase;
  miseItems: MiseItem[];
  checkedMise: Record<string, boolean>;
  toggleMise: (id: string, checked: boolean) => void;
  allMiseChecked: boolean;
  skipMiseValidation: boolean;
  setSkipMiseValidation: (v: boolean) => void;
  startCooking: () => void;

  sortedInstructions: RecipeInstruction[];
  currentStep: number;
  totalSteps: number;
  currentInstruction: RecipeInstruction | null;
  goNext: () => void;
  goPrev: () => void;
  goToStep: (index: number) => void;

  timerSnapshots: Array<
    KitchenTimer & { remainingSeconds: number }
  >;
  startTimerForCurrentStep: () => void;
  dismissTimer: (id: string) => void;

  finishCooking: () => void;

  rating: number;
  setRating: (n: number) => void;
  actualPrepTime: string;
  setActualPrepTime: (v: string) => void;
  actualCookTime: string;
  setActualCookTime: (v: string) => void;
  servingsCooked: string;
  setServingsCooked: (v: string) => void;
  completionNotes: string;
  setCompletionNotes: (v: string) => void;
}

export function useCookingMode(recipe: RecipeDetail): UseCookingModeResult {
  const miseItems = useMemo(() => buildMiseItems(recipe), [recipe]);

  const sortedInstructions = useMemo(
    () => normalizeRecipeInstructions(recipe.instructions),
    [recipe.instructions],
  );

  const [phase, setPhase] = useState<CookingPhase>("mise");
  const [checkedMise, setCheckedMise] = useState<Record<string, boolean>>({});
  const [skipMiseValidation, setSkipMiseValidation] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [timers, setTimers] = useState<KitchenTimer[]>([]);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const [rating, setRating] = useState(0);
  const [actualPrepTime, setActualPrepTime] = useState(
    String(recipe.prepTime ?? ""),
  );
  const [actualCookTime, setActualCookTime] = useState(
    String(recipe.cookTime ?? ""),
  );
  const [servingsCooked, setServingsCooked] = useState(
    String(recipe.servings ?? ""),
  );
  const [completionNotes, setCompletionNotes] = useState("");

  useEffect(() => {
    setPhase("mise");
    setCheckedMise({});
    setSkipMiseValidation(false);
    setCurrentStep(0);
    setTimers([]);
    setRating(0);
    setActualPrepTime(String(recipe.prepTime ?? ""));
    setActualCookTime(String(recipe.cookTime ?? ""));
    setServingsCooked(String(recipe.servings ?? ""));
    setCompletionNotes("");
  }, [recipe.id, recipe.prepTime, recipe.cookTime, recipe.servings]);

  const allMiseChecked = useMemo(() => {
    if (miseItems.length === 0) return true;
    return miseItems.every((m) => checkedMise[m.id]);
  }, [miseItems, checkedMise]);

  const toggleMise = useCallback((id: string, checked: boolean) => {
    setCheckedMise((prev) => ({ ...prev, [id]: checked }));
  }, []);

  const startCooking = useCallback(() => {
    setPhase("cooking");
    setCurrentStep(0);
  }, []);

  const totalSteps = sortedInstructions.length;
  const currentInstruction =
    totalSteps > 0 ? sortedInstructions[currentStep] ?? null : null;

  const goNext = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, Math.max(totalSteps - 1, 0)));
  }, [totalSteps]);

  const goPrev = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      setCurrentStep(
        Math.min(Math.max(index, 0), Math.max(totalSteps - 1, 0)),
      );
    },
    [totalSteps],
  );

  useEffect(() => {
    if (timers.length === 0) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timers.length]);

  useEffect(() => {
    setTimers((prev) =>
      prev.map((t) => ({
        ...t,
        done: t.done || nowTick >= t.expiresAt,
      })),
    );
  }, [nowTick]);

  const startTimerForCurrentStep = useCallback(() => {
    if (!currentInstruction) return;
    const seconds = parseTimingToSeconds(currentInstruction.timing);
    if (seconds == null || seconds <= 0) return;
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `t-${Date.now()}-${Math.random()}`;
    const label =
      currentInstruction.timing?.trim() ||
      `Step ${currentInstruction.step}`;
    setTimers((prev) => [
      ...prev,
      {
        id,
        stepIndex: currentStep,
        label,
        totalSeconds: seconds,
        expiresAt: Date.now() + seconds * 1000,
        done: false,
      },
    ]);
  }, [currentInstruction, currentStep]);

  const dismissTimer = useCallback((id: string) => {
    setTimers((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const timerSnapshots = useMemo(() => {
    return timers.map((t) => {
      const remainingSeconds = Math.max(
        0,
        Math.ceil((t.expiresAt - nowTick) / 1000),
      );
      return { ...t, remainingSeconds };
    });
  }, [timers, nowTick]);

  const finishCooking = useCallback(() => {
    setPhase("complete");
  }, []);

  return {
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
  };
}
