import type { TopologyLink } from "@/lib/engines/topology-builder";
import type { GraphNode, HighlightSet } from "./food-web-types";
import { CATEGORY_COLORS, HUD, WEB, hexToRgba } from "./food-web-constants";

// ---------------------------------------------------------------------------
// Node sizing
// ---------------------------------------------------------------------------

/** Collision padding beyond drawn radius — room for under-node labels + gaps. */
export const NODE_COLLIDE_PADDING = 28;

/**
 * Combined importance score: synergy dominates, but recipe count and cook count
 * give weight to ingredients the user actually uses.
 */
function combinedScore(node: GraphNode, maxSynergy: number, maxCookCount: number): number {
  const synNorm = maxSynergy > 0 ? (node.synergyStrength ?? 0) / maxSynergy : 0;
  const recNorm = Math.min(1, (node.recipeCount ?? 0) / 20);
  const cookNorm = maxCookCount > 0 ? (node.cookCount ?? 0) / maxCookCount : 0;
  return synNorm * 0.5 + recNorm * 0.3 + cookNorm * 0.2;
}

/** Visual node radius from combined score (sqrt curve, 4-24px). */
export function nodeRadius(
  node: GraphNode,
  maxSynergy: number,
  maxCookCount: number,
): number {
  const s = combinedScore(node, maxSynergy, maxCookCount);
  const minR = 4;
  const maxR = 24;
  const t = Math.sqrt(Math.max(0, Math.min(1, s)));
  return minR + t * (maxR - minR);
}

// ---------------------------------------------------------------------------
// Zoom helpers
// ---------------------------------------------------------------------------

