"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Menu,
  Settings,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { UserNav } from "./user-nav";
import { CommandPaletteTrigger } from "./command-palette";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { usePermissions } from "@/hooks/use-permissions";
import { useAllSectors } from "@/hooks/use-all-sectors";
import { useTreeExpansion } from "@/hooks/use-tree-expansion";
import {
  buildSectorTree,
  findActiveBranch,
  visibleSectors,
  type NavModule,
  type NavSector,
  type NavSectorNode,
} from "@/lib/navigation/sector-tree";

interface SidebarProps {
  user: {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string | null;
    is_global_admin: boolean;
  };
}

/* ── Tree leaf: a sub-page link ──────────────────────────────────── */

interface SubPageRowProps {
  label: string;
  href: string;
  active: boolean;
  onNavigate: () => void;
}

function SubPageRow({ label, href, active, onNavigate }: SubPageRowProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "block rounded-md py-1.5 pl-9 pr-3 text-sm transition-colors",
        active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}

/* ── Tree branch: a module group ─────────────────────────────────── */

interface ModuleRowProps {
  module: NavModule;
  nodeId: string;
  expanded: boolean;
  /** Id of the single sub-page resolved as active, or null. */
  activeSubPageId: string | null;
  onToggle: () => void;
  onNavigate: () => void;
}

function ModuleRow({
  module,
  nodeId,
  expanded,
  activeSubPageId,
  onToggle,
  onNavigate,
}: ModuleRowProps) {
  const Icon: LucideIcon = module.icon;
  const hasActiveChild = module.subPages.some((sp) => sp.id === activeSubPageId);

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`${nodeId}-children`}
        className={cn(
          "flex w-full items-center gap-2 rounded-md py-1.5 pl-5 pr-2 text-sm transition-colors",
          hasActiveChild
            ? "font-medium text-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        )}
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform",
            expanded && "rotate-90"
          )}
          aria-hidden="true"
        />
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">{module.label}</span>
      </button>
      {expanded && (
        <ul id={`${nodeId}-children`} className="mt-0.5 space-y-0.5">
          {module.subPages.map((sp) => (
            <li key={sp.id}>
              <SubPageRow
                label={sp.label}
                href={sp.href}
                active={sp.id === activeSubPageId}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/* ── Tree root: a sector group ───────────────────────────────────── */

interface SectorGroupProps {
  node: NavSectorNode;
  expanded: boolean;
  isModuleExpanded: (id: string) => boolean;
  activeModuleId: string | null;
  activeSubPageId: string | null;
  onToggleSector: () => void;
  onToggleModule: (id: string) => void;
  onSelectSector: (sector: NavSector) => void;
  onNavigate: () => void;
  /** When true the lone-sector chrome is dropped (single-sector user). */
  flat: boolean;
}

function SectorGroup({
  node,
  expanded,
  isModuleExpanded,
  activeModuleId,
  activeSubPageId,
  onToggleSector,
  onToggleModule,
  onSelectSector,
  onNavigate,
  flat,
}: SectorGroupProps) {
  const sectorNodeId = `nav-sector-${node.sector.id}`;
  const open = flat || expanded;

  const moduleItems = node.modules.map((mod) => (
    <ModuleRow
      key={mod.id}
      module={mod}
      nodeId={`nav-module-${node.sector.id}-${mod.id}`}
      expanded={isModuleExpanded(`${node.sector.id}:${mod.id}`)}
      activeSubPageId={activeModuleId === mod.id ? activeSubPageId : null}
      onToggle={() => {
        onToggleModule(`${node.sector.id}:${mod.id}`);
        // Activating any node inside this sector branch makes it current.
        onSelectSector(node.sector);
      }}
      onNavigate={() => {
        onSelectSector(node.sector);
        onNavigate();
      }}
    />
  ));

  // A single-sector user gets the module list with no sector header. The
  // tree's outer <ul> expects <li> children, so the modules render flat.
  if (flat) {
    return <>{moduleItems}</>;
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onToggleSector();
          onSelectSector(node.sector);
        }}
        aria-expanded={open}
        aria-controls={`${sectorNodeId}-children`}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold transition-colors",
          "text-foreground hover:bg-accent/50"
        )}
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            open && "rotate-90"
          )}
          aria-hidden="true"
        />
        <span className="flex-1 text-left">{node.sector.name}</span>
      </button>
      {open && (
        <ul
          id={`${sectorNodeId}-children`}
          className="mt-0.5 space-y-0.5"
        >
          {moduleItems}
        </ul>
      )}
    </li>
  );
}

/* ── Sidebar body ────────────────────────────────────────────────── */

