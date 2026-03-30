"use client";

import { useMemo } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChefHat, Clock, Replace, Lightbulb } from "lucide-react";
import type { TopologyData, TopologyLink } from "@/lib/engines/topology-builder";
import type { GraphNode } from "./food-web-types";
import {
  HUD,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  CUISINES,
  hexToRgba,
} from "./food-web-constants";

interface FoodWebDetailSheetProps {
  selectedNode: GraphNode | null;
  onClose: () => void;
  data: TopologyData | undefined;
  monoClass: string;
  displayClass: string;
}

export default function FoodWebDetailSheet({
  selectedNode,
  onClose,
  data,
  monoClass,
  displayClass,
}: FoodWebDetailSheetProps) {
  const MONO = monoClass;

  const nodeColor = selectedNode
    ? (CATEGORY_COLORS[selectedNode.category] ?? CATEGORY_COLORS.OTHER)
    : HUD.cyan;

  const selectedConnections = useMemo(() => {
    if (!selectedNode || !data) return [];
    return data.links
      .filter((l) => !l.synthetic)
      .filter(
        (l) => l.source === selectedNode.id || l.target === selectedNode.id,
      )
      .map((l) => {
        const otherId =
          l.source === selectedNode.id ? l.target : l.source;
        const other = data.nodes.find((n) => n.id === otherId);
        return {
          ...l,
          otherId,
          otherName: other?.name ?? "Unknown",
          otherCategory: other?.category ?? "OTHER",
          otherFlavorTags: other?.flavorTags ?? {},
        };
      })
      .sort((a, b) => b.weight - a.weight);
  }, [selectedNode, data]);

  const selectedRecipes = useMemo(() => {
    const seen = new Set<string>();
    const list: TopologyLink["recipes"] = [];
    for (const conn of selectedConnections) {
      for (const r of conn.recipes) {
        if (!seen.has(r.id) && list.length < 8) {
          seen.add(r.id);
          list.push(r);
        }
      }
    }
    return list;
  }, [selectedConnections]);

  // Flavor radar data
  const flavorRadarData = useMemo(() => {
    if (!selectedNode?.flavorTags) return [];
    const tags = selectedNode.flavorTags;
    return Object.entries(tags)
      .filter(([, v]) => typeof v === "number")
      .map(([key, value]) => ({
        dimension: key.charAt(0).toUpperCase() + key.slice(1),
        value: value as number,
        fullMark: 10,
      }));
  }, [selectedNode]);

  // Unexplored pairings: nodes with high flavor affinity but no co-occurrence
  const unexploredPairings = useMemo(() => {
    if (!selectedNode || !data) return [];
    const connectedIds = new Set(
      selectedConnections.map((c) => c.otherId),
    );
    connectedIds.add(selectedNode.id);

    const pairings: { id: string; name: string; category: string; affinity: number }[] = [];
    const selFlavor = selectedNode.flavorTags;
    if (!selFlavor || Object.keys(selFlavor).length === 0) return [];

    for (const node of data.nodes) {
      if (connectedIds.has(node.id)) continue;
      if (!node.flavorTags || Object.keys(node.flavorTags).length === 0) continue;

      // Inline cosine similarity
      const keys = new Set([
        ...Object.keys(selFlavor),
        ...Object.keys(node.flavorTags),
      ]);
      let dot = 0, magA = 0, magB = 0;
      for (const k of keys) {
        const va = selFlavor[k] ?? 0;
        const vb = node.flavorTags[k] ?? 0;
        dot += va * vb;
        magA += va * va;
        magB += vb * vb;
      }
      const affinity =
        magA > 0 && magB > 0 ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;

      if (affinity > 0.5) {
        pairings.push({
          id: node.id,
          name: node.name,
          category: node.category,
          affinity: Math.round(affinity * 100) / 100,
        });
      }
    }

    return pairings.sort((a, b) => b.affinity - a.affinity).slice(0, 5);
  }, [selectedNode, data, selectedConnections]);

  // Substitution options
  const substitutionOptions = useMemo(() => {
    if (!selectedNode || !data) return [];
    if (!selectedNode.substituteGroupIds?.length) return [];
    const groupIds = new Set(selectedNode.substituteGroupIds);

    return data.nodes
      .filter(
        (n) =>
          n.id !== selectedNode.id &&
          n.substituteGroupIds?.some((g) => groupIds.has(g)),
      )
      .slice(0, 5);
  }, [selectedNode, data]);

  // Cook history text
  const cookHistoryText = useMemo(() => {
    if (!selectedNode) return "";
    const parts: string[] = [];
    if (selectedNode.cookCount > 0) {
      parts.push(`Cooked ${selectedNode.cookCount}x`);
    }
    if (selectedNode.lastCooked) {
      const days = Math.floor(
        (Date.now() - new Date(selectedNode.lastCooked).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (days === 0) parts.push("today");
      else if (days === 1) parts.push("yesterday");
      else if (days < 7) parts.push(`${days} days ago`);
      else if (days < 30) parts.push(`${Math.floor(days / 7)}w ago`);
      else parts.push(`${Math.floor(days / 30)}mo ago`);
    }
    if (selectedNode.avgRating != null) {
      parts.push(`${selectedNode.avgRating}/5`);
    }
    return parts.join(" · ");
  }, [selectedNode]);

  return (
    <Sheet
      open={!!selectedNode}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        className="w-[380px] border-l-[#1a1a2e] sm:w-[420px]"
        style={{ backgroundColor: "#0b0b12" }}
      >
        <SheetHeader>
          <SheetTitle
            className={cn(displayClass, "flex items-center gap-3")}
            style={{ color: HUD.textPrimary }}
          >
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{
                backgroundColor: nodeColor,
                boxShadow: `0 0 10px ${hexToRgba(nodeColor, 0.5)}`,
              }}
            />
            {selectedNode?.name}
          </SheetTitle>
          <SheetDescription
            className={MONO}
            style={{ color: HUD.textDim }}
          >
            {selectedNode
              ? `${CATEGORY_LABELS[selectedNode.category] ?? selectedNode.category} · ${selectedNode.recipeCount} recipe${selectedNode.recipeCount === 1 ? "" : "s"} · synergy ${selectedNode.synergyStrength}`
              : ""}
          </SheetDescription>
        </SheetHeader>

        {selectedNode && (
          <ScrollArea className="mt-5 h-[calc(100vh-10rem)]">
            <div className="space-y-6 pr-4">
              {/* ── Tags ── */}
              <div className="flex flex-wrap gap-2">
                <span
                  className={cn(
                    MONO,
                    "rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                  )}
                  style={{
                    borderColor: HUD.border,
                    color: HUD.textMuted,
                  }}
                >
                  {CATEGORY_LABELS[selectedNode.category] ??
                    selectedNode.category}
                </span>
                {selectedNode.inPantry && (
                  <span
                    className={cn(
                      MONO,
                      "rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                    )}
                    style={{
                      borderColor: hexToRgba(HUD.amber, 0.3),
                      backgroundColor: hexToRgba(HUD.amber, 0.08),
                      color: HUD.amber,
                    }}
                  >
                    In Pantry
                  </span>
                )}
                {selectedNode.cuisineTags.map((t) => (
                  <span
                    key={t}
                    className={cn(
                      MONO,
                      "rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                    )}
                    style={{
                      borderColor: HUD.border,
                      color: HUD.textDim,
                    }}
                  >
                    {CUISINES.find((c) => c.value === t)?.label ?? t}
                  </span>
                ))}
              </div>

              {/* ── Cook history ── */}
              {cookHistoryText && (
                <div
                  className={cn(
                    MONO,
                    "text-[10px] uppercase tracking-wider",
                  )}
                  style={{ color: HUD.textMuted }}
                >
                  {cookHistoryText}
                </div>
              )}

              {/* ── Stat cards ── */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-md border p-3"
                  style={{
                    borderColor: HUD.border,
                    backgroundColor: "#0e0e18",
                  }}
                >
                  <div
                    className={cn(
                      MONO,
                      "text-2xl font-bold tabular-nums leading-none",
                    )}
                    style={{ color: HUD.textPrimary }}
                  >
                    {selectedNode.recipeCount}
                  </div>
                  <div
                    className={cn(
                      MONO,
                      "mt-1 text-[9px] uppercase tracking-[0.12em]",
                    )}
                    style={{ color: HUD.textDim }}
                  >
                    Recipes
                  </div>
                </div>
                <div
                  className="rounded-md border p-3"
                  style={{
                    borderColor: HUD.border,
                    backgroundColor: "#0e0e18",
                  }}
                >
                  <div
                    className={cn(
                      MONO,
                      "text-2xl font-bold tabular-nums leading-none",
                    )}
                    style={{ color: HUD.textPrimary }}
                  >
                    {selectedConnections.length}
                  </div>
                  <div
                    className={cn(
                      MONO,
                      "mt-1 text-[9px] uppercase tracking-[0.12em]",
                    )}
                    style={{ color: HUD.textDim }}
                  >
                    Synergies
                  </div>
                </div>
              </div>

              {/* ── Flavor radar chart ── */}
              {flavorRadarData.length > 2 && (
                <div>
                  <h3
                    className={cn(
                      MONO,
                      "mb-2 text-[10px] font-medium uppercase tracking-[0.15em]",
                    )}
                    style={{ color: HUD.textDim }}
                  >
                    Flavor Profile
                  </h3>
                  <div
                    className="rounded-md border p-2"
                    style={{
                      borderColor: HUD.border,
                      backgroundColor: "#0e0e18",
                    }}
                  >
                    <ResponsiveContainer width="100%" height={180}>
                      <RadarChart data={flavorRadarData} cx="50%" cy="50%" outerRadius="70%">
                        <PolarGrid
                          stroke={hexToRgba("#ffffff", 0.06)}
                          strokeDasharray="2 4"
                        />
                        <PolarAngleAxis
                          dataKey="dimension"
                          tick={{
                            fill: HUD.textGhost,
                            fontSize: 9,
                            fontFamily: "monospace",
                          }}
                        />
                        <Radar
                          name="Flavor"
                          dataKey="value"
                          stroke={hexToRgba(nodeColor, 0.7)}
                          fill={hexToRgba(nodeColor, 0.2)}
                          strokeWidth={1.5}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ── Connected ingredients ── */}
              <div>
                <h3
                  className={cn(
                    MONO,
                    "mb-3 text-[10px] font-medium uppercase tracking-[0.15em]",
                  )}
                  style={{ color: HUD.textDim }}
                >
                  Connected ingredients
                </h3>
                {selectedConnections.length === 0 ? (
                  <p
                    className={cn(MONO, "text-xs")}
                    style={{ color: HUD.textDim }}
                  >
                    No synergies at current filters.
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {selectedConnections.slice(0, 15).map((conn) => {
                      const maxW = selectedConnections[0]?.weight ?? 1;
                      const pct = (conn.weight / maxW) * 100;
                      const cc =
                        CATEGORY_COLORS[conn.otherCategory] ??
                        CATEGORY_COLORS.OTHER;
                      return (
                        <div
                          key={conn.otherId}
                          className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-[#1a1a2e]/30"
                        >
                          <span
                            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor: cc,
                              boxShadow: `0 0 4px ${hexToRgba(cc, 0.3)}`,
                            }}
                          />
                          <span
                            className={cn(
                              MONO,
                              "min-w-0 flex-1 truncate text-xs",
                            )}
                            style={{ color: HUD.textMuted }}
                          >
                            {conn.otherName}
                          </span>
                          <div className="flex shrink-0 items-center gap-2">
                            {conn.flavorAffinity > 0 && (
                              <span
                                className={cn(MONO, "text-[8px]")}
                                style={{
                                  color: hexToRgba(HUD.amber, 0.7),
                                }}
                                title={`Flavor affinity: ${conn.flavorAffinity}`}
                              >
                                {Math.round(conn.flavorAffinity * 100)}%
                              </span>
                            )}
                            <div
                              className="h-1 w-16 overflow-hidden rounded-full"
                              style={{ backgroundColor: "#1a1a2e" }}
                            >
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: hexToRgba(HUD.cyan, 0.55),
                                }}
                              />
                            </div>
                            <span
                              className={cn(
                                MONO,
                                "w-5 text-right text-[10px] font-bold",
                              )}
                              style={{ color: HUD.cyan }}
                            >
                              {conn.weight}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Unexplored pairings ── */}
              {unexploredPairings.length > 0 && (
                <div>
                  <h3
                    className={cn(
                      MONO,
                      "mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.15em]",
                    )}
                    style={{ color: HUD.textDim }}
                  >
                    <Lightbulb className="h-3 w-3" />
                    Flavor Matches — Not Yet in Recipes
                  </h3>
                  <div className="space-y-0.5">
                    {unexploredPairings.map((p) => {
                      const cc =
                        CATEGORY_COLORS[p.category] ?? CATEGORY_COLORS.OTHER;
                      return (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 rounded-md px-2 py-1.5"
                        >
                          <span
                            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor: cc,
                              boxShadow: `0 0 4px ${hexToRgba(cc, 0.3)}`,
                            }}
                          />
                          <span
                            className={cn(MONO, "flex-1 truncate text-xs")}
                            style={{ color: HUD.textMuted }}
                          >
                            {p.name}
                          </span>
                          <span
                            className={cn(MONO, "text-[10px] font-bold")}
                            style={{ color: hexToRgba(HUD.amber, 0.8) }}
                          >
                            {Math.round(p.affinity * 100)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Substitution options ── */}
              {substitutionOptions.length > 0 && (
                <div>
                  <h3
                    className={cn(
                      MONO,
                      "mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.15em]",
                    )}
                    style={{ color: HUD.textDim }}
                  >
                    <Replace className="h-3 w-3" />
                    Can Substitute
                  </h3>
                  <div className="space-y-0.5">
                    {substitutionOptions.map((sub) => {
                      const cc =
                        CATEGORY_COLORS[sub.category] ?? CATEGORY_COLORS.OTHER;
                      return (
                        <div
                          key={sub.id}
                          className="flex items-center gap-3 rounded-md px-2 py-1.5"
                        >
                          <span
                            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: cc }}
                          />
                          <span
                            className={cn(MONO, "text-xs")}
                            style={{ color: HUD.textMuted }}
                          >
                            {sub.name}
                          </span>
                          {sub.inPantry && (
                            <span
                              className={cn(MONO, "text-[8px] uppercase")}
                              style={{ color: HUD.amber }}
                            >
                              stocked
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Recipe cards ── */}
              {selectedRecipes.length > 0 && (
                <div>
                  <h3
                    className={cn(
                      MONO,
                      "mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.15em]",
                    )}
                    style={{ color: HUD.textDim }}
                  >
                    <ChefHat className="h-3 w-3" />
                    Featured In
                  </h3>
                  <div className="space-y-1.5">
                    {selectedRecipes.map((recipe) => (
                      <div
                        key={recipe.id}
                        className="rounded-md border-l-2 px-3 py-2"
                        style={{
                          borderLeftColor: hexToRgba(HUD.cyan, 0.3),
                          backgroundColor: "#0e0e18",
                        }}
                      >
                        <span
                          className="text-xs"
                          style={{ color: HUD.textMuted }}
                        >
                          {recipe.title}
                        </span>
                        <div className="mt-1 flex items-center gap-3">
                          <span
                            className={cn(MONO, "text-[8px] uppercase tracking-wider")}
                            style={{ color: HUD.textGhost }}
                          >
                            {CUISINES.find((c) => c.value === recipe.cuisine)
                              ?.label ?? recipe.cuisine}
                          </span>
                          <span
                            className={cn(
                              MONO,
                              "flex items-center gap-1 text-[8px]",
                            )}
                            style={{ color: HUD.textGhost }}
                          >
                            <Clock className="h-2.5 w-2.5" />
                            {recipe.cookTime}m
                          </span>
                          <span
                            className={cn(MONO, "text-[8px]")}
                            style={{ color: HUD.textGhost }}
                          >
                            {"*".repeat(recipe.difficulty)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
