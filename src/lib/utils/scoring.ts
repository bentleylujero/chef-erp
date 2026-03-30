export function cosineSimilarity(
  a: Record<string, number>,
  b: Record<string, number>,
): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const k of keys) {
    const va = a[k] ?? 0;
    const vb = b[k] ?? 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

export function overlapScore(setA: string[], setB: string[]): number {
  const a = new Set(setA.map((s) => s.trim().toLowerCase()).filter(Boolean));
  const b = new Set(setB.map((s) => s.trim().toLowerCase()).filter(Boolean));
  if (a.size === 0 && b.size === 0) return 100;

  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter += 1;
  }
  const union = a.size + b.size - inter;
  if (union === 0) return 0;
  return (inter / union) * 100;
}

export function weightedScore(scores: { value: number; weight: number }[]): number {
  if (scores.length === 0) return 0;
  let sumW = 0;
  let sum = 0;
  for (const { value, weight } of scores) {
    if (!Number.isFinite(value) || !Number.isFinite(weight)) continue;
    sum += value * weight;
    sumW += weight;
  }
  if (sumW === 0) return 0;
  return sum / sumW;
}