export function labelZoomThreshold(
  synergyStrength: number | undefined,
  maxSynergy: number,
): number {
  if (maxSynergy <= 0) return 0.06;
  const norm = Math.min(1, Math.max(0, (synergyStrength ?? 0) / maxSynergy));
  const emphasis = Math.sqrt(norm);
  return 0.3 - emphasis * 0.25;
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
  const x = Number.isFinite(node.x) ? node.x! : 0;
  const y = Number.isFinite(node.y) ? node.y! : 0;
  const k = Number.isFinite(globalScale) ? globalScale : 1;
  const baseR = nodeRadius(node, pctx.maxSynergy, pctx.maxCookCount);
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

  // ── Bloom / glow ──
  const bloomAlpha =
    highlightLevel === "full" || highlightLevel === "none"
      ? isHovered
        ? 0.18
        : 0.06
      : 0.03;
  const bloomR = isHovered ? radius * 3.2 : radius * 2.2;
  const bloom = ctx.createRadialGradient(x, y, radius * 0.3, x, y, bloomR);
  bloom.addColorStop(0, hexToRgba(color, bloomAlpha));
  bloom.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.arc(x, y, bloomR, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();

  // ── Ripple on hover ──
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
      const pulseAlpha = 0.15 + 0.12 * Math.sin(pctx.animTime * 0.004);
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
  const screenR = nodeScreenRadiusPx(baseR, k);
  const zoomTierOk = k >= labelZoomThreshold(node.synergyStrength, pctx.maxSynergy);
  const isNeighbor =
    pctx.highlightSet !== null && pctx.highlightSet.hop1.has(node.id);
  const zoomOk = zoomTierOk || screenR >= 5.5;
  const showLabel = isHovered || isNeighbor || zoomOk;

  if (showLabel) {
    const fontSize = isHovered ? 7 : 5.5;
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
  const x = Number.isFinite(node.x) ? node.x! : 0;
  const y = Number.isFinite(node.y) ? node.y! : 0;
  const baseR = nodeRadius(node, maxSynergy, maxCookCount);
  const radius = Math.max(baseR + 6, 12);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = _color;
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Quadratic bezier helpers
// ---------------------------------------------------------------------------

/** Evaluate point on quadratic bezier at parameter t (0..1). */
function bezierPoint(
  sx: number, sy: number,
  cpx: number, cpy: number,
  tx: number, ty: number,
  t: number,
): [number, number] {
  const mt = 1 - t;
  return [
    mt * mt * sx + 2 * mt * t * cpx + t * t * tx,
    mt * mt * sy + 2 * mt * t * cpy + t * t * ty,
  ];
}

/** Shared bezier control point calculation. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bezierControlPoint(s: any, t: any) {
  const mx = (s.x + t.x) / 2;
  const my = (s.y + t.y) / 2;
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const hash = ((s.id?.charCodeAt(0) ?? 0) + (t.id?.charCodeAt(0) ?? 0)) % 7;
  const curveSign = hash % 2 === 0 ? 1 : -1;
  const curveOffset = len > 50 ? curveSign * (12 + (hash / 7) * 18) : 0;
  const nx = len > 0 ? -dy / len : 0;
  const ny = len > 0 ? dx / len : 0;
  return { cpx: mx + nx * curveOffset, cpy: my + ny * curveOffset };
}

// ---------------------------------------------------------------------------
// Link painting — clean lines + animated transfer particles
// ---------------------------------------------------------------------------

export interface PaintLinkContext {
  highlightSet: HighlightSet | null;
  animTime: number;
  maxWeight: number;
  hoveredLinkKey: string | null;
  displayFontFamily: string;
}

/** Build a unique key for a link for hover comparison. */
export function linkKey(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  link: any,
): string {
  const sId = typeof link.source === "string" ? link.source : link.source?.id;
  const tId = typeof link.target === "string" ? link.target : link.target?.id;
  return `${sId}::${tId}`;
}

/**
 * Deterministic hash from link endpoints — gives each link a unique but stable
 * seed so particles don't all move in lockstep.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function linkSeed(s: any, t: any): number {
  let h = 0;
  const str = (s.id ?? "") + (t.id ?? "");
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
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

  const isHovered = plctx.hoveredLinkKey === linkKey(link);

  const synthetic = Boolean(link.synthetic);
  const isSubstitute = Boolean(link.substituteLink);
  const weight: number = link.weight ?? 1;

  const wNorm = plctx.maxWeight > 0 ? weight / plctx.maxWeight : 0;

  const srcColor = CATEGORY_COLORS[s.category] ?? CATEGORY_COLORS.OTHER;
  const tgtColor = CATEGORY_COLORS[t.category] ?? CATEGORY_COLORS.OTHER;
  const { cpx, cpy } = bezierControlPoint(s, t);

  const seed = linkSeed(s, t);
  const time = plctx.animTime;

  ctx.save();

  // ─────────────────────────────────────────────────
  // Line — simple, clean, thin
  // ─────────────────────────────────────────────────

  if (isHovered) {
    // Soft glow underlay
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.quadraticCurveTo(cpx, cpy, t.x, t.y);
    ctx.strokeStyle = hexToRgba("#ffffff", 0.05);
    ctx.lineWidth = 8;
    ctx.stroke();

    // Main line
    const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
    grad.addColorStop(0, hexToRgba(srcColor, 0.55));
    grad.addColorStop(1, hexToRgba(tgtColor, 0.55));
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.quadraticCurveTo(cpx, cpy, t.x, t.y);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Tooltip
    const fontSize = 5;
    ctx.font = `500 ${fontSize}px ${plctx.displayFontFamily}, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineJoin = "round";
    const affinity = link.flavorAffinity;
    let label = `${weight}x`;
    if (affinity != null && affinity > 0) {
      label += ` · ${Math.round(affinity * 100)}%`;
    }
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(18,18,18,0.9)";
    ctx.strokeText(label, cpx, cpy - 4);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(label, cpx, cpy - 4);
  } else if (isHighlighted) {
    // Subtle glow
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.quadraticCurveTo(cpx, cpy, t.x, t.y);
    ctx.strokeStyle = hexToRgba("#ffffff", 0.03);
    ctx.lineWidth = 5;
    ctx.stroke();

    // Main line
    const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
    grad.addColorStop(0, hexToRgba(srcColor, 0.4));
    grad.addColorStop(1, hexToRgba(tgtColor, 0.4));
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.quadraticCurveTo(cpx, cpy, t.x, t.y);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  } else {
    // Default — very thin, subtle
    const alpha = plctx.highlightSet
      ? synthetic ? 0.04 : 0.07
      : synthetic ? 0.1 : isSubstitute ? 0.14 : 0.12;

    if (synthetic) {
      ctx.setLineDash([4, 7]);
      ctx.lineDashOffset = -time * 0.02;
    } else if (isSubstitute) {
      ctx.setLineDash([2, 4]);
    }

    const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
    grad.addColorStop(0, hexToRgba(srcColor, alpha));
    grad.addColorStop(1, hexToRgba(tgtColor, alpha));
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.quadraticCurveTo(cpx, cpy, t.x, t.y);
    ctx.strokeStyle = grad;
    ctx.lineWidth = plctx.highlightSet ? 0.35 : 0.5;
    ctx.stroke();
  }

  ctx.restore();

  // ─────────────────────────────────────────────────
  // Transfer particles — lightweight dots, no gradients
  // ─────────────────────────────────────────────────

  // Skip particles for dimmed or synthetic links
  if (plctx.highlightSet && !isHighlighted && !isHovered) return;
  if (synthetic) return;

  ctx.save();

  // Fewer particles, simpler rendering — 1 to 3 max
  const particleCount = Math.min(3, 1 + Math.floor(wNorm * 2));
  const cycleDuration = 5000 - wNorm * 3000;
  const speed = 1 / cycleDuration;
  const pRadius = isHovered ? 1.8 : isHighlighted ? 1.4 : 1.0;

  for (let i = 0; i < particleCount; i++) {
    const phaseOffset = ((seed + i * 2654435761) % 1000) / 1000;
    const rawT = ((time * speed) + phaseOffset) % 1;
    const easedT = 0.5 - 0.5 * Math.cos(rawT * Math.PI);
    const [px, py] = bezierPoint(s.x, s.y, cpx, cpy, t.x, t.y, easedT);

    const particleColor = easedT < 0.5 ? srcColor : tgtColor;
    const edgeFade = Math.min(1, rawT * 5, (1 - rawT) * 5);
    const alpha = edgeFade * (isHovered ? 0.85 : isHighlighted ? 0.6 : 0.35);

    // Single filled dot — no radial gradient, no glow
    ctx.beginPath();
    ctx.arc(px, py, pRadius, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(particleColor, alpha);
    ctx.fill();
  }

  ctx.restore();
}

/** Wider invisible hit area for link pointer detection. */
export function paintLinkArea(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  link: any,
  paintColor: string,
  ctx: CanvasRenderingContext2D,
) {
  const s = link.source;
  const t = link.target;
  if (!s?.x || !t?.x) return;

  const { cpx, cpy } = bezierControlPoint(s, t);

  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.quadraticCurveTo(cpx, cpy, t.x, t.y);
  ctx.strokeStyle = paintColor;
  ctx.lineWidth = 10;
  ctx.stroke();
}
