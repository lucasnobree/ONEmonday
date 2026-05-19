"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSectorScope } from "@/hooks/use-sector-scope";
import { SectorScopeFilter } from "@/components/shared/sector-scope-filter";
import {
  useOrgChart,
  useDepartments,
  topLevelIds,
  allNodeIds,
  countNodes,
  filterTreeByDepartment,
  type OrgNode,
} from "@/hooks/hr/use-org-chart";
import { EmployeeProfileSheet } from "@/components/hr/employee-profile-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  ChevronRight,
  Users,
  Search,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** Ids on the path from a root down to (and including) any matching node. */
function pathIdsToMatch(tree: OrgNode[], matches: (n: OrgNode) => boolean) {
  const ids = new Set<string>();
  function walk(node: OrgNode): boolean {
    const childHit = node.children.map(walk).some(Boolean);
    const hit = matches(node) || childHit;
    if (childHit) ids.add(node.employee.id);
    return hit;
  }
  tree.forEach(walk);
  return ids;
}

/**
 * One node of the top-down org chart: a person card with a connector line up
 * to its manager and a row of children beneath it.
 */
function OrgChartNode({
  node,
  expandedSet,
  matchedIds,
  searchHitIds,
  isRoot,
  cardRef,
  onToggle,
  onClickEmployee,
}: {
  node: OrgNode;
  expandedSet: Set<string>;
  matchedIds: Set<string> | null;
  searchHitIds: Set<string> | null;
  isRoot: boolean;
  cardRef?: React.Ref<HTMLDivElement>;
  onToggle: (id: string) => void;
  onClickEmployee: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedSet.has(node.employee.id);
  // A node is "dimmed" when a department filter is active and it is only kept
  // for structure (an ancestor), not a true match.
  const isDimmed = matchedIds !== null && !matchedIds.has(node.employee.id);
  const isSearchHit = searchHitIds?.has(node.employee.id) ?? false;

  return (
    <div className="flex flex-col items-center">
      {/* Connector up to the parent (skipped for roots). */}
      {!isRoot && <div className="h-4 w-px bg-border" />}

      <div
        ref={cardRef}
        role="button"
        tabIndex={0}
        onClick={() => onClickEmployee(node.employee.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClickEmployee(node.employee.id);
          }
        }}
        className={cn(
          "relative w-52 rounded-lg border bg-card p-3 text-left shadow-sm transition-colors cursor-pointer hover:bg-accent/50 outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isDimmed && "opacity-45",
          isSearchHit && "ring-2 ring-primary"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0">
            {getInitials(node.employee.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">
              {node.employee.full_name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {node.employee.position}
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          {node.employee.department ? (
            <Badge variant="secondary" className="text-[10px]">
              {node.employee.department}
            </Badge>
          ) : (
            <span />
          )}
          {hasChildren && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(node.employee.id);
              }}
              className="flex items-center gap-0.5 rounded px-1 text-xs text-muted-foreground hover:text-foreground"
              aria-label={isExpanded ? "Recolher" : "Expandir"}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              {node.children.length}
            </button>
          )}
        </div>
      </div>

      {/* Children row, connected by lines. */}
      {hasChildren && isExpanded && (
        <>
          {/* Vertical stem down from this node. */}
          <div className="h-4 w-px bg-border" />
          <div className="flex items-start">
            {node.children.map((child, index) => {
              const isFirst = index === 0;
              const isLast = index === node.children.length - 1;
              const single = node.children.length === 1;
              return (
                <div
                  key={child.employee.id}
                  className="flex flex-col items-center"
                >
                  {/* Horizontal connector segment above each child. */}
                  {!single && (
                    <div className="flex h-px w-full">
                      <div className={cn("flex-1", !isFirst && "bg-border")} />
                      <div className={cn("flex-1", !isLast && "bg-border")} />
                    </div>
                  )}
                  <div className="px-3">
                    <OrgChartNode
                      node={child}
                      expandedSet={expandedSet}
                      matchedIds={matchedIds}
                      searchHitIds={searchHitIds}
                      isRoot={false}
                      onToggle={onToggle}
                      onClickEmployee={onClickEmployee}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function OrgChartPage() {
  const { scope } = useSectorScope();
  const [deptFilter, setDeptFilter] = useState("");
  const [search, setSearch] = useState("");
  const { data: fullTree, isLoading } = useOrgChart(scope);
  const { data: departments } = useDepartments(scope);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null
  );

  // Apply the department filter while keeping ancestor managers, so the chart
  // never fragments into orphan roots.
  const { tree, matchedIds } = useMemo(() => {
    const base = fullTree ?? [];
    if (!deptFilter) {
      return { tree: base, matchedIds: null as Set<string> | null };
    }
    const filtered = filterTreeByDepartment(base, deptFilter);
    return { tree: filtered.tree, matchedIds: filtered.matchedIds };
  }, [fullTree, deptFilter]);

  const totalCount = useMemo(() => countNodes(tree), [tree]);

  // Search hits: nodes whose name contains the query.
  const searchHitIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const ids = new Set<string>();
    const walk = (nodes: OrgNode[]) => {
      nodes.forEach((node) => {
        if (node.employee.full_name.toLowerCase().includes(q)) {
          ids.add(node.employee.id);
        }
        walk(node.children);
      });
    };
    walk(tree);
    return ids;
  }, [tree, search]);

  // Default expansion: top two levels — plus the full path to any search hit.
  const defaultExpandedIds = useMemo(() => {
    const ids = topLevelIds(tree);
    if (searchHitIds && searchHitIds.size > 0) {
      pathIdsToMatch(tree, (n) =>
        searchHitIds.has(n.employee.id)
      ).forEach((id) => ids.add(id));
    }
    return ids;
  }, [tree, searchHitIds]);

  const defaultSignature = useMemo(
    () => [...defaultExpandedIds].sort().join(","),
    [defaultExpandedIds]
  );

  const [expandedSet, setExpandedSet] = useState<Set<string>>(
    () => new Set(defaultExpandedIds)
  );
  const [seededSignature, setSeededSignature] = useState(defaultSignature);

  // Re-seed expansion during render when the underlying tree / search changes.
  if (seededSignature !== defaultSignature) {
    setSeededSignature(defaultSignature);
    setExpandedSet(new Set(defaultExpandedIds));
  }

  // The chart container is horizontally scrollable and centers a `min-w-max`
  // row; with a wide level-2 row the single root is pushed off-canvas. Scroll
  // the first root node into view once the tree has rendered.
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const rootNodeRef = useRef<HTMLDivElement | null>(null);
  const firstRootId = tree[0]?.employee.id ?? null;

  useEffect(() => {
    const container = scrollContainerRef.current;
    const rootNode = rootNodeRef.current;
    if (!container || !rootNode) return;
    // Center the root node horizontally within the scroll viewport.
    const target =
      rootNode.offsetLeft + rootNode.offsetWidth / 2 - container.clientWidth / 2;
    container.scrollLeft = Math.max(0, target);
  }, [firstRootId, isLoading]);

  function toggleExpand(id: string) {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SectorScopeFilter />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pessoa..."
            className="w-55 pl-8"
          />
        </div>

        <Select
          value={deptFilter}
          onValueChange={(v) => setDeptFilter(v === "__all__" ? "" : (v ?? ""))}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todos os departamentos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os departamentos</SelectItem>
            {(departments ?? []).map((dept) => (
              <SelectItem key={dept} value={dept}>
                {dept}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpandedSet(allNodeIds(tree))}
        >
          <Maximize2 className="h-3.5 w-3.5 mr-1" />
          Expandir tudo
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpandedSet(new Set())}
        >
          <Minimize2 className="h-3.5 w-3.5 mr-1" />
          Recolher tudo
        </Button>

        <span className="text-sm text-muted-foreground ml-auto">
          {totalCount} colaborador{totalCount === 1 ? "" : "es"}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : !tree || tree.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum colaborador cadastrado"
          description="Adicione colaboradores na página de colaboradores para visualizar o organograma."
        />
      ) : (
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto rounded-lg border bg-muted/20 p-6"
        >
          <div className="flex min-w-max items-start justify-center gap-8">
            {tree.map((root, index) => (
              <OrgChartNode
                key={root.employee.id}
                node={root}
                expandedSet={expandedSet}
                matchedIds={matchedIds}
                searchHitIds={searchHitIds}
                isRoot
                cardRef={index === 0 ? rootNodeRef : undefined}
                onToggle={toggleExpand}
                onClickEmployee={setSelectedEmployeeId}
              />
            ))}
          </div>
        </div>
      )}

      <EmployeeProfileSheet
        employeeId={selectedEmployeeId}
        open={!!selectedEmployeeId}
        onOpenChange={(open) => {
          if (!open) setSelectedEmployeeId(null);
        }}
      />
    </div>
  );
}
