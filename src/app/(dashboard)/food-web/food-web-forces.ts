import {
  forceCollide,
  forceRadial,
  forceX,
  forceY,
} from "d3-force";
import type { TopologyLink } from "@/lib/engines/topology-builder";
import type { GraphNode, GraphMode } from "./food-web-types";
import { nodeRadius, NODE_COLLIDE_PADDING } from "./food-web-canvas";

export interface PhysicsOverrides {
  chargeStrength?: number;
  linkDistanceMultiplier?: number;
  collisionPadding?: number;
  radialStrength?: number;
  linkStrength?: number;
  clusterStrength?: number;
}

/** Quick-apply presets for common layouts. */
export const PHYSICS_PRESETS = {
  tight: {
    chargeStrength: -150,
    linkDistanceMultiplier: 0.6,
    collisionPadding: 10,
    radialStrength: 0.08,
    linkStrength: 0.25,
    clusterStrength: 0.28,
  },
  balanced: {} as PhysicsOverrides, // defaults
  spread: {
    chargeStrength: -600,
    linkDistanceMultiplier: 2.0,
    collisionPadding: 35,
    radialStrength: 0.01,
    linkStrength: 0.1,
    clusterStrength: 0.1,
  },
  organic: {
    chargeStrength: -300,
    linkDistanceMultiplier: 1.5,
    collisionPadding: 20,
    radialStrength: 0.005,
    linkStrength: 0.08,
    clusterStrength: 0.05,
  },
} as const satisfies Record<string, PhysicsOverrides>;

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
  overrides?: PhysicsOverrides,
) {
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(width, height) * 0.42;
  const innerR = Math.min(width, height) * 0.04;
  const nodeCount = nodes.length;
  const distMul = overrides?.linkDistanceMultiplier ?? 1.0;

  // ── Adaptive charge — moderate repulsion to keep micro-cities from collapsing ──
  const defaultCharge = nodeCount > 80
    ? -180
    : nodeCount > 40
      ? -280
      : -400;
  const chargeStrength = overrides?.chargeStrength ?? defaultCharge;
  fg.d3Force("charge")?.strength(chargeStrength).distanceMax(maxR * 0.5);

  // ── Link force — shorter distances to keep connected nodes closer ──
  const link = fg.d3Force("link") as
    | { distance: (fn: unknown) => unknown; strength: (n: number) => unknown }
    | undefined;

  if (graphMode === "flavor-affinity") {
    link?.distance((l: TopologyLink) => {
      if (l.synthetic) return Math.min(400, Math.max(180, width * 0.12)) * distMul;
      const affinity = l.flavorAffinity ?? 0;
      return (70 + (1 - affinity) * 250) * distMul;
    });
  } else {
    link?.distance((l: TopologyLink) => {
      if (l.synthetic) return Math.min(400, Math.max(180, width * 0.12)) * distMul;
      const wgt = l.weight ?? 1;
      return Math.min(300, Math.max(80, 80 + wgt * 15)) * distMul;
    });
  }
  link?.strength(overrides?.linkStrength ?? 0.15);

  // ── Radial force — hubs toward center ──
  const radialStr = overrides?.radialStrength ?? 0.02;
  fg.d3Force(
    "radial",
    forceRadial(
      (n: GraphNode) => {
        if (maxSynergy <= 0) return maxR * 0.5;
        const s = n.synergyStrength ?? 0;
        const norm = Math.pow(s / maxSynergy, 0.6);
        return innerR + (1 - norm) * (maxR * 0.6 - innerR);
      },
      cx,
      cy,
    ).strength(radialStr),
  );

  // ── Collision — tight to visual radius ──
  const collidePad = overrides?.collisionPadding ?? NODE_COLLIDE_PADDING;
  fg.d3Force(
    "collide",
    forceCollide((node: GraphNode) => {
      return nodeRadius(node, maxSynergy, maxCookCount) + collidePad;
    })
      .strength(0.85)
      .iterations(4),
  );

  // ── Category / cuisine clustering — STRONG micro-city formation ──
  const clusterStr = overrides?.clusterStrength ?? 0.18;

  if (graphMode === "cuisine-clusters") {
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
      }).strength(clusterStr),
    );
    fg.d3Force(
      "clusterY",
      forceY((n: GraphNode) => {
        const cuisine = n.cuisineTags?.[0] ?? "OTHER";
        const angle = cuisineAngle.get(cuisine) ?? 0;
        return cy + Math.sin(angle) * clusterR;
      }).strength(clusterStr),
    );
  } else {
    // Strong category clustering — forms distinct micro-cities
    const categories = [...new Set(nodes.map((n) => n.category))];
    const angleStep = (2 * Math.PI) / Math.max(1, categories.length);
    const categoryAngle = new Map(categories.map((c, i) => [c, i * angleStep]));
    const clusterR = Math.min(width, height) * 0.28;

    fg.d3Force(
      "clusterX",
      forceX((n: GraphNode) => {
        const angle = categoryAngle.get(n.category) ?? 0;
        return cx + Math.cos(angle) * clusterR;
      }).strength(clusterStr),
    );
    fg.d3Force(
      "clusterY",
      forceY((n: GraphNode) => {
        const angle = categoryAngle.get(n.category) ?? 0;
        return cy + Math.sin(angle) * clusterR;
      }).strength(clusterStr),
    );
  }
}
