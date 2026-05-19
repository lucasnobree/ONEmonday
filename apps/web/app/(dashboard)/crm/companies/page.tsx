"use client";

import { useState, useMemo } from "react";
import { useSectorScope } from "@/hooks/use-sector-scope";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { SectorScopeFilter } from "@/components/shared/sector-scope-filter";
import { sectorFilterValue } from "@/lib/navigation/scoped-query";
import { useCompanies, type Company } from "@/hooks/crm/use-companies";
import { CompanyFormDialog } from "@/components/crm/company-form-dialog";
import { CompanyDetailSheet } from "@/components/crm/company-detail-sheet";
import {
  nextSortState,
  sortRows,
  type SortState,
} from "@/lib/crm/list-sort";
import { SortHeader } from "@/components/crm/sort-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/shared/filter-select";
import {
  Plus,
  Search,
  Globe,
  Users,
  MapPin,
  Building2,
  Download,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react";
import { exportToCSV } from "@/lib/utils/export-csv";
import { EmptyState } from "@/components/shared/empty-state";

const sizeLabels: Record<string, string> = {
  micro: "Micro",
  small: "Pequena",
  medium: "Média",
  large: "Grande",
  enterprise: "Enterprise",
};

type CompanySortKey = "name" | "industry" | "city" | "contacts_count";

function companyValue(company: Company, key: CompanySortKey): unknown {
  if (key === "contacts_count") return company.contacts_count;
  return company[key];
}

export default function CompaniesPage() {
  const { scope, isLoading: scopeLoading } = useSectorScope();
  const { currentSector } = useCurrentSector();
  const { data: companies, isLoading: companiesLoading } = useCompanies(scope);
  const isLoading = scopeLoading || companiesLoading;
  // New records need a concrete target sector. Under the all-sectors scope we
  // fall back to the sidebar's current sector; with neither, creation is off.
  const createSectorId = sectorFilterValue(scope) ?? currentSector?.id ?? null;
  const [search, setSearch] = useState("");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [sort, setSort] = useState<SortState<CompanySortKey>>({
    key: "name",
    direction: "asc",
  });
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null
  );

  // Distinct industries present, for the filter dropdown.
  const industries = useMemo(() => {
    const set = new Set<string>();
    for (const c of companies ?? []) {
      if (c.industry) set.add(c.industry);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [companies]);

  const filtered = useMemo(() => {
    let result = companies ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.industry?.toLowerCase().includes(q) ||
          c.city?.toLowerCase().includes(q)
      );
    }
    if (sizeFilter !== "all") {
      result = result.filter((c) => c.size === sizeFilter);
    }
    if (industryFilter !== "all") {
      result = result.filter((c) => c.industry === industryFilter);
    }
    return sortRows(result, sort, companyValue);
  }, [companies, search, sizeFilter, industryFilter, sort]);

  const hasActiveFilter =
    search.trim() !== "" || sizeFilter !== "all" || industryFilter !== "all";

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 rounded-lg bg-muted animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const toggleSort = (key: CompanySortKey) =>
    setSort((s) => nextSortState(s, key));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportToCSV(
                filtered.map((c) => ({
                  nome: c.name,
                  dominio: c.domain ?? "",
                  industria: c.industry ?? "",
                  cidade: c.city ?? "",
                  telefone: c.phone ?? "",
                })),
                `empresas-${new Date().toISOString().split("T")[0]}`,
                [
                  { key: "nome", label: "Nome" },
                  { key: "dominio", label: "Domínio" },
                  { key: "industria", label: "Indústria" },
                  { key: "cidade", label: "Cidade" },
                  { key: "telefone", label: "Telefone" },
                ]
              )
            }
            disabled={!filtered.length}
          >
            <Download className="size-4 mr-1" />
            Exportar
          </Button>
          <Button
            onClick={() => setShowCreate(true)}
            disabled={!createSectorId}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nova Empresa
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <SectorScopeFilter />
        <FilterSelect
          value={sizeFilter}
          onValueChange={setSizeFilter}
          className="w-40"
          aria-label="Filtrar por porte"
          options={[
            { value: "all", label: "Todo porte" },
            ...Object.entries(sizeLabels).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
        <FilterSelect
          value={industryFilter}
          onValueChange={setIndustryFilter}
          className="w-48"
          aria-label="Filtrar por indústria"
          options={[
            { value: "all", label: "Toda indústria" },
            ...industries.map((ind) => ({ value: ind, label: ind })),
          ]}
        />
        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setSearch("");
              setSizeFilter("all");
              setIndustryFilter("all");
            }}
          >
            Limpar filtros
          </Button>
        )}
        <div className="ml-auto inline-flex h-8 items-center rounded-lg bg-muted p-0.75">
          <button
            type="button"
            onClick={() => setView("grid")}
            className={`inline-flex items-center justify-center rounded-md px-2 py-1 transition-all ${
              view === "grid"
                ? "bg-background shadow-sm"
                : "text-muted-foreground"
            }`}
            title="Cards"
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={`inline-flex items-center justify-center rounded-md px-2 py-1 transition-all ${
              view === "table"
                ? "bg-background shadow-sm"
                : "text-muted-foreground"
            }`}
            title="Tabela"
          >
            <TableIcon className="size-4" />
          </button>
        </div>
      </div>

      {!companies?.length && !hasActiveFilter ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma empresa cadastrada"
          description="Adicione sua primeira empresa para começar a organizar seus clientes."
          action={
            <Button
              onClick={() => setShowCreate(true)}
              disabled={!createSectorId}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova Empresa
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhuma empresa encontrada para os filtros.
        </p>
      ) : view === "table" ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <SortHeader
                  label="Nome"
                  sortKey="name"
                  activeKey={sort.key}
                  direction={sort.direction}
                  onSort={toggleSort}
                  className="pl-3"
                />
                <SortHeader
                  label="Indústria"
                  sortKey="industry"
                  activeKey={sort.key}
                  direction={sort.direction}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Cidade"
                  sortKey="city"
                  activeKey={sort.key}
                  direction={sort.direction}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Contatos"
                  sortKey="contacts_count"
                  activeKey={sort.key}
                  direction={sort.direction}
                  onSort={toggleSort}
                />
                <th className="pb-2 pr-3 font-medium">Porte</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((company) => (
                <tr
                  key={company.id}
                  className="border-b last:border-0 cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedCompanyId(company.id)}
                >
                  <td className="py-2.5 pl-3 font-medium">{company.name}</td>
                  <td className="py-2.5 text-muted-foreground">
                    {company.industry ?? "—"}
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {[company.city, company.state].filter(Boolean).join(", ") ||
                      "—"}
                  </td>
                  <td className="py-2.5">{company.contacts_count}</td>
                  <td className="py-2.5 pr-3">
                    {company.size ? (
                      <Badge variant="outline">
                        {sizeLabels[company.size] ?? company.size}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((company) => (
            <Card
              key={company.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedCompanyId(company.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{company.name}</CardTitle>
                  {company.size && (
                    <Badge variant="outline">
                      {sizeLabels[company.size] ?? company.size}
                    </Badge>
                  )}
                </div>
                {company.industry && (
                  <p className="text-sm text-muted-foreground">
                    {company.industry}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {company.domain && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="h-3.5 w-3.5" />
                    <span>{company.domain}</span>
                  </div>
                )}
                {(company.city || company.state) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>
                      {[company.city, company.state]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>
                    {company.contacts_count}{" "}
                    {company.contacts_count === 1 ? "contato" : "contatos"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {createSectorId && (
        <CompanyFormDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          sectorId={createSectorId}
        />
      )}

      <CompanyDetailSheet
        companyId={selectedCompanyId}
        open={!!selectedCompanyId}
        onOpenChange={(o) => !o && setSelectedCompanyId(null)}
      />
    </div>
  );
}
