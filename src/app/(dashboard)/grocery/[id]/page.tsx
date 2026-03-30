"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  useAddGroceryItem,
  useDeleteGroceryItem,
  useGroceryList,
  useToggleGroceryItem,
  useUpdateGroceryList,
  type GroceryItemSource,
  type GroceryListStatus,
} from "@/hooks/use-grocery";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  IngredientAutocomplete,
  type SelectedIngredient,
} from "@/components/ingredient-autocomplete";
import { VoiceInput } from "@/components/voice-input";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const SECTION_ORDER: string[] = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Fresh Herbs",
  "Deli",
  "Pantry",
  "Grains & Pasta",
  "Beans & Legumes",
  "Condiments",
  "Oils & Fats",
  "Spices",
  "Baking",
  "Sweeteners",
  "Nuts & Seeds",
  "Beverages",
  "Other",
];

function sectionRank(name: string) {
  const i = SECTION_ORDER.indexOf(name);
  return i === -1 ? SECTION_ORDER.length : i;
}

function formatQty(q: number) {
  const rounded = Math.round(q * 1000) / 1000;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

function statusBadgeVariant(
  status: GroceryListStatus,
): "default" | "secondary" | "outline" {
  switch (status) {
    case "ACTIVE":
      return "default";
    case "COMPLETED":
      return "secondary";
    default:
      return "outline";
  }
}

function statusLabel(status: GroceryListStatus) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "ACTIVE":
      return "Shopping";
    case "COMPLETED":
      return "Done";
  }
}

function sourceLabel(source: GroceryItemSource) {
  switch (source) {
    case "MEAL_PLAN":
      return "Meal plan";
    case "PAR_LEVEL":
      return "Par";
    case "CUISINE_KIT":
      return "Kit";
    default:
      return "Manual";
  }
}

function sourceBadgeVariant(
  source: GroceryItemSource,
): "default" | "secondary" | "outline" {
  switch (source) {
    case "MEAL_PLAN":
      return "default";
    case "PAR_LEVEL":
      return "secondary";
    default:
      return "outline";
  }
}

function nextStatus(current: GroceryListStatus): GroceryListStatus {
  if (current === "DRAFT") return "ACTIVE";
  if (current === "ACTIVE") return "COMPLETED";
  return "DRAFT";
}

