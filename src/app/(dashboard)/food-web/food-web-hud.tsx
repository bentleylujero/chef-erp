"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Fuse from "fuse.js";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Network,
  Link2,
  Zap,
  Hexagon,
  Eye,
  EyeOff,
  X,
  ListTree,
  Unplug,
  Loader2,
  Sparkles,
  Search,
  ChevronRight,
  Compass,
} from "lucide-react";
import type { GraphNode, GraphMode } from "./food-web-types";
import {
  HUD,
  WEB,
  CUISINES,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  CATEGORY_GROUPS,
  hexToRgba,
} from "./food-web-constants";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HudCorners({ color = HUD.cyanDim }: { color?: string }) {
  const s = { borderColor: color };
  return (
    <>
      <span
        className="pointer-events-none absolute top-0 left-0 h-2 w-2 border-t border-l"
        style={s}
      />
      <span
        className="pointer-events-none absolute top-0 right-0 h-2 w-2 border-t border-r"
        style={s}
      />
      <span
        className="pointer-events-none absolute bottom-0 left-0 h-2 w-2 border-b border-l"
        style={s}
      />
      <span
        className="pointer-events-none absolute bottom-0 right-0 h-2 w-2 border-b border-r"
        style={s}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Stats HUD (top right)
// ---------------------------------------------------------------------------

interface StatsHudProps {
  nodeCount: number;
  linkCount: number;
  avgDeg: number;
  unlinkedHidden: number;
  monoClass: string;
}

function HudStat({
  icon,
  value,
  label,
  monoClass,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  monoClass: string;
}) {
  const formatted =
    typeof value === "number"
      ? Number.isInteger(value)
        ? value.toLocaleString()
        : value.toFixed(1)
      : value;

  return (
    <div
      className="relative flex items-center gap-2.5 rounded-lg px-3.5 py-2 backdrop-blur-xl"
      style={{
        background: HUD.panel,
        border: `1px solid ${HUD.border}`,
      }}
    >
      <HudCorners />
      <div style={{ color: hexToRgba(HUD.cyan, 0.45) }}>{icon}</div>
      <div>
        <div
          className={cn(
            monoClass,
            "text-lg font-bold tabular-nums leading-none",
          )}
          style={{ color: HUD.textPrimary }}
        >
          {formatted}
        </div>
        <div
          className={cn(
            monoClass,
            "text-[8px] font-medium uppercase tracking-[0.15em]",
          )}
          style={{ color: HUD.textDim }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

export function StatsHud({
  nodeCount,
  linkCount,
  avgDeg,
  unlinkedHidden,
  monoClass,
}: StatsHudProps) {
  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-1">
      <div className="flex gap-2.5">
        <HudStat
          icon={<Hexagon className="h-3.5 w-3.5" />}
          value={nodeCount}
          label="Nodes"
          monoClass={monoClass}
        />
        <HudStat
          icon={<Link2 className="h-3.5 w-3.5" />}
          value={linkCount}
          label="Synergies"
          monoClass={monoClass}
        />
        <HudStat
          icon={<Zap className="h-3.5 w-3.5" />}
          value={avgDeg}
          label="Avg Deg"
          monoClass={monoClass}
        />
      </div>
      {unlinkedHidden > 0 && (
        <span
          className={cn(
            monoClass,
            "max-w-[220px] text-right text-[8px] uppercase tracking-wider",
          )}
          style={{ color: HUD.textGhost }}
        >
          {unlinkedHidden} unlinked hidden
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filters panel (top left)
// ---------------------------------------------------------------------------

interface FiltersPanelProps {
  cuisine: string | undefined;
  setCuisine: (v: string | undefined) => void;
  pantryOnly: boolean;
  setPantryOnly: (v: boolean) => void;
  showUnlinked: boolean;
  setShowUnlinked: (v: boolean) => void;
  minWeight: number;
  setMinWeight: (v: number) => void;
  discoverMode: boolean;
  setDiscoverMode: (v: boolean) => void;
  bridgeStatus: {
    unlinkedCount: number;
    linkedCorpusPantryCount: number;
    novelPairCount: number;
    canGenerate: boolean;
    suggestedPairs: { ingredientIdA: string; ingredientIdB: string; nameA: string; nameB: string }[];
    nextBatchPairs?: { ingredientIdA: string; ingredientIdB: string; nameA: string; nameB: string }[];
  } | undefined;
  bridgeLoading: boolean;
  bridgeGenerate: { mutate: (u: undefined, opts: { onSuccess: (d: { recipesGenerated?: number }) => void; onError: (e: Error) => void }) => void; isPending: boolean };
  meshStatus: {
    canGenerate: boolean;
    reason?: string;
    meshRecipeCount?: number;
    hubCount?: number;
    pantrySize?: number;
    cooldownHoursRemaining?: number | null;
  } | undefined;
  meshLoading: boolean;
  meshGenerate: { mutate: (u: undefined, opts: { onSuccess: (d: { recipesGenerated?: number }) => void; onError: (e: Error) => void }) => void; isPending: boolean };
  monoClass: string;
}

export function FiltersPanel({
  cuisine,
  setCuisine,
  pantryOnly,
  setPantryOnly,
  showUnlinked,
  setShowUnlinked,
  minWeight,
  setMinWeight,
  discoverMode,
  setDiscoverMode,
  bridgeStatus,
  bridgeLoading,
  bridgeGenerate,
  meshStatus,
  meshLoading,
  meshGenerate,
  monoClass,
}: FiltersPanelProps) {
  const MONO = monoClass;

  return (
    <div className="absolute top-4 left-4 z-10">
      <div
        className="relative space-y-3 rounded-lg p-3 backdrop-blur-xl"
        style={{
          background: HUD.panel,
          border: `1px solid ${HUD.border}`,
        }}
      >
        <HudCorners />

        <Select
          value={cuisine ?? "__all__"}
          onValueChange={(v) =>
            setCuisine(!v || v === "__all__" ? undefined : v)
          }
        >
          <SelectTrigger
            className={cn(
              MONO,
              "h-7 w-[160px] border-[#1a1a2e] bg-transparent text-[10px]",
            )}
            style={{ color: HUD.textMuted }}
          >
            <SelectValue placeholder="All cuisines" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All cuisines</SelectItem>
            {CUISINES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={() => setPantryOnly(!pantryOnly)}
          className={cn(
            MONO,
            "flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-all",
            pantryOnly
              ? "border-[#ffab00]/40 bg-[#ffab00]/10 text-[#ffab00]"
              : "border-[#1a1a2e] text-[#475569] hover:text-[#94a3b8]",
          )}
        >
          {pantryOnly ? (
            <Eye className="h-3 w-3" />
          ) : (
            <EyeOff className="h-3 w-3" />
          )}
          Pantry Only
        </button>

        <button
          type="button"
          onClick={() => setShowUnlinked(!showUnlinked)}
          className={cn(
            MONO,
            "flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-all",
            showUnlinked
              ? "border-[#00e5ff]/35 bg-[#00e5ff]/8 text-[#7dd3fc]"
              : "border-[#1a1a2e] text-[#475569] hover:text-[#94a3b8]",
          )}
          title="Off: hide pantry items with no synergy edges. On: show every stocked item."
        >
          <Unplug className="h-3 w-3 shrink-0" />
          Unlinked items
        </button>

        {/* Discover mode toggle */}
        <button
          type="button"
          onClick={() => setDiscoverMode(!discoverMode)}
          className={cn(
            MONO,
            "flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-all",
            discoverMode
              ? "border-[#0eca78]/40 bg-[#0eca78]/10 text-[#0eca78]"
              : "border-[#1a1a2e] text-[#475569] hover:text-[#94a3b8]",
          )}
          title="Highlight unexplored ingredient combinations with high flavor affinity"
        >
          <Compass className="h-3 w-3 shrink-0" />
          Discover
        </button>

        <div className="flex items-center gap-2">
          <span
            className={cn(MONO, "text-[9px] uppercase tracking-wider")}
            style={{ color: HUD.textDim }}
          >
            Str
          </span>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={minWeight}
            onChange={(e) => setMinWeight(Number(e.target.value))}
            className="h-0.5 flex-1 cursor-pointer appearance-none rounded-full bg-[#1a1a2e] [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00e5ff] [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(0,229,255,0.6)]"
          />
          <span
            className={cn(MONO, "w-3 text-center text-[10px] font-bold")}
            style={{ color: HUD.cyan }}
          >
            {minWeight}
          </span>
        </div>

        {/* ── Pantry Bridge ── */}
        <div className="mt-1 space-y-2 border-t border-[#1a1a2e]/60 pt-2.5">
          <div
            className={cn(
              MONO,
              "text-[9px] font-medium uppercase tracking-[0.12em]",
            )}
            style={{ color: HUD.textDim }}
          >
            Pantry bridge
          </div>
          {bridgeLoading ? (
            <div
              className={cn(MONO, "flex items-center gap-2 text-[9px]")}
              style={{ color: HUD.textGhost }}
            >
              <Loader2 className="size-3 animate-spin shrink-0" />
              Scanning unlinked...
            </div>
          ) : bridgeStatus ? (
            <>
              <p
                className={cn(MONO, "text-[8px] leading-relaxed")}
                style={{ color: HUD.textGhost }}
              >
                {bridgeStatus.unlinkedCount === 0
                  ? "All stocked items already co-occur in your cookbook."
                  : `${bridgeStatus.unlinkedCount} unlinked · ${bridgeStatus.linkedCorpusPantryCount} stocked on graph · ${bridgeStatus.novelPairCount} novel pair${bridgeStatus.novelPairCount === 1 ? "" : "s"}`}
              </p>
              {(bridgeStatus.nextBatchPairs?.length
                ? bridgeStatus.nextBatchPairs
                : bridgeStatus.suggestedPairs
              )
                .slice(0, 3)
                .map((p) => (
                  <div
                    key={`${p.ingredientIdA}-${p.ingredientIdB}`}
                    className={cn(MONO, "truncate text-[8px]")}
                    style={{ color: HUD.textMuted }}
                    title={`${p.nameA} + ${p.nameB}`}
                  >
                    {p.nameA} + {p.nameB}
                  </div>
                ))}
              <button
                type="button"
                disabled={!bridgeStatus.canGenerate || bridgeGenerate.isPending}
                onClick={() => {
                  bridgeGenerate.mutate(undefined, {
                    onSuccess: (d) => {
                      toast.success(
                        `Bridge complete — ${d.recipesGenerated ?? 0} recipe(s) added`,
                      );
                    },
                    onError: (e) => toast.error(e.message),
                  });
                }}
                className={cn(
                  MONO,
                  "flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-all",
                  bridgeStatus.canGenerate && !bridgeGenerate.isPending
                    ? "border-[#00e5ff]/35 bg-[#00e5ff]/10 text-[#7dd3fc] hover:bg-[#00e5ff]/15"
                    : "cursor-not-allowed border-[#1a1a2e] text-[#475569] opacity-60",
                )}
              >
                {bridgeGenerate.isPending ? (
                  <Loader2 className="size-3 animate-spin shrink-0" />
                ) : (
                  <Sparkles className="size-3 shrink-0" />
                )}
                Bridge with AI
              </button>

              {/* ── Network mesh ── */}
              <div
                className={cn(
                  MONO,
                  "mt-2.5 space-y-2 border-t border-[#1a1a2e]/60 pt-2.5",
                )}
              >
                <div
                  className="text-[9px] font-medium uppercase tracking-[0.12em]"
                  style={{ color: HUD.textDim }}
                >
                  Network mesh
                </div>
                {meshLoading ? (
                  <div
                    className={cn(
                      MONO,
                      "flex items-center gap-2 text-[9px]",
                    )}
                    style={{ color: HUD.textGhost }}
                  >
                    <Loader2 className="size-3 animate-spin shrink-0" />
                    Scanning graph...
                  </div>
                ) : meshStatus ? (
                  <>
                    <p
                      className={cn(MONO, "text-[8px] leading-relaxed")}
                      style={{ color: HUD.textGhost }}
                    >
                      {meshStatus.canGenerate
                        ? `Up to ${meshStatus.meshRecipeCount} recipe(s) · ${meshStatus.hubCount} hubs · ${meshStatus.pantrySize} stocked`
                        : meshStatus.reason}
                      {meshStatus.cooldownHoursRemaining != null &&
                      meshStatus.cooldownHoursRemaining > 0
                        ? ` · ~${meshStatus.cooldownHoursRemaining}h until next pass`
                        : ""}
                    </p>
                    <button
                      type="button"
                      disabled={
                        !meshStatus.canGenerate || meshGenerate.isPending
                      }
                      onClick={() => {
                        meshGenerate.mutate(undefined, {
                          onSuccess: (d) => {
                            toast.success(
                              `Mesh complete — ${d.recipesGenerated ?? 0} recipe(s) added`,
                            );
                          },
                          onError: (e) => toast.error(e.message),
                        });
                      }}
                      className={cn(
                        MONO,
                        "flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-all",
                        meshStatus.canGenerate && !meshGenerate.isPending
                          ? "border-[#ffab00]/35 bg-[#ffab00]/10 text-[#fcd34d] hover:bg-[#ffab00]/15"
                          : "cursor-not-allowed border-[#1a1a2e] text-[#475569] opacity-60",
                      )}
                    >
                      {meshGenerate.isPending ? (
                        <Loader2 className="size-3 animate-spin shrink-0" />
                      ) : (
                        <Network className="size-3 shrink-0" />
                      )}
                      Mesh with AI
                    </button>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search bar (top center)
// ---------------------------------------------------------------------------

interface SearchBarProps {
  nodes: GraphNode[];
  onSelect: (node: GraphNode) => void;
  monoClass: string;
}

export function SearchBar({ nodes, onSelect, monoClass }: SearchBarProps) {
  const MONO = monoClass;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fuse = useMemo(
    () =>
      new Fuse(nodes, {
        keys: ["name", "category"],
        threshold: 0.4,
      }),
    [nodes],
  );

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return fuse.search(query).slice(0, 8);
  }, [fuse, query]);

  // Keyboard shortcut: "/" to focus
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        document.activeElement?.tagName !== "INPUT"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleSelect = useCallback(
    (node: GraphNode) => {
      onSelect(node);
      setQuery("");
      setOpen(false);
      inputRef.current?.blur();
    },
    [onSelect],
  );

  return (
    <div className="absolute top-16 left-1/2 z-20 -translate-x-1/2">
      <div
        className="relative rounded-lg backdrop-blur-xl"
        style={{
          background: HUD.panel,
          border: `1px solid ${HUD.border}`,
        }}
      >
        <HudCorners />
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Search
            className="h-3 w-3 shrink-0"
            style={{ color: hexToRgba(HUD.cyan, 0.45) }}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search ingredients ( / )"
            className={cn(
              MONO,
              "w-48 bg-transparent text-[10px] text-[#e2e8f0] placeholder:text-[#334155] focus:outline-none",
            )}
          />
        </div>

        {open && results.length > 0 && (
          <div
            className="absolute top-full left-0 mt-1 w-full rounded-lg p-1 backdrop-blur-xl"
            style={{
              background: HUD.panel,
              border: `1px solid ${HUD.border}`,
            }}
          >
            {results.map(({ item }) => {
              const cc =
                CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.OTHER;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    MONO,
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[10px] transition-colors hover:bg-[#1a1a2e]/50",
                  )}
                  style={{ color: HUD.textMuted }}
                  onClick={() => handleSelect(item)}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: cc,
                      boxShadow: `0 0 4px ${hexToRgba(cc, 0.3)}`,
                    }}
                  />
                  <span className="flex-1 truncate">{item.name}</span>
                  <span
                    className="text-[8px] uppercase"
                    style={{ color: HUD.textGhost }}
                  >
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legend (bottom left)
// ---------------------------------------------------------------------------

interface LegendProps {
  activeCategories: string[];
  categoryCounts: Map<string, number>;
  onHighlightCategory: (category: string | null) => void;
  monoClass: string;
}

export function Legend({
  activeCategories,
  categoryCounts,
  onHighlightCategory,
  monoClass,
}: LegendProps) {
  const MONO = monoClass;
  const [legendOpen, setLegendOpen] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const activeCatSet = useMemo(
    () => new Set(activeCategories),
    [activeCategories],
  );

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  if (!legendOpen) {
    return (
      <div className="absolute bottom-4 left-4 z-10">
        <div
          className="relative rounded-lg backdrop-blur-xl"
          style={{
            background: HUD.panel,
            border: `1px solid ${HUD.border}`,
          }}
        >
          <HudCorners />
          <button
            type="button"
            onClick={() => setLegendOpen(true)}
            className={cn(
              MONO,
              "flex items-center gap-2 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors hover:text-[#94a3b8]",
            )}
            style={{ color: HUD.textMuted }}
          >
            <ListTree
              className="size-3 shrink-0"
              style={{ color: hexToRgba(HUD.cyan, 0.45) }}
            />
            Legend
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-4 left-4 z-10">
      <div
        className="relative max-h-[50vh] overflow-y-auto rounded-lg p-3 backdrop-blur-xl"
        style={{
          background: HUD.panel,
          border: `1px solid ${HUD.border}`,
        }}
      >
        <HudCorners />
        <div className="mb-2 flex items-center justify-between gap-2 pr-0.5">
          <span
            className={cn(
              MONO,
              "text-[9px] font-medium uppercase tracking-[0.12em]",
            )}
            style={{ color: HUD.textDim }}
          >
            Legend
          </span>
          <button
            type="button"
            onClick={() => setLegendOpen(false)}
            className={cn(
              MONO,
              "flex size-6 shrink-0 items-center justify-center rounded-md border border-transparent text-[#475569] transition-colors hover:border-[#1a1a2e] hover:bg-[#1a1a2e]/40 hover:text-[#94a3b8]",
            )}
            aria-label="Close legend"
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-1">
          {CATEGORY_GROUPS.map((group) => {
            const groupCats = group.categories.filter((c) =>
              activeCatSet.has(c),
            );
            if (groupCats.length === 0) return null;

            const totalCount = groupCats.reduce(
              (sum, c) => sum + (categoryCounts.get(c) ?? 0),
              0,
            );
            const isExpanded = expandedGroups.has(group.label);

            // Pick a representative color (first category in group)
            const repColor =
              CATEGORY_COLORS[groupCats[0]] ?? CATEGORY_COLORS.OTHER;

            return (
              <div key={group.label}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  onDoubleClick={() => onHighlightCategory(groupCats[0])}
                  className={cn(
                    MONO,
                    "flex w-full items-center gap-2 rounded px-1 py-0.5 text-left transition-colors hover:bg-[#1a1a2e]/30",
                  )}
                >
                  <ChevronRight
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 transition-transform",
                      isExpanded && "rotate-90",
                    )}
                    style={{ color: HUD.textGhost }}
                  />
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: repColor,
                      boxShadow: `0 0 5px ${hexToRgba(repColor, 0.4)}`,
                    }}
                  />
                  <span
                    className="text-[9px] uppercase tracking-wider"
                    style={{ color: HUD.textMuted }}
                  >
                    {group.label}
                  </span>
                  <span
                    className="text-[8px] tabular-nums"
                    style={{ color: HUD.textGhost }}
                  >
                    ({totalCount})
                  </span>
                </button>

                {isExpanded && (
                  <div className="ml-5 mt-0.5 space-y-0.5">
                    {groupCats.map((cat) => {
                      const c =
                        CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.OTHER;
                      const count = categoryCounts.get(cat) ?? 0;
                      return (
                        <button
                          key={cat}
                          type="button"
                          className="flex w-full items-center gap-2 rounded px-1 py-0.5 transition-colors hover:bg-[#1a1a2e]/30"
                          onClick={() => onHighlightCategory(cat)}
                        >
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{
                              backgroundColor: c,
                              boxShadow: `0 0 4px ${hexToRgba(c, 0.35)}`,
                            }}
                          />
                          <span
                            className={cn(
                              MONO,
                              "text-[8px] uppercase tracking-wider",
                            )}
                            style={{ color: HUD.textGhost }}
                          >
                            {CATEGORY_LABELS[cat] ?? cat}
                          </span>
                          <span
                            className={cn(MONO, "text-[7px] tabular-nums")}
                            style={{ color: HUD.textGhost }}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Legend footer */}
          <div className="space-y-1 border-t border-[#1a1a2e]/50 pt-1.5">
            <div className="flex items-center gap-2">
              <span
                className={cn(MONO, "text-[8px] uppercase tracking-wider leading-tight")}
                style={{ color: HUD.textGhost }}
              >
                Node size = synergy + recipes + cooks
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full border border-dashed"
                style={{ borderColor: hexToRgba(HUD.amber, 0.5) }}
              />
              <span
                className={cn(MONO, "text-[9px] uppercase tracking-wider")}
                style={{ color: HUD.textGhost }}
              >
                In pantry
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full border"
                style={{ borderColor: hexToRgba(HUD.green, 0.5) }}
              />
              <span
                className={cn(MONO, "text-[9px] uppercase tracking-wider")}
                style={{ color: HUD.textGhost }}
              >
                Recently cooked
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode selector (bottom right)
// ---------------------------------------------------------------------------

interface ModeSelectorProps {
  graphMode: GraphMode;
  setGraphMode: (m: GraphMode) => void;
  monoClass: string;
}

export function ModeSelector({
  graphMode,
  setGraphMode,
  monoClass,
}: ModeSelectorProps) {
  const MONO = monoClass;
  const modes: { value: GraphMode; label: string }[] = [
    { value: "co-occurrence", label: "Co-occur" },
    { value: "flavor-affinity", label: "Flavor" },
    { value: "cuisine-clusters", label: "Cuisine" },
  ];

  return (
    <div className="absolute bottom-4 right-4 z-10">
      <div
        className="relative flex gap-1 rounded-lg p-1.5 backdrop-blur-xl"
        style={{
          background: HUD.panel,
          border: `1px solid ${HUD.border}`,
        }}
      >
        <HudCorners />
        {modes.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setGraphMode(m.value)}
            className={cn(
              MONO,
              "rounded-md px-2.5 py-1 text-[9px] font-medium uppercase tracking-wider transition-all",
              graphMode === m.value
                ? "bg-[#00e5ff]/12 text-[#7dd3fc]"
                : "text-[#475569] hover:text-[#94a3b8]",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Title (top center)
// ---------------------------------------------------------------------------

interface TitleHudProps {
  displayClass: string;
  monoClass: string;
}

export function TitleHud({ displayClass, monoClass }: TitleHudProps) {
  return (
    <div className="pointer-events-none absolute top-5 left-1/2 z-10 -translate-x-1/2">
      <div className="flex items-center gap-3">
        <div
          className="h-px w-10"
          style={{
            background: `linear-gradient(90deg, transparent, ${HUD.cyanDim})`,
          }}
        />
        <h1
          className={cn(
            displayClass,
            "text-xs font-semibold uppercase tracking-[0.3em]",
          )}
          style={{ color: "#c8d6e5" }}
        >
          Food Web
        </h1>
        <div
          className="h-px w-10"
          style={{
            background: `linear-gradient(270deg, transparent, ${HUD.cyanDim})`,
          }}
        />
      </div>
      <p
        className={cn(
          monoClass,
          "mt-0.5 text-center text-[8px] uppercase tracking-[0.2em]",
        )}
        style={{ color: HUD.textGhost }}
      >
        Ingredient synergies
      </p>
    </div>
  );
}
