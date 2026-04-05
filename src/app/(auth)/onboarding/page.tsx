"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChefHat,
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
  X,
  Flame,
  Candy,
  Droplets,
  Citrus,
  Beef,
  Bean,
  Sparkles,
  Package,
  ClipboardList,
  Receipt,
  Loader2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import type { PantryParsedItem } from "@/lib/ai/pantry-list-parser";
import {
  IngredientAutocomplete,
  type SelectedIngredient,
} from "@/components/ingredient-autocomplete";
import { VoiceInput } from "@/components/voice-input";
import { Label } from "@/components/ui/label";

const TOTAL_STEPS = 4;
const MESSY_LIST_CHAR_SOFT_LIMIT = 12_000;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function mergePantryFromServer(
  prev: { name: string; quantity: number; unit: string }[],
  server: { name: string; quantity: number; unit: string }[],
) {
  const keys = new Set(prev.map((p) => p.name.toLowerCase()));
  const additions = server.filter((s) => !keys.has(s.name.toLowerCase()));
  return additions.length > 0 ? [...prev, ...additions] : prev;
}

function readMessyListError(data: unknown): string {
  if (!data || typeof data !== "object") return "Request failed";
  const err = (data as { error?: unknown }).error;
  if (typeof err === "string" && err.trim()) return err;
  return "Request failed";
}

type MessyListRow = { item: PantryParsedItem; selected: boolean };

// ── Cuisine Data ──────────────────────────────────────────────────

const CUISINES = [
  { id: "FRENCH", label: "French", emoji: "🇫🇷" },
  { id: "ITALIAN", label: "Italian", emoji: "🇮🇹" },
  { id: "DELI", label: "Deli", emoji: "🥪" },
  { id: "MEXICAN", label: "Mexican", emoji: "🇲🇽" },
  { id: "MEDITERRANEAN", label: "Mediterranean", emoji: "🫒" },
  { id: "JAPANESE", label: "Japanese", emoji: "🇯🇵" },
  { id: "THAI", label: "Thai", emoji: "🇹🇭" },
  { id: "KOREAN", label: "Korean", emoji: "🇰🇷" },
  { id: "CHINESE", label: "Chinese", emoji: "🇨🇳" },
  { id: "INDIAN", label: "Indian", emoji: "🇮🇳" },
  { id: "AMERICAN", label: "American", emoji: "🇺🇸" },
  { id: "MIDDLE_EASTERN", label: "Middle Eastern", emoji: "🧆" },
  { id: "AFRICAN", label: "African", emoji: "🌍" },
  { id: "CARIBBEAN", label: "Caribbean", emoji: "🌴" },
  { id: "SOUTHEAST_ASIAN", label: "SE Asian", emoji: "🍜" },
  { id: "FUSION", label: "Fusion", emoji: "🔀" },
] as const;

// ── Equipment Data ────────────────────────────────────────────────

const EQUIPMENT = [
  "Stand Mixer",
  "Immersion Blender",
  "Sous Vide",
  "Grill",
  "Smoker",
  "Cast Iron",
  "Dutch Oven",
  "Food Processor",
  "Mandoline",
  "Thermometer",
  "Torch",
  "Pressure Cooker",
  "Dehydrator",
] as const;

// ── Dietary Data ──────────────────────────────────────────────────

const DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Nut-Free",
  "Shellfish-Free",
  "Kosher",
  "Halal",
] as const;

// ── Skill Levels ──────────────────────────────────────────────────

const SKILL_LEVELS = [
  {
    id: "INTERMEDIATE" as const,
    label: "Intermediate",
    description: "Comfortable with basics. Ready to level up techniques and expand your repertoire.",
    icon: "🔪",
  },
  {
    id: "ADVANCED" as const,
    label: "Advanced",
    description: "Strong technique foundation. Can improvise, develop recipes, and work multiple components.",
    icon: "🍳",
  },
  {
    id: "PROFESSIONAL" as const,
    label: "Professional",
    description: "Restaurant or culinary school trained. Master of timing, mise en place, and complex dishes.",
    icon: "👨‍🍳",
  },
] as const;

