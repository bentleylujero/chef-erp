import { forceCollide, forceRadial, forceX, forceY } from "d3-force";
import type { TopologyLink } from "@/lib/engines/topology-builder";
import type { GraphNode, GraphMode } from "./food-web-types";
import { nodeRadius, NODE_COLLIDE_PADDING } from "./food-web-canvas";

/**
 * Apply all custom d3 forces to the ForceGraph2D instance.
 *
 * Called from a useEffect whenever graphData, dimensions, or graphMode change.
 */
export function configureForces(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fg: any,
  nodes: GraphNode[],
  width: number,
  height: number,
  maxSynergy: number,
  maxCookCount: number,
  graphMode: GraphMode,
) {
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(width, height) * 0.44;
  const innerR = Math.min(width, height) * 0.05;
  const nodeCount = nodes.length;

  // ── Adaptive charge — scale by node count ──
  const chargeStrength = Math.min(-1200, -3400 * (50 / Math.max(1, nodeCount)));
  fg.d3Force("charge")?.strength(chargeStrength);

  // ── Link force ──
  const link = fg.d3Force("link") as
    | { distance: (fn: unknown) => unknown; strength: (n: number) => unknown }
    | undefined;

  if (graphMode === "flavor-affinity") {
    link?.distance((l: TopologyLink) => {
      if (l.synthetic) return Math.min(720, Math.max(280, width * 0.22));
      const affinity = l.flavorAffinity ?? 0;
      return 100 + (1 - affinity) * 500;
    });
  } else {
    link?.distance((l: TopologyLink) => {
      if (l.synthetic) return Math.min(720, Math.max(280, width * 0.22));
      const wgt = l.weight ?? 1;
      return Math.min(640, Math.max(210, 168 + wgt * 24));
    });
  }
  link?.strength(0.14);

  // ── Radial force — hubs toward center ──
  fg.d3Force(
    "radial",
    forceRadial(
      (n: GraphNode) => {
        if (maxSynergy <= 0) return maxR * 0.72;
        const s = n.synergyStrength ?? 0;
        const norm = Math.pow(s / maxSynergy, 0.72);
        return innerR + (1 - norm) * (maxR - innerR);
      },
      cx,
      cy,
    ).strength(0.1),
  );

  // ── Collision ──
  fg.d3Force(
    "collide",
    forceCollide((node: GraphNode) => {
      return nodeRadius(node, maxSynergy, maxCookCount) + NODE_COLLIDE_PADDING;
    })
      .strength(1)
      .iterations(4),
  );

  // ── Category / cuisine clustering ──
  if (graphMode === "cuisine-clusters") {
    // Group by first cuisine tag
    const cuisines = [...new Set(nodes.map((n) => n.cuisineTags?.[0] ?? "OTHER"))];
    const angleStep = (2 * Math.PI) / Math.max(1, cuisines.length);
    const cuisineAngle = new Map(cuisines.map((c, i) => [c, i * angleStep]));
    const clusterR = Math.min(width, height) * 0.28;

    fg.d3Force(
      "clusterX",
      forceX((n: GraphNode) => {
        const cuisine = n.cuisineTags?.[0] ?? "OTHER";
        const angle = cuisineAngle.get(cuisine) ?? 0;
        return cx + Math.cos(angle) * clusterR;
      }).strength(0.06),
    );
    fg.d3Force(
      "clusterY",
      forceY((n: GraphNode) => {
        const cuisine = n.cuisineTags?.[0] ?? "OTHER";
        const angle = cuisineAngle.get(cuisine) ?? 0;
        return cy + Math.sin(angle) * clusterR;
      }).strength(0.06),
    );
  } else {
    // Default: subtle category clustering
    const categories = [...new Set(nodes.map((n) => n.category))];
    const angleStep = (2 * Math.PI) / Math.max(1, categories.length);
    const categoryAngle = new Map(categories.map((c, i) => [c, i * angleStep]));
    const clusterR = Math.min(width, height) * 0.3;

    fg.d3Force(
      "clusterX",
      forceX((n: GraphNode) => {
        const angle = categoryAngle.get(n.category) ?? 0;
        return cx + Math.cos(angle) * clusterR;
      }).strength(0.03),
    );
    fg.d3Force(
      "clusterY",
      forceY((n: GraphNode) => {
        const angle = categoryAngle.get(n.category) ?? 0;
        return cy + Math.sin(angle) * clusterR;
      }).strength(0.03),
    );
  }
}
