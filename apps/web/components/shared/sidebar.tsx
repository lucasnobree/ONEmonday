"use client";

import { useState } from "react";
import Link from "next/link";
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
import { UserNav } from "./user-nav";
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

const comingSoonModules = [
  { name: "Analytics", icon: BarChart3, href: "/analytics" },
  { name: "CRM", icon: Users, href: "/crm" },
  { name: "Support Desk", icon: Headphones, href: "/support" },
  { name: "Dev Tools", icon: Terminal, href: "/dev-tools" },
  { name: "RH Portal", icon: UserCog, href: "/hr" },
];

function SidebarContent({ user }: SidebarProps) {
  const { currentSector } = useCurrentSector();

  const basePath = currentSector ? `/${currentSector.slug}` : "";

  const navItems = [
    { title: "Dashboard", href: "/", icon: LayoutDashboard },
    { title: "Boards", href: `${basePath}/boards`, icon: Kanban },
    { title: "Projetos", href: `${basePath}/projects`, icon: FolderKanban },
    { title: "Configuracoes", href: "/settings", icon: Settings },
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

      <Separator />

      <div className="flex-1 overflow-auto px-3 py-3">
        <SidebarNav items={navItems} />

        <Separator className="my-4" />

        <div className="space-y-1">
          <span className="px-3 text-xs font-medium text-muted-foreground">
            Modulos
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
        <NotificationBell />
        <UserNav user={user} />
      </div>
    </div>
  );
}

export function Sidebar({ user }: SidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-background md:block">
        <SidebarContent user={user} />
      </aside>

      {/* Mobile top bar + sheet */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center border-b bg-background px-4 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" />}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Abrir menu</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Menu de navegacao</SheetTitle>
            <SidebarContent user={user} />
          </SheetContent>
        </Sheet>
        <span className="ml-3 text-lg font-bold">ONEmonday</span>
      </div>

      {/* Spacer for mobile top bar */}
      <div className="h-14 shrink-0 md:hidden" />
    </>
  );
}
