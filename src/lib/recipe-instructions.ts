import type { RecipeInstruction } from "@/hooks/use-recipes";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

/**
 * AI recipes use `step: string` (the sentence). App CRUD uses `step: number` + `text: string`.
 * Normalize so we always have a numeric order and a readable body.
 */
export function normalizeRecipeInstruction(
  raw: unknown,
  index: number,
): RecipeInstruction {
  const o = asRecord(raw);
  const textField = typeof o.text === "string" ? o.text.trim() : "";
  const notes = typeof o.notes === "string" ? o.notes.trim() : "";
  const stepVal = o.step;

  const stringStep =
    typeof stepVal === "string" && stepVal.trim() ? stepVal.trim() : "";

  let body = textField;
  if (!body && stringStep) body = stringStep;
  if (!body && notes) body = notes;

  const stepNumber =
    typeof stepVal === "number" && Number.isFinite(stepVal)
      ? Math.round(stepVal)
      : index + 1;

  const notesForExtra =
    notes && notes !== body ? notes : undefined;

  return {
    step: stepNumber,
    text: body,
    technique:
      typeof o.technique === "string" ? o.technique : undefined,
    timing: typeof o.timing === "string" ? o.timing : undefined,
    notes: notesForExtra,
  };
}

export function normalizeRecipeInstructions(
  instructions: unknown[] | null | undefined,
): RecipeInstruction[] {
  const list = Array.isArray(instructions) ? instructions : [];
  const normalized = list.map((raw, i) => normalizeRecipeInstruction(raw, i));

  return [...normalized].sort((a, b) => {
    if (a.step !== b.step) return a.step - b.step;
    return 0;
  });
}
