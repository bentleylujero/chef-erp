"use client";

import { useState, useMemo } from "react";
import {
  format,
  addWeeks,
  subWeeks,
  startOfWeek,
  addDays,
  isSameDay,
  parseISO,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  UtensilsCrossed,
  Trash2,
  Pencil,
  ShoppingCart,
  CalendarDays,
  ChefHat,
  Clock,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  useMealPlan,
  useAddMealPlanEntry,
  useUpdateMealPlanEntry,
  useDeleteMealPlanEntry,
} from "@/hooks/use-meal-plan";
import type { MealPlanEntry } from "@/hooks/use-meal-plan";
import { useRecipes } from "@/hooks/use-recipes";
import type { RecipeListItem } from "@/hooks/use-recipes";

const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;
type MealType = (typeof MEAL_TYPES)[number];

const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snack",
};

const MEAL_TIMES: Record<MealType, string> = {
  BREAKFAST: "7 – 9 AM",
  LUNCH: "12 – 2 PM",
  DINNER: "6 – 8 PM",
  SNACK: "Anytime",
};

const CUISINE_COLORS: Record<string, string> = {
  FRENCH: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  ITALIAN: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  DELI: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  MEXICAN: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  MEDITERRANEAN: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  JAPANESE: "bg-rose-500/15 text-rose-400 border-rose-500/20",
  THAI: "bg-lime-500/15 text-lime-400 border-lime-500/20",
  AMERICAN: "bg-sky-500/15 text-sky-400 border-sky-500/20",
  KOREAN: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  CHINESE: "bg-red-500/15 text-red-400 border-red-500/20",
  INDIAN: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
};

function getCuisineClass(cuisine: string) {
  return CUISINE_COLORS[cuisine] ?? "bg-muted text-muted-foreground";
}

