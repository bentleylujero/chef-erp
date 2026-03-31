import { HUD } from "./food-web-constants";

export function HudCorners({ color = HUD.cyanDim }: { color?: string }) {
  const s = { borderColor: color };
  return (
    <>
      <span
        className="pointer-events-none absolute top-0 left-0 h-2 w-2 border-t border-l"
        style={s}
      />
      <span
        className="pointer-events-none absolute top-0 right-0 h-2 w-2 border-t border-r"
        style={s}
      />
      <span
        className="pointer-events-none absolute bottom-0 left-0 h-2 w-2 border-b border-l"
        style={s}
      />
      <span
        className="pointer-events-none absolute bottom-0 right-0 h-2 w-2 border-b border-r"
        style={s}
      />
    </>
  );
}
