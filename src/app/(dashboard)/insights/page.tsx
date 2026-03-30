"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useInsights } from "@/hooks/use-insights";
import {
  AlertCircle,
  Brain,
  ChefHat,
  Coins,
  Flame,
  Leaf,
  LineChart as LineChartIcon,
  Sparkles,
  TrendingUp,
} from "lucide-react";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 px-4 text-center">
      <LineChartIcon className="h-10 w-10 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[220px] w-full rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const { data, isLoading, isError, error } = useInsights();

  const costChartData = useMemo(() => {
    if (!data) return [];
    const avg = data.cost.avgCostPerRecipe;
    return data.cost.spendingOverTime.map((d) => ({
      ...d,
      avgPerCook: Number(avg.toFixed(2)),
    }));
  }, [data]);

  const aiCompoundData = useMemo(() => {
    if (!data) return [];
    let cumRecipes = 0;
    let cumCost = 0;
    return data.ai.generationOverTime.map((row) => {
      cumRecipes += row.recipes;
      cumCost += row.cost;
      return {
        ...row,
        cumulativeRecipes: cumRecipes,
        cumulativeCost: Number(cumCost.toFixed(2)),
      };
    });
  }, [data]);

  if (isLoading) return <InsightsSkeleton />;

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-center text-muted-foreground">
          {error instanceof Error ? error.message : "Could not load insights."}
        </p>
      </div>
    );
  }

  const hasCookbook = data.cookbook.totalRecipes > 0;
  const hasCooks = data.cooking.totalCooks > 0;
  const isEmpty = !hasCookbook && !hasCooks;

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-chart-2/10 p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-chart-1/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-chart-3/15 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
              Insights
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            The compound effect of every cook, purchase, and generation — your
            kitchen intelligence, visualized.
          </p>
          {isEmpty && (
            <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
              Add recipes, log cooks, and shop — this dashboard will fill in as
              you use the ERP.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* 1. Cookbook growth — stacked area */}
        <Card className="overflow-hidden border-border/80 bg-card/80 backdrop-blur-sm xl:col-span-3">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-chart-2" />
              <CardTitle>Cookbook growth</CardTitle>
            </div>
            <CardDescription>
              Cumulative recipes by source — batch AI, single-shot AI, and your
              own creations stacking over time.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {!hasCookbook ? (
              <EmptyChart message="No recipes in the cookbook yet." />
            ) : (
              <ChartContainer
                config={{
                  aiBatch: {
                    label: "AI batch",
                    theme: {
                      light: "oklch(0.55 0.19 264)",
                      dark: "oklch(0.62 0.2 264)",
                    },
                  },
                  aiSingle: {
                    label: "AI single / chat",
                    theme: {
                      light: "oklch(0.55 0.16 200)",
                      dark: "oklch(0.65 0.14 200)",
                    },
                  },
                  userCreated: {
                    label: "You & imports",
                    theme: {
                      light: "oklch(0.6 0.18 145)",
                      dark: "oklch(0.68 0.16 145)",
                    },
                  },
                }}
                className="aspect-[21/9] min-h-[280px] w-full max-md:aspect-video"
              >
                <AreaChart
                  data={data.cookbook.growthStackedBySource}
                  margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="fillAiBatch" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--color-aiBatch)"
                        stopOpacity={0.9}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-aiBatch)"
                        stopOpacity={0.15}
                      />
                    </linearGradient>
                    <linearGradient id="fillAiSingle" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--color-aiSingle)"
                        stopOpacity={0.85}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-aiSingle)"
                        stopOpacity={0.12}
                      />
                    </linearGradient>
                    <linearGradient id="fillUser" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--color-userCreated)"
                        stopOpacity={0.85}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-userCreated)"
                        stopOpacity={0.12}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => v.slice(0, 7)}
                    className="text-[10px]"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    className="text-[10px]"
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, p) =>
                          p?.[0]?.payload?.date
                            ? format(parseISO(`${p[0].payload.date}-01`), "MMMM yyyy")
                            : ""
                        }
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="userCreated"
                    stackId="1"
                    stroke="var(--color-userCreated)"
                    fill="url(#fillUser)"
                  />
                  <Area
                    type="monotone"
                    dataKey="aiSingle"
                    stackId="1"
                    stroke="var(--color-aiSingle)"
                    fill="url(#fillAiSingle)"
                  />
                  <Area
                    type="monotone"
                    dataKey="aiBatch"
                    stackId="1"
                    stroke="var(--color-aiBatch)"
                    fill="url(#fillAiBatch)"
                  />
                  <Legend />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* 2. Cuisine donut */}
        <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Recipes by cuisine</CardTitle>
            <CardDescription>Share of your active cookbook.</CardDescription>
          </CardHeader>
          <CardContent>
            {!data.cookbook.recipesByCuisine.length ? (
              <EmptyChart message="No cuisine breakdown yet." />
            ) : (
              <ChartContainer
                config={Object.fromEntries(
                  data.cookbook.recipesByCuisine.map((c, i) => [
                    c.cuisine,
                    {
                      label: c.cuisine,
                      color: CHART_COLORS[i % CHART_COLORS.length],
                    },
                  ]),
                )}
                className="mx-auto aspect-square max-h-[280px] w-full"
              >
                <PieChart>
                  <ChartTooltip
                    content={<ChartTooltipContent hideLabel nameKey="cuisine" />}
                  />
                  <Pie
                    data={data.cookbook.recipesByCuisine}
                    dataKey="count"
                    nameKey="cuisine"
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {data.cookbook.recipesByCuisine.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                        stroke="transparent"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* 3. Cooking frequency */}
        <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <CardTitle>Cooking frequency</CardTitle>
            </div>
            <CardDescription>Logged cooks per week (recent).</CardDescription>
          </CardHeader>
          <CardContent>
            {!data.cooking.cookingFrequency.some((d) => d.count > 0) ? (
              <EmptyChart message="Log cooks to see your rhythm." />
            ) : (
              <ChartContainer
                config={{
                  count: {
                    label: "Cooks",
                    theme: {
                      light: "oklch(0.55 0.2 35)",
                      dark: "oklch(0.65 0.18 35)",
                    },
                  },
                }}
                className="aspect-video min-h-[220px] w-full"
              >
                <BarChart data={data.cooking.cookingFrequency}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => format(parseISO(v), "MMM d")}
                    className="text-[10px]"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    className="text-[10px]"
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, p) =>
                          p?.[0]?.payload?.date
                            ? format(
                                parseISO(p[0].payload.date),
                                "Week of MMM d",
                              )
                            : ""
                        }
                      />
                    }
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* 6. Waste (placed early for balance) */}
        <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Leaf className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <CardTitle>Waste score</CardTitle>
            </div>
            <CardDescription>
              Expired lines vs purchase events (proxy).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-xl bg-muted/40 py-8">
              <span className="font-heading text-5xl font-bold tabular-nums tracking-tight text-foreground">
                {data.waste.wasteRate.toFixed(1)}%
              </span>
              <span className="mt-1 text-sm text-muted-foreground">
                waste rate
              </span>
              <span className="mt-3 text-xs text-muted-foreground">
                {data.waste.totalExpired} inventory lines past expiry
              </span>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Expiring soon
              </p>
              {!data.waste.expiringItems.length ? (
                <p className="text-sm text-muted-foreground">
                  Nothing urgent in the next stretch.
                </p>
              ) : (
                <ul className="max-h-[140px] space-y-2 overflow-auto text-sm">
                  {data.waste.expiringItems.map((item) => (
                    <li
                      key={`${item.name}-${item.expiryDate}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/50 px-2 py-1.5"
                    >
                      <span className="truncate font-medium">{item.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {item.daysLeft}d
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 4. Food cost */}
        <Card className="border-border/80 bg-card/80 backdrop-blur-sm md:col-span-2 xl:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <CardTitle>Food cost</CardTitle>
            </div>
            <CardDescription>
              Monthly spend vs average cost per logged cook.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!costChartData.length ? (
              <EmptyChart message="No purchase history yet." />
            ) : (
              <ChartContainer
                config={{
                  amount: {
                    label: "Monthly spend",
                    theme: {
                      light: "oklch(0.45 0.12 75)",
                      dark: "oklch(0.72 0.14 75)",
                    },
                  },
                  avgPerCook: {
                    label: "Avg / cook",
                    theme: {
                      light: "oklch(0.5 0.15 264)",
                      dark: "oklch(0.62 0.16 264)",
                    },
                  },
                }}
                className="aspect-[2/1] min-h-[240px] w-full max-md:aspect-video"
              >
                <ComposedChart data={costChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    className="text-[10px]"
                  />
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v}`}
                    className="text-[10px]"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v}`}
                    className="text-[10px]"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="amount"
                    fill="var(--color-amount)"
                    radius={[4, 4, 0, 0]}
                    opacity={0.85}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgPerCook"
                    stroke="var(--color-avgPerCook)"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* 5. Top expense ingredients */}
        <Card className="border-border/80 bg-card/80 backdrop-blur-sm xl:col-span-1">
          <CardHeader>
            <CardTitle>Top expense ingredients</CardTitle>
            <CardDescription>Lifetime spend by ingredient (top 10).</CardDescription>
          </CardHeader>
          <CardContent>
            {!data.cost.topExpenseIngredients.length ? (
              <EmptyChart message="Record purchases to rank ingredients." />
            ) : (
              <ChartContainer
                config={{
                  totalSpent: {
                    label: "Spent",
                    theme: {
                      light: "oklch(0.5 0.14 25)",
                      dark: "oklch(0.65 0.16 25)",
                    },
                  },
                }}
                className="aspect-[4/5] min-h-[280px] w-full"
              >
                <BarChart
                  layout="vertical"
                  data={[...data.cost.topExpenseIngredients].reverse()}
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v}`}
                    className="text-[10px]"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tickLine={false}
                    axisLine={false}
                    className="text-[10px]"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="totalSpent"
                    fill="var(--color-totalSpent)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* 7. AI generation */}
        <Card className="border-border/80 bg-card/80 backdrop-blur-sm md:col-span-2 xl:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              <CardTitle>AI generation</CardTitle>
            </div>
            <CardDescription>
              As your cookbook compounds, monthly generation can taper — cache
              hit rate reflects cooking from your book.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Recipes generated</p>
                <p className="font-heading text-xl font-semibold tabular-nums">
                  {data.ai.totalRecipesGenerated.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Est. cost</p>
                <p className="font-heading text-xl font-semibold tabular-nums">
                  ${data.ai.estimatedTotalCost.toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Cache hit rate</p>
                <p className="font-heading text-xl font-semibold tabular-nums">
                  {data.ai.cacheHitRate.toFixed(0)}%
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Tokens</p>
                <p className="font-heading text-xl font-semibold tabular-nums">
                  {data.ai.totalTokensUsed.toLocaleString()}
                </p>
              </div>
            </div>
            {!aiCompoundData.length ? (
              <EmptyChart message="No completed generation jobs yet." />
            ) : (
              <ChartContainer
                config={{
                  recipes: {
                    label: "Monthly recipes",
                    theme: {
                      light: "oklch(0.55 0.2 290)",
                      dark: "oklch(0.62 0.18 290)",
                    },
                  },
                  cumulativeRecipes: {
                    label: "Cumulative (compound)",
                    theme: {
                      light: "oklch(0.42 0.08 264)",
                      dark: "oklch(0.75 0.1 264)",
                    },
                  },
                }}
                className="aspect-[2/1] min-h-[220px] w-full max-md:aspect-video"
              >
                <ComposedChart data={aiCompoundData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} className="text-[10px]" />
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    className="text-[10px]"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    className="text-[10px]"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="recipes"
                    fill="var(--color-recipes)"
                    radius={[4, 4, 0, 0]}
                    opacity={0.9}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cumulativeRecipes"
                    stroke="var(--color-cumulativeRecipes)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Summary strip */}
        <Card className="border-border/80 bg-card/80 backdrop-blur-sm xl:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-chart-2" />
              <CardTitle>Quick stats</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Recipes</span>
              <span className="font-medium tabular-nums">
                {data.cookbook.totalRecipes}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Total cooks</span>
              <span className="font-medium tabular-nums">
                {data.cooking.totalCooks}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">This month</span>
              <span className="font-medium tabular-nums">
                {data.cooking.cooksThisMonth}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Avg rating</span>
              <span className="font-medium tabular-nums">
                {data.cooking.avgRating.toFixed(1)} / 5
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Technique reps</span>
              <span className="font-medium tabular-nums">
                {data.techniques.totalTechniquesLogged}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 8. Techniques */}
        <Card className="border-border/80 bg-card/80 backdrop-blur-sm xl:col-span-2">
          <CardHeader>
            <CardTitle>Technique heatmap</CardTitle>
            <CardDescription>Logged repetitions — where you invest reps.</CardDescription>
          </CardHeader>
          <CardContent>
            {!data.techniques.techniqueDistribution.length ? (
              <EmptyChart message="Log techniques from your profile to see distribution." />
            ) : (
              <ChartContainer
                config={{
                  count: {
                    label: "Reps",
                    theme: {
                      light: "oklch(0.5 0.18 25)",
                      dark: "oklch(0.68 0.16 25)",
                    },
                  },
                }}
                className="aspect-[2/1] min-h-[260px] w-full max-md:aspect-[3/4]"
              >
                <BarChart
                  layout="vertical"
                  data={[...data.techniques.techniqueDistribution].reverse()}
                  margin={{ left: 4, right: 12 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="technique"
                    width={108}
                    tickLine={false}
                    axisLine={false}
                    className="text-[10px]"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* 9. Cuisine diversity radar */}
        <Card className="border-border/80 bg-card/80 backdrop-blur-sm xl:col-span-3">
          <CardHeader>
            <CardTitle>Cuisine diversity</CardTitle>
            <CardDescription>
              Recipes you have actually cooked — breadth of exploration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!data.techniques.cuisineDiversity.length ? (
              <EmptyChart message="Cook across cuisines to fill the radar." />
            ) : (
              <ChartContainer
                config={{
                  recipesCooked: {
                    label: "Cooks",
                    theme: {
                      light: "oklch(0.55 0.2 35)",
                      dark: "oklch(0.68 0.18 35)",
                    },
                  },
                }}
                className="mx-auto aspect-[2/1] min-h-[300px] max-w-3xl max-md:aspect-square"
              >
                <RadarChart
                  data={data.techniques.cuisineDiversity.slice(0, 10)}
                  margin={{ top: 24, right: 24, bottom: 24, left: 24 }}
                >
                  <PolarGrid className="stroke-border/50" />
                  <PolarAngleAxis
                    dataKey="cuisine"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[
                      0,
                      Math.max(
                        ...data.techniques.cuisineDiversity
                          .slice(0, 10)
                          .map((d) => d.recipesCooked),
                        1,
                      ),
                    ]}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Radar
                    name="Recipes cooked"
                    dataKey="recipesCooked"
                    stroke="var(--color-recipesCooked)"
                    fill="var(--color-recipesCooked)"
                    fillOpacity={0.35}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Top recipes table-style card */}
        <Card className="border-border/80 bg-card/80 backdrop-blur-sm xl:col-span-3">
          <CardHeader>
            <CardTitle>Most-cooked recipes</CardTitle>
            <CardDescription>Your repeat winners by logged sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            {!data.cooking.topRecipes.length ? (
              <EmptyChart message="Cook something twice — it will show up here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Recipe</th>
                      <th className="pb-2 pr-4 font-medium">Cooks</th>
                      <th className="pb-2 font-medium">Avg rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cooking.topRecipes.map((r, i) => (
                      <tr
                        key={`${r.title}-${i}`}
                        className="border-b border-border/40 last:border-0"
                      >
                        <td className="py-2 pr-4 font-medium">{r.title}</td>
                        <td className="py-2 pr-4 tabular-nums">{r.cooks}</td>
                        <td className="py-2 tabular-nums">
                          {r.avgRating > 0 ? r.avgRating.toFixed(1) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
