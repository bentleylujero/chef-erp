export type UnitType =
  | "g"
  | "kg"
  | "oz"
  | "lb"
  | "ml"
  | "l"
  | "cup"
  | "tbsp"
  | "tsp"
  | "count"
  | "bunch"
  | "pinch"
  | "slice";

const MASS_UNITS: ReadonlySet<UnitType> = new Set(["g", "kg", "oz", "lb"]);
const VOLUME_UNITS: ReadonlySet<UnitType> = new Set([
  "ml",
  "l",
  "cup",
  "tbsp",
  "tsp",
]);
const COUNT_UNITS: ReadonlySet<UnitType> = new Set([
  "count",
  "bunch",
  "pinch",
  "slice",
]);

/** US customary conversions */
const G_PER_OZ = 28.349523125;
const G_PER_LB = 453.59237;
const ML_PER_L = 1000;
const ML_PER_CUP = 236.5882365;
const ML_PER_TBSP = 14.78676478125;
const ML_PER_TSP = 4.92892159375;

const TSP_PER_TBSP = 3;
const TBSP_PER_CUP = 16;
const TSP_PER_CUP = TBSP_PER_CUP * TSP_PER_TBSP;

const EPS = 1e-6;

const UNIT_ALIASES: Record<string, UnitType> = {
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  cup: "cup",
  cups: "cup",
  tbsp: "tbsp",
  tbsps: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  t: "tbsp",
  tbl: "tbsp",
  tsp: "tsp",
  tsps: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  count: "count",
  bunch: "bunch",
  bunches: "bunch",
  pinch: "pinch",
  pinches: "pinch",
  slice: "slice",
  slices: "slice",
};

function toGrams(value: number, unit: UnitType): number {
  switch (unit) {
    case "g":
      return value;
    case "kg":
      return value * 1000;
    case "oz":
      return value * G_PER_OZ;
    case "lb":
      return value * G_PER_LB;
    default:
      return value;
  }
}

function fromGrams(grams: number, unit: UnitType): number {
  switch (unit) {
    case "g":
      return grams;
    case "kg":
      return grams / 1000;
    case "oz":
      return grams / G_PER_OZ;
    case "lb":
      return grams / G_PER_LB;
    default:
      return grams;
  }
}

function toMl(value: number, unit: UnitType): number {
  switch (unit) {
    case "ml":
      return value;
    case "l":
      return value * ML_PER_L;
    case "cup":
      return value * ML_PER_CUP;
    case "tbsp":
      return value * ML_PER_TBSP;
    case "tsp":
      return value * ML_PER_TSP;
    default:
      return value;
  }
}

function fromMl(ml: number, unit: UnitType): number {
  switch (unit) {
    case "ml":
      return ml;
    case "l":
      return ml / ML_PER_L;
    case "cup":
      return ml / ML_PER_CUP;
    case "tbsp":
      return ml / ML_PER_TBSP;
    case "tsp":
      return ml / ML_PER_TSP;
    default:
      return ml;
  }
}

function parseUnitString(unit: string): UnitType | null {
  const key = unit.trim().toLowerCase();
  return UNIT_ALIASES[key] ?? null;
}

export function convertUnit(
  value: number,
  from: UnitType,
  to: UnitType,
): number | null {
  if (from === to) return value;

  if (MASS_UNITS.has(from) && MASS_UNITS.has(to)) {
    return fromGrams(toGrams(value, from), to);
  }

  if (VOLUME_UNITS.has(from) && VOLUME_UNITS.has(to)) {
    return fromMl(toMl(value, from), to);
  }

  if (COUNT_UNITS.has(from) && COUNT_UNITS.has(to)) {
    return null;
  }

  return null;
}

/** Vulgar fractions common in recipes; closest match within tolerance wins. */
const UNICODE_FRACS: { v: number; sym: string }[] = [
  { v: 1 / 8, sym: "⅛" },
  { v: 1 / 6, sym: "⅙" },
  { v: 1 / 4, sym: "¼" },
  { v: 1 / 3, sym: "⅓" },
  { v: 3 / 8, sym: "⅜" },
  { v: 1 / 2, sym: "½" },
  { v: 5 / 8, sym: "⅝" },
  { v: 2 / 3, sym: "⅔" },
  { v: 3 / 4, sym: "¾" },
  { v: 5 / 6, sym: "⅚" },
  { v: 7 / 8, sym: "⅞" },
];

const FRAC_MATCH_TOL = 0.034;

function matchUnicodeFraction(frac: number): string | null {
  let best: { v: number; sym: string } | null = null;
  let bestD = FRAC_MATCH_TOL;
  for (const entry of UNICODE_FRACS) {
    const d = Math.abs(frac - entry.v);
    if (d < bestD) {
      bestD = d;
      best = entry;
    }
  }
  return best ? best.sym : null;
}

function formatNumberPart(whole: number, frac: number): string {
  if (whole === 0) {
    const u = matchUnicodeFraction(frac);
    if (u) return u;
    return trimDecimal(frac);
  }
  const u = matchUnicodeFraction(frac);
  if (u) return `${whole}${u}`;
  if (Math.abs(frac) < EPS) return String(whole);
  return `${whole} ${trimDecimal(frac)}`;
}

function trimDecimal(n: number): string {
  const t = n.toFixed(4).replace(/\.?0+$/, "");
  return t;
}

