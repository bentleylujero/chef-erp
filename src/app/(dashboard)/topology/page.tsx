"use client";

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import dynamic from "next/dynamic";
import { forceCollide } from "d3-force";
import { JetBrains_Mono, Outfit } from "next/font/google";
import { useTopology } from "@/hooks/use-topology";
import type {
  TopologyNode,
  TopologyLink,
} from "@/lib/engines/topology-builder";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Network, Link2, Zap, Hexagon, ChefHat, Eye, EyeOff } from "lucide-react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const display = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const MONO = mono.className;
const DISPLAY = display.className;
const DISPLAY_CANVAS = display.style.fontFamily;

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const HUD = {
  bg: "#08080d",
  panel: "rgba(8,8,13,0.82)",
  border: "rgba(26,26,46,0.7)",
  cyan: "#00e5ff",
  cyanDim: "rgba(0,229,255,0.15)",
  amber: "#ffab00",
  textPrimary: "#e2e8f0",
  textMuted: "#94a3b8",
  textDim: "#475569",
  textGhost: "#334155",
} as const;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CUISINES = [
  { value: "FRENCH", label: "French" },
  { value: "ITALIAN", label: "Italian" },
  { value: "DELI", label: "Deli" },
  { value: "MEXICAN", label: "Mexican" },
  { value: "MEDITERRANEAN", label: "Mediterranean" },
  { value: "JAPANESE", label: "Japanese" },
  { value: "THAI", label: "Thai" },
  { value: "KOREAN", label: "Korean" },
  { value: "CHINESE", label: "Chinese" },
  { value: "INDIAN", label: "Indian" },
  { value: "AMERICAN", label: "American" },
  { value: "MIDDLE_EASTERN", label: "Middle Eastern" },
  { value: "AFRICAN", label: "African" },
  { value: "CARIBBEAN", label: "Caribbean" },
  { value: "SOUTHEAST_ASIAN", label: "Southeast Asian" },
  { value: "FUSION", label: "Fusion" },
  { value: "OTHER", label: "Other" },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  // Proteins
  POULTRY: "#ff5c8a",
  RED_MEAT: "#e63946",
  SEAFOOD: "#48bfe3",
  CURED_DELI: "#d4627a",
  PROTEIN: "#ff3d71",

  // Produce
  VEGETABLE: "#0eca78",
  FRUIT: "#ffa62b",
  AROMATIC: "#b8e986",
  MUSHROOM: "#a68a64",
  PRODUCE: "#0eca78",

  // Dairy & Cheese
  DAIRY: "#3d8bfd",
  CHEESE: "#f4d35e",

  // Condiments
  SAUCE: "#c77dff",
  PASTE: "#e07be0",
  VINEGAR: "#9d4edd",
  CONDIMENT: "#a56eff",

  // Pantry
  SPICE: "#ff8a00",
  HERB: "#00d68f",
  GRAIN: "#e8c547",
  OIL_FAT: "#f7d94c",
  NUT_SEED: "#c4956a",
  PANTRY_STAPLE: "#6b7a8d",
  LEGUME: "#8bff42",
  SWEETENER: "#ff6b9d",
  BEVERAGE: "#00cfff",
  BAKING: "#d066ff",
  OTHER: "#8895a7",
};

