"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { SlidersHorizontal, RotateCcw, Flame, X } from "lucide-react";
import { HUD, hexToRgba } from "./food-web-constants";
import { HudCorners } from "./hud-corners";
import type { PhysicsOverrides } from "./food-web-forces";

interface PhysicsPanelProps {
  overrides: PhysicsOverrides;
  setOverrides: (o: PhysicsOverrides) => void;
  velocityDecay: number;
  setVelocityDecay: (v: number) => void;
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
}: SliderRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(monoClass, "w-[52px] shrink-0 text-[8px] uppercase tracking-wider")}
        style={{ color: HUD.textDim }}
      >
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-0.5 flex-1 cursor-pointer appearance-none rounded-full bg-[#1a1a2e] [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00e5ff] [&::-webkit-slider-thumb]:shadow-[0_0_4px_rgba(0,229,255,0.5)]"
      />
      <span
        className={cn(monoClass, "w-[34px] text-right text-[8px] font-bold tabular-nums")}
        style={{ color: HUD.cyan }}
      >
        {display}
      </span>
    </div>
  );
}

export function PhysicsPanel({
  overrides,
  setOverrides,
  velocityDecay,
  setVelocityDecay,
  nodeCount,
  graphRef,
  monoClass,
}: PhysicsPanelProps) {
  const MONO = monoClass;
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const defaultCharge = nodeCount > 80 ? -300 : nodeCount > 40 ? -500 : -700;

  const applyAndReheat = useCallback(
    (next: PhysicsOverrides, nextDecay?: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setOverrides(next);
        if (nextDecay !== undefined) setVelocityDecay(nextDecay);
        graphRef.current?.d3ReheatSimulation();
      }, 150);
    },
    [setOverrides, setVelocityDecay, graphRef],
  );

  const charge = overrides.chargeStrength ?? defaultCharge;
  const distMul = overrides.linkDistanceMultiplier ?? 1.0;
  const padding = overrides.collisionPadding ?? 28;
  const gravity = overrides.radialStrength ?? 0.025;

  const handleReset = useCallback(() => {
    setOverrides({});
    setVelocityDecay(0.35);
    graphRef.current?.d3ReheatSimulation();
  }, [setOverrides, setVelocityDecay, graphRef]);

  const handleReheat = useCallback(() => {
    graphRef.current?.d3ReheatSimulation();
  }, [graphRef]);

  if (!open) {
    return (
      <div className="absolute bottom-14 right-4 z-10">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            MONO,
            "relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[9px] font-medium uppercase tracking-wider backdrop-blur-xl transition-colors hover:text-[#94a3b8]",
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
            style={{ color: hexToRgba(HUD.cyan, 0.45) }}
          />
          Physics
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-14 right-4 z-10">
      <div
        className="relative w-[220px] space-y-2.5 rounded-lg p-3 backdrop-blur-xl"
        style={{
          background: HUD.panel,
          border: `1px solid ${HUD.border}`,
        }}
      >
        <HudCorners />

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
            className="flex size-5 items-center justify-center rounded-md text-[#475569] transition-colors hover:bg-[#1a1a2e]/40 hover:text-[#94a3b8]"
            aria-label="Close physics panel"
          >
            <X className="size-3" strokeWidth={2} />
          </button>
        </div>

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
          label="Spacing"
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
          label="Friction"
          value={velocityDecay}
          min={0.1}
          max={0.6}
          step={0.05}
          display={velocityDecay.toFixed(2)}
          onChange={(v) => applyAndReheat(overrides, v)}
          monoClass={MONO}
        />

        <div className="flex gap-1.5 border-t border-[#1a1a2e]/60 pt-2">
          <button
            type="button"
            onClick={handleReset}
            className={cn(
              MONO,
              "flex flex-1 items-center justify-center gap-1 rounded-md border border-[#1a1a2e] px-2 py-1 text-[9px] font-medium uppercase tracking-wider text-[#475569] transition-colors hover:bg-[#1a1a2e]/40 hover:text-[#94a3b8]",
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
              "flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1 text-[9px] font-medium uppercase tracking-wider transition-colors",
              "border-[#ffab00]/35 bg-[#ffab00]/10 text-[#fcd34d] hover:bg-[#ffab00]/15",
            )}
          >
            <Flame className="size-2.5" />
            Reheat
          </button>
        </div>
      </div>
    </div>
  );
}