function displayUnitLabel(rawUnit: string, quantity: number): string {
  const absQ = Math.abs(quantity);
  const plural = absQ > 1 + EPS || absQ < EPS;
  const parsed = parseUnitString(rawUnit);
  if (!parsed) return rawUnit.trim();

  const labels: Record<UnitType, [string, string]> = {
    g: ["g", "g"],
    kg: ["kg", "kg"],
    oz: ["oz", "oz"],
    lb: ["lb", "lb"],
    ml: ["ml", "ml"],
    l: ["l", "l"],
    cup: ["cup", "cups"],
    tbsp: ["tbsp", "tbsp"],
    tsp: ["tsp", "tsp"],
    count: ["count", "count"],
    bunch: ["bunch", "bunches"],
    pinch: ["pinch", "pinches"],
    slice: ["slice", "slices"],
  };
  const [singular, pl] = labels[parsed];
  return plural ? pl : singular;
}

export function formatQuantity(quantity: number, unit: string): string {
  if (!Number.isFinite(quantity)) return `${quantity} ${unit}`.trim();

  const absQ = Math.abs(quantity);
  const sign = quantity < 0 ? "-" : "";
  const whole = Math.floor(absQ + EPS);
  let frac = absQ - whole;
  if (frac > 1 - EPS) {
    frac = 0;
  }

  const fracSym = matchUnicodeFraction(frac);
  const qtyStr =
    whole === 0 && fracSym
      ? `${sign}${fracSym}`
      : whole === 0
        ? `${sign}${trimDecimal(absQ)}`
        : frac < EPS
          ? `${sign}${whole}`
          : fracSym
            ? `${sign}${formatNumberPart(whole, frac)}`
            : `${sign}${trimDecimal(absQ)}`;

  const u = displayUnitLabel(unit, quantity);
  return `${qtyStr} ${u}`.trim();
}

function volumeFromTotalTsp(totalTsp: number): { quantity: number; unit: UnitType } {
  let cups = Math.floor((totalTsp + EPS) / TSP_PER_CUP);
  let rem = totalTsp - cups * TSP_PER_CUP;
  let tbsp = Math.floor((rem + EPS) / TSP_PER_TBSP);
  rem -= tbsp * TSP_PER_TBSP;
  let tsp = rem;

  while (tsp >= TSP_PER_TBSP - EPS) {
    tbsp += 1;
    tsp -= TSP_PER_TBSP;
  }
  while (tbsp >= TBSP_PER_CUP - EPS) {
    cups += 1;
    tbsp -= TBSP_PER_CUP;
  }

  if (
    cups === 0 &&
    tbsp > 0 &&
    Math.abs(tsp) < EPS &&
    tbsp % 4 === 0 &&
    tbsp <= 12
  ) {
    return { quantity: tbsp / TBSP_PER_CUP, unit: "cup" };
  }

  if (cups > 0) {
    const mlRemainder = tbsp * ML_PER_TBSP + tsp * ML_PER_TSP;
    const cupFrac = cups + mlRemainder / ML_PER_CUP;
    if (Math.abs(mlRemainder) < EPS) {
      return { quantity: cups, unit: "cup" };
    }
    return { quantity: cupFrac, unit: "cup" };
  }

  if (tbsp > 0 && Math.abs(tsp) < EPS) {
    return { quantity: tbsp, unit: "tbsp" };
  }

  if (tbsp > 0) {
    return { quantity: tbsp + tsp / TSP_PER_TBSP, unit: "tbsp" };
  }

  if (totalTsp * ML_PER_TSP >= ML_PER_CUP * 0.125 - EPS) {
    return { quantity: (totalTsp * ML_PER_TSP) / ML_PER_CUP, unit: "cup" };
  }

  if (totalTsp * ML_PER_TSP >= ML_PER_TBSP - EPS) {
    return { quantity: (totalTsp * ML_PER_TSP) / ML_PER_TBSP, unit: "tbsp" };
  }

  return { quantity: tsp, unit: "tsp" };
}

function nicestMass(
  grams: number,
  original: UnitType,
): { quantity: number; unit: UnitType } {
  const metric = original === "g" || original === "kg";
  if (metric) {
    if (Math.abs(grams) >= 1000 - EPS) {
      return { quantity: grams / 1000, unit: "kg" };
    }
    return { quantity: grams, unit: "g" };
  }
  const oz = grams / G_PER_OZ;
  if (Math.abs(oz) >= 16 - EPS) {
    return { quantity: oz / 16, unit: "lb" };
  }
  return { quantity: oz, unit: "oz" };
}

function nicestVolume(
  ml: number,
  original: UnitType,
): { quantity: number; unit: UnitType } {
  if (original === "ml" || original === "l") {
    if (Math.abs(ml) >= 1000 - EPS) {
      return { quantity: ml / ML_PER_L, unit: "l" };
    }
    return { quantity: ml, unit: "ml" };
  }

  const totalTsp = ml / ML_PER_TSP;
  return volumeFromTotalTsp(totalTsp);
}

export function scaleQuantity(
  quantity: number,
  unit: string,
  scaleFactor: number,
): { quantity: number; unit: string } {
  if (!Number.isFinite(quantity) || !Number.isFinite(scaleFactor)) {
    return { quantity: quantity * scaleFactor, unit };
  }

  const parsed = parseUnitString(unit);
  if (!parsed) {
    return { quantity: quantity * scaleFactor, unit };
  }

  if (COUNT_UNITS.has(parsed)) {
    return { quantity: quantity * scaleFactor, unit: parsed };
  }

  if (MASS_UNITS.has(parsed)) {
    const g = toGrams(quantity, parsed) * scaleFactor;
    const { quantity: q, unit: u } = nicestMass(g, parsed);
    return { quantity: q, unit: u };
  }

  if (VOLUME_UNITS.has(parsed)) {
    const ml = toMl(quantity, parsed) * scaleFactor;
    const { quantity: q, unit: u } = nicestVolume(ml, parsed);
    return { quantity: q, unit: u };
  }

  return { quantity: quantity * scaleFactor, unit };
}
