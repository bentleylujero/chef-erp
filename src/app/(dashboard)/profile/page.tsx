"use client";

import { useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import {
  ChefHat,
  Star,
  Utensils,
  Flame,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  Calendar,
  Award,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  formatCuisine,
  formatTechnique,
  CUISINE_STYLES,
} from "@/components/cookbook/recipe-card";

interface FlavorProfile {
  spiceTolerance: number;
  sweetPref: number;
  saltyPref: number;
  sourPref: number;
  umamiPref: number;
  bitterPref: number;
  ingredientAversions: string[];
}

interface CookingStyle {
  primaryCuisines: string[];
  exploringCuisines: string[];
  preferredTechniques: string[];
  cookingPhilosophy: string | null;
  mealPrepStyle: string;
}

interface TechniqueLog {
  id: string;
  technique: string;
  cuisine: string | null;
  timesPerformed: number;
  lastPerformed: string;
  comfortLevel: number;
}

interface ProfileData {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  skillLevel: string;
  dietaryRestrictions: string[];
  kitchenEquipment: string[];
  createdAt: string;
  flavorProfile: FlavorProfile | null;
  cookingStyle: CookingStyle | null;
  techniqueLogs: TechniqueLog[];
  stats: {
    totalRecipesCooked: number;
    totalRatings: number;
    avgRatingGiven: number | null;
    favoriteCuisine: string | null;
    favoriteTechnique: string | null;
  };
}

const SKILL_LABELS: Record<string, { label: string; color: string }> = {
  INTERMEDIATE: {
    label: "Intermediate",
    color: "bg-blue-500/15 text-blue-400",
  },
  ADVANCED: {
    label: "Advanced",
    color: "bg-amber-500/15 text-amber-400",
  },
  PROFESSIONAL: {
    label: "Professional",
    color: "bg-emerald-500/15 text-emerald-400",
  },
};

const COMMON_EQUIPMENT = [
  "Chef's Knife",
  "Cutting Board",
  "Cast Iron Skillet",
  "Stainless Steel Pan",
  "Dutch Oven",
  "Sheet Pan",
  "Stock Pot",
  "Sauce Pan",
  "Wok",
  "Stand Mixer",
  "Food Processor",
  "Blender",
  "Immersion Blender",
  "Sous Vide",
  "Pressure Cooker",
  "Thermometer",
  "Mandoline",
  "Mortar & Pestle",
  "Grill",
  "Smoker",
  "Pasta Machine",
  "Torch",
  "Scale",
  "Fermentation Crock",
];

function useProfile() {
  return useQuery<ProfileData>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
  });
}

function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated");
    },
    onError: () => {
      toast.error("Failed to update profile");
    },
  });
}

function FlavorRadarChart({ profile }: { profile: FlavorProfile }) {
  const data = [
    { flavor: "Spicy", value: profile.spiceTolerance, fullMark: 10 },
    { flavor: "Sweet", value: profile.sweetPref, fullMark: 10 },
    { flavor: "Salty", value: profile.saltyPref, fullMark: 10 },
    { flavor: "Sour", value: profile.sourPref, fullMark: 10 },
    { flavor: "Umami", value: profile.umamiPref, fullMark: 10 },
    { flavor: "Bitter", value: profile.bitterPref, fullMark: 10 },
  ];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
        <PolarGrid
          stroke="hsl(var(--border))"
          strokeOpacity={0.3}
        />
        <PolarAngleAxis
          dataKey="flavor"
          tick={{
            fill: "hsl(var(--muted-foreground))",
            fontSize: 12,
            fontWeight: 500,
          }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 10]}
          tick={false}
          axisLine={false}
        />
        <Radar
          name="Flavor DNA"
          dataKey="value"
          stroke="hsl(var(--primary))"
          fill="hsl(var(--primary))"
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function EditablePhilosophy({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  if (!editing) {
    return (
      <div className="group flex items-start gap-2">
        <p className="flex-1 text-sm text-muted-foreground italic">
          {value || "No cooking philosophy set yet..."}
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => {
            setDraft(value ?? "");
            setEditing(true);
          }}
        >
          <Pencil className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Describe your cooking philosophy..."
        className="min-h-[80px] text-sm"
      />
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => {
            onSave(draft);
            setEditing(false);
          }}
        >
          <Check className="mr-1 size-3" /> Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => setEditing(false)}
        >
          <X className="mr-1 size-3" /> Cancel
        </Button>
      </div>
    </div>
  );
}

