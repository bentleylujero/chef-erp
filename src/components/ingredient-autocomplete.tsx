"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useIngredientSearch, type Ingredient } from "@/hooks/use-inventory";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_COLORS: Record<string, string> = {
  POULTRY: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  RED_MEAT: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  SEAFOOD: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  CURED_DELI: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  PROTEIN: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  VEGETABLE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  FRUIT: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  AROMATIC: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400",
  MUSHROOM: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  PRODUCE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  DAIRY: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  CHEESE: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  SAUCE: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  PASTE: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400",
  VINEGAR: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  CONDIMENT: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  SPICE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  HERB: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  GRAIN: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  LEGUME: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  OIL_FAT: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  NUT_SEED: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  BAKING: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  PANTRY_STAPLE: "bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-400",
  SWEETENER: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  BEVERAGE: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  OTHER: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

function formatCategory(cat: string) {
  return cat
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface SelectedIngredient {
  id: string;
  name: string;
  defaultUnit: string;
  category: string;
  storageType: string;
  shelfLifeDays: number | null;
  avgPricePerUnit: number | null;
}

interface IngredientAutocompleteProps {
  onSelect: (ingredient: SelectedIngredient) => void;
  onFreeformSubmit?: (name: string) => void;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

export function IngredientAutocomplete({
  onSelect,
  onFreeformSubmit,
  value: controlledValue,
  onChange: controlledOnChange,
  placeholder = "Search ingredients...",
  className,
  autoFocus,
  disabled,
}: IngredientAutocompleteProps) {
  const [internalValue, setInternalValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const inputValue = controlledValue ?? internalValue;
  const setInputValue = controlledOnChange ?? setInternalValue;

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: results = [], isLoading } = useIngredientSearch(debouncedSearch);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(inputValue.trim());
    }, 200);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [inputValue]);

  useEffect(() => {
    if (debouncedSearch.length > 0 && results.length > 0) {
      setIsOpen(true);
    }
  }, [results, debouncedSearch]);

  useEffect(() => {
    setHighlightIndex(-1);
  }, [results]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectIngredient = useCallback(
    (ingredient: Ingredient) => {
      onSelect({
        id: ingredient.id,
        name: ingredient.name,
        defaultUnit: ingredient.defaultUnit,
        category: ingredient.category,
        storageType: ingredient.storageType,
        shelfLifeDays: ingredient.shelfLifeDays,
        avgPricePerUnit: ingredient.avgPricePerUnit,
      });
      setInputValue(ingredient.name);
      setIsOpen(false);
      setDebouncedSearch("");
    },
    [onSelect, setInputValue],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || results.length === 0) {
      if (e.key === "Enter" && inputValue.trim() && onFreeformSubmit) {
        e.preventDefault();
        onFreeformSubmit(inputValue.trim());
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < results.length) {
          selectIngredient(results[highlightIndex]);
        } else if (results.length > 0) {
          selectIngredient(results[0]);
        } else if (onFreeformSubmit && inputValue.trim()) {
          onFreeformSubmit(inputValue.trim());
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
      case "Tab":
        if (results.length > 0) {
          e.preventDefault();
          const idx = highlightIndex >= 0 ? highlightIndex : 0;
          selectIngredient(results[idx]);
        }
        break;
    }
  }

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (!isOpen && e.target.value.length > 0) setIsOpen(true);
          }}
          onFocus={() => {
            if (inputValue.length > 0 && results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-9 pr-8"
          autoFocus={autoFocus}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
        />
        {inputValue.length > 0 && (
          <ChevronDown
            className={cn(
              "text-muted-foreground absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        )}
      </div>

      {isOpen && inputValue.length > 0 && (
        <div
          ref={listRef}
          className="bg-popover text-popover-foreground border-border absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border shadow-lg"
        >
          {isLoading && (
            <div className="text-muted-foreground px-3 py-2 text-sm">
              Searching...
            </div>
          )}
          {!isLoading && results.length === 0 && debouncedSearch.length > 0 && (
            <div className="px-3 py-2">
              <div className="text-muted-foreground text-sm">
                No matches for &ldquo;{debouncedSearch}&rdquo;
              </div>
              {onFreeformSubmit && (
                <button
                  className="text-primary mt-1 text-sm font-medium hover:underline"
                  onClick={() => onFreeformSubmit(inputValue.trim())}
                >
                  Add &ldquo;{inputValue.trim()}&rdquo; as custom ingredient
                </button>
              )}
            </div>
          )}
          {results.map((ingredient, idx) => (
            <button
              key={ingredient.id}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                idx === highlightIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50",
              )}
              onClick={() => selectIngredient(ingredient)}
              onMouseEnter={() => setHighlightIndex(idx)}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{ingredient.name}</div>
                {(() => {
                  const hint =
                    ingredient.resolveVia &&
                    ingredient.resolveVia !== "exact_name" &&
                    ingredient.matchedVia
                      ? ingredient.matchedVia
                      : null;
                  const desc = ingredient.description?.trim();
                  const sub = [hint, desc].filter(Boolean).join(" · ");
                  return sub ? (
                    <div className="text-muted-foreground truncate text-xs">
                      {sub}
                    </div>
                  ) : null;
                })()}
              </div>
              <Badge
                variant="secondary"
                className={cn(
                  "shrink-0 text-[10px]",
                  CATEGORY_COLORS[ingredient.category],
                )}
              >
                {formatCategory(ingredient.category)}
              </Badge>
              <span className="text-muted-foreground shrink-0 text-xs">
                {ingredient.defaultUnit}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
