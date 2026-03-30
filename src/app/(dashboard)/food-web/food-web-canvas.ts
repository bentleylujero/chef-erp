import type { TopologyLink } from "@/lib/engines/topology-builder";
import type { GraphNode, HighlightSet } from "./food-web-types";
import { CATEGORY_COLORS, HUD, WEB, hexToRgba } from "./food-web-constants";

// ---------------------------------------------------------------------------
// Node sizing
// ---------------------------------------------------------------------------

/** Collision padding beyond drawn radius — room for under-node labels + gaps. */
export const NODE_COLLIDE_PADDING = 44;

/**
 * Combined importance score: synergy dominates, but recipe count and cook count
 * give weight to ingredients the user actually uses.
 */
function combinedScore(node: GraphNode, maxSynergy: number, maxCookCount: number): number {
  const synNorm = maxSynergy > 0 ? (node.synergyStrength ?? 0) / maxSynergy : 0;
  const recNorm = Math.min(1, (node.recipeCount ?? 0) / 20); // cap at 20 recipes
  const cookNorm = maxCookCount > 0 ? (node.cookCount ?? 0) / maxCookCount : 0;
  return synNorm * 0.5 + recNorm * 0.3 + cookNorm * 0.2;
}

/** Visual node radius from combined score (sqrt curve, 3-30px). */
export function nodeRadius(
  node: GraphNode,
  maxSynergy: number,
  maxCookCount: number,
): number {
  const s = combinedScore(node, maxSynergy, maxCookCount);
  const minR = 3;
  const maxR = 30;
  const t = Math.sqrt(Math.max(0, Math.min(1, s)));
  return minR + t * (maxR - minR);
}

// ---------------------------------------------------------------------------
// Zoom helpers
// ---------------------------------------------------------------------------

const ZOOM_VISUAL_REF = 0.32;
const ZOOM_VISUAL_PINCH = 1.18;

export function zoomPinchFactor(globalScale: number): number {
  const k = Number.isFinite(globalScale) && globalScale > 0 ? globalScale : ZOOM_VISUAL_REF;
  const kSafe = Math.max(k, 0.032);
  const ratio = Math.min(4, Math.max(0.22, ZOOM_VISUAL_REF / kSafe));
  return Math.pow(ratio, ZOOM_VISUAL_PINCH);
}

/**
 * Zoom threshold for label visibility — hubs show at lower zoom, weak nodes need more zoom.
 */
export function labelZoomThreshold(
  synergyStrength: number | undefined,
  maxSynergy: number,
): number {
  if (maxSynergy <= 0) return 0.06;
  const norm = Math.min(1, Math.max(0, (synergyStrength ?? 0) / maxSynergy));
  const emphasis = Math.sqrt(norm);
  return 0.42 - emphasis * 0.35;
}

function nodeScreenRadiusPx(baseR: number, globalScale: number): number {
  if (!Number.isFinite(globalScale) || globalScale <= 0) return 0;
  return baseR * globalScale;
}

// ---------------------------------------------------------------------------
// Node painting
// ---------------------------------------------------------------------------

export interface PaintNodeContext {
  highlightSet: HighlightSet | null;
  hoveredNodeId: string | null;
  maxSynergy: number;
  maxCookCount: number;
  animTime: number;
  hoverStartTime: number;
  displayFontFamily: string;
}

