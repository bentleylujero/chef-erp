import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUserId } from "@/lib/auth/api-user";
import { recipeVisibilityClause } from "@/lib/recipes/visibility";
import type { Cuisine, RecipeSource } from "@prisma/client";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  eachWeekOfInterval,
  eachMonthOfInterval,
  subMonths,
  format,
  differenceInCalendarDays,
  min as dateMin,
} from "date-fns";

const AI_BATCH: RecipeSource = "AI_BATCH";
const AI_SINGLE_SOURCES: RecipeSource[] = [
  "AI_SINGLE",
  "AI_CHAT",
  "AI_CUISINE_EXPLORE",
  "AI_EXPIRY_RESCUE",
  "AI_PREFERENCE_DRIFT",
  "AI_INGREDIENT_FILL",
  "AI_PANTRY_BRIDGE",
  "AI_NETWORK_MESH",
];
const USER_BOOK_SOURCES: RecipeSource[] = ["USER_CREATED", "IMPORTED"];

function sourceBucket(source: RecipeSource): "aiBatch" | "aiSingle" | "userCreated" {
  if (source === AI_BATCH) return "aiBatch";
  if (AI_SINGLE_SOURCES.includes(source)) return "aiSingle";
  return "userCreated";
}

function formatCuisine(c: Cuisine): string {
  return c.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function formatTechnique(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export async function GET() {
  try {
    const auth = await requireApiUserId();
    if ("response" in auth) return auth.response;
    const userId = auth.userId;

    const now = new Date();
    const monthStart = startOfMonth(now);
    const lookback = subMonths(now, 18);

    const [
      cuisineGroups,
      sourceGroups,
      recipesForGrowth,
      totalCooks,
      cooksThisMonth,
      ratingAgg,
      cookGroups,
      cookDates,
      purchaseSum,
      purchaseThisMonthSum,
      purchaseRows,
      topPurchases,
      inventoryExpired,
      inventoryExpiring,
      purchaseCount,
      genJobsAgg,
      genJobsList,
      techniqueGroups,
      cookingLogsDetail,
    ] = await Promise.all([
      prisma.recipe.groupBy({
        by: ["cuisine"],
        where: { status: "active", AND: [recipeVisibilityClause(userId)] },
        _count: { _all: true },
      }),
      prisma.recipe.groupBy({
        by: ["source"],
        where: { status: "active", AND: [recipeVisibilityClause(userId)] },
        _count: { _all: true },
      }),
      prisma.recipe.findMany({
        where: { status: "active", AND: [recipeVisibilityClause(userId)] },
        select: { createdAt: true, source: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.cookingLog.count({ where: { userId: userId } }),
      prisma.cookingLog.count({
        where: { userId: userId, cookedAt: { gte: monthStart } },
      }),
      prisma.recipeRating.aggregate({
        where: { userId: userId },
        _avg: { rating: true },
      }),
      prisma.cookingLog.groupBy({
        by: ["recipeId"],
        where: { userId: userId },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.cookingLog.findMany({
        where: { userId: userId },
        select: { cookedAt: true },
      }),
      prisma.purchaseHistory.aggregate({
        where: { userId: userId },
        _sum: { cost: true },
      }),
      prisma.purchaseHistory.aggregate({
        where: { userId: userId, purchasedAt: { gte: monthStart } },
        _sum: { cost: true },
      }),
      prisma.purchaseHistory.findMany({
        where: { userId: userId },
        select: { cost: true, ingredientId: true, purchasedAt: true },
      }),
      prisma.purchaseHistory.groupBy({
        by: ["ingredientId"],
        where: { userId: userId },
        _sum: { cost: true },
        orderBy: { _sum: { cost: "desc" } },
        take: 10,
      }),
      prisma.inventory.count({
        where: {
          userId: userId,
          expiryDate: { lt: now },
          quantity: { gt: 0 },
        },
      }),
      prisma.inventory.findMany({
        where: {
          userId: userId,
          quantity: { gt: 0 },
          expiryDate: { gte: now },
        },
        select: {
          expiryDate: true,
          ingredient: { select: { name: true } },
        },
        orderBy: { expiryDate: "asc" },
        take: 12,
      }),
      prisma.purchaseHistory.count({ where: { userId: userId } }),
      prisma.generationJob.aggregate({
        where: { userId: userId },
        _count: { _all: true },
        _sum: {
          recipesGenerated: true,
          tokensUsed: true,
          estimatedCost: true,
        },
      }),
      prisma.generationJob.findMany({
        where: { userId: userId, status: "COMPLETED" },
        select: {
          createdAt: true,
          completedAt: true,
          recipesGenerated: true,
          estimatedCost: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.techniqueLog.findMany({
        where: { userId: userId },
        select: { technique: true, timesPerformed: true },
      }),
      prisma.cookingLog.findMany({
        where: { userId: userId },
        select: { recipe: { select: { cuisine: true, source: true } } },
      }),
    ]);

    const totalRecipes = recipesForGrowth.length;

    const recipesByCuisine = cuisineGroups
      .map((g) => ({
        cuisine: formatCuisine(g.cuisine),
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count);

    const recipesBySource = sourceGroups
      .map((g) => ({
        source: g.source.replace(/_/g, " "),
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count);

    const recipeSpanStart =
      recipesForGrowth.length > 0
        ? dateMin(recipesForGrowth.map((r) => r.createdAt))
        : lookback;
    const recipeMonths = eachMonthOfInterval({
      start: dateMin([lookback, recipeSpanStart]),
      end: now,
    });

    const growthOverTime = recipeMonths.map((m) => {
      const end = endOfMonth(m);
      const cumulative = recipesForGrowth.filter((r) => r.createdAt <= end)
        .length;
      return {
        date: format(m, "yyyy-MM"),
        cumulative,
      };
    });

    const stackedCorrect = recipeMonths.map((m) => {
      const end = endOfMonth(m);
      let aiBatch = 0;
      let aiSingle = 0;
      let userCreated = 0;
      for (const r of recipesForGrowth) {
        if (r.createdAt > end) continue;
        const b = sourceBucket(r.source);
        if (b === "aiBatch") aiBatch += 1;
        else if (b === "aiSingle") aiSingle += 1;
        else userCreated += 1;
      }
      return {
        date: format(m, "yyyy-MM"),
        aiBatch,
        aiSingle,
        userCreated,
        cumulative: aiBatch + aiSingle + userCreated,
      };
    });

    const topRecipeIds = cookGroups.map((g) => g.recipeId);
    const topRecipeMeta = await prisma.recipe.findMany({
      where: {
        id: { in: topRecipeIds },
        AND: [recipeVisibilityClause(userId)],
      },
      select: { id: true, title: true, avgRating: true },
    });
    const metaById = new Map(topRecipeMeta.map((r) => [r.id, r]));
    const topRecipes = cookGroups.map((g) => {
      const meta = metaById.get(g.recipeId);
      return {
        title: meta?.title ?? "Unknown",
        cooks: g._count.id,
        avgRating: meta?.avgRating ?? 0,
      };
    });

    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weeks = eachWeekOfInterval(
      {
        start: subMonths(weekStart, 3),
        end: weekStart,
      },
      { weekStartsOn: 1 },
    );

    const cookingFrequency = weeks.map((w) => {
      const wEnd = new Date(w);
      wEnd.setDate(wEnd.getDate() + 6);
      wEnd.setHours(23, 59, 59, 999);
      const count = cookDates.filter(
        (c) => c.cookedAt >= w && c.cookedAt <= wEnd,
      ).length;
      return { date: format(w, "yyyy-MM-dd"), count };
    });

    const totalSpent = purchaseSum._sum.cost ?? 0;
    const spentThisMonth = purchaseThisMonthSum._sum.cost ?? 0;
    const avgCostPerRecipe =
      totalCooks > 0 ? totalSpent / totalCooks : 0;

    const purchaseSpanStart =
      purchaseRows.length > 0
        ? dateMin(purchaseRows.map((p) => p.purchasedAt ?? now))
        : lookback;
    const purchaseMonths = eachMonthOfInterval({
      start: dateMin([lookback, purchaseSpanStart]),
      end: now,
    });

    const spendingOverTime = purchaseMonths.map((m) => {
      const start = startOfMonth(m);
      const end = endOfMonth(m);
      const amount = purchaseRows
        .filter((p) => {
          const t = p.purchasedAt ?? now;
          return t >= start && t <= end;
        })
        .reduce((s, p) => s + p.cost, 0);
      return { date: format(m, "yyyy-MM"), amount };
    });

    const ingIds = topPurchases.map((p) => p.ingredientId);
    const ingNames = await prisma.ingredient.findMany({
      where: { id: { in: ingIds } },
      select: { id: true, name: true },
    });
    const nameByIng = new Map(ingNames.map((i) => [i.id, i.name]));
    const topExpenseIngredients = topPurchases.map((p) => ({
      name: nameByIng.get(p.ingredientId) ?? "Unknown",
      totalSpent: p._sum.cost ?? 0,
    }));

    const wasteRate =
      purchaseCount > 0 ? (inventoryExpired / purchaseCount) * 100 : 0;

    const expiringItems = inventoryExpiring.map((inv) => ({
      name: inv.ingredient.name,
      expiryDate: inv.expiryDate!.toISOString(),
      daysLeft: Math.max(
        0,
        differenceInCalendarDays(inv.expiryDate!, now),
      ),
    }));

    const genByMonth = new Map<
      string,
      { recipes: number; cost: number }
    >();
    for (const job of genJobsList) {
      const d = job.completedAt ?? job.createdAt;
      const key = format(d, "yyyy-MM");
      const cur = genByMonth.get(key) ?? { recipes: 0, cost: 0 };
      cur.recipes += job.recipesGenerated;
      cur.cost += job.estimatedCost;
      genByMonth.set(key, cur);
    }

    const genSpanStart =
      genJobsList.length > 0
        ? dateMin(genJobsList.map((j) => j.completedAt ?? j.createdAt))
        : lookback;
    const genMonths = eachMonthOfInterval({
      start: dateMin([lookback, genSpanStart]),
      end: now,
    });

    const generationOverTime = genMonths.map((m) => {
      const key = format(m, "yyyy-MM");
      const v = genByMonth.get(key) ?? { recipes: 0, cost: 0 };
      return { date: key, recipes: v.recipes, cost: v.cost };
    });

    const cacheHitRate =
      cookingLogsDetail.length > 0
        ? (cookingLogsDetail.filter((l) =>
            USER_BOOK_SOURCES.includes(l.recipe.source),
          ).length /
            cookingLogsDetail.length) *
          100
        : 0;

    const techniqueTotals = new Map<string, number>();
    for (const row of techniqueGroups) {
      const k = row.technique;
      techniqueTotals.set(k, (techniqueTotals.get(k) ?? 0) + row.timesPerformed);
    }
    const techniqueDistribution = [...techniqueTotals.entries()]
      .map(([technique, count]) => ({
        technique: formatTechnique(technique),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 16);

    const cuisineCookCounts = new Map<string, number>();
    for (const row of cookingLogsDetail) {
      const c = formatCuisine(row.recipe.cuisine);
      cuisineCookCounts.set(c, (cuisineCookCounts.get(c) ?? 0) + 1);
    }
    const cuisineDiversity = [...cuisineCookCounts.entries()]
      .map(([cuisine, recipesCooked]) => ({ cuisine, recipesCooked }))
      .sort((a, b) => b.recipesCooked - a.recipesCooked);

    const payload = {
      cookbook: {
        totalRecipes,
        recipesByCuisine,
        recipesBySource,
        growthOverTime,
        growthStackedBySource: stackedCorrect,
      },
      cooking: {
        totalCooks,
        cooksThisMonth,
        avgRating: ratingAgg._avg.rating ?? 0,
        topRecipes,
        cookingFrequency,
      },
      cost: {
        totalSpent,
        spentThisMonth,
        avgCostPerRecipe,
        spendingOverTime,
        topExpenseIngredients,
      },
      waste: {
        totalExpired: inventoryExpired,
        wasteRate,
        expiringItems,
      },
      ai: {
        totalGenerationJobs: genJobsAgg._count._all,
        totalRecipesGenerated: genJobsAgg._sum.recipesGenerated ?? 0,
        totalTokensUsed: genJobsAgg._sum.tokensUsed ?? 0,
        estimatedTotalCost: genJobsAgg._sum.estimatedCost ?? 0,
        generationOverTime,
        cacheHitRate,
      },
      techniques: {
        totalTechniquesLogged: techniqueGroups.reduce(
          (s, t) => s + t.timesPerformed,
          0,
        ),
        techniqueDistribution,
        cuisineDiversity,
      },
    };

    return NextResponse.json(payload);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to compute insights" },
      { status: 500 },
    );
  }
}
