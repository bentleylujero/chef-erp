import { z } from "zod";

export const recipeInstructionSchema = z.object({
  step: z.string(),
  technique: z.string(),
  timing: z.string().nullish(),
  notes: z.string().nullish(),
});

export const generatedIngredientSchema = z.object({
  ingredientName: z.string(),
  quantity: z.number(),
  unit: z.string(),
  isOptional: z.boolean().default(false),
  prepNote: z.string().nullish(),
  substituteFor: z.string().nullish(), // "this pantry ingredient substitutes for [ideal ingredient]"
});

export const generatedRecipeSchema = z.object({
  title: z.string(),
  description: z.string(),
  cuisine: z.string(),
  difficulty: z.number().min(1).max(5),
  techniques: z.array(z.string()),
  ingredients: z.array(generatedIngredientSchema),
  instructions: z.array(recipeInstructionSchema),
  prepTime: z.number(),
  cookTime: z.number(),
  servings: z.number(),
  flavorTags: z.object({
    spicy: z.number().min(0).max(10),
    sweet: z.number().min(0).max(10),
    umami: z.number().min(0).max(10),
    acidic: z.number().min(0).max(10),
    rich: z.number().min(0).max(10),
    light: z.number().min(0).max(10),
  }),
  tags: z.array(z.string()),
});

export const batchGenerationResponseSchema = z.object({
  recipes: z.array(generatedRecipeSchema),
});

export type RecipeInstruction = z.infer<typeof recipeInstructionSchema>;
export type GeneratedIngredient = z.infer<typeof generatedIngredientSchema>;
export type GeneratedRecipe = z.infer<typeof generatedRecipeSchema>;
export type BatchGenerationResponse = z.infer<
  typeof batchGenerationResponseSchema
>;
