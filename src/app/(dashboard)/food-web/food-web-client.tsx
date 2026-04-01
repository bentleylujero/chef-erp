"use client";

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import dynamic from "next/dynamic";
import { JetBrains_Mono, Outfit } from "next/font/google";
import { useFoodWeb } from "@/hooks/use-food-web";
import {
  usePantryBridge,
  usePantryBridgeGenerate,
} from "@/hooks/use-pantry-bridge";
import {
  useNetworkMesh,
  useNetworkMeshGenerate,
} from "@/hooks/use-network-mesh";
import type { TopologyLink } from "@/lib/engines/topology-builder";
import { cn } from "@/lib/utils";
import { Network, Loader2 } from "lucide-react";
import type { GraphNode, GraphMode, HighlightSet } from "./food-web-types";
import { HUD, WEB, hexToRgba } from "./food-web-constants";
import {
  paintNode,
  paintNodeArea,
  paintLink,
  paintLinkArea,
  linkKey,
  nodeRadius,
  NODE_COLLIDE_PADDING,
  type PaintNodeContext,
  type PaintLinkContext,
} from "./food-web-canvas";
import { configureForces, type PhysicsOverrides } from "./food-web-forces";
import {
  TitleHud,
  StatsHud,
  FiltersPanel,
  SearchBar,
  Legend,
  ModeSelector,
} from "./food-web-hud";
import FoodWebDetailSheet from "./food-web-detail-sheet";
import { PhysicsPanel } from "./food-web-physics-panel";

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
// Page
// ---------------------------------------------------------------------------

