"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  SlidersHorizontal,
  RotateCcw,
  Flame,
  X,
  Lock,
  Unlock,
  Zap,
  Circle,
  Maximize2,
  Wind,
} from "lucide-react";
import { HUD, hexToRgba } from "./food-web-constants";
import { HudCorners } from "./hud-corners";
import { PHYSICS_PRESETS, type PhysicsOverrides } from "./food-web-forces";

interface PhysicsPanelProps {
  overrides: PhysicsOverrides;
  setOverrides: (o: PhysicsOverrides) => void;
  velocityDecay: number;
  setVelocityDecay: (v: number) => void;
  alphaDecay: number;
  setAlphaDecay: (v: number) => void;
  nodeCount: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  graphRef: React.RefObject<any>;
  monoClass: string;
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
  monoClass: string;
  accent?: string;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  monoClass,
  accent,
}: SliderRowProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const trackColor = accent ?? HUD.accent;

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(monoClass, "w-[56px] shrink-0 text-[8px] uppercase tracking-wider")}
        style={{ color: HUD.textDim }}
      >
        {label}
      </span>
      <div className="relative flex-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-0.5 w-full cursor-pointer appearance-none rounded-full bg-[#2a2420] [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(212,165,116,0.4)]"
          style={{
            background: `linear-gradient(to right, ${hexToRgba(trackColor, 0.5)} 0%, ${hexToRgba(trackColor, 0.5)} ${pct}%, #2a2420 ${pct}%, #2a2420 100%)`,
            // @ts-expect-error -- custom property for thumb
            "--thumb-bg": trackColor,
          }}
        />
      </div>
      <span
        className={cn(monoClass, "w-[38px] text-right text-[8px] font-bold tabular-nums")}
        style={{ color: accent ?? HUD.accent }}
      >
        {display}
      </span>
    </div>
  );
}

function SectionLabel({
  children,
  monoClass,
}: {
  children: React.ReactNode;
  monoClass: string;
}) {
  return (
    <div
      className={cn(
        monoClass,
        "flex items-center gap-1.5 pt-1.5 text-[7px] font-medium uppercase tracking-[0.15em]",
      )}
      style={{ color: hexToRgba(HUD.accent, 0.4) }}
    >
      <div className="h-px flex-1" style={{ background: hexToRgba(HUD.accent, 0.1) }} />
      <span>{children}</span>
      <div className="h-px flex-1" style={{ background: hexToRgba(HUD.accent, 0.1) }} />
    </div>
  );
}

type PresetKey = keyof typeof PHYSICS_PRESETS;

const PRESET_META: { key: PresetKey; label: string; icon: typeof Zap; velocityDecay: number; alphaDecay: number }[] = [
  { key: "tight", label: "Tight", icon: Circle, velocityDecay: 0.4, alphaDecay: 0.03 },
  { key: "balanced", label: "Balanced", icon: Zap, velocityDecay: 0.35, alphaDecay: 0.0228 },
  { key: "spread", label: "Spread", icon: Maximize2, velocityDecay: 0.3, alphaDecay: 0.02 },
  { key: "organic", label: "Organic", icon: Wind, velocityDecay: 0.2, alphaDecay: 0.015 },
];

