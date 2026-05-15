"use client";

import { useState, useMemo } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useClauses, type Clause } from "@/hooks/legal/use-clauses";
import { ClauseFormDialog } from "@/components/legal/clause-form-dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { ScrollText, Search, CheckCircle2 } from "lucide-react";
import { CLAUSE_CATEGORIES } from "@/lib/validations/legal";
import { CLAUSE_CATEGORY_LABELS } from "@/lib/legal/labels";

export default function ClausesPage() {
  const { currentSector } = useCurrentSector();
  const { data: clauses, isLoading } = useClauses(currentSector?.id);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editing, setEditing] = useState<Clause | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (clauses ?? []).filter((c: Clause) => {
      if (categoryFilter !== "all" && c.category !== categoryFilter)
        return false;
      if (term) {
        const haystack = [c.title, c.body].join(" ").toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [clauses, categoryFilter, search]);

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para ver a biblioteca de clausulas.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar clausula"
              className="w-64 pl-8"
            />
          </div>
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v ?? "all")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {CLAUSE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CLAUSE_CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ClauseFormDialog />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : !(clauses ?? []).length ? (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              icon={ScrollText}
              title="Biblioteca de clausulas vazia"
              description="Adicione modelos de clausulas pre-aprovadas para reutilizar nos contratos."
              action={<ClauseFormDialog />}
            />
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhuma clausula encontrada com os filtros selecionados.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((clause: Clause) => (
            <Card
              key={clause.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setEditing(clause)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{clause.title}</CardTitle>
                  {clause.is_approved && (
                    <Badge variant="default" className="shrink-0">
                      <CheckCircle2 className="size-3 mr-1" />
                      Aprovada
                    </Badge>
                  )}
                </div>
                <Badge variant="outline" className="w-fit">
                  {CLAUSE_CATEGORY_LABELS[clause.category] ?? clause.category}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                  {clause.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <ClauseFormDialog
          key={editing.id}
          clause={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          hideTrigger
        />
      )}
    </div>
  );
}
