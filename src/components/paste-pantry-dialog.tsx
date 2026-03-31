"use client";

import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ClipboardList, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const BULK_CHUNK = 200;
const PARSE_CHAR_SOFT_LIMIT = 12_000;

function readApiError(data: unknown): string {
  if (!data || typeof data !== "object") return "Request failed";
  const err = (data as { error?: unknown }).error;
  if (typeof err === "string" && err.trim()) return err;
  if (Array.isArray(err)) {
    const parts = err.map((item) => {
      if (item && typeof item === "object" && "message" in item) {
        return String((item as { message: string }).message);
      }
      return JSON.stringify(item);
    });
    return parts.join(" · ") || "Invalid request";
  }
  return "Request failed";
}

import type { PantryParsedItem } from "@/lib/ai/pantry-list-parser";
import { INGREDIENT_CATEGORIES } from "@/lib/utils/categories";
import {
  invalidateQueriesAffectedByPantry,
  useBulkAddInventory,
} from "@/hooks/use-inventory";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ReviewRow extends PantryParsedItem {
  key: string;
  ingredientId: string | null;
  newName: string;
  newCategory: string;
  selected: boolean;
}

function toReviewRow(item: PantryParsedItem, i: number): ReviewRow {
  return {
    ...item,
    key: `${Date.now()}-${i}`,
    ingredientId: item.matchedIngredientId,
    newName: item.parsedName,
    newCategory: item.aiCategory,
    selected: true,
  };
}

function catalogOptions(row: PantryParsedItem): { id: string; name: string }[] {
  const map = new Map<string, string>();
  if (row.matchedIngredientId && row.matchedIngredientName) {
    map.set(row.matchedIngredientId, row.matchedIngredientName);
  }
  for (const a of row.alternates) {
    if (!map.has(a.id)) map.set(a.id, a.name);
  }
  return [...map.entries()].map(([id, name]) => ({ id, name }));
}

function ConfidenceBadge({
  confidence,
}: {
  confidence: PantryParsedItem["confidence"];
}) {
  const map = {
    high: {
      label: "High",
      className:
        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    },
    medium: {
      label: "Likely",
      className:
        "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    low: {
      label: "Weak",
      className:
        "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20",
    },
    unmatched: {
      label: "New",
      className:
        "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
    },
  } as const;
  const c = map[confidence] ?? map.unmatched;
  return (
    <Badge variant="outline" className={`text-[10px] font-normal ${c.className}`}>
      {c.label}
    </Badge>
  );
}