// ── Basic Staples ─────────────────────────────────────────────────

const BASIC_STAPLES = [
  { name: "Salt", quantity: 500, unit: "g" },
  { name: "Black Pepper", quantity: 100, unit: "g" },
  { name: "Olive Oil", quantity: 750, unit: "ml" },
  { name: "Butter", quantity: 250, unit: "g" },
  { name: "Garlic", quantity: 10, unit: "count" },
  { name: "Onion", quantity: 5, unit: "count" },
  { name: "All-Purpose Flour", quantity: 1000, unit: "g" },
  { name: "Sugar", quantity: 500, unit: "g" },
  { name: "Eggs", quantity: 12, unit: "count" },
  { name: "Milk", quantity: 1000, unit: "ml" },
  { name: "Vegetable Oil", quantity: 500, unit: "ml" },
  { name: "Rice", quantity: 1000, unit: "g" },
  { name: "Pasta", quantity: 500, unit: "g" },
  { name: "Chicken Stock", quantity: 1000, unit: "ml" },
  { name: "Soy Sauce", quantity: 250, unit: "ml" },
  { name: "Tomato Paste", quantity: 200, unit: "g" },
  { name: "Lemon", quantity: 4, unit: "count" },
  { name: "Red Wine Vinegar", quantity: 250, unit: "ml" },
  { name: "Dijon Mustard", quantity: 200, unit: "g" },
  { name: "Honey", quantity: 350, unit: "ml" },
] as const;

// ── Flavor slider icons ───────────────────────────────────────────

const FLAVOR_CONFIG = [
  { key: "spiceTolerance", label: "Spice Tolerance", icon: Flame, color: "text-red-400" },
  { key: "sweetPref", label: "Sweet", icon: Candy, color: "text-pink-400" },
  { key: "saltyPref", label: "Salty", icon: Droplets, color: "text-blue-400" },
  { key: "sourPref", label: "Sour", icon: Citrus, color: "text-yellow-400" },
  { key: "umamiPref", label: "Umami", icon: Beef, color: "text-amber-400" },
  { key: "bitterPref", label: "Bitter", icon: Bean, color: "text-emerald-400" },
] as const;

