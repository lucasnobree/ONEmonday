"use client";

import { useState } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useOrgChart, useDepartments, type OrgNode } from "@/hooks/hr/use-org-chart";
import { EmployeeProfileSheet } from "@/components/hr/employee-profile-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function OrgTreeNode({
  node,
  depth,
  expandedSet,
  onToggle,
  onClickEmployee,
}: {
  node: OrgNode;
  depth: number;
  expandedSet: Set<string>;
  onToggle: (id: string) => void;
  onClickEmployee: (id: string) => void;
}) {
  const isExpanded = expandedSet.has(node.employee.id);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-md border p-3 hover:bg-accent/50 transition-colors cursor-pointer"
        style={{ marginLeft: depth * 24 }}
        onClick={() => onClickEmployee(node.employee.id)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.employee.id);
            }}
            className="shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-4" />
        )}

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0">
          {getInitials(node.employee.full_name)}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {node.employee.full_name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {node.employee.position}
          </p>
        </div>

        {node.employee.department && (
          <Badge variant="secondary" className="shrink-0 text-xs">
            {node.employee.department}
          </Badge>
        )}

        {hasChildren && (
          <span className="text-xs text-muted-foreground shrink-0">
            {node.children.length}
          </span>
        )}
      </div>

      {isExpanded && hasChildren && (
        <div className="relative ml-4 border-l border-muted">
          <div className="space-y-1 py-1">
            {node.children.map((child) => (
              <OrgTreeNode
                key={child.employee.id}
                node={child}
                depth={depth + 1}
                expandedSet={expandedSet}
                onToggle={onToggle}
                onClickEmployee={onClickEmployee}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrgChartPage() {
  const { currentSector } = useCurrentSector();
  const [deptFilter, setDeptFilter] = useState("");
  const { data: tree, isLoading } = useOrgChart(
    currentSector?.id,
    deptFilter || undefined
  );
  const { data: departments } = useDepartments(currentSector?.id);
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null
  );

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

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para ver o organograma.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
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
          description="Adicione colaboradores na pagina de colaboradores para visualizar o organograma."
        />
      ) : (
        <div className="space-y-1">
          {tree.map((node) => (
            <OrgTreeNode
              key={node.employee.id}
              node={node}
              depth={0}
              expandedSet={expandedSet}
              onToggle={toggleExpand}
              onClickEmployee={setSelectedEmployeeId}
            />
          ))}
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
