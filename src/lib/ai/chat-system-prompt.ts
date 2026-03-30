import { prisma } from "@/lib/prisma";

export async function buildSousChefSystemPrompt(
  userId: string,
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      cookingStyle: true,
      flavorProfile: true,
      inventory: {
        where: { quantity: { gt: 0 } },
        include: { ingredient: true },
        orderBy: { ingredient: { name: "asc" } },
      },
    },
  });

  if (!user) throw new Error("User not found");

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const pantryItems = user.inventory.map((inv) => {
    const expiring =
      inv.expiryDate && inv.expiryDate <= threeDaysFromNow
        ? ` ⚠️ EXPIRES ${inv.expiryDate.toLocaleDateString()}`
        : "";
    return `- ${inv.ingredient.name} (${inv.quantity} ${inv.unit}, ${inv.ingredient.category.toLowerCase().replace("_", " ")})${expiring}`;
  });

  const expiringItems = user.inventory.filter(
    (inv) => inv.expiryDate && inv.expiryDate <= threeDaysFromNow,
  );

  const recentCooks = await prisma.cookingLog.findMany({
    where: { userId },
    orderBy: { cookedAt: "desc" },
    take: 5,
    include: { recipe: { select: { title: true, cuisine: true } } },
  });

  const recipeStats = await prisma.recipe.groupBy({
    by: ["cuisine"],
    where: {
      cookingLogs: { some: { userId } },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });

  const totalRecipes = await prisma.recipe.count({
    where: {
      OR: [
        { cookingLogs: { some: { userId } } },
        { ratings: { some: { userId } } },
      ],
    },
  });

  const style = user.cookingStyle;
  const flavor = user.flavorProfile;

  const sections: string[] = [
    `You are a professional sous chef and cooking advisor named "Sous Chef" working inside Chef Bentley's kitchen management system. You have deep expertise in French, Italian, Deli, Mexican, and Mediterranean cuisines, with working knowledge of all world cuisines.`,

    `Your personality: confident, knowledgeable, encouraging but direct. You give technique-focused advice appropriate for ${user.skillLevel.toLowerCase()}-level chefs. Be concise but thorough — no fluff, no unnecessary preamble.`,
  ];

  if (style) {
    const cuisines = style.primaryCuisines
      .map((c) => c.toLowerCase().replace("_", " "))
      .join(", ");
    const techniques = style.preferredTechniques
      .map((t) => t.toLowerCase().replace("_", " "))
      .join(", ");
    sections.push(
      `## Chef's Cooking Style\n- Primary cuisines: ${cuisines || "not set"}\n- Preferred techniques: ${techniques || "not set"}\n- Philosophy: ${style.cookingPhilosophy || "not specified"}`,
    );
  }

  sections.push(
    `## Skill Level & Equipment\n- Skill: ${user.skillLevel}\n- Equipment: ${user.kitchenEquipment.length > 0 ? user.kitchenEquipment.join(", ") : "not specified"}\n- Dietary restrictions: ${user.dietaryRestrictions.length > 0 ? user.dietaryRestrictions.join(", ") : "none"}`,
  );

  if (pantryItems.length > 0) {
    sections.push(
      `## Current Pantry (${pantryItems.length} items)\n${pantryItems.join("\n")}`,
    );
  } else {
    sections.push(`## Current Pantry\nThe pantry is currently empty.`);
  }

  if (expiringItems.length > 0) {
    const expList = expiringItems
      .map(
        (inv) =>
          `- ${inv.ingredient.name}: expires ${inv.expiryDate!.toLocaleDateString()}`,
      )
      .join("\n");
    sections.push(
      `## ⚠️ Expiring Soon (within 3 days)\n${expList}\nPrioritize using these ingredients when suggesting recipes.`,
    );
  }

  if (flavor) {
    const texturePrefs =
      typeof flavor.texturePrefs === "object" && flavor.texturePrefs
        ? Object.entries(flavor.texturePrefs as Record<string, number>)
            .filter(([, v]) => v >= 7)
            .map(([k]) => k)
            .join(", ")
        : "";
    sections.push(
      `## Flavor Profile\n- Spice tolerance: ${flavor.spiceTolerance}/10\n- Sweet: ${flavor.sweetPref}/10, Salty: ${flavor.saltyPref}/10, Sour: ${flavor.sourPref}/10, Umami: ${flavor.umamiPref}/10, Bitter: ${flavor.bitterPref}/10\n- Preferred textures: ${texturePrefs || "no strong preference"}\n- Ingredient aversions: ${flavor.ingredientAversions.length > 0 ? flavor.ingredientAversions.join(", ") : "none"}`,
    );
  }

  if (recentCooks.length > 0) {
    const cookList = recentCooks
      .map(
        (log) =>
          `- ${log.recipe.title} (${log.recipe.cuisine.toLowerCase()}) on ${log.cookedAt.toLocaleDateString()}`,
      )
      .join("\n");
    sections.push(`## Recent Cooking History\n${cookList}`);
  }

  if (totalRecipes > 0 || recipeStats.length > 0) {
    const topCuisines = recipeStats
      .map(
        (s) => `${s.cuisine.toLowerCase().replace("_", " ")} (${s._count.id})`,
      )
      .join(", ");
    sections.push(
      `## Cookbook Stats\n- Total recipes in rotation: ${totalRecipes}\n- Top cuisines: ${topCuisines || "none yet"}`,
    );
  }

  sections.push(`## Guidelines
- When suggesting recipes, prefer ingredients already in the chef's pantry.
- If asked about expiring items, focus on creative ways to use them before they spoil.
- Adapt suggestions to the chef's skill level, equipment, and flavor preferences.
- When sharing a full recipe in conversation, also include a JSON block in this exact format so it can be saved to the cookbook:

\`\`\`recipe-json
{
  "title": "Recipe Title",
  "description": "Brief description",
  "cuisine": "CUISINE_ENUM",
  "difficulty": 3,
  "techniques": ["TECHNIQUE_ENUM"],
  "prepTime": 15,
  "cookTime": 30,
  "servings": 4,
  "ingredients": [
    { "name": "ingredient name", "quantity": 1.0, "unit": "cup", "isOptional": false }
  ],
  "instructions": [
    { "step": 1, "text": "Step description", "technique": "TECHNIQUE_ENUM", "timing": "5 min" }
  ],
  "tags": ["comfort", "quick"],
  "flavorTags": { "spicy": 3, "sweet": 1, "umami": 8 }
}
\`\`\`

- Keep responses focused and actionable. No generic disclaimers.`);

  return sections.join("\n\n");
}
