"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Kanban,
  FolderKanban,
  Lock,
  Menu,
  BarChart3,
  Users,
  Headphones,
  Terminal,
  UserCog,
  Settings,
  DollarSign,
  Megaphone,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { SectorSwitcher } from "./sector-switcher";
import { SidebarNav } from "./sidebar-nav";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { UserNav } from "./user-nav";
import { CommandPaletteTrigger } from "./command-palette";
import { useCurrentSector } from "@/hooks/use-current-sector";

interface SidebarProps {
  user: {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string | null;
    is_global_admin: boolean;
  };
}

const activeModules = [
  { name: "Support Desk", icon: Headphones, href: "/support" },
  { name: "CRM", icon: Users, href: "/crm" },
  { name: "RH Portal", icon: UserCog, href: "/hr" },
  { name: "Financeiro", icon: DollarSign, href: "/finance" },
  { name: "Jurídico", icon: Scale, href: "/legal" },
];

const comingSoonModules = [
  { name: "Analytics", icon: BarChart3, href: "/analytics" },
  { name: "Dev Tools", icon: Terminal, href: "/dev-tools" },
  { name: "Marketing", icon: Megaphone, href: "/marketing" },
];

function SidebarContent({ user }: SidebarProps) {
  const { currentSector } = useCurrentSector();
  const pathname = usePathname();

  const basePath = currentSector ? `/${currentSector.slug}` : "";

  const navItems = [
    { title: "Dashboard", href: "/", icon: LayoutDashboard },
    { title: "Boards", href: `${basePath}/boards`, icon: Kanban },
    { title: "Projetos", href: `${basePath}/projects`, icon: FolderKanban },
    { title: "Configurações", href: "/settings", icon: Settings },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold">ONEmonday</span>
        </Link>
      </div>

      <div className="px-3 pb-3">
        <SectorSwitcher />
      </div>

      <div className="px-3 pb-3">
        <CommandPaletteTrigger />
      </div>

      <Separator />

      <div className="flex-1 overflow-auto px-3 py-3">
        <SidebarNav items={navItems} />

        <Separator className="my-4" />

        <div className="space-y-1">
          <span className="px-3 text-xs font-medium text-muted-foreground">
            Módulos
          </span>
          {activeModules.map((mod) => {
            const isActive = pathname.startsWith(mod.href);
            return (
              <Link
                key={mod.name}
                href={mod.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                <mod.icon className="h-4 w-4" />
                <span className="flex-1">{mod.name}</span>
              </Link>
            );
          })}
        </div>

        <Separator className="my-4" />

        <div className="space-y-1">
          <span className="px-3 text-xs font-medium text-muted-foreground">
            Em breve
          </span>
          <TooltipProvider>
            {comingSoonModules.map((mod) => (
              <Tooltip key={mod.name}>
                <TooltipTrigger
                  render={<Link href={mod.href} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/50 transition-colors" />}
                >
                  <mod.icon className="h-4 w-4" />
                  <span className="flex-1">{mod.name}</span>
                  <Lock className="h-3 w-3" />
                </TooltipTrigger>
                <TooltipContent side="right">Em breve</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      </div>

      <Separator />

      <div className="p-3 space-y-1">
        <div className="flex items-center gap-1">
          <NotificationBell />
          <ThemeToggle />
        </div>
        <UserNav user={user} />
      </div>
    </div>
  );
}

export function Sidebar({ user }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Close the mobile sheet whenever navigation lands on a new route.
  // Tracking the rendered pathname avoids a setState-in-effect cascade.
  const [sheetPathname, setSheetPathname] = useState(pathname);
  if (sheetPathname !== pathname) {
    setSheetPathname(pathname);
    if (open) setOpen(false);
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-background md:block">
        <SidebarContent user={user} />
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
        <div className="flex items-center">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" />}>
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menu</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
              <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
              <SidebarContent user={user} />
            </SheetContent>
          </Sheet>
          <span className="ml-3 text-lg font-bold">ONEmonday</span>
        </div>
        <NotificationBell />
      </div>
    </>
  );
}