function SidebarContent({
  user,
  onNavigate,
}: SidebarProps & { onNavigate: () => void }) {
  const pathname = usePathname();
  const { currentSector, setSector } = useCurrentSector();
  const { isGlobalAdmin, sectorRoles, isLoading } = usePermissions();
  const { sectors: allSectors } = useAllSectors(isGlobalAdmin);
  const { isExpanded, toggle, expandBranch } = useTreeExpansion();

  // Resolve which sectors are visible, then materialise the full tree.
  const sectors = useMemo(
    () => visibleSectors(isGlobalAdmin, sectorRoles, allSectors),
    [isGlobalAdmin, sectorRoles, allSectors]
  );
  const tree = useMemo(() => buildSectorTree(sectors), [sectors]);

  // A user with exactly one sector never needs to switch sectors — the tree
  // drops the sector header and shows the module list flat.
  const flat = sectors.length === 1;

  // Locate the active route in the tree to drive highlighting + auto-expand.
  // The current sector breaks ties for global URLs shown under every sector.
  const activeBranch = useMemo(
    () => findActiveBranch(tree, pathname, currentSector?.id),
    [tree, pathname, currentSector?.id]
  );

  // Auto-expand the branch matching the current route so the sidebar always
  // reveals where the user is. `expandBranch` only adds ids (never collapses)
  // and no-ops when they are already open, so this stays cheap on every nav.
  const branchSectorId = activeBranch.sectorId;
  const branchModuleId = activeBranch.moduleId;
  useEffect(() => {
    expandBranch([
      branchSectorId ? `sector:${branchSectorId}` : null,
      branchSectorId && branchModuleId
        ? `${branchSectorId}:${branchModuleId}`
        : null,
    ]);
  }, [branchSectorId, branchModuleId, expandBranch]);

  // The single-sector user always has that sector as the current context.
  // `setSector` writes to localStorage + dispatches an event (a side effect
  // touching other components), so it must run in an effect, not in render.
  // The id guard keeps it idle once the context is settled.
  const loneSector = flat ? sectors[0] : null;
  const loneSectorId = loneSector?.id;
  const currentSectorId = currentSector?.id;
  useEffect(() => {
    if (loneSector && loneSectorId !== currentSectorId) {
      setSector(loneSector);
    }
  }, [loneSector, loneSectorId, currentSectorId, setSector]);

  return (
    <div className="flex h-full flex-col">
      {/* Top zone: logo + quick links + command palette */}
      <div className="px-4 py-5">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2"
        >
          <span className="text-lg font-bold">ONEmonday</span>
        </Link>
      </div>

      <div className="space-y-1 px-3 pb-2">
        <Link
          href="/"
          onClick={onNavigate}
          aria-current={pathname === "/" ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          <span className="flex-1">Início</span>
        </Link>
        <CommandPaletteTrigger />
      </div>

      <Separator />

      {/* Middle zone: the Sector → Module → Sub-page tree */}
      <nav
        aria-label="Navegação por setor"
        className="flex-1 overflow-auto px-3 py-3"
      >
        {isLoading ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">
            Carregando…
          </p>
        ) : sectors.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">
            Nenhum setor disponível.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {tree.map((node) => (
              <SectorGroup
                key={node.sector.id}
                node={node}
                flat={flat}
                expanded={isExpanded(`sector:${node.sector.id}`)}
                isModuleExpanded={isExpanded}
                activeModuleId={
                  activeBranch.sectorId === node.sector.id
                    ? activeBranch.moduleId
                    : null
                }
                activeSubPageId={
                  activeBranch.sectorId === node.sector.id
                    ? activeBranch.subPageId
                    : null
                }
                onToggleSector={() => toggle(`sector:${node.sector.id}`)}
                onToggleModule={toggle}
                onSelectSector={setSector}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        )}
      </nav>

      <Separator />

      {/* Bottom zone: settings, notifications, theme, user */}
      <div className="space-y-1 p-3">
        <Link
          href="/settings"
          onClick={onNavigate}
          aria-current={
            pathname === "/settings" || pathname.startsWith("/settings/")
              ? "page"
              : undefined
          }
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/settings" || pathname.startsWith("/settings/")
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          <span className="flex-1">Configurações</span>
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <ThemeToggle />
        </div>
        <UserNav user={user} />
      </div>
    </div>
  );
}

/* ── Public component: desktop rail + mobile sheet ───────────────── */

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
        <SidebarContent user={user} onNavigate={() => {}} />
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
        <div className="flex items-center">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" />}>
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menu</span>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-64 p-0"
              showCloseButton={false}
            >
              <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
              <SidebarContent
                user={user}
                onNavigate={() => setOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <span className="ml-3 text-lg font-bold">ONEmonday</span>
        </div>
        <NotificationBell />
      </div>
    </>
  );
}