const CATEGORY_LABELS: Record<string, string> = {
  POULTRY: "Poultry",
  RED_MEAT: "Red Meat",
  SEAFOOD: "Seafood",
  CURED_DELI: "Cured / Deli",
  PROTEIN: "Protein",
  VEGETABLE: "Vegetable",
  FRUIT: "Fruit",
  AROMATIC: "Aromatic",
  MUSHROOM: "Mushroom",
  PRODUCE: "Produce",
  DAIRY: "Dairy",
  CHEESE: "Cheese",
  SAUCE: "Sauce",
  PASTE: "Paste",
  VINEGAR: "Vinegar",
  CONDIMENT: "Condiment",
  SPICE: "Spice",
  HERB: "Herb",
  GRAIN: "Grain",
  OIL_FAT: "Oil / Fat",
  NUT_SEED: "Nut / Seed",
  PANTRY_STAPLE: "Pantry Staple",
  LEGUME: "Legume",
  SWEETENER: "Sweetener",
  BEVERAGE: "Beverage",
  BAKING: "Baking",
  OTHER: "Other",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GraphNode extends TopologyNode {
  x?: number;
  y?: number;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HudCorners({ color = HUD.cyanDim }: { color?: string }) {
  const s = { borderColor: color };
  return (
    <>
      <span className="pointer-events-none absolute top-0 left-0 h-2 w-2 border-t border-l" style={s} />
      <span className="pointer-events-none absolute top-0 right-0 h-2 w-2 border-t border-r" style={s} />
      <span className="pointer-events-none absolute bottom-0 left-0 h-2 w-2 border-b border-l" style={s} />
      <span className="pointer-events-none absolute bottom-0 right-0 h-2 w-2 border-b border-r" style={s} />
    </>
  );
}

function HudStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
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
            MONO,
            "text-lg font-bold tabular-nums leading-none",
          )}
          style={{ color: HUD.textPrimary }}
        >
          {formatted}
        </div>
        <div
          className={cn(MONO, "text-[8px] font-medium uppercase tracking-[0.15em]")}
          style={{ color: HUD.textDim }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IngredientTopologyPage() {
  const [cuisine, setCuisine] = useState<string | undefined>();
  const [pantryOnly, setPantryOnly] = useState(false);
  const [minWeight, setMinWeight] = useState(1);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  const filters = useMemo(
    () => ({ cuisine, pantryOnly, minWeight }),
    [cuisine, pantryOnly, minWeight],
  );
  const { data, isLoading } = useTopology(filters);

  const graphData = useMemo(() => {
    if (!data) return { nodes: [] as GraphNode[], links: [] as TopologyLink[] };
    return {
      nodes: data.nodes.map((n) => ({ ...n })) as GraphNode[],
      links: data.links.map((l) => ({ ...l })),
    };
  }, [data]);

  const adjacency = useMemo(() => {
    const adj = new Map<string, Set<string>>();
    if (!data) return adj;
    for (const link of data.links) {
      if (!adj.has(link.source)) adj.set(link.source, new Set());
      if (!adj.has(link.target)) adj.set(link.target, new Set());
      adj.get(link.source)!.add(link.target);
      adj.get(link.target)!.add(link.source);
    }
    return adj;
  }, [data]);

  const highlightIds = useMemo(() => {
    if (!hoveredNode) return null;
    const set = new Set<string>([hoveredNode.id]);
    const neighbors = adjacency.get(hoveredNode.id);
    if (neighbors) for (const id of neighbors) set.add(id);
    return set;
  }, [hoveredNode, adjacency]);

  // ── Resize ──────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setDimensions({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitPadding = useMemo(
    () =>
      Math.max(48, Math.min(dimensions.width, dimensions.height) * 0.065),
    [dimensions.width, dimensions.height],
  );

  // ── Force tuning ────────────────────────────────────
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength(-1100);
    const link = fg.d3Force("link") as
      | { distance: (fn: unknown) => unknown; strength: (n: number) => unknown }
      | undefined;
    link?.distance((l: TopologyLink) =>
      Math.max(180, 420 - l.weight * 9),
    );
    link?.strength(0.28);
    fg.d3Force(
      "collide",
      forceCollide((node: GraphNode) => {
        const rc = node.recipeCount ?? 1;
        const baseSize = Math.max(3, Math.min(28, Math.sqrt(rc) * 5 + 2));
        return baseSize + 36;
      }).strength(0.95),
    );
  }, [graphData]);

  const handleEngineStop = useCallback(() => {
    const fg = graphRef.current;
    if (!fg || graphData.nodes.length === 0) return;
    requestAnimationFrame(() => {
      fg.zoomToFit(450, fitPadding);
    });
  }, [fitPadding, graphData.nodes.length]);

  useEffect(() => {
    const fg = graphRef.current;
    if (!fg || graphData.nodes.length === 0 || isLoading) return;
    const id = requestAnimationFrame(() => {
      fg.zoomToFit(280, fitPadding);
    });
    return () => cancelAnimationFrame(id);
  }, [
    dimensions.width,
    dimensions.height,
    fitPadding,
    graphData.nodes.length,
    isLoading,
  ]);

  // ── Canvas: node painting ───────────────────────────
  const paintNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const rc = node.recipeCount ?? 1;
      const baseSize = Math.max(3, Math.min(28, Math.sqrt(rc) * 5 + 2));
      const color = CATEGORY_COLORS[node.category] ?? CATEGORY_COLORS.OTHER;
      const isInHighlight = !highlightIds || highlightIds.has(node.id);
      const isHovered = hoveredNode?.id === node.id;
      const radius = isHovered ? baseSize * 1.35 : baseSize;

      if (!isInHighlight) {
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(color, 0.05);
        ctx.fill();
        return;
      }

      // Layer 1 -- atmospheric glow
      const atmoR = radius * (isHovered ? 4.5 : 3);
      const atmo = ctx.createRadialGradient(x, y, radius * 0.5, x, y, atmoR);
      atmo.addColorStop(0, hexToRgba(color, isHovered ? 0.25 : 0.08));
      atmo.addColorStop(0.4, hexToRgba(color, isHovered ? 0.07 : 0.02));
      atmo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(x, y, atmoR, 0, Math.PI * 2);
      ctx.fillStyle = atmo;
      ctx.fill();

      // Layer 2 -- pantry ring (dashed amber)
      if (node.inPantry) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(HUD.amber, 0.45);
        ctx.lineWidth = 0.8;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.restore();
      }

      // Layer 3 -- outer ring
      ctx.beginPath();
      ctx.arc(x, y, radius + 1.2, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(color, isHovered ? 0.65 : 0.2);
      ctx.lineWidth = 0.6;
      ctx.stroke();

      // Layer 4 -- core body gradient
      const core = ctx.createRadialGradient(
        x - radius * 0.2, y - radius * 0.2, 0,
        x, y, radius,
      );
      core.addColorStop(0, hexToRgba("#ffffff", 0.3));
      core.addColorStop(0.35, hexToRgba(color, 0.85));
      core.addColorStop(1, hexToRgba(color, 0.3));
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();

      // Layer 5 -- center hotspot
      const hs = ctx.createRadialGradient(x, y, 0, x, y, radius * 0.3);
      hs.addColorStop(0, "rgba(255,255,255,0.5)");
      hs.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = hs;
      ctx.fill();

      // Layer 6 -- label (only on hover, neighbors, or zoomed-in large nodes)
      const isNeighbor = highlightIds !== null && highlightIds.has(node.id);
      const showLabel =
        isHovered ||
        isNeighbor ||
        (globalScale > 1.5 && baseSize > 7);

      if (showLabel) {
        const fontSize = isHovered
          ? Math.min(9.5, Math.max(6.5, 7.5 / globalScale))
          : Math.min(7.5, Math.max(5.2, 5.8 / globalScale));
        ctx.font = `500 ${fontSize}px ${DISPLAY_CANVAS}, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.lineJoin = "round";

        const text = node.name;
        const textY = y + radius + 4;

        ctx.lineWidth = Math.max(2.5, fontSize * 0.35);
        ctx.strokeStyle = "rgba(2,4,10,0.92)";
        ctx.strokeText(text, x, textY);
        ctx.lineWidth = Math.max(1.2, fontSize * 0.18);
        ctx.strokeStyle = "rgba(2,4,10,0.45)";
        ctx.strokeText(text, x, textY);

        ctx.fillStyle = isHovered
          ? HUD.cyan
          : hexToRgba(HUD.textMuted, 0.92);
        ctx.fillText(text, x, textY);
      }
    },
    [highlightIds, hoveredNode],
  );

  const paintNodeArea = useCallback(
    (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const rc = node.recipeCount ?? 1;
      const baseSize = Math.max(3, Math.min(28, Math.sqrt(rc) * 5 + 2));
      const radius = baseSize * 1.45 + 12;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    },
    [],
  );

  // ── Canvas: link painting ───────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paintLink = useCallback(
    (link: any, ctx: CanvasRenderingContext2D) => {
      const s = link.source;
      const t = link.target;
      if (!s?.x || !t?.x) return;

      const isHighlighted =
        highlightIds &&
        highlightIds.has(s.id) &&
        highlightIds.has(t.id);
      const weight: number = link.weight ?? 1;

      if (isHighlighted) {
        // outer glow
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = hexToRgba(HUD.cyan, 0.06);
        ctx.lineWidth = weight * 2 + 8;
        ctx.stroke();

        // mid glow
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = hexToRgba(HUD.cyan, 0.15);
        ctx.lineWidth = weight * 1.2 + 3;
        ctx.stroke();

        // core
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = hexToRgba(HUD.cyan, 0.55);
        ctx.lineWidth = Math.max(0.8, weight * 0.5);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = highlightIds
          ? "rgba(0,229,255,0.012)"
          : "rgba(0,229,255,0.035)";
        ctx.lineWidth = 0.3;
        ctx.stroke();
      }
    },
    [highlightIds],
  );

  // ── Handlers ────────────────────────────────────────
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node ?? null);
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node ?? null);
  }, []);

  // ── Detail panel derivations ────────────────────────
  const selectedConnections = useMemo(() => {
    if (!selectedNode || !data) return [];
    return data.links
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
        };
      })
      .sort((a, b) => b.weight - a.weight);
  }, [selectedNode, data]);

  const selectedRecipes = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const conn of selectedConnections) {
      for (const r of conn.recipes) {
        if (!seen.has(r) && list.length < 8) {
          seen.add(r);
          list.push(r);
        }
      }
    }
    return list;
  }, [selectedConnections]);

  const activeCategories = useMemo(() => {
    if (!data) return [];
    const cats = new Set(data.nodes.map((n) => n.category));
    return [...cats].sort();
  }, [data]);

  const nodeColor = selectedNode
    ? (CATEGORY_COLORS[selectedNode.category] ?? CATEGORY_COLORS.OTHER)
    : HUD.cyan;

  // ── Render ──────────────────────────────────────────
  return (
    <div className="relative flex h-[calc(100vh-7.5rem)] flex-col overflow-hidden">
      {/* Keyframe animations */}
      <style>{`
        @keyframes hud-scan {
          0%   { top: -2px; }
          100% { top: calc(100% + 2px); }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════
          FULL-BLEED GRAPH CONTAINER
          ═══════════════════════════════════════════════ */}
      <div ref={containerRef} className="relative min-h-0 flex-1">
        {/* BG: base */}
        <div className="absolute inset-0" style={{ backgroundColor: HUD.bg }} />

        {/* BG: grid lines */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(${hexToRgba(HUD.cyan, 0.025)} 1px, transparent 1px),
              linear-gradient(90deg, ${hexToRgba(HUD.cyan, 0.025)} 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />

        {/* BG: scan line */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute right-0 left-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${hexToRgba(HUD.cyan, 0.1)} 20%, ${hexToRgba(HUD.cyan, 0.18)} 50%, ${hexToRgba(HUD.cyan, 0.1)} 80%, transparent 100%)`,
              animation: "hud-scan 7s linear infinite",
            }}
          />
        </div>

        {/* BG: vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at center, transparent 15%, ${hexToRgba(HUD.bg, 0.45)} 55%, ${HUD.bg} 100%)`,
          }}
        />

        {/* ── Graph / Loading / Empty ── */}
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="relative h-24 w-24">
                <div
                  className="absolute inset-0 animate-spin rounded-full border"
                  style={{
                    borderColor: HUD.border,
                    borderTopColor: hexToRgba(HUD.cyan, 0.4),
                    animationDuration: "3s",
                  }}
                />
                <div
                  className="absolute inset-3 animate-spin rounded-full border"
                  style={{
                    borderColor: HUD.border,
                    borderTopColor: hexToRgba(HUD.cyan, 0.2),
                    animationDuration: "5s",
                    animationDirection: "reverse",
                  }}
                />
                <div
                  className="absolute inset-6 animate-spin rounded-full border"
                  style={{
                    borderColor: HUD.border,
                    borderTopColor: hexToRgba(HUD.cyan, 0.1),
                    animationDuration: "7s",
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Network
                    className="h-6 w-6"
                    style={{ color: hexToRgba(HUD.cyan, 0.3) }}
                  />
                </div>
              </div>
              <span
                className={cn(MONO, "text-[10px] uppercase tracking-[0.2em]")}
                style={{ color: HUD.textDim }}
              >
                Building topology&hellip;
              </span>
            </div>
          </div>
        ) : graphData.nodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <Network className="h-14 w-14" style={{ color: HUD.border }} />
            <p className={cn(MONO, "text-sm")} style={{ color: HUD.textDim }}>
              No connections found
            </p>
            <p
              className={cn(MONO, "text-[10px]")}
              style={{ color: HUD.textGhost }}
            >
              Lower minimum strength or adjust filters
            </p>
          </div>
        ) : (
          <ForceGraph2D
            ref={graphRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            backgroundColor="rgba(0,0,0,0)"
            nodeVal={(n) => (n as GraphNode).recipeCount ?? 1}
            nodeRelSize={5.5}
            nodeCanvasObject={paintNode as never}
            nodeCanvasObjectMode={() => "replace" as const}
            nodePointerAreaPaint={paintNodeArea as never}
            linkCanvasObject={paintLink as never}
            linkCanvasObjectMode={() => "replace" as const}
            onNodeHover={handleNodeHover as never}
            onNodeClick={handleNodeClick as never}
            onEngineStop={handleEngineStop as never}
            warmupTicks={160}
            cooldownTicks={480}
            d3VelocityDecay={0.22}
            enableZoomInteraction={true}
            enablePanInteraction={true}
            minZoom={0.15}
            maxZoom={8}
          />
        )}

        {/* ═══════════════════════════════════════════
            HUD OVERLAYS
            ═══════════════════════════════════════════ */}

        {/* ── Title (top center) ── */}
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
                DISPLAY,
                "text-xs font-semibold uppercase tracking-[0.3em]",
              )}
              style={{ color: "#c8d6e5" }}
            >
              Ingredient Topology
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
              MONO,
              "mt-0.5 text-center text-[8px] uppercase tracking-[0.2em]",
            )}
            style={{ color: HUD.textGhost }}
          >
            Network Analysis
          </p>
        </div>

        {/* ── Stats (top right) ── */}
        {data && !isLoading && (
          <div className="absolute top-4 right-4 z-10 flex gap-2.5">
            <HudStat
              icon={<Hexagon className="h-3.5 w-3.5" />}
              value={data.stats.totalIngredients}
              label="Nodes"
            />
            <HudStat
              icon={<Link2 className="h-3.5 w-3.5" />}
              value={data.stats.totalConnections}
              label="Edges"
            />
            <HudStat
              icon={<Zap className="h-3.5 w-3.5" />}
              value={data.stats.avgConnectionsPerNode}
              label="Avg Deg"
            />
          </div>
        )}

        {/* ── Filters (top left) ── */}
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
              onClick={() => setPantryOnly((v) => !v)}
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

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  MONO,
                  "text-[9px] uppercase tracking-wider",
                )}
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
          </div>
        </div>

        {/* ── Legend (bottom left) ── */}
        {activeCategories.length > 0 && !isLoading && (
          <div className="absolute bottom-4 left-4 z-10">
            <div
              className="relative rounded-lg p-3 backdrop-blur-xl"
              style={{
                background: HUD.panel,
                border: `1px solid ${HUD.border}`,
              }}
            >
              <HudCorners />
              <div className="space-y-1.5">
                {activeCategories.map((cat) => {
                  const c = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.OTHER;
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: c,
                          boxShadow: `0 0 5px ${hexToRgba(c, 0.45)}`,
                        }}
                      />
                      <span
                        className={cn(
                          MONO,
                          "text-[9px] uppercase tracking-wider",
                        )}
                        style={{ color: HUD.textGhost }}
                      >
                        {CATEGORY_LABELS[cat] ?? cat}
                      </span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2 border-t border-[#1a1a2e]/50 pt-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full border border-dashed"
                    style={{ borderColor: hexToRgba(HUD.amber, 0.5) }}
                  />
                  <span
                    className={cn(
                      MONO,
                      "text-[9px] uppercase tracking-wider",
                    )}
                    style={{ color: HUD.textGhost }}
                  >
                    In pantry
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════
          DETAIL SHEET
          ═══════════════════════════════════════════════ */}
      <Sheet
        open={!!selectedNode}
        onOpenChange={(open) => {
          if (!open) setSelectedNode(null);
        }}
      >
        <SheetContent
          className="w-[380px] border-l-[#1a1a2e] sm:w-[420px]"
          style={{ backgroundColor: "#0b0b12" }}
        >
          <SheetHeader>
            <SheetTitle
              className={cn(DISPLAY, "flex items-center gap-3")}
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
                ? `${CATEGORY_LABELS[selectedNode.category] ?? selectedNode.category} · ${selectedNode.recipeCount} recipe${selectedNode.recipeCount === 1 ? "" : "s"}`
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
                      Connections
                    </div>
                  </div>
                </div>

                {/* ── Connections with strength bars ── */}
                <div>
                  <h3
                    className={cn(
                      MONO,
                      "mb-3 text-[10px] font-medium uppercase tracking-[0.15em]",
                    )}
                    style={{ color: HUD.textDim }}
                  >
                    Connected Ingredients
                  </h3>
                  {selectedConnections.length === 0 ? (
                    <p
                      className={cn(MONO, "text-xs")}
                      style={{ color: HUD.textDim }}
                    >
                      No connections at current filters.
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
                              <div
                                className="h-1 w-16 overflow-hidden rounded-full"
                                style={{ backgroundColor: "#1a1a2e" }}
                              >
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: hexToRgba(
                                      HUD.cyan,
                                      0.55,
                                    ),
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

                {/* ── Recipes ── */}
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
                    <div className="space-y-1">
                      {selectedRecipes.map((title) => (
                        <div
                          key={title}
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
                            {title}
                          </span>
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
    </div>
  );
}
