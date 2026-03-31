"use client";

import {
  BookOpen,
  ChefHat,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Flame,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Kitchen Command Center
        </h1>
        <p className="text-muted-foreground mt-1">
          Your cooking universe at a glance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cookbook Recipes
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Complete onboarding to generate your first batch
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pantry Items
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Add your ingredients to get started
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Meals This Week
            </CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Plan your week in the meal planner
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Techniques Logged
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Tracked across all cuisines
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Expiring Soon
            </CardTitle>
            <CardDescription>
              Items approaching their use-by date
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No pantry items tracked yet. Add ingredients to see expiry
              alerts.
            </p>
            <Link
              href="/pantry"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "mt-4",
              })}
            >
              Go to Pantry
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="h-4 w-4" />
              Tonight&apos;s Suggestions
            </CardTitle>
            <CardDescription>
              Recipes matched to your pantry and style
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Complete onboarding to get personalized recipe suggestions
              based on your ingredients and cooking style.
            </p>
            <Link
              href="/cookbook"
              className={buttonVariants({
                variant: "default",
                size: "sm",
                className: "mt-4",
              })}
            >
              Browse Cookbook
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link
            href="/pantry/scan"
            className={buttonVariants({ variant: "outline" })}
          >
            Scan Receipt
          </Link>
          <Link href="/pantry" className={buttonVariants({ variant: "outline" })}>
            Add Ingredients
          </Link>
          <Link href="/explore" className={buttonVariants({ variant: "outline" })}>
            Explore a Cuisine
          </Link>
          <Link href="/chat" className={buttonVariants({ variant: "outline" })}>
            Ask Sous Chef
          </Link>
          <Link href="/food-web" className={buttonVariants({ variant: "outline" })}>
            Food Web
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
