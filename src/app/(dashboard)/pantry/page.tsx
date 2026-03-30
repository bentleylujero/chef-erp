"use client";

import { useState, useCallback, useEffect } from "react";
import {
  format,
  differenceInDays,
  isPast,
  addDays,
} from "date-fns";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  AlertTriangle,
  CalendarDays,
  X,
  Loader2,
  Camera,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { INGREDIENT_CATEGORIES } from "@/lib/utils/categories";
import {
  useInventory,
  useAddInventory,
  useUpdateInventory,
  useDeleteInventory,
  type InventoryItem,
} from "@/hooks/use-inventory";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  IngredientAutocomplete,
  type SelectedIngredient,
} from "@/components/ingredient-autocomplete";
import { VoiceInput } from "@/components/voice-input";
import { PastePantryDialog } from "@/components/paste-pantry-dialog";

// ─── Constants ────────────────────────────────────────

const LOCATION_CONFIG: Record<string, { label: string; color: string }> = {
  FRIDGE: {
    label: "Fridge",
    color: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  },
  FREEZER: {
    label: "Freezer",
    color: "bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200",
  },
  PANTRY: {
    label: "Pantry",
    color: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  COUNTER: {
    label: "Counter",
    color: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  },
};

interface FormState {
  ingredientId: string;
  ingredientName: string;
  quantity: string;
  unit: string;
  location: string;
  purchaseDate: Date | undefined;
  expiryDate: Date | undefined;
  cost: string;
  parLevel: string;
  shelfLifeDays: number | null;
}

const EMPTY_FORM: FormState = {
  ingredientId: "",
  ingredientName: "",
  quantity: "",
  unit: "",
  location: "PANTRY",
  purchaseDate: new Date(),
  expiryDate: undefined,
  cost: "",
  parLevel: "",
  shelfLifeDays: null,
};

function expiryStatus(expiryDate: string | null) {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate);
  if (isPast(expiry)) return "expired" as const;
  const days = differenceInDays(expiry, new Date());
  if (days <= 3) return "warning" as const;
  if (days <= 7) return "caution" as const;
  return "ok" as const;
}

// ─── Page ─────────────────────────────────────────────