export default function FoodWebClient() {
  // ── State ────────────────────────────────────────────
  const [cuisine, setCuisine] = useState<string | undefined>();
  const [pantryOnly, setPantryOnly] = useState(true);
  const [minWeight, setMinWeight] = useState(1);
  const [graphMode, setGraphMode] = useState<GraphMode>("co-occurrence");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [showUnlinked, setShowUnlinked] = useState(true);
  const [discoverMode, setDiscoverMode] = useState(false);
  const [highlightedCategory, setHighlightedCategory] = useState<string | null>(null);
  const [physicsOverrides, setPhysicsOverrides] = useState<PhysicsOverrides>({});
  const [velocityDecay, setVelocityDecay] = useState(0.35);
  const [alphaDecay, setAlphaDecay] = useState(0.0228);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [hoveredLink, setHoveredLink] = useState<any>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  // Animation time ref
  const animTimeRef = useRef(0);
  const hoverStartRef = useRef(0);
  const prevHoveredIdRef = useRef<string | null>(null);
  const entryProgressRef = useRef(0);
  const entryStartRef = useRef(0);

  // ── Data fetching ────────────────────────────────────
  const filters = useMemo(
    () => ({ cuisine, pantryOnly, minWeight, mode: graphMode }),
    [cuisine, pantryOnly, minWeight, graphMode],
  );
  const { data, isLoading, dataUpdatedAt } = useFoodWeb(filters);
  const { data: bridgeStatus, isLoading: bridgeLoading } = usePantryBridge();
  const bridgeGen = usePantryBridgeGenerate();
  const { data: meshStatus, isLoading: meshLoading } = useNetworkMesh();
  const meshGen = useNetworkMeshGenerate();

  // ── Throttled animation — repaint at ~20fps for particle animations ──
  useEffect(() => {
    let raf: number;
    let lastTick = 0;
    const FRAME_INTERVAL = 50; // 20fps is plenty for subtle particles
    function tick(ts: number) {
      animTimeRef.current = ts;
      if (ts - lastTick >= FRAME_INTERVAL) {
        lastTick = ts;
        const fg = graphRef.current;
        if (fg && typeof fg.tickFrame === "function") {
          fg.tickFrame();
        }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Track hover transitions
  useEffect(() => {
    if (hoveredNode && hoveredNode.id !== prevHoveredIdRef.current) {
      hoverStartRef.current = animTimeRef.current;
    }
    prevHoveredIdRef.current = hoveredNode?.id ?? null;
  }, [hoveredNode]);

  // ── Derived graph data ───────────────────────────────
  const linkedNodeIds = useMemo(() => {
    const s = new Set<string>();
    for (const l of data?.links ?? []) {
      if (l.synthetic) continue;
      s.add(l.source);
      s.add(l.target);
    }
    return s;
  }, [data?.links]);

  const graphData = useMemo(() => {
    if (!data) {
      return {
        nodes: [] as GraphNode[],
        links: [] as TopologyLink[],
        unlinkedHidden: 0,
      };
    }
    const unlinkedCount = data.nodes.filter((n) => !linkedNodeIds.has(n.id))
      .length;
    const nodes = (
      showUnlinked
        ? data.nodes
        : data.nodes.filter((n) => linkedNodeIds.has(n.id))
    ).map((n) => ({ ...n })) as GraphNode[];
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = data.links
      .filter((l) => nodeIds.has(l.source) && nodeIds.has(l.target))
      .map((l) => ({ ...l }));
    return {
      nodes,
      links,
      unlinkedHidden: showUnlinked ? 0 : unlinkedCount,
    };
  }, [data, showUnlinked, linkedNodeIds]);

  const displayStats = useMemo(() => {
    const n = graphData.nodes.length;
    const e = graphData.links.length;
    const avgDeg = n > 0 ? Math.round((e * 2 * 100) / n) / 100 : 0;
    return { nodeCount: n, linkCount: e, avgDeg };
  }, [graphData.nodes, graphData.links]);

  const adjacency = useMemo(() => {
    const adj = new Map<string, Set<string>>();
    for (const link of graphData.links) {
      if (!adj.has(link.source)) adj.set(link.source, new Set());
      if (!adj.has(link.target)) adj.set(link.target, new Set());
      adj.get(link.source)!.add(link.target);
      adj.get(link.target)!.add(link.source);
    }
    return adj;
  }, [graphData.links]);

  const maxSynergy = useMemo(() => {
    if (!graphData.nodes.length) return 0;
    return Math.max(0, ...graphData.nodes.map((n) => n.synergyStrength ?? 0));
  }, [graphData.nodes]);

  const maxCookCount = useMemo(() => {
    return data?.meta?.maxCookCount ?? 0;
  }, [data?.meta]);

  const maxWeight = useMemo(() => {
    if (!graphData.links.length) return 1;
    return Math.max(1, ...graphData.links.map((l) => l.weight ?? 1));
  }, [graphData.links]);

  // ── 2-hop highlight ──────────────────────────────────
  const highlightSet = useMemo<HighlightSet | null>(() => {
    // Category highlight takes precedence
    if (highlightedCategory) {
      const ids = new Set(
        graphData.nodes
          .filter((n) => n.category === highlightedCategory)
          .map((n) => n.id),
      );
      return { hop1: ids, hop2: ids };
    }
    if (!hoveredNode) return null;
    const hop1 = new Set<string>([hoveredNode.id]);
    const hop2 = new Set<string>([hoveredNode.id]);
    const neighbors1 = adjacency.get(hoveredNode.id);
    if (neighbors1) {
      for (const id of neighbors1) {
        hop1.add(id);
        hop2.add(id);
        const neighbors2 = adjacency.get(id);
        if (neighbors2) {
          for (const id2 of neighbors2) hop2.add(id2);
        }
      }
    }
    return { hop1, hop2 };
  }, [hoveredNode, adjacency, highlightedCategory, graphData.nodes]);

  // ── Category counts for legend ───────────────────────
  const activeCategories = useMemo(() => {
    if (!graphData.nodes.length) return [];
    return [...new Set(graphData.nodes.map((n) => n.category))].sort();
  }, [graphData.nodes]);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of graphData.nodes) {
      map.set(n.category, (map.get(n.category) ?? 0) + 1);
    }
    return map;
  }, [graphData.nodes]);

  // ── Discover mode: ghost edges for unexplored high-affinity pairs ──
  // Optimized: only compare pantry items (more relevant), pre-filter nodes
  // with flavor tags, and use early termination.
  const discoveryLinks = useMemo(() => {
    if (!discoverMode || !graphData.nodes.length) return [];
    const existingPairs = new Set<string>();
    for (const l of graphData.links) {
      const a = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
      const b = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
      existingPairs.add(a < b ? `${a}::${b}` : `${b}::${a}`);
    }

    // Pre-filter: only nodes with flavor tags, prioritize pantry items
    const candidates = graphData.nodes.filter(
      (n) => n.flavorTags && Object.keys(n.flavorTags).length > 0,
    );
    // Sort pantry items first so the best discoveries bubble up
    candidates.sort((a, b) => (b.inPantry ? 1 : 0) - (a.inPantry ? 1 : 0));
    // Cap candidates to avoid O(n²) blowup on large graphs
    const maxCandidates = Math.min(candidates.length, 80);

    const ghosts: { source: GraphNode; target: GraphNode; affinity: number }[] = [];
    for (let i = 0; i < maxCandidates; i++) {
      for (let j = i + 1; j < maxCandidates; j++) {
        const a = candidates[i];
        const b = candidates[j];
        const pk = a.id < b.id ? `${a.id}::${b.id}` : `${b.id}::${a.id}`;
        if (existingPairs.has(pk)) continue;

        // Inline cosine similarity
        const aFlavor = a.flavorTags;
        const bFlavor = b.flavorTags;
        const keys = new Set([
          ...Object.keys(aFlavor),
          ...Object.keys(bFlavor),
        ]);
        let dot = 0,
          magA = 0,
          magB = 0;
        for (const k of keys) {
          const va = aFlavor[k] ?? 0;
          const vb = bFlavor[k] ?? 0;
          dot += va * vb;
          magA += va * va;
          magB += vb * vb;
        }
        const affinity =
          magA > 0 && magB > 0
            ? dot / (Math.sqrt(magA) * Math.sqrt(magB))
            : 0;

        if (affinity > 0.65) {
          ghosts.push({ source: a, target: b, affinity });
        }
      }
    }
    return ghosts.sort((a, b) => b.affinity - a.affinity).slice(0, 50);
  }, [discoverMode, graphData.nodes, graphData.links]);

  // ── Resize ───────────────────────────────────────────
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

  // ── Force configuration ──────────────────────────────
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;
    configureForces(
      fg,
      graphData.nodes,
      dimensions.width,
      dimensions.height,
      maxSynergy,
      maxCookCount,
      graphMode,
      physicsOverrides,
    );
  }, [graphData, dimensions.width, dimensions.height, maxSynergy, maxCookCount, graphMode, physicsOverrides]);

  // Track whether user has manually zoomed/panned — if so, don't auto-fit
  const userInteractedRef = useRef(false);
  const initialFitDoneRef = useRef(false);

  // Auto-fit the graph once warmup ticks complete and nodes have positions.
  // We use a short delay after data arrives so the warmup simulation has run.
  useEffect(() => {
    if (!graphData.nodes.length || initialFitDoneRef.current) return;
    const fg = graphRef.current;
    if (!fg) return;

    // After warmup ticks run the graph will have positions — fit immediately
    const timer = setTimeout(() => {
      if (!userInteractedRef.current) {
        fg.zoomToFit(600, fitPadding);
        initialFitDoneRef.current = true;
        entryStartRef.current = animTimeRef.current;
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [graphData.nodes.length, fitPadding]);

  // Second fit after simulation settles — timer-based since engine never stops
  const settledFitRef = useRef(false);
  useEffect(() => {
    if (!graphData.nodes.length || settledFitRef.current) return;
    const fg = graphRef.current;
    if (!fg) return;
    const timer = setTimeout(() => {
      settledFitRef.current = true;
      entryStartRef.current = animTimeRef.current;
      if (!userInteractedRef.current) {
        fg.zoomToFit(450, fitPadding);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [graphData.nodes.length, fitPadding]);

  // Reset interaction tracking when data changes (new filter, mode switch)
  useEffect(() => {
    userInteractedRef.current = false;
    initialFitDoneRef.current = false;
    settledFitRef.current = false;
  }, [showUnlinked, graphMode, dataUpdatedAt]);

  // ── Canvas callbacks ─────────────────────────────────
  const paintNodeCb = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const pctx: PaintNodeContext = {
        highlightSet,
        hoveredNodeId: hoveredNode?.id ?? null,
        maxSynergy,
        maxCookCount,
        animTime: animTimeRef.current,
        hoverStartTime: hoverStartRef.current,
        displayFontFamily: DISPLAY_CANVAS,
      };

      // Entry animation
      if (entryStartRef.current > 0) {
        const elapsed = animTimeRef.current - entryStartRef.current;
        entryProgressRef.current = Math.min(1, elapsed / 800);
      } else {
        entryProgressRef.current = 1;
      }

      paintNode(node, ctx, globalScale, pctx);
    },
    [highlightSet, hoveredNode, maxSynergy, maxCookCount],
  );

  const paintNodeAreaCb = useCallback(
    (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      paintNodeArea(node, color, ctx, maxSynergy, maxCookCount);
    },
    [maxSynergy, maxCookCount],
  );

  const hoveredLinkKey = hoveredLink ? linkKey(hoveredLink) : null;

  const paintLinkCb = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (link: any, ctx: CanvasRenderingContext2D) => {
      const plctx: PaintLinkContext = {
        highlightSet,
        animTime: animTimeRef.current,
        maxWeight,
        hoveredLinkKey,
        displayFontFamily: DISPLAY_CANVAS,
      };
      paintLink(link, ctx, plctx);
    },
    [highlightSet, maxWeight, hoveredLinkKey],
  );

  const paintLinkAreaCb = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (link: any, paintColor: string, ctx: CanvasRenderingContext2D) => {
      paintLinkArea(link, paintColor, ctx);
    },
    [],
  );

  // ── Post-render: draw discover mode ghost edges ──────
  const onRenderFramePost = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ctx: CanvasRenderingContext2D, _globalScale: number) => {
      if (!discoverMode || discoveryLinks.length === 0) return;

      ctx.save();
      const time = animTimeRef.current;

      for (const ghost of discoveryLinks) {
        const sx = ghost.source.x ?? 0;
        const sy = ghost.source.y ?? 0;
        const tx = ghost.target.x ?? 0;
        const ty = ghost.target.y ?? 0;

        const alpha = 0.08 + ghost.affinity * 0.12;
        const hue = ghost.affinity > 0.8 ? HUD.green : HUD.accent;

        ctx.beginPath();
        ctx.setLineDash([3, 6]);
        ctx.lineDashOffset = -time * 0.015;
        ctx.moveTo(sx, sy);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = hexToRgba(hue, alpha);
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      ctx.restore();
    },
    [discoverMode, discoveryLinks],
  );

  // ── Handlers ─────────────────────────────────────────
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node ?? null);
    setHighlightedCategory(null);
    const el = containerRef.current;
    if (el) {
      el.style.cursor = node ? "grab" : "default";
    }
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLinkHover = useCallback((link: any) => {
    setHoveredLink(link ?? null);
    const el = containerRef.current;
    if (el && !hoveredNode) {
      el.style.cursor = link ? "pointer" : "default";
    }
  }, [hoveredNode]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLinkClick = useCallback((link: any) => {
    if (link?.source) {
      setSelectedNode(link.source);
    }
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node ?? null);
  }, []);

  const handleNodeDrag = useCallback((node: GraphNode) => {
    userInteractedRef.current = true;
  }, []);

  const handleNodeDragEnd = useCallback((node: GraphNode) => {
    // Pin node where user dropped it
    node.fx = node.x;
    node.fy = node.y;
  }, []);

  // Double-click background to unpin all nodes and re-fit
  const handleBackgroundClick = useCallback(() => {
    setHoveredNode(null);
    setHighlightedCategory(null);
  }, []);

  const handleBackgroundRightClick = useCallback(() => {
    // Right-click background: unpin all nodes
    for (const node of graphData.nodes) {
      (node as GraphNode).fx = undefined;
      (node as GraphNode).fy = undefined;
    }
    const fg = graphRef.current;
    if (fg) {
      fg.d3ReheatSimulation();
    }
  }, [graphData.nodes]);

  const handleZoom = useCallback(() => {
    userInteractedRef.current = true;
  }, []);

  const handleSearchSelect = useCallback((node: GraphNode) => {
    const fg = graphRef.current;
    if (!fg) return;
    if (node.x != null && node.y != null) {
      fg.centerAt(node.x, node.y, 600);
      fg.zoom(2, 600);
    }
    setHoveredNode(node);
    setHighlightedCategory(null);
  }, []);

  const handleHighlightCategory = useCallback((category: string | null) => {
    setHighlightedCategory((prev) =>
      prev === category ? null : category,
    );
    setHoveredNode(null);
  }, []);

  // ── Render ───────────────────────────────────────────
  return (
    <div className="relative flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      {/* ═══════════════════════════════════════════════
          FULL-BLEED GRAPH CONTAINER
          ═══════════════════════════════════════════════ */}
      <div ref={containerRef} className="relative min-h-0 flex-1">
        {/* BG: Warm dark canvas */}
        <div className="absolute inset-0" style={{ backgroundColor: WEB.canvasBg }} />
        {/* Subtle dot grid — cartographic feel */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle, ${WEB.dotNoise} 0.8px, transparent 0.8px)`,
            backgroundSize: "28px 28px",
          }}
        />
        {/* Gentle warm vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at center, transparent 0%, ${hexToRgba(WEB.canvasBg, 0.06)} 55%, ${hexToRgba("#0f0e12", 0.5)} 100%)`,
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
                    borderTopColor: hexToRgba(HUD.accent, 0.4),
                    animationDuration: "3s",
                  }}
                />
                <div
                  className="absolute inset-3 animate-spin rounded-full border"
                  style={{
                    borderColor: HUD.border,
                    borderTopColor: hexToRgba(HUD.accent, 0.2),
                    animationDuration: "5s",
                    animationDirection: "reverse",
                  }}
                />
                <div
                  className="absolute inset-6 animate-spin rounded-full border"
                  style={{
                    borderColor: HUD.border,
                    borderTopColor: hexToRgba(HUD.accent, 0.1),
                    animationDuration: "7s",
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Network
                    className="h-6 w-6"
                    style={{ color: hexToRgba(HUD.accent, 0.3) }}
                  />
                </div>
              </div>
              <span
                className={cn(MONO, "text-[10px] uppercase tracking-[0.2em]")}
                style={{ color: HUD.textDim }}
              >
                Weaving food web&hellip;
              </span>
            </div>
          </div>
        ) : graphData.nodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <Network className="h-14 w-14" style={{ color: HUD.border }} />
            <p className={cn(MONO, "text-sm")} style={{ color: HUD.textDim }}>
              No synergies found
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
            key={`${showUnlinked ? "all" : "linked"}-${graphMode}`}
            ref={graphRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            backgroundColor="rgba(0,0,0,0)"
            nodeVal={(n) =>
              Math.max(1, (n as GraphNode).synergyStrength ?? 0)
            }
            nodeRelSize={4}
            nodeColor={() => "rgba(0,0,0,0)"}
            nodeLabel={(n) => String((n as GraphNode).name ?? "")}
            nodeCanvasObject={paintNodeCb as never}
            nodeCanvasObjectMode={() => "after" as const}
            nodePointerAreaPaint={paintNodeAreaCb as never}
            linkCanvasObject={paintLinkCb as never}
            linkCanvasObjectMode={() => "replace" as const}
            linkPointerAreaPaint={paintLinkAreaCb as never}
            linkHoverPrecision={6}
            onLinkHover={handleLinkHover as never}
            onLinkClick={handleLinkClick as never}
            onNodeHover={handleNodeHover as never}
            onNodeClick={handleNodeClick as never}
            onNodeDrag={handleNodeDrag as never}
            onNodeDragEnd={handleNodeDragEnd as never}
            onRenderFramePost={onRenderFramePost as never}
            onZoom={handleZoom as never}
            onBackgroundClick={handleBackgroundClick as never}
            onBackgroundRightClick={handleBackgroundRightClick as never}
            enableNodeDrag={true}
            warmupTicks={80}
            cooldownTicks={Infinity}
            cooldownTime={Infinity}
            d3VelocityDecay={velocityDecay}
            d3AlphaDecay={alphaDecay}
            enableZoomInteraction={true}
            enablePanInteraction={true}
            minZoom={0.1}
            maxZoom={12}
          />
        )}

        {/* ═══════════════════════════════════════════
            HUD OVERLAYS
            ═══════════════════════════════════════════ */}

        {/* Title */}
        <TitleHud displayClass={DISPLAY} monoClass={MONO} />

        {/* Search bar */}
        {!isLoading && graphData.nodes.length > 0 && (
          <SearchBar
            nodes={graphData.nodes}
            onSelect={handleSearchSelect}
            monoClass={MONO}
          />
        )}

        {/* Stats */}
        {data && !isLoading && (
          <StatsHud
            nodeCount={displayStats.nodeCount}
            linkCount={displayStats.linkCount}
            avgDeg={displayStats.avgDeg}
            unlinkedHidden={graphData.unlinkedHidden}
            monoClass={MONO}
          />
        )}

        {/* Filters */}
        <FiltersPanel
          cuisine={cuisine}
          setCuisine={setCuisine}
          pantryOnly={pantryOnly}
          setPantryOnly={setPantryOnly}
          showUnlinked={showUnlinked}
          setShowUnlinked={setShowUnlinked}
          minWeight={minWeight}
          setMinWeight={setMinWeight}
          discoverMode={discoverMode}
          setDiscoverMode={setDiscoverMode}
          bridgeStatus={bridgeStatus}
          bridgeLoading={bridgeLoading}
          bridgeGenerate={bridgeGen}
          meshStatus={meshStatus}
          meshLoading={meshLoading}
          meshGenerate={meshGen}
          monoClass={MONO}
        />

        {/* Legend */}
        {activeCategories.length > 0 && !isLoading && (
          <Legend
            activeCategories={activeCategories}
            categoryCounts={categoryCounts}
            onHighlightCategory={handleHighlightCategory}
            monoClass={MONO}
          />
        )}

        {/* Physics panel */}
        {!isLoading && graphData.nodes.length > 0 && (
          <PhysicsPanel
            overrides={physicsOverrides}
            setOverrides={setPhysicsOverrides}
            velocityDecay={velocityDecay}
            setVelocityDecay={setVelocityDecay}
            alphaDecay={alphaDecay}
            setAlphaDecay={setAlphaDecay}
            nodeCount={graphData.nodes.length}
            graphRef={graphRef}
            monoClass={MONO}
          />
        )}

        {/* Mode selector */}
        {!isLoading && graphData.nodes.length > 0 && (
          <ModeSelector
            graphMode={graphMode}
            setGraphMode={setGraphMode}
            monoClass={MONO}
          />
        )}

        {/* Discover mode indicator */}
        {discoverMode && discoveryLinks.length > 0 && (
          <div
            className="absolute bottom-14 right-4 z-10"
            style={{ pointerEvents: "none" }}
          >
            <span
              className={cn(MONO, "text-[8px] uppercase tracking-wider")}
              style={{ color: hexToRgba(HUD.accent, 0.6) }}
            >
              {discoveryLinks.length} unexplored flavor match
              {discoveryLinks.length === 1 ? "" : "es"}
            </span>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════
          DETAIL SHEET
          ═══════════════════════════════════════════════ */}
      <FoodWebDetailSheet
        selectedNode={selectedNode}
        onClose={() => setSelectedNode(null)}
        data={data}
        monoClass={MONO}
        displayClass={DISPLAY}
      />
    </div>
  );
}