export default function GroceryListDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const { data: list, isLoading, isError } = useGroceryList(id);
  const updateList = useUpdateGroceryList();
  const toggleItem = useToggleGroceryItem(id);
  const deleteItem = useDeleteGroceryItem(id);
  const addItem = useAddGroceryItem(id);

  const [addSearchText, setAddSearchText] = useState("");

  const grouped = useMemo(() => {
    const src = list?.items;
    if (!src?.length) return [];
    const map = new Map<string, typeof src>();
    for (const item of src) {
      const section = item.storeSection?.trim() || "Other";
      const arr = map.get(section) ?? [];
      arr.push(item);
      map.set(section, arr);
    }
    return [...map.entries()]
      .sort(([a], [b]) => sectionRank(a) - sectionRank(b))
      .map(([section, groupItems]) => ({ section, items: groupItems }));
  }, [list]);

  const checkedCount = list?.items?.filter((i) => i.checked).length ?? 0;
  const totalCount = list?.items?.length ?? 0;

  const runningTotal = useMemo(() => {
    const src = list?.items;
    if (!src?.length) return null;
    let sum = 0;
    let any = false;
    for (const i of src) {
      if (i.estimatedCost != null) {
        sum += i.estimatedCost;
        any = true;
      }
    }
    return any ? sum : null;
  }, [list]);

  async function handleStatusCycle() {
    if (!list) return;
    const next = nextStatus(list.status);
    try {
      await updateList.mutateAsync({ id: list.id, status: next });
      toast.success(`Marked as ${statusLabel(next).toLowerCase()}`);
    } catch {
      toast.error("Could not update status");
    }
  }

  async function handleAddIngredient(ing: SelectedIngredient) {
    try {
      await addItem.mutateAsync({
        ingredientId: ing.id,
        quantity: 1,
        unit: ing.defaultUnit,
      });
      toast.success(`Added ${ing.name}`);
      setAddSearchText("");
    } catch {
      toast.error("Could not add item");
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Loading list…
      </div>
    );
  }

  if (isError || !list) {
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <p className="text-destructive">This list could not be loaded.</p>
        <Link
          href="/grocery"
          className={cn(buttonVariants({ variant: "default" }), "inline-flex")}
        >
          Back to lists
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 pb-28">
      <div className="flex items-center gap-2">
        <Link
          href="/grocery"
          aria-label="Back to grocery lists"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-sm" }),
            "shrink-0",
          )}
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {list.name}
            </h1>
            <Badge variant={statusBadgeVariant(list.status)}>
              {statusLabel(list.status)}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            Created {format(new Date(list.createdAt), "MMM d, yyyy")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleStatusCycle}
          disabled={updateList.isPending}
        >
          {updateList.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          Cycle status
        </Button>
        <div className="flex items-center gap-2">
          <IngredientAutocomplete
            className="w-64"
            value={addSearchText}
            onChange={setAddSearchText}
            onSelect={handleAddIngredient}
            placeholder="Search ingredients to add…"
            disabled={addItem.isPending}
          />
          <VoiceInput
            onTranscript={(text) => setAddSearchText(text)}
            disabled={addItem.isPending}
            size="icon"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium tabular-nums">
            {checkedCount} / {totalCount} checked
          </span>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={
            totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0
          }
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{
              width:
                totalCount > 0
                  ? `${Math.round((checkedCount / totalCount) * 100)}%`
                  : "0%",
            }}
          />
        </div>
      </div>

      {grouped.length === 0 && (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No items yet. Add ingredients or regenerate from the list hub.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {grouped.map(({ section, items }) => (
          <details
            key={section}
            className="group rounded-xl border bg-card shadow-sm open:shadow-md"
            open
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="text-sm font-medium">{section}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                {items.filter((i) => i.checked).length}/{items.length}
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <Separator />
            <ul className="divide-y divide-border/60">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-3 px-3 py-3 sm:items-center"
                >
                  <Checkbox
                    checked={item.checked}
                    disabled={toggleItem.isPending}
                    onCheckedChange={(v) => {
                      const checked = v === true;
                      toggleItem.mutate(
                        { itemId: item.id, checked },
                        {
                          onError: () =>
                            toast.error("Could not update that item"),
                        },
                      );
                    }}
                    className="mt-0.5 sm:mt-0"
                    aria-label={`Got ${item.ingredient.name}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={
                        item.checked
                          ? "text-muted-foreground line-through"
                          : ""
                      }
                    >
                      <span className="font-medium">{item.ingredient.name}</span>
                      <span className="ml-2 text-sm text-muted-foreground tabular-nums">
                        {formatQty(item.quantity)} {item.unit}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant={sourceBadgeVariant(item.source)}
                        className="text-[0.65rem] font-normal"
                      >
                        {sourceLabel(item.source)}
                      </Badge>
                      {item.estimatedCost != null && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {currency.format(item.estimatedCost)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={deleteItem.isPending}
                    onClick={async () => {
                      try {
                        await deleteItem.mutateAsync(item.id);
                        toast.success("Removed");
                      } catch {
                        toast.error("Could not remove");
                      }
                    }}
                    aria-label={`Remove ${item.ingredient.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md md:static md:z-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg md:shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground">Estimated total</p>
            <p className="text-lg font-semibold tabular-nums">
              {runningTotal != null ? currency.format(runningTotal) : "—"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => router.push("/grocery")}
          >
            All lists
          </Button>
        </div>
      </div>
    </div>
  );
}