export default function PantryPage() {
  // Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [location, setLocation] = useState("ALL");
  const [expiringSoon, setExpiringSoon] = useState(false);

  // Sheet / form state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Autocomplete text for voice input
  const [autocompleteText, setAutocompleteText] = useState("");

  // Delete dialog
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);

  // Paste list dialog
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);

  // Date pickers
  const [purchaseDateOpen, setPurchaseDateOpen] = useState(false);
  const [expiryDateOpen, setExpiryDateOpen] = useState(false);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ─── Queries & mutations ───────────────────────────
  const { data: items = [], isLoading } = useInventory({
    search: debouncedSearch || undefined,
    category: category !== "ALL" ? category : undefined,
    location: location !== "ALL" ? location : undefined,
    expiring: expiringSoon || undefined,
  });

  const addMutation = useAddInventory();
  const updateMutation = useUpdateInventory();
  const deleteMutation = useDeleteInventory();

  // ─── Derived stats ─────────────────────────────────
  const belowParCount = items.filter(
    (i) => i.parLevel != null && i.quantity < i.parLevel,
  ).length;
  const expiringCount = items.filter((i) => {
    const s = expiryStatus(i.expiryDate);
    return s === "expired" || s === "warning";
  }).length;

  // ─── Handlers ──────────────────────────────────────
  const openAdd = useCallback(() => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setAutocompleteText("");
    setSheetOpen(true);
  }, []);

  const openEdit = useCallback((item: InventoryItem) => {
    setEditingItem(item);
    setForm({
      ingredientId: item.ingredientId,
      ingredientName: item.ingredient.name,
      quantity: String(item.quantity),
      unit: item.unit,
      location: item.location,
      purchaseDate: item.purchaseDate
        ? new Date(item.purchaseDate)
        : undefined,
      expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
      cost: item.cost != null ? String(item.cost) : "",
      parLevel: item.parLevel != null ? String(item.parLevel) : "",
      shelfLifeDays: item.ingredient.shelfLifeDays,
    });
    setSheetOpen(true);
  }, []);

  const selectIngredient = useCallback(
    (ing: SelectedIngredient) => {
      const expiry =
        ing.shelfLifeDays && form.purchaseDate
          ? addDays(form.purchaseDate, ing.shelfLifeDays)
          : undefined;
      setForm((prev) => ({
        ...prev,
        ingredientId: ing.id,
        ingredientName: ing.name,
        unit: ing.defaultUnit,
        location: ing.storageType,
        expiryDate: expiry,
        shelfLifeDays: ing.shelfLifeDays,
      }));
      setAutocompleteText(ing.name);
    },
    [form.purchaseDate],
  );

  const handleSubmit = useCallback(async () => {
    const qty = parseFloat(form.quantity);
    if (!form.ingredientId || isNaN(qty) || qty <= 0 || !form.unit) {
      toast.error("Please fill in all required fields");
      return;
    }

    const name = form.ingredientName;
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({
          id: editingItem.id,
          quantity: qty,
          unit: form.unit,
          purchaseDate: form.purchaseDate?.toISOString() ?? null,
          expiryDate: form.expiryDate?.toISOString() ?? null,
          cost: form.cost ? parseFloat(form.cost) : null,
          location: form.location,
          parLevel: form.parLevel ? parseFloat(form.parLevel) : null,
        });
        toast.success(`Updated ${name}`);
      } else {
        await addMutation.mutateAsync({
          ingredientId: form.ingredientId,
          quantity: qty,
          unit: form.unit,
          purchaseDate: form.purchaseDate?.toISOString(),
          expiryDate: form.expiryDate?.toISOString(),
          cost: form.cost ? parseFloat(form.cost) : undefined,
          location: form.location,
          parLevel: form.parLevel ? parseFloat(form.parLevel) : undefined,
        });
        toast.success(`Added ${name} to pantry`);
      }
      setSheetOpen(false);
    } catch {
      toast.error(editingItem ? "Failed to update item" : "Failed to add item");
    }
  }, [form, editingItem, addMutation, updateMutation]);

  const handleDelete = useCallback(async () => {
    if (!deleteItem) return;
    const name = deleteItem.ingredient.name;
    try {
      await deleteMutation.mutateAsync(deleteItem.id);
      toast.success(`Removed ${name}`);
      setDeleteItem(null);
    } catch {
      toast.error("Failed to delete item");
    }
  }, [deleteItem, deleteMutation]);

  const isSubmitting = addMutation.isPending || updateMutation.isPending;
  const hasFilters =
    search || category !== "ALL" || location !== "ALL" || expiringSoon;

  // ─── Render ────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pantry</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {items.length} item{items.length !== 1 && "s"}
            </span>
            {belowParCount > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="size-3" />
                {belowParCount} below par
              </span>
            )}
            {expiringCount > 0 && (
              <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                <AlertTriangle className="size-3" />
                {expiringCount} expiring
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPasteDialogOpen(true)}
          >
            <ClipboardList className="size-4 mr-1.5" />
            Paste list
          </Button>
          <Link href="/pantry/scan">
            <Button variant="outline" size="sm">
              <Camera className="size-4 mr-1.5" />
              Scan Receipt
            </Button>
          </Link>
          <Button onClick={openAdd}>
            <Plus className="size-4 mr-1.5" />
            Add Item
          </Button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search ingredients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 w-48 pl-7 text-xs"
          />
        </div>

        <Select value={category} onValueChange={(v) => setCategory(v ?? "ALL")}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {Object.entries(INGREDIENT_CATEGORIES).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={location} onValueChange={(v) => setLocation(v ?? "ALL")}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All locations</SelectItem>
            {Object.entries(LOCATION_CONFIG).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={expiringSoon ? "default" : "outline"}
          size="xs"
          onClick={() => setExpiringSoon((v) => !v)}
        >
          <AlertTriangle className="size-3 mr-1" />
          Expiring Soon
        </Button>

        {hasFilters && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setSearch("");
              setCategory("ALL");
              setLocation("ALL");
              setExpiringSoon(false);
            }}
          >
            <X className="size-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* ── Table / Empty / Loading ── */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="mb-3 size-12 text-muted-foreground/30" />
          <h3 className="text-lg font-medium">No items in your pantry</h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Start tracking your ingredients by adding items to your inventory.
          </p>
          <Button onClick={openAdd} size="sm" className="mt-4">
            <Plus className="mr-1.5 size-4" />
            Add your first item
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-3">Ingredient</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Purchased</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Par</TableHead>
                <TableHead className="w-16 pr-3 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const cat =
                  INGREDIENT_CATEGORIES[
                    item.ingredient
                      .category as keyof typeof INGREDIENT_CATEGORIES
                  ];
                const loc = LOCATION_CONFIG[item.location];
                const es = expiryStatus(item.expiryDate);
                const belowPar =
                  item.parLevel != null && item.quantity < item.parLevel;

                return (
                  <TableRow key={item.id}>
                    <TableCell className="pl-3 font-medium">
                      {item.ingredient.description ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span className="cursor-default border-b border-dashed border-muted-foreground/40" />
                            }
                          >
                            {item.ingredient.name}
                          </TooltipTrigger>
                          <TooltipContent
                            side="right"
                            className="max-w-60"
                          >
                            {item.ingredient.description}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        item.ingredient.name
                      )}
                    </TableCell>
                    <TableCell>
                      {cat && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "h-4 px-1.5 text-[10px]",
                            cat.color,
                          )}
                        >
                          {cat.label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.quantity}
                      <span className="ml-0.5 text-xs text-muted-foreground">
                        {item.unit}
                      </span>
                    </TableCell>
                    <TableCell>
                      {loc && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "h-4 px-1.5 text-[10px]",
                            loc.color,
                          )}
                        >
                          {loc.label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {item.purchaseDate
                        ? format(new Date(item.purchaseDate), "MMM d")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {item.expiryDate ? (
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-xs tabular-nums",
                            es === "expired" &&
                              "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
                            es === "warning" &&
                              "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
                            es === "caution" &&
                              "text-yellow-700 dark:text-yellow-400",
                            es === "ok" && "text-muted-foreground",
                          )}
                        >
                          {format(new Date(item.expiryDate), "MMM d")}
                          {es === "expired" && " · expired"}
                          {es === "warning" &&
                            ` · ${differenceInDays(new Date(item.expiryDate), new Date())}d`}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {item.parLevel != null ? (
                        <span
                          className={cn(
                            belowPar &&
                              "font-semibold text-destructive",
                          )}
                        >
                          {item.quantity}/{item.parLevel}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-3 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteItem(item)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Add / Edit Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editingItem ? "Edit Item" : "Add to Pantry"}
            </SheetTitle>
            <SheetDescription>
              {editingItem
                ? `Update ${editingItem.ingredient.name} details.`
                : "Search for an ingredient and set its details."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            {/* Ingredient picker (add mode) */}
            {!editingItem ? (
              <div className="space-y-1.5">
                <Label>Ingredient *</Label>
                {form.ingredientId ? (
                  <div className="flex items-center justify-between rounded-lg border border-input px-3 py-2">
                    <div>
                      <span className="text-sm font-medium">
                        {form.ingredientName}
                      </span>
                      {form.shelfLifeDays && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {form.shelfLifeDays}d shelf life
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        setForm((p) => ({
                          ...p,
                          ingredientId: "",
                          ingredientName: "",
                          unit: "",
                          expiryDate: undefined,
                          shelfLifeDays: null,
                        }));
                        setAutocompleteText("");
                      }}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <IngredientAutocomplete
                      className="flex-1"
                      value={autocompleteText}
                      onChange={setAutocompleteText}
                      onSelect={selectIngredient}
                      placeholder="Type to search ingredients…"
                      autoFocus
                    />
                    <VoiceInput
                      onTranscript={(text) => {
                        setAutocompleteText(text);
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Ingredient</Label>
                <div className="rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm">
                  {form.ingredientName}
                </div>
              </div>
            )}

            {/* Quantity + Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, quantity: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit *</Label>
                <Input
                  placeholder="g, ml, count…"
                  value={form.unit}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, unit: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label>Storage Location</Label>
              <Select
                value={form.location}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, location: v ?? "PANTRY" }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LOCATION_CONFIG).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Purchase date */}
            <div className="space-y-1.5">
              <Label>Purchase Date</Label>
              <Popover
                open={purchaseDateOpen}
                onOpenChange={setPurchaseDateOpen}
              >
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start font-normal",
                        !form.purchaseDate && "text-muted-foreground",
                      )}
                    />
                  }
                >
                  <CalendarDays className="mr-2 size-3.5" />
                  {form.purchaseDate
                    ? format(form.purchaseDate, "PPP")
                    : "Pick a date"}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.purchaseDate}
                    onSelect={(date) => {
                      setForm((prev) => {
                        const newExpiry =
                          prev.shelfLifeDays && date
                            ? addDays(date, prev.shelfLifeDays)
                            : prev.expiryDate;
                        return {
                          ...prev,
                          purchaseDate: date ?? undefined,
                          expiryDate: newExpiry ?? undefined,
                        };
                      });
                      setPurchaseDateOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Expiry date */}
            <div className="space-y-1.5">
              <Label>
                Expiry Date
                {form.shelfLifeDays != null && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    ({form.shelfLifeDays}d shelf life)
                  </span>
                )}
              </Label>
              <Popover open={expiryDateOpen} onOpenChange={setExpiryDateOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start font-normal",
                        !form.expiryDate && "text-muted-foreground",
                      )}
                    />
                  }
                >
                  <CalendarDays className="mr-2 size-3.5" />
                  {form.expiryDate
                    ? format(form.expiryDate, "PPP")
                    : "No expiry set"}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.expiryDate}
                    onSelect={(date) => {
                      setForm((p) => ({
                        ...p,
                        expiryDate: date ?? undefined,
                      }));
                      setExpiryDateOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Cost */}
            <div className="space-y-1.5">
              <Label>Cost ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.cost}
                onChange={(e) =>
                  setForm((p) => ({ ...p, cost: e.target.value }))
                }
              />
            </div>

            {/* Par level */}
            <div className="space-y-1.5">
              <Label>Par Level</Label>
              <Input
                type="number"
                step="any"
                min="0"
                placeholder="Minimum stock level"
                value={form.parLevel}
                onChange={(e) =>
                  setForm((p) => ({ ...p, parLevel: e.target.value }))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Get alerted when stock falls below this level.
              </p>
            </div>
          </div>

          <SheetFooter>
            <SheetClose render={<Button variant="outline" />}>
              Cancel
            </SheetClose>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              )}
              {editingItem ? "Save Changes" : "Add to Pantry"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Delete Confirmation ── */}
      <AlertDialog
        open={!!deleteItem}
        onOpenChange={(open) => {
          if (!open) setDeleteItem(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from pantry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove{" "}
              <span className="font-medium text-foreground">
                {deleteItem?.ingredient.name}
              </span>{" "}
              ({deleteItem?.quantity} {deleteItem?.unit}) from your inventory.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 size-3.5" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PastePantryDialog
        open={pasteDialogOpen}
        onOpenChange={setPasteDialogOpen}
      />
    </div>
  );
}