export function paintNode(
  node: GraphNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  pctx: PaintNodeContext,
) {
  ctx.save();
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const k = Number.isFinite(globalScale) ? globalScale : 1;
  const pinch = zoomPinchFactor(k);
  const baseR = nodeRadius(node, pctx.maxSynergy, pctx.maxCookCount) * pinch;
  const color = CATEGORY_COLORS[node.category] ?? CATEGORY_COLORS.OTHER;
  const isHovered = pctx.hoveredNodeId === node.id;

  // Determine highlight level
  let highlightLevel: "full" | "hop2" | "dim" | "none" = "none";
  if (!pctx.highlightSet) {
    highlightLevel = "none";
  } else if (pctx.highlightSet.hop1.has(node.id)) {
    highlightLevel = "full";
  } else if (pctx.highlightSet.hop2.has(node.id)) {
    highlightLevel = "hop2";
  } else {
    highlightLevel = "dim";
  }

  const radius = isHovered ? baseR * 1.22 : baseR;

  // ── Dim state: barely visible ──
  if (highlightLevel === "dim") {
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(color, 0.06);
    ctx.fill();
    ctx.restore();
    return;
  }

  // ── Bloom / glow for all visible nodes ──
  const bloomAlpha =
    highlightLevel === "full" || highlightLevel === "none"
      ? isHovered
        ? 0.18
        : 0.06
      : 0.03; // hop2
  const bloomR = isHovered ? radius * 3.2 : radius * 2.2;
  const bloom = ctx.createRadialGradient(x, y, radius * 0.3, x, y, bloomR);
  bloom.addColorStop(0, hexToRgba(color, bloomAlpha));
  bloom.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.arc(x, y, bloomR, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();

  // ── Ripple effect on hover ──
  if (isHovered && pctx.hoverStartTime > 0) {
    const elapsed = pctx.animTime - pctx.hoverStartTime;
    if (elapsed < 600) {
      const progress = elapsed / 600;
      const rippleR = radius + (radius * 2.5) * progress;
      const rippleAlpha = 0.25 * (1 - progress);
      ctx.beginPath();
      ctx.arc(x, y, rippleR, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(color, rippleAlpha);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  // ── Recently cooked pulse ──
  if (node.lastCooked) {
    const daysSince =
      (Date.now() - new Date(node.lastCooked).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) {
      const pulseAlpha =
        0.15 + 0.12 * Math.sin(pctx.animTime * 0.004);
      ctx.beginPath();
      ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(HUD.green, pulseAlpha);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // ── Pantry ring ──
  if (node.inPantry) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(HUD.amber, 0.55);
    ctx.lineWidth = 1;
    ctx.setLineDash([3.5, 3.5]);
    // Subtle glow
    ctx.shadowColor = hexToRgba(HUD.amber, 0.2);
    ctx.shadowBlur = 4;
    ctx.stroke();
    ctx.restore();
  }

  // ── Outer stroke ──
  ctx.beginPath();
  ctx.arc(x, y, radius + 0.9, 0, Math.PI * 2);
  ctx.strokeStyle = hexToRgba(
    color,
    isHovered ? 0.6 : highlightLevel === "hop2" ? 0.18 : 0.28,
  );
  ctx.lineWidth = 0.55;
  ctx.stroke();

  // ── Gradient fill ──
  const fillAlpha =
    isHovered ? 0.92 : highlightLevel === "hop2" ? 0.45 : 0.78;
  const grad = ctx.createRadialGradient(
    x - radius * 0.25,
    y - radius * 0.25,
    radius * 0.1,
    x,
    y,
    radius,
  );
  grad.addColorStop(0, hexToRgba("#ffffff", 0.2));
  grad.addColorStop(0.4, hexToRgba(color, fillAlpha));
  grad.addColorStop(1, hexToRgba(color, fillAlpha * 0.85));
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // ── Inner highlight ──
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba("#ffffff", isHovered ? 0.25 : 0.12);
  ctx.fill();

  // ── Label ──
  const kSafe = Math.max(k, 0.032);
  const screenR = nodeScreenRadiusPx(baseR, k);
  const zoomTierOk = k >= labelZoomThreshold(node.synergyStrength, pctx.maxSynergy);
  const isNeighbor =
    pctx.highlightSet !== null && pctx.highlightSet.hop1.has(node.id);
  const zoomOk = zoomTierOk || screenR >= 5.5;
  const showLabel = isHovered || isNeighbor || zoomOk;

  if (showLabel) {
    const labelPinch = pinch;
    const fontSize = isHovered
      ? Math.min(11, Math.max(6, (8.5 * labelPinch) / kSafe))
      : Math.min(9, Math.max(5, (6.8 * labelPinch) / kSafe));
    ctx.font = `500 ${fontSize}px ${pctx.displayFontFamily}, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineJoin = "round";

    const text = node.name;
    const textY = y + radius + (isHovered ? 5 : 6);

    ctx.lineWidth = Math.max(2.2, fontSize * 0.32);
    ctx.strokeStyle = "rgba(18,18,18,0.95)";
    ctx.strokeText(text, x, textY);
    ctx.lineWidth = Math.max(1, fontSize * 0.15);
    ctx.strokeStyle = "rgba(18,18,18,0.4)";
    ctx.strokeText(text, x, textY);

    ctx.fillStyle = isHovered
      ? WEB.label
      : highlightLevel === "hop2"
        ? hexToRgba(WEB.labelMuted, 0.55)
        : hexToRgba(WEB.labelMuted, 0.95);
    ctx.fillText(text, x, textY);
  }
  ctx.restore();
}

export function paintNodeArea(
  node: GraphNode,
  _color: string,
  ctx: CanvasRenderingContext2D,
  maxSynergy: number,
  maxCookCount: number,
) {
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const baseR = nodeRadius(node, maxSynergy, maxCookCount);
  const radius = baseR + NODE_COLLIDE_PADDING * 0.85;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = _color;
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Link painting
// ---------------------------------------------------------------------------

export interface PaintLinkContext {
  highlightSet: HighlightSet | null;
  animTime: number;
  maxWeight: number;
}

export function paintLink(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  link: any,
  ctx: CanvasRenderingContext2D,
  plctx: PaintLinkContext,
) {
  const s = link.source;
  const t = link.target;
  if (!s?.x || !t?.x) return;

  const isHighlighted =
    plctx.highlightSet &&
    plctx.highlightSet.hop1.has(s.id) &&
    plctx.highlightSet.hop1.has(t.id);

  const synthetic = Boolean(link.synthetic);
  const isSubstitute = Boolean(link.substituteLink);
  const weight: number = link.weight ?? 1;

  // Width scales more dramatically with weight
  const wNorm = plctx.maxWeight > 0 ? weight / plctx.maxWeight : 0;
  const baseW = synthetic ? 0.38 : 0.3 + wNorm * 2.5;

  // ── Gradient color from source -> target category ──
  const srcColor = CATEGORY_COLORS[s.category] ?? CATEGORY_COLORS.OTHER;
  const tgtColor = CATEGORY_COLORS[t.category] ?? CATEGORY_COLORS.OTHER;

  // ── Bezier control point (perpendicular offset for curvature) ──
  const mx = (s.x + t.x) / 2;
  const my = (s.y + t.y) / 2;
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  // Hash-based offset so parallel edges don't overlap identically
  const hash = ((s.id?.charCodeAt(0) ?? 0) + (t.id?.charCodeAt(0) ?? 0)) % 7;
  const curveSign = hash % 2 === 0 ? 1 : -1;
  const curveOffset = len > 50 ? curveSign * (12 + (hash / 7) * 18) : 0;
  const nx = len > 0 ? -dy / len : 0;
  const ny = len > 0 ? dx / len : 0;
  const cpx = mx + nx * curveOffset;
  const cpy = my + ny * curveOffset;

  ctx.save();

  if (synthetic) {
    ctx.setLineDash([4, 7]);
    ctx.lineDashOffset = -plctx.animTime * 0.02;
  } else if (isSubstitute) {
    ctx.setLineDash([2, 4]);
  }

  if (isHighlighted) {
    // Glow
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.quadraticCurveTo(cpx, cpy, t.x, t.y);
    ctx.strokeStyle = WEB.edgeGlow;
    ctx.lineWidth = baseW * 6 + 4;
    ctx.stroke();

    // Main highlighted stroke with gradient
    const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
    grad.addColorStop(0, hexToRgba(srcColor, 0.6));
    grad.addColorStop(1, hexToRgba(tgtColor, 0.6));
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.quadraticCurveTo(cpx, cpy, t.x, t.y);
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(0.65, baseW * 2.2);
    ctx.stroke();
  } else {
    // Normal stroke
    const alpha = plctx.highlightSet
      ? synthetic
        ? 0.06
        : 0.1
      : synthetic
        ? 0.15
        : isSubstitute
          ? 0.25
          : 0.22;
    const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
    grad.addColorStop(0, hexToRgba(srcColor, alpha));
    grad.addColorStop(1, hexToRgba(tgtColor, alpha));
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.quadraticCurveTo(cpx, cpy, t.x, t.y);
    ctx.strokeStyle = grad;
    ctx.lineWidth = plctx.highlightSet ? baseW * 0.65 : baseW;
    ctx.stroke();
  }

  ctx.restore();
}
