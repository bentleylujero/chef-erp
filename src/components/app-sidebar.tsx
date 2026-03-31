"use client";

import {
  BookOpen,
  ChefHat,
  Compass,
  Home,
  LineChart,
  MessageSquare,
  Receipt,
  Scale,
  ShoppingCart,
  UtensilsCrossed,
  Warehouse,
  Network,
  CalendarDays,
  Settings,
  Moon,
  Sun,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "Dashboard", href: "/", icon: Home },
  { title: "Cookbook", href: "/cookbook", icon: BookOpen },
  { title: "Pantry", href: "/pantry", icon: Warehouse },
  { title: "Meal Plan", href: "/meal-plan", icon: CalendarDays },
  { title: "Grocery Lists", href: "/grocery", icon: ShoppingCart },
];

const intelligenceNav = [
  { title: "Sous Chef", href: "/chat", icon: MessageSquare },
  { title: "Explore Cuisines", href: "/explore", icon: Compass },
  { title: "Scan Receipt", href: "/pantry/scan", icon: Receipt },
];

const analyticsNav = [
  { title: "Food Web", href: "/food-web", icon: Network },
  { title: "Insights", href: "/insights", icon: LineChart },
  { title: "Techniques", href: "/profile/techniques", icon: Scale },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ChefHat className="h-4.5 w-4.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight">
              Chef Bentley
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Kitchen ERP
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Kitchen</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={(props) => <Link {...props} href={item.href} />}
                    isActive={
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href)
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Intelligence</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {intelligenceNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={(props) => <Link {...props} href={item.href} />}
                    isActive={pathname.startsWith(item.href)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Analytics</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analyticsNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={(props) => <Link {...props} href={item.href} />}
                    isActive={pathname.startsWith(item.href)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={(props) => <Link {...props} href="/profile" />}
              isActive={pathname === "/profile"}
            >
              <UtensilsCrossed className="h-4 w-4" />
              <span>Cooking Profile</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span>Toggle Theme</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