function EditableList({
  items,
  onSave,
  placeholder,
}: {
  items: string[];
  onSave: (items: string[]) => void;
  placeholder: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(items);
  const [newItem, setNewItem] = useState("");

  if (!editing) {
    return (
      <div className="group flex items-start gap-2">
        <div className="flex flex-1 flex-wrap gap-1.5">
          {items.length === 0 && (
            <span className="text-sm text-muted-foreground italic">
              None set
            </span>
          )}
          {items.map((item) => (
            <Badge key={item} variant="secondary" className="text-xs">
              {item}
            </Badge>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => {
            setDraft([...items]);
            setEditing(true);
          }}
        >
          <Pencil className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {draft.map((item) => (
          <Badge
            key={item}
            variant="secondary"
            className="cursor-pointer text-xs gap-1 pr-1"
            onClick={() => setDraft(draft.filter((i) => i !== item))}
          >
            {item}
            <Trash2 className="size-3 text-destructive" />
          </Badge>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={placeholder}
          className="h-7 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newItem.trim()) {
              setDraft([...draft, newItem.trim()]);
              setNewItem("");
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs shrink-0"
          onClick={() => {
            if (newItem.trim()) {
              setDraft([...draft, newItem.trim()]);
              setNewItem("");
            }
          }}
        >
          <Plus className="size-3" />
        </Button>
      </div>
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => {
            onSave(draft);
            setEditing(false);
          }}
        >
          <Check className="mr-1 size-3" /> Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => setEditing(false)}
        >
          <X className="mr-1 size-3" /> Cancel
        </Button>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}

export default function CookingProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  if (isLoading || !profile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Cooking Profile
          </h1>
          <p className="text-muted-foreground mt-1">
            Your cooking style, Flavor DNA, and equipment.
          </p>
        </div>
        <ProfileSkeleton />
      </div>
    );
  }

  const skillInfo = SKILL_LABELS[profile.skillLevel] ?? SKILL_LABELS.INTERMEDIATE;
  const memberSince = new Date(profile.createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
            <ChefHat className="size-8 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                {profile.name}
              </h1>
              <Badge className={cn("border-0", skillInfo.color)}>
                {skillInfo.label}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="size-3.5" />
              Member since {memberSince}
            </div>
          </div>
        </div>
        <Select
          value={profile.skillLevel}
          onValueChange={(v) => updateProfile.mutate({ skillLevel: v })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
            <SelectItem value="ADVANCED">Advanced</SelectItem>
            <SelectItem value="PROFESSIONAL">Professional</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <BookOpen className="size-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {profile.stats.totalRecipesCooked}
              </div>
              <div className="text-xs text-muted-foreground">
                Recipes Cooked
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Star className="size-5 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {profile.stats.avgRatingGiven?.toFixed(1) ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground">Avg Rating</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <Utensils className="size-5 text-blue-500" />
            </div>
            <div>
              <div className="text-lg font-bold truncate">
                {profile.stats.favoriteCuisine
                  ? formatCuisine(profile.stats.favoriteCuisine)
                  : "—"}
              </div>
              <div className="text-xs text-muted-foreground">Top Cuisine</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-violet-500/10 p-2">
              <Award className="size-5 text-violet-500" />
            </div>
            <div>
              <div className="text-lg font-bold truncate">
                {profile.stats.favoriteTechnique
                  ? formatTechnique(profile.stats.favoriteTechnique)
                  : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                Top Technique
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Cooking Style */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Utensils className="size-4" />
              Cooking Style
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                Primary Cuisines
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {(profile.cookingStyle?.primaryCuisines ?? []).map((c) => (
                  <Badge
                    key={c}
                    className={cn(
                      "border-0 text-sm px-3 py-1",
                      CUISINE_STYLES[c] ?? CUISINE_STYLES.OTHER,
                    )}
                  >
                    {formatCuisine(c)}
                  </Badge>
                ))}
                {(profile.cookingStyle?.primaryCuisines ?? []).length ===
                  0 && (
                  <span className="text-sm text-muted-foreground italic">
                    Cook more recipes to discover your primary cuisines
                  </span>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                Exploring Cuisines
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {(profile.cookingStyle?.exploringCuisines ?? []).map((c) => (
                  <Badge
                    key={c}
                    variant="outline"
                    className="text-xs"
                  >
                    {formatCuisine(c)}
                  </Badge>
                ))}
                {(profile.cookingStyle?.exploringCuisines ?? []).length ===
                  0 && (
                  <span className="text-sm text-muted-foreground italic">
                    No cuisines being explored yet
                  </span>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                Preferred Techniques
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {(profile.cookingStyle?.preferredTechniques ?? []).map((t) => (
                  <Badge
                    key={t}
                    variant="secondary"
                    className="text-xs"
                  >
                    {formatTechnique(t)}
                  </Badge>
                ))}
                {(profile.cookingStyle?.preferredTechniques ?? []).length ===
                  0 && (
                  <span className="text-sm text-muted-foreground italic">
                    No preferred techniques yet
                  </span>
                )}
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                Cooking Philosophy
              </h4>
              <EditablePhilosophy
                value={profile.cookingStyle?.cookingPhilosophy ?? null}
                onSave={(v) =>
                  updateProfile.mutate({
                    cookingStyle: { cookingPhilosophy: v },
                  })
                }
              />
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                Meal Prep Style
              </h4>
              <Select
                value={profile.cookingStyle?.mealPrepStyle ?? "MIXED"}
                onValueChange={(v) =>
                  updateProfile.mutate({
                    cookingStyle: { mealPrepStyle: v },
                  })
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BATCH">Batch</SelectItem>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="MIXED">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Flavor DNA */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="size-4" />
              Flavor DNA
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profile.flavorProfile ? (
              <>
                <FlavorRadarChart profile={profile.flavorProfile} />
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    {
                      label: "Spicy",
                      key: "spiceTolerance" as const,
                      color: "text-red-400",
                    },
                    {
                      label: "Sweet",
                      key: "sweetPref" as const,
                      color: "text-pink-400",
                    },
                    {
                      label: "Salty",
                      key: "saltyPref" as const,
                      color: "text-sky-400",
                    },
                    {
                      label: "Sour",
                      key: "sourPref" as const,
                      color: "text-yellow-400",
                    },
                    {
                      label: "Umami",
                      key: "umamiPref" as const,
                      color: "text-violet-400",
                    },
                    {
                      label: "Bitter",
                      key: "bitterPref" as const,
                      color: "text-emerald-400",
                    },
                  ].map(({ label, key, color }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-lg border px-3 py-2"
                    >
                      <span className={cn("text-xs font-medium", color)}>
                        {label}
                      </span>
                      <span className="text-sm font-bold tabular-nums">
                        {profile.flavorProfile![key]}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Flame className="size-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Your Flavor DNA will develop as you cook and rate recipes.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Equipment & Dietary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Equipment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kitchen Equipment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {COMMON_EQUIPMENT.map((item) => {
                const owned = profile.kitchenEquipment.includes(item);
                return (
                  <label
                    key={item}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
                      owned
                        ? "border-primary/30 bg-primary/5"
                        : "border-transparent hover:bg-muted/50",
                    )}
                  >
                    <Checkbox
                      checked={owned}
                      onCheckedChange={(checked) => {
                        const newEquipment = checked
                          ? [...profile.kitchenEquipment, item]
                          : profile.kitchenEquipment.filter(
                              (e) => e !== item,
                            );
                        updateProfile.mutate({
                          kitchenEquipment: newEquipment,
                        });
                      }}
                    />
                    <span className="text-xs">{item}</span>
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Dietary Restrictions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Dietary Restrictions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EditableList
              items={profile.dietaryRestrictions}
              onSave={(items) =>
                updateProfile.mutate({ dietaryRestrictions: items })
              }
              placeholder="Add restriction (e.g., Nut Allergy)"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
