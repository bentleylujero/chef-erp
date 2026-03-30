"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, BookOpen, Sparkles, Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const DEMO_USER_ID = "demo-user";

const GENERATION_PHASES = [
  { label: "Analyzing your pantry and preferences...", duration: 2000 },
  { label: "Matching ingredients to your favorite cuisines...", duration: 3000 },
  { label: "Crafting recipes from your kitchen inventory...", duration: 8000 },
  { label: "Calibrating difficulty to your skill level...", duration: 2000 },
  { label: "Balancing flavors to your palate...", duration: 2000 },
  { label: "Finalizing your personal cookbook...", duration: 3000 },
];

export default function GeneratingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<{
    ingredientCount: number;
    cuisines: string[];
  } | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [recipesGenerated, setRecipesGenerated] = useState(0);
  const generationStarted = useRef(false);

  useEffect(() => {
    async function fetchUserContext() {
      try {
        const res = await fetch(`/api/inventory`);
        if (res.ok) {
          const items = await res.json();
          setStats({ ingredientCount: items.length, cuisines: [] });
        }
      } catch {
        setStats({ ingredientCount: 0, cuisines: [] });
      }
    }
    fetchUserContext();
  }, []);

  useEffect(() => {
    const totalDuration = GENERATION_PHASES.reduce((a, p) => a + p.duration, 0);
    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += 100;
      const pct = Math.min((elapsed / totalDuration) * 85, 85);
      setProgress(pct);

      let cumulative = 0;
      for (let i = 0; i < GENERATION_PHASES.length; i++) {
        cumulative += GENERATION_PHASES[i].duration;
        if (elapsed < cumulative) {
          setPhase(i);
          break;
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (generationStarted.current) return;
    generationStarted.current = true;

    async function generate() {
      try {
        const res = await fetch("/api/ai/generate-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: DEMO_USER_ID,
            trigger: "ONBOARDING_BATCH",
            count: 10,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Generation failed");
        }

        const data = await res.json();
        setRecipesGenerated(data.recipesGenerated ?? 0);
        setProgress(100);
        setIsComplete(true);

        await new Promise((r) => setTimeout(r, 1500));

        toast.success(
          `Your cookbook is ready! ${data.recipesGenerated} recipes generated.`,
          { duration: 5000 },
        );
        router.push("/cookbook");
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Generation failed";
        toast.error(msg);
        setProgress(100);
        setIsComplete(true);

        await new Promise((r) => setTimeout(r, 2000));
        router.push("/cookbook");
      }
    }

    generate();
  }, [router]);

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-lg space-y-10 text-center">
        {/* Animated Icon */}
        <div className="relative mx-auto h-24 w-24">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
          <div className="bg-primary/10 relative flex h-24 w-24 items-center justify-center rounded-full">
            {isComplete ? (
              <Check className="text-primary h-12 w-12 animate-in fade-in zoom-in" />
            ) : (
              <ChefHat className="text-primary h-12 w-12 animate-pulse" />
            )}
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">
            {isComplete
              ? "Your Cookbook is Ready"
              : "Building Your Personal Cookbook"}
          </h1>
          {isComplete ? (
            <p className="text-muted-foreground text-lg">
              {recipesGenerated} recipes crafted just for you. Redirecting...
            </p>
          ) : (
            <p className="text-muted-foreground text-lg">
              {stats && stats.ingredientCount > 0
                ? `Analyzing your ${stats.ingredientCount} ingredients across your favorite cuisines...`
                : GENERATION_PHASES[phase]?.label}
            </p>
          )}
        </div>

        {/* Progress */}
        <div className="space-y-3">
          <Progress value={progress} className="h-2.5" />
          <p className="text-muted-foreground text-sm tabular-nums">
            {Math.round(progress)}%
          </p>
        </div>

        {/* Phase Indicators */}
        <div className="mx-auto max-w-sm space-y-2">
          {GENERATION_PHASES.slice(0, phase + 1).map((p, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-lg px-4 py-2 transition-all ${
                i === phase && !isComplete
                  ? "bg-primary/5 text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {i < phase || isComplete ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              <span className="text-sm">{p.label}</span>
            </div>
          ))}
        </div>

        {/* Bottom info */}
        <div className="flex items-center justify-center gap-6 pt-4">
          <div className="flex items-center gap-2">
            <BookOpen className="text-muted-foreground h-4 w-4" />
            <span className="text-muted-foreground text-xs">
              AI-powered recipe generation
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="text-muted-foreground h-4 w-4" />
            <span className="text-muted-foreground text-xs">
              Personalized to your palate
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
