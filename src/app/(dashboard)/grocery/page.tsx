"use client";

import { format } from "date-fns";
import {
  ChevronDown,
  ClipboardList,
  Loader2,
  Plus,
  ShoppingBasket,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  useCreateGroceryList,
  useGroceryLists,
  type GroceryListStatus,
} from "@/hooks/use-grocery";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function statusBadgeVariant(
  status: GroceryListStatus,
): "default" | "secondary" | "outline" {
  switch (status) {
    case "ACTIVE":
      return "default";
    case "COMPLETED":
      return "secondary";
    default:
      return "outline";
  }
}

function statusLabel(status: GroceryListStatus) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "ACTIVE":
      return "Active";
    case "COMPLETED":
      return "Done";
  }
}

export default function GroceryListsPage() {
  const router = useRouter();
  const { data: lists, isLoading, isError } = useGroceryLists();
  const createList = useCreateGroceryList();

  const dayStamp = format(new Date(), "MMM d");

  async function handleCreate(
    source: "manual" | "meal-plan" | "smart",
    name: string,
  ) {
    try {
      const created = await createList.mutateAsync({ name, source });
      toast.success("List created");
      router.push(`/grocery/${created.id}`);
    } catch {
      toast.error("Could not create list");
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Grocery Lists
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Build lists from your meal plan and pantry par levels — organized
            by store section for faster shopping.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                className="w-full shrink-0 sm:w-auto"
                disabled={createList.isPending}
              />
            }
          >
            {createList.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            New list
            <ChevronDown className="size-4 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuItem
              onClick={() =>
                handleCreate("manual", `Shopping list · ${dayStamp}`)
              }
            >
              <ClipboardList className="size-4 opacity-70" />
              Blank list
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                handleCreate("meal-plan", `Meal plan · ${dayStamp}`)
              }
            >
              <ShoppingBasket className="size-4 opacity-70" />
              From meal plan
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCreate("smart", `Smart list · ${dayStamp}`)}
            >
              <Sparkles className="size-4 opacity-70" />
              Smart list
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isError && (
        <p className="text-sm text-destructive">
          Something went wrong loading your lists.
        </p>
      )}

      {isLoading && (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && lists && lists.length === 0 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">No lists yet</CardTitle>
            <CardDescription>
              Start a blank list, pull from this week&apos;s meal plan, or run
              a smart list that also restocks anything below par.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!isLoading && lists && lists.length > 0 && (
        <ul className="grid gap-3">
          {lists.map((list) => {
            const pct =
              list.itemCount > 0
                ? Math.round((list.checkedCount / list.itemCount) * 100)
                : 0;
            return (
              <li key={list.id}>
                <Link href={`/grocery/${list.id}`} className="block">
                  <Card
                    size="sm"
                    className="transition-colors hover:bg-muted/40 active:bg-muted/60"
                  >
                    <CardHeader className="border-b border-border/60 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="line-clamp-2 text-base leading-snug">
                          {list.name}
                        </CardTitle>
                        <Badge variant={statusBadgeVariant(list.status)}>
                          {statusLabel(list.status)}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs tabular-nums">
                        Updated {format(new Date(list.updatedAt), "MMM d, h:mm a")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">
                          {list.itemCount}{" "}
                          {list.itemCount === 1 ? "item" : "items"}
                        </span>
                        <span className="font-medium tabular-nums text-foreground">
                          {list.estimatedTotal != null
                            ? currency.format(list.estimatedTotal)
                            : "—"}
                        </span>
                      </div>
                      <div
                        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Items checked"
                      >
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                        {list.checkedCount} of {list.itemCount} checked
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