export function PastePantryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState<"input" | "review">("input");
  const [pasteText, setPasteText] = useState("");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [parsing, setParsing] = useState(false);

  const queryClient = useQueryClient();
  const bulkMutation = useBulkAddInventory({ cascadeInvalidation: false });

  useEffect(() => {
    if (!open) {
      setStep("input");
      setPasteText("");
      setRows([]);
    }
  }, [open]);

  const parseList = useCallback(async () => {
    const t = pasteText.trim();
    if (!t) {
      toast.error("Paste your list first");
      return;
    }
    setParsing(true);
    try {
      const res = await fetch("/api/ai/parse-pantry-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        throw new Error("Server returned an invalid response");
      }
      if (!res.ok) {
        throw new Error(readApiError(data));
      }
      const payload = data as { items?: PantryParsedItem[] };
      const items = (payload.items ?? []) as PantryParsedItem[];
      if (items.length === 0) {
        toast.message("No ingredients found", {
          description: "Try adding one item per line or separating with commas.",
        });
        return;
      }
      if (t.length > PARSE_CHAR_SOFT_LIMIT) {
        toast.message("Long list", {
          description: `Only the first ${PARSE_CHAR_SOFT_LIMIT.toLocaleString()} characters were sent for parsing. Split huge lists into two pastes if needed.`,
        });
      }
      setRows(items.map(toReviewRow));
      setStep("review");
      toast.success(`Parsed ${items.length} ingredient${items.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse list");
    } finally {
      setParsing(false);
    }
  }, [pasteText]);

  const updateRow = useCallback((key: string, patch: Partial<ReviewRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }, []);

  const toggleAll = useCallback((checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  }, []);

  const allSelected = rows.length > 0 && rows.every((r) => r.selected);
  const someSelected = rows.some((r) => r.selected);

  const submitBulk = useCallback(async () => {
    const chosen = rows.filter((r) => r.selected);
    if (chosen.length === 0) {
      toast.error("Select at least one row");
      return;
    }
    for (const r of chosen) {
      if (!r.ingredientId && !r.newName.trim()) {
        toast.error("New ingredients need a name");
        return;
      }
    }

    const items = chosen.map((r) => {
      if (r.ingredientId) {
        return {
          ingredientId: r.ingredientId,
          quantity: r.quantity,
          unit: r.unit,
        };
      }
      return {
        newName: r.newName.trim(),
        category: r.newCategory,
        quantity: r.quantity,
        unit: r.unit,
      };
    });

    try {
      let created = 0;
      let updated = 0;
      let ingredientsCreated = 0;
      for (let i = 0; i < items.length; i += BULK_CHUNK) {
        const slice = items.slice(i, i + BULK_CHUNK);
        const result = await bulkMutation.mutateAsync(slice);
        created += result.created;
        updated += result.updated;
        ingredientsCreated += result.ingredientsCreated;
      }
      toast.success("Pantry updated", {
        description: `${created} new row${created === 1 ? "" : "s"}, ${updated} merged, ${ingredientsCreated} new ingredient${ingredientsCreated === 1 ? "" : "s"} in catalog.`,
      });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add items");
    } finally {
      await invalidateQueriesAffectedByPantry(queryClient);
    }
  }, [rows, bulkMutation, onOpenChange, queryClient]);

  const charCount = pasteText.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[min(90dvh,860px)] max-h-[90dvh] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        showCloseButton
      >
        <div className="shrink-0 p-4 pb-2 pr-12">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="size-5 opacity-80" />
              Paste pantry list
            </DialogTitle>
            <DialogDescription>
              Drop a rough list (notes app, paper scan text, etc.). An agent
              normalizes lines, assigns categories, and matches your catalog.
              Review matches, then add everything in one go.
            </DialogDescription>
          </DialogHeader>
        </div>

        {step === "input" ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-2 px-4">
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="paste-pantry-text">Your list</Label>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {charCount.toLocaleString()} chars
                    {charCount > PARSE_CHAR_SOFT_LIMIT ? (
                      <span className="text-amber-600 dark:text-amber-400">
                        {" "}
                        (parser uses first {PARSE_CHAR_SOFT_LIMIT.toLocaleString()})
                      </span>
                    ) : null}
                  </span>
                </div>
                <Textarea
                  id="paste-pantry-text"
                  placeholder={`e.g.\n2 lb salmon\nold bay, lemons\nquinoa\nparm\nheavy cream`}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  className="min-h-[min(200px,32vh)] max-h-[min(380px,42vh)] flex-1 resize-y overflow-y-auto font-mono text-sm"
                  disabled={parsing}
                />
              </div>
            </div>
            <DialogFooter className="mx-0 mb-0 mt-0 shrink-0 border-t border-border bg-muted/40 px-4 py-3 backdrop-blur-md supports-backdrop-filter:bg-muted/30 sm:justify-end">
              <Button
                onClick={parseList}
                disabled={parsing || !pasteText.trim()}
              >
                {parsing ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Parsing…
                  </>
                ) : (
                  "Parse & match"
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 -ml-2"
                onClick={() => setStep("input")}
              >
                <ArrowLeft className="size-4 mr-1" />
                Edit list
              </Button>
              <span className="text-xs text-muted-foreground">
                {rows.length} line{rows.length !== 1 ? "s" : ""} — scroll the
                table, then use the buttons below.
              </span>
            </div>
            <div
              className="min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-y-contain px-4 pb-2"
              style={{ WebkitOverflowScrolling: "touch" }}
              tabIndex={0}
              aria-label="Parsed ingredients review"
            >
                <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="sticky top-0 z-[1] w-10 bg-popover pl-3 shadow-[0_1px_0_hsl(var(--border))]">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(c) => toggleAll(c === true)}
                      />
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] w-[22%] bg-popover shadow-[0_1px_0_hsl(var(--border))]">
                      You wrote
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] w-[26%] bg-popover shadow-[0_1px_0_hsl(var(--border))]">
                      Catalog match
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] w-16 bg-popover shadow-[0_1px_0_hsl(var(--border))]">
                      Match
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] w-20 bg-popover shadow-[0_1px_0_hsl(var(--border))]">
                      Qty
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] w-20 bg-popover shadow-[0_1px_0_hsl(var(--border))]">
                      Unit
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const opts = catalogOptions(row);
                    const selectVal = row.ingredientId ?? "__new__";
                    return (
                      <TableRow
                        key={row.key}
                        className={!row.selected ? "opacity-45" : undefined}
                      >
                        <TableCell className="pl-3 align-top pt-3">
                          <Checkbox
                            checked={row.selected}
                            onCheckedChange={(c) =>
                              updateRow(row.key, { selected: c === true })
                            }
                          />
                        </TableCell>
                        <TableCell className="align-top pt-2.5">
                          <span className="text-xs leading-snug text-muted-foreground">
                            {row.rawLine}
                          </span>
                        </TableCell>
                        <TableCell className="align-top py-2">
                          <Select
                            value={selectVal}
                            onValueChange={(v) => {
                              if (v === "__new__") {
                                updateRow(row.key, {
                                  ingredientId: null,
                                });
                              } else {
                                const opt = opts.find((o) => o.id === v);
                                updateRow(row.key, {
                                  ingredientId: v,
                                  newName: opt?.name ?? row.newName,
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Match" />
                            </SelectTrigger>
                            <SelectContent>
                              {opts.map((o) => (
                                <SelectItem key={o.id} value={o.id}>
                                  {o.name}
                                </SelectItem>
                              ))}
                              <SelectItem value="__new__">
                                New ingredient…
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          {!row.ingredientId && (
                            <div className="mt-2 space-y-1.5">
                              <Input
                                className="h-7 text-xs"
                                value={row.newName}
                                onChange={(e) =>
                                  updateRow(row.key, {
                                    newName: e.target.value,
                                  })
                                }
                                placeholder="Name"
                              />
                              <Select
                                value={row.newCategory}
                                onValueChange={(v) =>
                                  updateRow(row.key, {
                                    newCategory: v ?? row.newCategory,
                                  })
                                }
                              >
                                <SelectTrigger className="h-7 text-[10px]">
                                  <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(INGREDIENT_CATEGORIES).map(
                                    ([k, { label }]) => (
                                      <SelectItem key={k} value={k}>
                                        {label}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="align-top pt-3">
                          <ConfidenceBadge confidence={row.confidence} />
                        </TableCell>
                        <TableCell className="align-top pt-1.5">
                          <Input
                            type="number"
                            min={0.001}
                            step="any"
                            className="h-8 text-xs"
                            value={row.quantity}
                            onChange={(e) =>
                              updateRow(row.key, {
                                quantity: parseFloat(e.target.value) || 0,
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="align-top pt-1.5">
                          <Input
                            className="h-8 text-xs"
                            value={row.unit}
                            onChange={(e) =>
                              updateRow(row.key, { unit: e.target.value })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <DialogFooter className="mx-0 mb-0 mt-0 shrink-0 border-t border-border bg-muted/40 px-4 py-3 backdrop-blur-md supports-backdrop-filter:bg-muted/30 sm:justify-end">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={submitBulk}
                disabled={!someSelected || bulkMutation.isPending}
              >
                {bulkMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Adding…
                  </>
                ) : (
                  "Add to pantry"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
