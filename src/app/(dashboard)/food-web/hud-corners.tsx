import { HUD } from "./food-web-constants";

/**
 * Subtle warm corner accents — two small dots at opposing corners
 * that give panels a cartographic "pin" feel.
 */
export function HudCorners({ color = HUD.accentDim }: { color?: string }) {
  return (
    <>
      <span
        className="pointer-events-none absolute top-1.5 left-1.5 h-1 w-1 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span
        className="pointer-events-none absolute bottom-1.5 right-1.5 h-1 w-1 rounded-full"
        style={{ backgroundColor: color }}
      />
    </>
  );
}