export function PhysicsPanel({
  overrides,
  setOverrides,
  velocityDecay,
  setVelocityDecay,
  alphaDecay,
  setAlphaDecay,
  nodeCount,
  graphRef,
  monoClass,
}: PhysicsPanelProps) {
  const MONO = monoClass;
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [activePreset, setActivePreset] = useState<PresetKey | null>("balanced");

  const defaultCharge = nodeCount > 80 ? -180 : nodeCount > 40 ? -280 : -400;

  const applyAndReheat = useCallback(
    (next: PhysicsOverrides, nextDecay?: number, nextAlpha?: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setActivePreset(null); // custom settings = no preset
      debounceRef.current = setTimeout(() => {
        setOverrides(next);
        if (nextDecay !== undefined) setVelocityDecay(nextDecay);
        if (nextAlpha !== undefined) setAlphaDecay(nextAlpha);
        graphRef.current?.d3ReheatSimulation();
      }, 150);
    },
    [setOverrides, setVelocityDecay, setAlphaDecay, graphRef],
  );

  const charge = overrides.chargeStrength ?? defaultCharge;
  const distMul = overrides.linkDistanceMultiplier ?? 1.0;
  const padding = overrides.collisionPadding ?? 28;
  const gravity = overrides.radialStrength ?? 0.025;
  const linkStr = overrides.linkStrength ?? 0.15;
  const clusterStr = overrides.clusterStrength ?? 0.18;

  const handleReset = useCallback(() => {
    setOverrides({});
    setVelocityDecay(0.35);
    setAlphaDecay(0.0228);
    setActivePreset("balanced");
    graphRef.current?.d3ReheatSimulation();
  }, [setOverrides, setVelocityDecay, setAlphaDecay, graphRef]);

  const handleReheat = useCallback(() => {
    graphRef.current?.d3ReheatSimulation();
  }, [graphRef]);

  const handlePreset = useCallback(
    (preset: PresetKey) => {
      const p = PHYSICS_PRESETS[preset];
      const meta = PRESET_META.find((m) => m.key === preset)!;
      setOverrides({ ...p });
      setVelocityDecay(meta.velocityDecay);
      setAlphaDecay(meta.alphaDecay);
      setActivePreset(preset);
      graphRef.current?.d3ReheatSimulation();
    },
    [setOverrides, setVelocityDecay, setAlphaDecay, graphRef],
  );

  const handleFreezeAll = useCallback(() => {
    const fg = graphRef.current;
    if (!fg) return;
    const data = fg.graphData?.();
    if (!data?.nodes) return;
    for (const node of data.nodes) {
      node.fx = node.x;
      node.fy = node.y;
    }
  }, [graphRef]);

  const handleUnfreezeAll = useCallback(() => {
    const fg = graphRef.current;
    if (!fg) return;
    const data = fg.graphData?.();
    if (!data?.nodes) return;
    for (const node of data.nodes) {
      node.fx = undefined;
      node.fy = undefined;
    }
    fg.d3ReheatSimulation();
  }, [graphRef]);

  if (!open) {
    return (
      <div className="absolute bottom-14 right-4 z-10">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            MONO,
            "relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[9px] font-medium uppercase tracking-wider backdrop-blur-xl transition-colors hover:text-[#a89b8c]",
          )}
          style={{
            background: HUD.panel,
            border: `1px solid ${HUD.border}`,
            color: HUD.textMuted,
          }}
          title="Adjust physics simulation"
        >
          <HudCorners />
          <SlidersHorizontal
            className="size-3 shrink-0"
            style={{ color: hexToRgba(HUD.accent, 0.5) }}
          />
          Physics
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-14 right-4 z-10">
      <div
        className="relative w-[252px] space-y-1.5 rounded-lg p-3 backdrop-blur-xl"
        style={{
          background: HUD.panel,
          border: `1px solid ${HUD.border}`,
        }}
      >
        <HudCorners />

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <span
            className={cn(
              MONO,
              "text-[9px] font-medium uppercase tracking-[0.12em]",
            )}
            style={{ color: HUD.textDim }}
          >
            Physics
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex size-5 items-center justify-center rounded-md text-[#6b5f53] transition-colors hover:bg-[#2a2420]/40 hover:text-[#a89b8c]"
            aria-label="Close physics panel"
          >
            <X className="size-3" strokeWidth={2} />
          </button>
        </div>

        {/* ── Presets ── */}
        <div className="flex gap-1">
          {PRESET_META.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => handlePreset(key)}
              className={cn(
                MONO,
                "flex flex-1 items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-[7px] font-medium uppercase tracking-wider transition-all",
                activePreset === key
                  ? "border-[#d4a574]/40 bg-[#d4a574]/12 text-[#d4a574]"
                  : "border-[#2a2420] text-[#6b5f53] hover:bg-[#2a2420]/40 hover:text-[#a89b8c]",
              )}
            >
              <Icon className="size-2.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Forces ── */}
        <SectionLabel monoClass={MONO}>Forces</SectionLabel>

        <SliderRow
          label="Repulse"
          value={-charge}
          min={100}
          max={1000}
          step={50}
          display={String(charge)}
          onChange={(v) =>
            applyAndReheat({ ...overrides, chargeStrength: -v })
          }
          monoClass={MONO}
        />

        <SliderRow
          label="Gravity"
          value={gravity}
          min={0}
          max={0.15}
          step={0.005}
          display={gravity.toFixed(3)}
          onChange={(v) =>
            applyAndReheat({ ...overrides, radialStrength: v })
          }
          monoClass={MONO}
        />

        <SliderRow
          label="Clusters"
          value={clusterStr}
          min={0}
          max={0.4}
          step={0.01}
          display={clusterStr.toFixed(2)}
          onChange={(v) =>
            applyAndReheat({ ...overrides, clusterStrength: v })
          }
          monoClass={MONO}
          accent={HUD.green}
        />

        {/* ── Spacing ── */}
        <SectionLabel monoClass={MONO}>Spacing</SectionLabel>

        <SliderRow
          label="Distance"
          value={distMul}
          min={0.5}
          max={3.0}
          step={0.1}
          display={`${distMul.toFixed(1)}x`}
          onChange={(v) =>
            applyAndReheat({ ...overrides, linkDistanceMultiplier: v })
          }
          monoClass={MONO}
        />

        <SliderRow
          label="Bonds"
          value={linkStr}
          min={0.02}
          max={0.4}
          step={0.01}
          display={linkStr.toFixed(2)}
          onChange={(v) =>
            applyAndReheat({ ...overrides, linkStrength: v })
          }
          monoClass={MONO}
        />

        <SliderRow
          label="Padding"
          value={padding}
          min={5}
          max={50}
          step={1}
          display={String(padding)}
          onChange={(v) =>
            applyAndReheat({ ...overrides, collisionPadding: v })
          }
          monoClass={MONO}
        />

        {/* ── Dynamics ── */}
        <SectionLabel monoClass={MONO}>Dynamics</SectionLabel>

        <SliderRow
          label="Friction"
          value={velocityDecay}
          min={0.1}
          max={0.6}
          step={0.05}
          display={velocityDecay.toFixed(2)}
          onChange={(v) => applyAndReheat(overrides, v)}
          monoClass={MONO}
          accent={HUD.amber}
        />

        <SliderRow
          label="Settle"
          value={alphaDecay}
          min={0.005}
          max={0.06}
          step={0.001}
          display={alphaDecay.toFixed(3)}
          onChange={(v) => applyAndReheat(overrides, undefined, v)}
          monoClass={MONO}
          accent={HUD.amber}
        />

        {/* ── Actions ── */}
        <div className="flex gap-1 border-t border-[#2a2420]/60 pt-2">
          <button
            type="button"
            onClick={handleFreezeAll}
            className={cn(
              MONO,
              "flex flex-1 items-center justify-center gap-1 rounded-md border border-[#2a2420] px-1.5 py-1 text-[8px] font-medium uppercase tracking-wider text-[#6b5f53] transition-colors hover:bg-[#2a2420]/40 hover:text-[#a89b8c]",
            )}
            title="Pin all nodes in place"
          >
            <Lock className="size-2.5" />
            Pin
          </button>
          <button
            type="button"
            onClick={handleUnfreezeAll}
            className={cn(
              MONO,
              "flex flex-1 items-center justify-center gap-1 rounded-md border border-[#2a2420] px-1.5 py-1 text-[8px] font-medium uppercase tracking-wider text-[#6b5f53] transition-colors hover:bg-[#2a2420]/40 hover:text-[#a89b8c]",
            )}
            title="Unpin all nodes"
          >
            <Unlock className="size-2.5" />
            Free
          </button>
          <button
            type="button"
            onClick={handleReset}
            className={cn(
              MONO,
              "flex flex-1 items-center justify-center gap-1 rounded-md border border-[#2a2420] px-1.5 py-1 text-[8px] font-medium uppercase tracking-wider text-[#6b5f53] transition-colors hover:bg-[#2a2420]/40 hover:text-[#a89b8c]",
            )}
          >
            <RotateCcw className="size-2.5" />
            Reset
          </button>
          <button
            type="button"
            onClick={handleReheat}
            className={cn(
              MONO,
              "flex flex-1 items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-[8px] font-medium uppercase tracking-wider transition-colors",
              "border-[#e8a849]/35 bg-[#e8a849]/10 text-[#e8a849] hover:bg-[#e8a849]/15",
            )}
          >
            <Flame className="size-2.5" />
            Heat
          </button>
        </div>
      </div>
    </div>
  );
}
