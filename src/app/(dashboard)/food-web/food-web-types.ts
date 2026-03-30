import type { TopologyNode, TopologyLink } from "@/lib/engines/topology-builder";
import type { GraphMode } from "@/lib/food-web-query-key";

export type { GraphMode };

export interface GraphNode extends TopologyNode {
  x?: number;
  y?: number;
}

export interface HighlightSet {
  /** The hovered node + direct (1-hop) neighbors — full brightness. */
  hop1: Set<string>;
  /** hop1 + 2-hop neighbors — reduced brightness. */
  hop2: Set<string>;
}
