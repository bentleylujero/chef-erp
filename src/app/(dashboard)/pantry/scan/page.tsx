"use client";

import { useState, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Camera,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Search,
  Package,
  Receipt,
  Sparkles,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useParseReceipt,
  useConfirmReceipt,
  type ConfirmReceiptResult,
} from "@/hooks/use-receipt-scan";
import type { ParsedReceipt, ParsedReceiptItem } from "@/lib/ai/receipt-parser";
import { useIngredientSearch } from "@/hooks/use-inventory";

type ScanStep = "upload" | "processing" | "review" | "success";

interface EditableItem extends ParsedReceiptItem {
  included: boolean;
  editedQuantity: number;
  editedUnit: string;
  editedPrice: number;
}

function ConfidenceBadge({ confidence }: { confidence: ParsedReceiptItem["confidence"] }) {
  const map = {
    high: { label: "High match", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
    medium: { label: "Likely match", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    low: { label: "Weak match", className: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
    unmatched: { label: "Unmatched", className: "bg-red-500/15 text-red-700 dark:text-red-400" },
  } as const;

  const cfg = map[confidence];
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${cfg.className}`}>{cfg.label}</span>;
}

function IngredientPicker({
  currentId,
  currentName,
  onSelect,
}: {
  currentId: string | null;
  currentName: string | null;
  onSelect: (id: string, name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { data: results } = useIngredientSearch(query);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-1.5">
        {currentName ? (
          <span className="text-sm font-medium truncate max-w-[140px]">{currentName}</span>
        ) : (
          <span className="text-sm text-muted-foreground italic">None</span>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setOpen(!open)}
          aria-label="Search ingredients"
        >
          <Search className="size-3" />
        </Button>
      </div>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-64 rounded-lg border bg-popover p-2 shadow-lg">
          <Input
            placeholder="Search ingredients..."
            value={query}
            onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
            className="mb-2 h-7 text-xs"
            autoFocus
          />
          <div className="max-h-40 overflow-y-auto">
            {results && results.length > 0 ? (
              results.map((ing) => (
                <button
                  key={ing.id}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted transition-colors"
                  onClick={() => {
                    onSelect(ing.id, ing.name);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Package className="size-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{ing.name}</span>
                  {ing.id === currentId && (
                    <CheckCircle2 className="size-3 text-emerald-500 ml-auto shrink-0" />
                  )}
                </button>
              ))
            ) : query.length > 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground text-center">
                No ingredients found
              </p>
            ) : (
              <p className="px-2 py-3 text-xs text-muted-foreground text-center">
                Type to search...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UploadStep({
  onImageSelected,
}: {
  onImageSelected: (base64: string, preview: string) => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        onImageSelected(base64, dataUrl);
      };
      reader.readAsDataURL(file);
    },
    [onImageSelected],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div
        className={`
          relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12
          transition-all duration-200 cursor-pointer
          ${
            dragActive
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
          }
        `}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div className="mb-4 rounded-2xl bg-primary/10 p-4">
          <Receipt className="size-10 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">Drop your receipt here</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          or click to browse files
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Supports JPEG, PNG, WebP up to 15MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground font-medium">OR</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" />
          Upload Image
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.capture = "environment";
            input.onchange = () => {
              const file = input.files?.[0];
              if (file) processFile(file);
            };
            input.click();
          }}
        >
          <Camera className="size-4" />
          Take Photo
        </Button>
      </div>
    </div>
  );
}

function ProcessingStep({ preview }: { preview: string }) {
  return (
    <div className="mx-auto max-w-md space-y-8 text-center">
      <div className="relative mx-auto w-48 overflow-hidden rounded-xl border shadow-lg">
        <img
          src={preview}
          alt="Uploaded receipt"
          className="w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <span className="text-sm font-medium">Analyzing...</span>
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold">Reading your receipt</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          AI is extracting items, prices, and matching to your ingredient database
        </p>
      </div>
    </div>
  );
}

function ReviewStep({
  receipt,
  items,
  onItemChange,
  onToggleItem,
  onToggleAll,
  onStoreName,
  onReceiptDate,
  onConfirm,
  confirming,
}: {
  receipt: ParsedReceipt;
  items: EditableItem[];
  onItemChange: (index: number, updates: Partial<EditableItem>) => void;
  onToggleItem: (index: number) => void;
  onToggleAll: (checked: boolean) => void;
  onStoreName: (name: string) => void;
  onReceiptDate: (date: string) => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const includedItems = items.filter((i) => i.included);
  const matchedItems = includedItems.filter((i) => i.matchedIngredientId);
  const totalPrice = includedItems.reduce((s, i) => s + i.editedPrice, 0);
  const allChecked = items.length > 0 && items.every((i) => i.included);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <Card className="flex-1 min-w-[200px]">
          <CardContent className="pt-0">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Receipt className="size-4 text-primary" />
              </div>
              <div>
                <Input
                  value={receipt.storeName ?? ""}
                  onChange={(e) => onStoreName((e.target as HTMLInputElement).value)}
                  placeholder="Store name"
                  className="h-7 text-sm font-medium border-none p-0 shadow-none focus-visible:ring-0"
                />
                <Input
                  type="date"
                  value={receipt.receiptDate ?? ""}
                  onChange={(e) => onReceiptDate((e.target as HTMLInputElement).value)}
                  className="h-6 text-xs text-muted-foreground border-none p-0 shadow-none focus-visible:ring-0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Card className="min-w-[140px]">
            <CardContent className="pt-0 text-center">
              <p className="text-2xl font-bold tabular-nums">{includedItems.length}</p>
              <p className="text-xs text-muted-foreground">Items selected</p>
            </CardContent>
          </Card>
          <Card className="min-w-[140px]">
            <CardContent className="pt-0 text-center">
              <p className="text-2xl font-bold tabular-nums">{matchedItems.length}</p>
              <p className="text-xs text-muted-foreground">Auto-matched</p>
            </CardContent>
          </Card>
          <Card className="min-w-[140px]">
            <CardContent className="pt-0 text-center">
              <p className="text-2xl font-bold tabular-nums">${totalPrice.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Total cost</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" />
            Parsed Items
            <Badge variant="secondary" className="ml-auto">
              {items.length} items found
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={(checked) => onToggleAll(checked === true)}
                  />
                </TableHead>
                <TableHead>Receipt Item</TableHead>
                <TableHead>Matched Ingredient</TableHead>
                <TableHead className="w-20">Confidence</TableHead>
                <TableHead className="w-24">Qty</TableHead>
                <TableHead className="w-20">Unit</TableHead>
                <TableHead className="w-24 text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow
                  key={idx}
                  className={!item.included ? "opacity-40" : undefined}
                >
                  <TableCell className="pl-4">
                    <Checkbox
                      checked={item.included}
                      onCheckedChange={() => onToggleItem(idx)}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-sm">{item.rawName}</span>
                  </TableCell>
                  <TableCell>
                    <IngredientPicker
                      currentId={item.matchedIngredientId}
                      currentName={item.matchedIngredientName}
                      onSelect={(id, name) =>
                        onItemChange(idx, {
                          matchedIngredientId: id,
                          matchedIngredientName: name,
                          confidence: "high",
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <ConfidenceBadge confidence={item.confidence} />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.editedQuantity}
                      onChange={(e) =>
                        onItemChange(idx, {
                          editedQuantity: parseFloat((e.target as HTMLInputElement).value) || 0,
                        })
                      }
                      className="h-7 w-20 text-xs tabular-nums"
                      min={0}
                      step={0.01}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.editedUnit}
                      onChange={(e) =>
                        onItemChange(idx, { editedUnit: (e.target as HTMLInputElement).value })
                      }
                      className="h-7 w-16 text-xs"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      value={item.editedPrice}
                      onChange={(e) =>
                        onItemChange(idx, {
                          editedPrice: parseFloat((e.target as HTMLInputElement).value) || 0,
                        })
                      }
                      className="h-7 w-20 text-xs tabular-nums text-right ml-auto"
                      min={0}
                      step={0.01}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No items were extracted from the receipt
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {matchedItems.length} of {includedItems.length} items matched to ingredients.
          {" "}Unmatched items without a selection will be skipped.
        </p>
        <Button
          size="lg"
          onClick={onConfirm}
          disabled={confirming || matchedItems.length === 0}
        >
          {confirming ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          Confirm & Update Pantry
        </Button>
      </div>
    </div>
  );
}

function safeOnboardingReturnHref(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  const path = raw.split("?")[0];
  if (path !== "/onboarding") return null;
  return raw;
}

function SuccessStep({
  result,
  returnTo,
}: {
  result: ConfirmReceiptResult;
  returnTo: string | null;
}) {
  const continueHref = safeOnboardingReturnHref(returnTo);
  return (
    <div className="mx-auto max-w-md space-y-8 text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-500/10">
        <CheckCircle2 className="size-10 text-emerald-500" />
      </div>
      <div>
        <h3 className="text-2xl font-bold">Pantry Updated!</h3>
        <p className="mt-2 text-muted-foreground">
          Your inventory has been updated with the receipt items.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-0 text-center">
            <p className="text-3xl font-bold text-primary">
              {result.itemsProcessed}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Items added</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-0 text-center">
            <p className="text-3xl font-bold text-primary">
              ${result.totalCost.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Total logged</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-0 text-center">
            <p className="text-3xl font-bold">{result.inventoryCreated}</p>
            <p className="text-xs text-muted-foreground mt-1">New items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-0 text-center">
            <p className="text-3xl font-bold">{result.inventoryUpdated}</p>
            <p className="text-xs text-muted-foreground mt-1">Restocked</p>
          </CardContent>
        </Card>
      </div>

      {result.generationTriggered && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-0 flex items-center gap-3">
            <Sparkles className="size-5 text-primary shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium">New recipes incoming!</p>
              <p className="text-xs text-muted-foreground">
                New ingredients detected. The AI will generate recipes using your updated pantry.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3 justify-center">
        {continueHref ? (
          <Link
            href={continueHref}
            className={buttonVariants({ variant: "default", size: "lg" })}
          >
            <ArrowRight className="size-4" />
            Continue setup
          </Link>
        ) : null}
        <Link
          href="/pantry"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <Package className="size-4" />
          View Pantry
        </Link>
        <Link
          href={
            continueHref
              ? `/pantry/scan?returnTo=${encodeURIComponent(continueHref)}`
              : "/pantry/scan"
          }
          className={buttonVariants({
            variant: continueHref ? "outline" : "default",
            size: "lg",
          })}
        >
          <RotateCcw className="size-4" />
          Scan Another
        </Link>
      </div>
    </div>
  );
}

function ScanReceiptPageInner() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const [step, setStep] = useState<ScanStep>("upload");
  const [imageBase64, setImageBase64] = useState<string>("");
  const [preview, setPreview] = useState<string>("");
  const [receipt, setReceipt] = useState<ParsedReceipt | null>(null);
  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);
  const [confirmResult, setConfirmResult] = useState<ConfirmReceiptResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseMutation = useParseReceipt();
  const confirmMutation = useConfirmReceipt();

  const handleImageSelected = useCallback(
    (base64: string, previewUrl: string) => {
      setImageBase64(base64);
      setPreview(previewUrl);
      setStep("processing");
      setError(null);

      parseMutation.mutate(base64, {
        onSuccess: (data) => {
          setReceipt(data);
          setEditableItems(
            data.items.map((item) => ({
              ...item,
              included: true,
              editedQuantity: item.quantity,
              editedUnit: item.unit,
              editedPrice: item.price,
            })),
          );
          setStep("review");
        },
        onError: (err) => {
          setError(err.message);
          setStep("upload");
        },
      });
    },
    [parseMutation],
  );

  const handleItemChange = useCallback(
    (index: number, updates: Partial<EditableItem>) => {
      setEditableItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, ...updates } : item)),
      );
    },
    [],
  );

  const handleToggleItem = useCallback((index: number) => {
    setEditableItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, included: !item.included } : item,
      ),
    );
  }, []);

  const handleToggleAll = useCallback((checked: boolean) => {
    setEditableItems((prev) => prev.map((item) => ({ ...item, included: checked })));
  }, []);

  const handleConfirm = useCallback(() => {
    if (!receipt) return;

    const confirmedItems = editableItems
      .filter((item) => item.included && item.matchedIngredientId)
      .map((item) => ({
        ingredientId: item.matchedIngredientId!,
        quantity: item.editedQuantity,
        unit: item.editedUnit,
        cost: item.editedPrice,
      }));

    if (confirmedItems.length === 0) return;

    confirmMutation.mutate(
      {
        items: confirmedItems,
        storeName: receipt.storeName,
        receiptDate: receipt.receiptDate,
        totalAmount: receipt.totalAmount,
        imageBase64,
      },
      {
        onSuccess: (data) => {
          setConfirmResult(data);
          setStep("success");
        },
        onError: (err) => {
          setError(err.message);
        },
      },
    );
  }, [receipt, editableItems, confirmMutation, imageBase64]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scan Receipt</h1>
          <p className="text-muted-foreground mt-1">
            Upload a photo of your grocery receipt to auto-update inventory.
          </p>
        </div>
        {step !== "upload" && step !== "success" && (
          <Button
            variant="outline"
            onClick={() => {
              setStep("upload");
              setReceipt(null);
              setEditableItems([]);
              setError(null);
              setImageBase64("");
              setPreview("");
            }}
          >
            <RotateCcw className="size-4" />
            Start Over
          </Button>
        )}
      </div>

      {step !== "upload" && step !== "success" && (
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          {(["upload", "processing", "review"] as const).map((s, i) => {
            const labels = { upload: "Upload", processing: "Analyze", review: "Review" };
            const stepIndex = ["upload", "processing", "review"].indexOf(step);
            const isCurrent = s === step;
            const isPast = i < stepIndex;
            return (
              <span key={s} className="flex items-center gap-2">
                {i > 0 && <ArrowRight className="size-3" />}
                <span
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isPast
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "bg-muted"
                  }`}
                >
                  {isPast && <CheckCircle2 className="size-3" />}
                  {labels[s]}
                </span>
              </span>
            );
          })}
        </nav>
      )}

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-0 flex items-center gap-3">
            <XCircle className="size-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Something went wrong</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto shrink-0"
              onClick={() => setError(null)}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "upload" && <UploadStep onImageSelected={handleImageSelected} />}
      {step === "processing" && <ProcessingStep preview={preview} />}
      {step === "review" && receipt && (
        <ReviewStep
          receipt={receipt}
          items={editableItems}
          onItemChange={handleItemChange}
          onToggleItem={handleToggleItem}
          onToggleAll={handleToggleAll}
          onStoreName={(name) => setReceipt({ ...receipt, storeName: name })}
          onReceiptDate={(date) => setReceipt({ ...receipt, receiptDate: date })}
          onConfirm={handleConfirm}
          confirming={confirmMutation.isPending}
        />
      )}
      {step === "success" && confirmResult && (
        <SuccessStep result={confirmResult} returnTo={returnTo} />
      )}
    </div>
  );
}

export default function ScanReceiptPage() {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground p-8 text-center text-sm">
          Loading…
        </div>
      }
    >
      <ScanReceiptPageInner />
    </Suspense>
  );
}