export default function MealPlannerPage() {
  const [currentWeek, setCurrentWeek] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const weekISO = currentWeek.toISOString();
  const { data: plan, isLoading } = useMealPlan(weekISO);
  const addEntry = useAddMealPlanEntry();
  const updateEntry = useUpdateMealPlanEntry();
  const deleteEntry = useDeleteMealPlanEntry();

  const [addDialog, setAddDialog] = useState<{
    open: boolean;
    date: Date;
    mealType: MealType;
  }>({ open: false, date: new Date(), mealType: "DINNER" });

  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    entry: MealPlanEntry | null;
  }>({ open: false, entry: null });

  const [recipeSearch, setRecipeSearch] = useState("");
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [servings, setServings] = useState<number>(4);
  const [addMealType, setAddMealType] = useState<MealType>("DINNER");

  const { data: recipesData } = useRecipes({
    search: recipeSearch,
    limit: 12,
  });

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));
  }, [currentWeek]);

  const entriesByDayAndMeal = useMemo(() => {
    const map = new Map<string, MealPlanEntry[]>();
    for (const entry of plan?.entries ?? []) {
      const d = parseISO(entry.date);
      for (const day of weekDays) {
        if (isSameDay(d, day)) {
          const key = `${format(day, "yyyy-MM-dd")}-${entry.mealType}`;
          const existing = map.get(key) ?? [];
          existing.push(entry);
          map.set(key, existing);
        }
      }
    }
    return map;
  }, [plan?.entries, weekDays]);

  const stats = useMemo(() => {
    const entries = plan?.entries ?? [];
    const totalMeals = entries.length;
    const estimatedCost = entries.reduce((acc, e) => {
      return acc + (e.recipe.platePrice ?? 0);
    }, 0);
    return { totalMeals, estimatedCost };
  }, [plan?.entries]);

  function openAddDialog(date: Date, mealType: MealType) {
    setAddDialog({ open: true, date, mealType });
    setAddMealType(mealType);
    setRecipeSearch("");
    setSelectedRecipeId("");
    setServings(4);
  }

  function handleAddEntry() {
    if (!selectedRecipeId) return;
    addEntry.mutate(
      {
        recipeId: selectedRecipeId,
        date: format(addDialog.date, "yyyy-MM-dd"),
        mealType: addMealType,
        scaledServings: servings,
      },
      { onSuccess: () => setAddDialog((p) => ({ ...p, open: false })) },
    );
  }

  function openEditDialog(entry: MealPlanEntry) {
    setEditDialog({ open: true, entry });
    setServings(entry.scaledServings ?? entry.recipe.servings);
  }

  function handleUpdateEntry() {
    if (!editDialog.entry) return;
    updateEntry.mutate(
      { id: editDialog.entry.id, scaledServings: servings },
      { onSuccess: () => setEditDialog({ open: false, entry: null }) },
    );
  }

  function handleDeleteEntry() {
    if (!editDialog.entry) return;
    deleteEntry.mutate(editDialog.entry.id, {
      onSuccess: () => setEditDialog({ open: false, entry: null }),
    });
  }

  const isToday = (day: Date) => isSameDay(day, new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meal Planner</h1>
          <p className="text-muted-foreground mt-1">
            Plan your week and let the system optimize prep work.
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <ShoppingCart className="h-4 w-4" />
          Generate Grocery List
        </Button>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentWeek((w) => subWeeks(w, 1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <CalendarDays className="text-muted-foreground h-4 w-4" />
          <span className="text-lg font-semibold">
            Week of {format(currentWeek, "MMMM d")}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentWeek((w) => addWeeks(w, 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Weekly Grid */}
      {isLoading ? (
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="bg-muted/50 h-96 animate-pulse rounded-lg"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className={`flex flex-col rounded-lg border ${
                isToday(day)
                  ? "border-primary/40 bg-primary/5"
                  : "bg-card"
              }`}
            >
              {/* Day Header */}
              <div
                className={`border-b px-3 py-2 text-center ${
                  isToday(day) ? "bg-primary/10" : ""
                }`}
              >
                <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  {format(day, "EEE")}
                </div>
                <div
                  className={`text-lg font-bold ${
                    isToday(day) ? "text-primary" : ""
                  }`}
                >
                  {format(day, "d")}
                </div>
              </div>

              {/* Meal Slots */}
              <div className="flex flex-1 flex-col gap-1 p-1.5">
                {MEAL_TYPES.map((mealType) => {
                  const key = `${format(day, "yyyy-MM-dd")}-${mealType}`;
                  const slotEntries = entriesByDayAndMeal.get(key) ?? [];

                  return (
                    <div key={mealType} className="space-y-1">
                      <div className="text-muted-foreground px-1 text-[10px] font-medium uppercase tracking-wider">
                        {MEAL_LABELS[mealType]}
                      </div>

                      {slotEntries.length > 0 ? (
                        slotEntries.map((entry) => (
                          <button
                            key={entry.id}
                            onClick={() => openEditDialog(entry)}
                            className="hover:bg-accent group w-full cursor-pointer rounded-md border p-1.5 text-left transition-colors"
                          >
                            <div className="truncate text-xs font-medium leading-tight">
                              {entry.recipe.title}
                            </div>
                            <div className="mt-1 flex items-center gap-1">
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1 py-0 ${getCuisineClass(entry.recipe.cuisine)}`}
                              >
                                {entry.recipe.cuisine}
                              </Badge>
                              <span className="text-muted-foreground flex items-center gap-0.5 text-[9px]">
                                <Users className="h-2.5 w-2.5" />
                                {entry.scaledServings ??
                                  entry.recipe.servings}
                              </span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <button
                          onClick={() => openAddDialog(day, mealType)}
                          className="bg-muted/30 hover:bg-muted/60 hover:border-primary/30 flex w-full items-center justify-center rounded-md border border-dashed py-2 transition-all"
                        >
                          <Plus className="text-muted-foreground h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Bar */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="text-muted-foreground h-4 w-4" />
              <span className="text-sm font-medium">
                {stats.totalMeals} meals planned
              </span>
            </div>
            <Separator orientation="vertical" className="!h-5" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                ~${stats.estimatedCost.toFixed(2)} estimated grocery cost
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <ShoppingCart className="h-3.5 w-3.5" />
            Generate Grocery List
          </Button>
        </CardContent>
      </Card>

      {/* Add Recipe Dialog */}
      <Dialog
        open={addDialog.open}
        onOpenChange={(open) => setAddDialog((p) => ({ ...p, open }))}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5" />
              Add to {MEAL_LABELS[addDialog.mealType]} —{" "}
              {format(addDialog.date, "EEE, MMM d")}
            </DialogTitle>
            <DialogDescription>
              Search your cookbook and add a recipe to your meal plan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Recipe Search */}
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search your cookbook..."
                className="pl-9"
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
              />
            </div>

            {/* Recipe List */}
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1">
              {recipesData?.recipes.length === 0 && (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  No recipes found. Try a different search.
                </div>
              )}
              {recipesData?.recipes.map((recipe: RecipeListItem) => (
                <button
                  key={recipe.id}
                  onClick={() => {
                    setSelectedRecipeId(recipe.id);
                    setServings(recipe.servings);
                  }}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                    selectedRecipeId === recipe.id
                      ? "bg-primary/10 border-primary border"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {recipe.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1 py-0 ${getCuisineClass(recipe.cuisine)}`}
                      >
                        {recipe.cuisine}
                      </Badge>
                      <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                        <Clock className="h-2.5 w-2.5" />
                        {recipe.prepTime + recipe.cookTime}m
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Meal Type + Servings */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Meal</label>
                <Select
                  value={addMealType}
                  onValueChange={(v) => setAddMealType(v as MealType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEAL_TYPES.map((mt) => (
                      <SelectItem key={mt} value={mt}>
                        {MEAL_LABELS[mt]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Servings</label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={servings}
                  onChange={(e) => setServings(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setAddDialog((p) => ({ ...p, open: false }))}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddEntry}
              disabled={!selectedRecipeId || addEntry.isPending}
            >
              {addEntry.isPending ? "Adding..." : "Add to Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Entry Dialog */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(open) =>
          setEditDialog((p) => ({ ...p, open }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editDialog.entry?.recipe.title}
            </DialogTitle>
            <DialogDescription>
              {editDialog.entry && (
                <span className="flex items-center gap-2 pt-1">
                  <Badge
                    variant="outline"
                    className={getCuisineClass(
                      editDialog.entry.recipe.cuisine,
                    )}
                  >
                    {editDialog.entry.recipe.cuisine}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {MEAL_LABELS[editDialog.entry.mealType]} —{" "}
                    {format(parseISO(editDialog.entry.date), "EEE, MMM d")}
                  </span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {editDialog.entry && (
            <div className="space-y-4">
              <div className="bg-muted/50 grid grid-cols-3 gap-3 rounded-lg p-3">
                <div className="text-center">
                  <Clock className="text-muted-foreground mx-auto mb-1 h-4 w-4" />
                  <div className="text-xs font-medium">
                    {editDialog.entry.recipe.prepTime +
                      editDialog.entry.recipe.cookTime}
                    m
                  </div>
                  <div className="text-muted-foreground text-[10px]">
                    Total Time
                  </div>
                </div>
                <div className="text-center">
                  <Users className="text-muted-foreground mx-auto mb-1 h-4 w-4" />
                  <div className="text-xs font-medium">
                    {editDialog.entry.scaledServings ??
                      editDialog.entry.recipe.servings}
                  </div>
                  <div className="text-muted-foreground text-[10px]">
                    Servings
                  </div>
                </div>
                <div className="text-center">
                  <ChefHat className="text-muted-foreground mx-auto mb-1 h-4 w-4" />
                  <div className="text-xs font-medium">
                    {"★".repeat(editDialog.entry.recipe.difficulty)}
                  </div>
                  <div className="text-muted-foreground text-[10px]">
                    Difficulty
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Adjust Servings
                </label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={servings}
                  onChange={(e) => setServings(Number(e.target.value))}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={handleDeleteEntry}
              disabled={deleteEntry.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleteEntry.isPending ? "Removing..." : "Remove"}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() =>
                  setEditDialog({ open: false, entry: null })
                }
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateEntry}
                disabled={updateEntry.isPending}
                className="gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                {updateEntry.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