// ── Component ─────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chefName, setChefName] = useState("Chef");
  const [chefEmail, setChefEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          name?: string;
          email?: string;
          userId?: string | null;
        };
        if (cancelled) return;
        if (data.name?.trim()) setChefName(data.name.trim());
        if (data.email?.trim()) setChefEmail(data.email.trim());
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Step 1
  const [primaryCuisines, setPrimaryCuisines] = useState<string[]>([]);
  const [exploringCuisines, setExploringCuisines] = useState<string[]>([]);

  // Step 2
  const [skillLevel, setSkillLevel] = useState<"INTERMEDIATE" | "ADVANCED" | "PROFESSIONAL">("INTERMEDIATE");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>([]);

  // Step 3
  const [flavors, setFlavors] = useState({
    spiceTolerance: 5,
    sweetPref: 5,
    saltyPref: 5,
    sourPref: 5,
    umamiPref: 5,
    bitterPref: 5,
  });
  const [aversions, setAversions] = useState<string[]>([]);
  const [aversionInput, setAversionInput] = useState("");
  const [philosophy, setPhilosophy] = useState("");

  // Step 4
  const [pantryItems, setPantryItems] = useState<
    { name: string; quantity: number; unit: string }[]
  >([]);
  const [pantrySearch, setPantrySearch] = useState("");
  const [pantryQty, setPantryQty] = useState<number>(1);
  const [pantryUnit, setPantryUnit] = useState("count");
  const [messyListText, setMessyListText] = useState("");
  const [messyListParsing, setMessyListParsing] = useState(false);
  const [messyListRows, setMessyListRows] = useState<MessyListRow[] | null>(
    null,
  );

  const pantryBootstrapDone = useRef(false);
  useEffect(() => {
    if (pantryBootstrapDone.current) return;
    pantryBootstrapDone.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/inventory", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as Array<{
          ingredient: { name: string };
          quantity: number;
          unit: string;
        }>;
        if (cancelled || !Array.isArray(data)) return;
        const mapped = data.map((row) => ({
          name: row.ingredient.name,
          quantity: row.quantity,
          unit: row.unit,
        }));
        setPantryItems((prev) => mergePantryFromServer(prev, mapped));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCuisine = useCallback(
    (list: string[], setList: (v: string[]) => void, id: string) => {
      setList(list.includes(id) ? list.filter((c) => c !== id) : [...list, id]);
    },
    [],
  );

  const toggleItem = useCallback(
    (list: string[], setList: (v: string[]) => void, id: string) => {
      setList(list.includes(id) ? list.filter((c) => c !== id) : [...list, id]);
    },
    [],
  );

  function addAversion() {
    const trimmed = aversionInput.trim();
    if (trimmed && !aversions.includes(trimmed)) {
      setAversions([...aversions, trimmed]);
    }
    setAversionInput("");
  }

  function addPantryItem() {
    const trimmed = pantrySearch.trim();
    if (trimmed && !pantryItems.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setPantryItems([...pantryItems, { name: trimmed, quantity: pantryQty, unit: pantryUnit }]);
    }
    setPantrySearch("");
    setPantryQty(1);
    setPantryUnit("count");
  }

  function addAllStaples() {
    const existing = new Set(pantryItems.map((p) => p.name.toLowerCase()));
    const newItems = BASIC_STAPLES.filter(
      (s) => !existing.has(s.name.toLowerCase()),
    ).map((s) => ({ name: s.name, quantity: s.quantity, unit: s.unit }));
    setPantryItems([...pantryItems, ...newItems]);
  }

  const parseMessyList = useCallback(async () => {
    const t = messyListText.trim();
    if (!t) {
      toast.error("Add your list first");
      return;
    }
    setMessyListParsing(true);
    try {
      const res = await fetch("/api/ai/parse-pantry-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: t }),
      });
      const data: unknown = await res.json();
      if (!res.ok) throw new Error(readMessyListError(data));
      const items = (data as { items?: PantryParsedItem[] }).items ?? [];
      if (items.length === 0) {
        toast.message("No ingredients found", {
          description: "Try one item per line or separate with commas.",
        });
        return;
      }
      if (t.length > MESSY_LIST_CHAR_SOFT_LIMIT) {
        toast.message("Long list", {
          description: `Only the first ${MESSY_LIST_CHAR_SOFT_LIMIT.toLocaleString()} characters were parsed.`,
        });
      }
      setMessyListRows(items.map((item) => ({ item, selected: true })));
      toast.success(
        `Parsed ${items.length} ingredient${items.length === 1 ? "" : "s"}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse list");
    } finally {
      setMessyListParsing(false);
    }
  }, [messyListText]);

  const addMessySelectionToPantry = useCallback(() => {
    if (!messyListRows?.length) return;
    const chosen = messyListRows.filter((r: MessyListRow) => r.selected);
    if (chosen.length === 0) {
      toast.error("Select at least one ingredient");
      return;
    }
    setPantryItems((prev) => {
      const next = [...prev];
      const keys = new Set(next.map((p) => p.name.toLowerCase()));
      for (const { item } of chosen) {
        const name = item.parsedName.trim();
        if (!name) continue;
        const k = name.toLowerCase();
        if (!keys.has(k)) {
          keys.add(k);
          next.push({
            name,
            quantity: item.quantity,
            unit: item.unit,
          });
        }
      }
      return next;
    });
    setMessyListRows(null);
    setMessyListText("");
    toast.success(
      `Added ${chosen.length} item${chosen.length === 1 ? "" : "s"} to your pantry list`,
    );
  }, [messyListRows]);

  async function handleFinish() {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: chefName.trim(),
          email: chefEmail.trim(),
          skillLevel,
          kitchenEquipment: equipment,
          dietaryRestrictions: dietary,
          primaryCuisines,
          exploringCuisines,
          cookingPhilosophy: philosophy || undefined,
          flavorProfile: {
            ...flavors,
            ingredientAversions: aversions,
          },
          pantryItems,
        }),
      });

      if (!res.ok) throw new Error("Onboarding failed");

      router.push("/onboarding/generating");
    } catch {
      setIsSubmitting(false);
    }
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return (
          primaryCuisines.length > 0 &&
          chefName.trim().length > 0 &&
          isValidEmail(chefEmail)
        );
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        return pantryItems.length > 0;
      default:
        return false;
    }
  };

  const progressPercent = (step / TOTAL_STEPS) * 100;

  return (
    <div className="bg-background flex min-h-screen flex-col">
      {/* Top bar */}
      <div className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-9 w-9 items-center justify-center rounded-lg">
              <ChefHat className="text-primary h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Chef Bentley&apos;s ERP</h2>
              <p className="text-muted-foreground text-xs">
                Step {step} of {TOTAL_STEPS}
              </p>
            </div>
          </div>
          <div className="w-48">
            <Progress value={progressPercent} className="h-2" />
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-1 items-start justify-center overflow-y-auto px-6 py-10">
        <div className="w-full max-w-3xl">
          {/* ── Step 1: Cooking Style ─────────────── */}
          {step === 1 && (
            <div className="space-y-8">
              <div className="space-y-2 text-center">
                <h1 className="text-3xl font-bold tracking-tight">
                  What&apos;s your cooking style?
                </h1>
                <p className="text-muted-foreground text-lg">
                  This helps us build a cookbook tailored to your kitchen.
                </p>
              </div>

              <div className="mx-auto grid max-w-md gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="onboard-name">Your name</Label>
                  <Input
                    id="onboard-name"
                    value={chefName}
                    onChange={(e) => setChefName(e.target.value)}
                    autoComplete="name"
                    placeholder="Chef"
                  />
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="onboard-email">Email</Label>
                  <Input
                    id="onboard-email"
                    type="email"
                    value={chefEmail}
                    onChange={(e) => setChefEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="you@kitchen.com"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider">
                  Cuisines you cook most
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {CUISINES.map((c) => {
                    const selected = primaryCuisines.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() =>
                          toggleCuisine(primaryCuisines, setPrimaryCuisines, c.id)
                        }
                        className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-4 transition-all ${
                          selected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "hover:bg-muted/50 border-transparent"
                        }`}
                      >
                        <span className="text-2xl">{c.emoji}</span>
                        <span className="text-xs font-medium">{c.label}</span>
                        {selected && (
                          <Check className="text-primary h-3.5 w-3.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider">
                  Cuisines you want to explore
                </h3>
                <p className="text-muted-foreground text-sm">
                  We&apos;ll gradually introduce these into your recipes.
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {CUISINES.filter(
                    (c) => !primaryCuisines.includes(c.id),
                  ).map((c) => {
                    const selected = exploringCuisines.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() =>
                          toggleCuisine(
                            exploringCuisines,
                            setExploringCuisines,
                            c.id,
                          )
                        }
                        className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-4 transition-all ${
                          selected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "hover:bg-muted/50 border-transparent"
                        }`}
                      >
                        <span className="text-2xl">{c.emoji}</span>
                        <span className="text-xs font-medium">{c.label}</span>
                        {selected && (
                          <Check className="text-primary h-3.5 w-3.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Skill & Equipment ─────────── */}
          {step === 2 && (
            <div className="space-y-8">
              <div className="space-y-2 text-center">
                <h1 className="text-3xl font-bold tracking-tight">
                  Skill &amp; Equipment
                </h1>
                <p className="text-muted-foreground text-lg">
                  We&apos;ll match recipe complexity to your level and tools.
                </p>
              </div>

              {/* Skill Level */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider">
                  Your skill level
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {SKILL_LEVELS.map((level) => {
                    const selected = skillLevel === level.id;
                    return (
                      <button
                        key={level.id}
                        onClick={() => setSkillLevel(level.id)}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${
                          selected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "hover:bg-muted/50 border-transparent"
                        }`}
                      >
                        <div className="mb-2 text-2xl">{level.icon}</div>
                        <div className="text-sm font-semibold">{level.label}</div>
                        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                          {level.description}
                        </p>
                        {selected && (
                          <Check className="text-primary mt-2 h-4 w-4" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Equipment */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider">
                  Kitchen equipment
                </h3>
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT.map((item) => {
                    const selected = equipment.includes(item);
                    return (
                      <button
                        key={item}
                        onClick={() =>
                          toggleItem(equipment, setEquipment, item)
                        }
                        className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-all ${
                          selected
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        {selected && <Check className="h-3 w-3" />}
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Dietary */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider">
                  Dietary restrictions
                  <span className="text-muted-foreground ml-2 text-xs font-normal normal-case">
                    optional
                  </span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {DIETARY_OPTIONS.map((item) => {
                    const selected = dietary.includes(item);
                    return (
                      <button
                        key={item}
                        onClick={() =>
                          toggleItem(dietary, setDietary, item)
                        }
                        className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-all ${
                          selected
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        {selected && <Check className="h-3 w-3" />}
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Flavor Profile ────────────── */}
          {step === 3 && (
            <div className="space-y-8">
              <div className="space-y-2 text-center">
                <h1 className="text-3xl font-bold tracking-tight">
                  Your Flavor Profile
                </h1>
                <p className="text-muted-foreground text-lg">
                  Fine-tune your palate so every recipe hits the mark.
                </p>
              </div>

              {/* Flavor Sliders */}
              <div className="space-y-5">
                {FLAVOR_CONFIG.map(({ key, label, icon: Icon, color }) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${color}`} />
                        <span className="text-sm font-medium">{label}</span>
                      </div>
                      <span className="bg-muted rounded-md px-2 py-0.5 text-sm font-bold tabular-nums">
                        {flavors[key as keyof typeof flavors]}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={flavors[key as keyof typeof flavors]}
                      onChange={(e) =>
                        setFlavors((prev) => ({
                          ...prev,
                          [key]: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-current"
                    />
                    <div className="text-muted-foreground flex justify-between text-[10px]">
                      <span>Minimal</span>
                      <span>Maximum</span>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Ingredient Aversions */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider">
                  Ingredient aversions
                  <span className="text-muted-foreground ml-2 text-xs font-normal normal-case">
                    optional
                  </span>
                </h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., cilantro, anchovies..."
                    value={aversionInput}
                    onChange={(e) => setAversionInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addAversion()}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={addAversion}
                    disabled={!aversionInput.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {aversions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {aversions.map((a) => (
                      <Badge key={a} variant="secondary" className="gap-1 pr-1">
                        {a}
                        <button
                          onClick={() =>
                            setAversions(aversions.filter((v) => v !== a))
                          }
                          className="hover:bg-muted ml-0.5 rounded-full p-0.5"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Cooking Philosophy */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider">
                  Cooking philosophy
                  <span className="text-muted-foreground ml-2 text-xs font-normal normal-case">
                    optional
                  </span>
                </h3>
                <textarea
                  value={philosophy}
                  onChange={(e) => setPhilosophy(e.target.value)}
                  placeholder="I like rustic, hearty food with deep flavors..."
                  className="border-input bg-background ring-ring/20 focus-visible:ring-ring placeholder:text-muted-foreground h-24 w-full rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  maxLength={500}
                />
                <p className="text-muted-foreground text-xs">
                  {philosophy.length}/500
                </p>
              </div>
            </div>
          )}

          {/* ── Step 4: Your Pantry ───────────────── */}
          {step === 4 && (
            <div className="space-y-8">
              <div className="space-y-2 text-center">
                <h1 className="text-3xl font-bold tracking-tight">
                  Stock Your Pantry
                </h1>
                <p className="text-muted-foreground text-lg">
                  Tell us what you have, and we&apos;ll build recipes around it.
                </p>
              </div>

              {/* Messy list → AI pantry */}
              <Card className="border-primary/15">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardList className="size-5 opacity-80" />
                    Messy pantry list (AI)
                  </CardTitle>
                  <p className="text-muted-foreground text-sm font-normal leading-relaxed">
                    Walk through your real pantry and type everything you have—messy
                    is fine. Include{" "}
                    <span className="text-foreground font-medium">
                      amounts when you can
                    </span>{" "}
                    (cups, lbs, &quot;half a bag&quot;, etc.) so we can stock your
                    virtual pantry accurately. Our AI will parse the list and you
                    can add the matches below.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!messyListRows ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="messy-pantry">Your list</Label>
                        <span className="text-muted-foreground text-[10px] tabular-nums">
                          {messyListText.length.toLocaleString()} chars
                          {messyListText.length > MESSY_LIST_CHAR_SOFT_LIMIT ? (
                            <span className="text-amber-600 dark:text-amber-400">
                              {" "}
                              (first{" "}
                              {MESSY_LIST_CHAR_SOFT_LIMIT.toLocaleString()} sent)
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <Textarea
                        id="messy-pantry"
                        placeholder={`e.g.\n2 lb salmon fillet\nold bay, 3 lemons\nquinoa 2 cups\nparm wedge\nheavy cream`}
                        value={messyListText}
                        onChange={(e) => setMessyListText(e.target.value)}
                        disabled={messyListParsing}
                        className="min-h-[140px] font-mono text-sm"
                      />
                      <Button
                        type="button"
                        onClick={() => void parseMessyList()}
                        disabled={messyListParsing || !messyListText.trim()}
                        className="w-full sm:w-auto"
                      >
                        {messyListParsing ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Parsing…
                          </>
                        ) : (
                          "Parse list with AI"
                        )}
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-muted-foreground text-sm">
                        Review parsed lines. Uncheck anything you don&apos;t want,
                        then add to your pantry list.
                      </p>
                      <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-2">
                        {messyListRows.map((row: MessyListRow, i: number) => (
                          <label
                            key={`${row.item.rawLine}-${i}`}
                            className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5"
                          >
                            <Checkbox
                              checked={row.selected}
                              onCheckedChange={(c) =>
                                setMessyListRows((prev: MessyListRow[] | null) =>
                                  prev
                                    ? prev.map((r: MessyListRow, j: number) =>
                                        j === i
                                          ? { ...r, selected: !!c }
                                          : r,
                                      )
                                    : null,
                                )
                              }
                              className="mt-0.5"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="font-medium">
                                {row.item.parsedName}
                              </span>
                              <span className="text-muted-foreground ml-2 text-xs">
                                {row.item.quantity} {row.item.unit}
                              </span>
                              <span className="text-muted-foreground block truncate text-[11px]">
                                {row.item.rawLine}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={addMessySelectionToPantry}
                        >
                          Add selected to pantry list
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setMessyListRows(null);
                            setMessyListText("");
                          }}
                        >
                          Discard
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Receipt scan */}
              <Card>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                      <Receipt className="text-primary h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Scan a receipt</div>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        Upload a photo of a grocery receipt. We read line items and
                        add them to your pantry. When you&apos;re done, use{" "}
                        <span className="text-foreground font-medium">
                          Continue setup
                        </span>{" "}
                        to return here and finish onboarding.
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/pantry/scan?returnTo=${encodeURIComponent("/onboarding")}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "inline-flex shrink-0",
                    )}
                  >
                    Open receipt scan
                  </Link>
                </CardContent>
              </Card>

              {/* Quick Add */}
              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                      <Sparkles className="text-primary h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">
                        Add All Basic Staples
                      </div>
                      <div className="text-muted-foreground text-xs">
                        Salt, pepper, olive oil, butter, garlic, and{" "}
                        {BASIC_STAPLES.length - 5} more essentials
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={addAllStaples}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add {BASIC_STAPLES.length} Items
                  </Button>
                </CardContent>
              </Card>

              {/* Manual Add */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider">
                  Add individual items
                </h3>
                <div className="flex gap-2">
                  <IngredientAutocomplete
                    className="flex-1"
                    value={pantrySearch}
                    onChange={setPantrySearch}
                    onSelect={(ing: SelectedIngredient) => {
                      const name = ing.name;
                      if (!pantryItems.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
                        setPantryItems([
                          ...pantryItems,
                          { name, quantity: pantryQty, unit: ing.defaultUnit },
                        ]);
                      }
                      setPantrySearch("");
                      setPantryQty(1);
                      setPantryUnit(ing.defaultUnit);
                    }}
                    onFreeformSubmit={(name: string) => {
                      if (!pantryItems.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
                        setPantryItems([
                          ...pantryItems,
                          { name, quantity: pantryQty, unit: pantryUnit },
                        ]);
                      }
                      setPantrySearch("");
                      setPantryQty(1);
                      setPantryUnit("count");
                    }}
                    placeholder="Search or type an ingredient..."
                  />
                  <Input
                    type="number"
                    min={1}
                    value={pantryQty}
                    onChange={(e) => setPantryQty(Number(e.target.value))}
                    className="w-20"
                    placeholder="Qty"
                  />
                  <select
                    value={pantryUnit}
                    onChange={(e) => setPantryUnit(e.target.value)}
                    className="border-input bg-background rounded-md border px-2 text-sm"
                  >
                    <option value="count">count</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="L">L</option>
                    <option value="oz">oz</option>
                    <option value="lb">lb</option>
                    <option value="cup">cup</option>
                    <option value="tbsp">tbsp</option>
                    <option value="tsp">tsp</option>
                    <option value="bunch">bunch</option>
                  </select>
                  <VoiceInput
                    onTranscript={(text) => setPantrySearch(text)}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={addPantryItem}
                    disabled={!pantrySearch.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Pantry Items List */}
              {pantryItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="text-muted-foreground h-4 w-4" />
                      <span className="text-sm font-medium">
                        {pantryItems.length} items in your pantry
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive text-xs"
                      onClick={() => setPantryItems([])}
                    >
                      Clear All
                    </Button>
                  </div>
                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
                    {pantryItems.map((item, idx) => (
                      <div
                        key={`${item.name}-${idx}`}
                        className="group hover:bg-muted/50 flex items-center justify-between rounded-md px-3 py-1.5"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">
                            {item.name}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {item.quantity} {item.unit}
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            setPantryItems(pantryItems.filter((_, i) => i !== idx))
                          }
                          className="text-muted-foreground hover:text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="border-t px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="text-muted-foreground text-sm">
            {step === 1 &&
              primaryCuisines.length > 0 &&
              `${primaryCuisines.length} cuisine${primaryCuisines.length > 1 ? "s" : ""} selected`}
            {step === 2 &&
              equipment.length > 0 &&
              `${equipment.length} equipment item${equipment.length > 1 ? "s" : ""}`}
            {step === 4 &&
              pantryItems.length > 0 &&
              `${pantryItems.length} pantry item${pantryItems.length > 1 ? "s" : ""}`}
          </div>

          {step < TOTAL_STEPS ? (
            <Button
              onClick={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1))}
              disabled={!canProceed()}
              className="gap-2"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={!canProceed() || isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                "Saving..."
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Build My Cookbook
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
