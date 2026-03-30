"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Flame,
  ArrowUpDown,
  LayoutGrid,
  List,
  Calendar,
  Hash,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  formatTechnique,
  formatCuisine,
  CUISINE_STYLES,
} from "@/components/cookbook/recipe-card";

interface TechniqueLog {
  id: string;
  technique: string;
  cuisine: string | null;
  timesPerformed: number;
  lastPerformed: string;
  comfortLevel: number;
  notes: string | null;
}

interface ProfileData {
  techniqueLogs: TechniqueLog[];
}

const COMFORT_LABELS = [
  "",
  "Novice",
  "Familiar",
  "Competent",
  "Proficient",
  "Mastered",
];

const COMFORT_COLORS = [
  "",
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-emerald-500",
  "bg-primary",
];

function ComfortStars({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Flame
          key={i}
          className={cn(
            "size-3.5",
            i < level
              ? "fill-orange-400 text-orange-400"
              : "text-muted-foreground/20",
          )}
        />
      ))}
    </div>
  );
}

function TechniqueHeatmap({ techniques }: { techniques: TechniqueLog[] }) {
  const allCuisines = useMemo(() => {
    const set = new Set<string>();
    techniques.forEach((t) => {
      if (t.cuisine) set.add(t.cuisine);
    });
    return Array.from(set).sort();
  }, [techniques]);

  const allTechniqueNames = useMemo(() => {
    const set = new Set<string>();
    techniques.forEach((t) => set.add(t.technique));
    return Array.from(set).sort();
  }, [techniques]);

  const lookupMap = useMemo(() => {
    const map = new Map<string, TechniqueLog>();
    techniques.forEach((t) => {
      if (t.cuisine) {
        map.set(`${t.technique}:${t.cuisine}`, t);
      }
    });
    return map;
  }, [techniques]);

  if (allCuisines.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `140px repeat(${allCuisines.length}, 1fr)`,
          }}
        >
          <div />
          {allCuisines.map((c) => (
            <div
              key={c}
              className="text-center text-[10px] font-medium text-muted-foreground truncate px-1"
            >
              {formatCuisine(c)}
            </div>
          ))}
          {allTechniqueNames.map((tech) => (
            <>
              <div
                key={`label-${tech}`}
                className="text-xs font-medium truncate pr-2 flex items-center"
              >
                {formatTechnique(tech)}
              </div>
              {allCuisines.map((cuisine) => {
                const entry = lookupMap.get(`${tech}:${cuisine}`);
                const level = entry?.comfortLevel ?? 0;
                return (
                  <div
                    key={`${tech}:${cuisine}`}
                    className={cn(
                      "aspect-square rounded-sm transition-colors",
                      level === 0 && "bg-muted/30",
                      level === 1 && "bg-red-500/30",
                      level === 2 && "bg-orange-500/40",
                      level === 3 && "bg-yellow-500/50",
                      level === 4 && "bg-emerald-500/50",
                      level === 5 && "bg-primary/60",
                    )}
                    title={
                      entry
                        ? `${formatTechnique(tech)} × ${formatCuisine(cuisine)}: ${COMFORT_LABELS[level]} (${entry.timesPerformed}×)`
                        : `${formatTechnique(tech)} × ${formatCuisine(cuisine)}: Not practiced`
                    }
                  />
                );
              })}
            </>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>Mastery:</span>
          {[0, 1, 2, 3, 4, 5].map((level) => (
            <div key={level} className="flex items-center gap-1">
              <div
                className={cn(
                  "size-3 rounded-sm",
                  level === 0 && "bg-muted/30",
                  level === 1 && "bg-red-500/30",
                  level === 2 && "bg-orange-500/40",
                  level === 3 && "bg-yellow-500/50",
                  level === 4 && "bg-emerald-500/50",
                  level === 5 && "bg-primary/60",
                )}
              />
              <span>{level === 0 ? "None" : COMFORT_LABELS[level]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TechniqueMasteryPage() {
  const [view, setView] = useState<"grid" | "table" | "heatmap">("grid");
  const [groupBy, setGroupBy] = useState<"comfort" | "cuisine">("comfort");
  const [sortField, setSortField] = useState<"comfort" | "times" | "recent">(
    "comfort",
  );

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
  });

  const techniques = profile?.techniqueLogs ?? [];

  const sorted = useMemo(() => {
    return [...techniques].sort((a, b) => {
      if (sortField === "comfort") return b.comfortLevel - a.comfortLevel;
      if (sortField === "times") return b.timesPerformed - a.timesPerformed;
      return (
        new Date(b.lastPerformed).getTime() -
        new Date(a.lastPerformed).getTime()
      );
    });
  }, [techniques, sortField]);

  const grouped = useMemo(() => {
    const map: Record<string, TechniqueLog[]> = {};
    for (const t of sorted) {
      const key =
        groupBy === "comfort"
          ? COMFORT_LABELS[t.comfortLevel] || "Unknown"
          : t.cuisine
            ? formatCuisine(t.cuisine)
            : "General";
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [sorted, groupBy]);

  const totalTechniques = techniques.length;
  const masteredCount = techniques.filter((t) => t.comfortLevel >= 4).length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Technique Mastery
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your techniques across cuisines.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Technique Mastery
        </h1>
        <p className="text-muted-foreground mt-1">
          Track your techniques across cuisines.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Hash className="size-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {totalTechniques}
              </div>
              <div className="text-xs text-muted-foreground">
                Techniques Practiced
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <Flame className="size-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {masteredCount}
              </div>
              <div className="text-xs text-muted-foreground">
                Proficient / Mastered
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <ArrowUpDown className="size-5 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {totalTechniques > 0
                  ? (
                      techniques.reduce((s, t) => s + t.comfortLevel, 0) /
                      totalTechniques
                    ).toFixed(1)
                  : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                Avg Comfort Level
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border p-0.5">
          <Button
            variant={view === "grid" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="mr-1 size-3" /> Grid
          </Button>
          <Button
            variant={view === "table" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setView("table")}
          >
            <List className="mr-1 size-3" /> Table
          </Button>
          <Button
            variant={view === "heatmap" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setView("heatmap")}
          >
            <LayoutGrid className="mr-1 size-3" /> Heatmap
          </Button>
        </div>

        {view !== "heatmap" && (
          <>
            <Select
              value={groupBy}
              onValueChange={(v) =>
                setGroupBy(v as "comfort" | "cuisine")
              }
            >
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <ChevronDown className="mr-1 size-3" />
                <SelectValue placeholder="Group by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comfort">By Comfort Level</SelectItem>
                <SelectItem value="cuisine">By Cuisine</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sortField}
              onValueChange={(v) =>
                setSortField(v as "comfort" | "times" | "recent")
              }
            >
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <ArrowUpDown className="mr-1 size-3" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comfort">Comfort Level</SelectItem>
                <SelectItem value="times">Times Performed</SelectItem>
                <SelectItem value="recent">Most Recent</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {/* Heatmap View */}
      {view === "heatmap" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Technique × Cuisine Mastery Heatmap
            </CardTitle>
          </CardHeader>
          <CardContent>
            {techniques.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No techniques logged yet. Cook some recipes to start tracking.
              </div>
            ) : (
              <TechniqueHeatmap techniques={techniques} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Grid View */}
      {view === "grid" && (
        <div className="space-y-6">
          {techniques.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
              <Flame className="size-8 text-muted-foreground/40 mb-3" />
              <h3 className="text-base font-semibold">
                No techniques logged yet
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Cook recipes to start building your technique mastery.
              </p>
            </div>
          )}
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                {group}
                <Badge variant="secondary" className="text-[10px]">
                  {items.length}
                </Badge>
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((t) => (
                  <Card key={t.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-sm">
                            {formatTechnique(t.technique)}
                          </h4>
                          {t.cuisine && (
                            <Badge
                              className={cn(
                                "mt-1 border-0 text-[10px]",
                                CUISINE_STYLES[t.cuisine] ??
                                  CUISINE_STYLES.OTHER,
                              )}
                            >
                              {formatCuisine(t.cuisine)}
                            </Badge>
                          )}
                        </div>
                        <ComfortStars level={t.comfortLevel} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {COMFORT_LABELS[t.comfortLevel]}
                          </span>
                          <span className="font-medium tabular-nums">
                            {t.comfortLevel}/5
                          </span>
                        </div>
                        <Progress
                          value={(t.comfortLevel / 5) * 100}
                          className="h-1.5"
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Hash className="size-3" />
                          {t.timesPerformed}×
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {new Date(t.lastPerformed).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table View */}
      {view === "table" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Technique</TableHead>
                  <TableHead>Cuisine</TableHead>
                  <TableHead>Comfort</TableHead>
                  <TableHead className="text-right">Times</TableHead>
                  <TableHead className="text-right">Last Performed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-8"
                    >
                      No techniques logged yet
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium text-sm">
                        {formatTechnique(t.technique)}
                      </TableCell>
                      <TableCell>
                        {t.cuisine ? (
                          <Badge
                            className={cn(
                              "border-0 text-[10px]",
                              CUISINE_STYLES[t.cuisine] ??
                                CUISINE_STYLES.OTHER,
                            )}
                          >
                            {formatCuisine(t.cuisine)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            General
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={(t.comfortLevel / 5) * 100}
                            className={cn("h-1.5 w-16")}
                          />
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {t.comfortLevel}/5
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {t.timesPerformed}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {new Date(t.lastPerformed).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
