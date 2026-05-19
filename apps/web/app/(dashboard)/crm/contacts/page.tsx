"use client";

import { useState, useMemo } from "react";
import { useSectorScope } from "@/hooks/use-sector-scope";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { SectorScopeFilter } from "@/components/shared/sector-scope-filter";
import { sectorFilterValue } from "@/lib/navigation/scoped-query";
import { useContacts, type Contact } from "@/hooks/crm/use-contacts";
import { ContactFormDialog } from "@/components/crm/contact-form-dialog";
import { ContactDetailSheet } from "@/components/crm/contact-detail-sheet";
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
  Mail,
  Phone,
  Building2,
  UserRound,
  Download,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react";
import { exportToCSV } from "@/lib/utils/export-csv";
import { EmptyState } from "@/components/shared/empty-state";

type ContactSortKey = "full_name" | "position" | "company" | "email";

function contactValue(contact: Contact, key: ContactSortKey): unknown {
  if (key === "company") return contact.company?.name ?? null;
  return contact[key];
}

export default function ContactsPage() {
  const { scope, isLoading: scopeLoading } = useSectorScope();
  const { currentSector } = useCurrentSector();
  const { data: contacts, isLoading: contactsLoading } = useContacts(scope);
  const isLoading = scopeLoading || contactsLoading;
  // New records / the detail sheet's company picker need a concrete sector;
  // fall back to the sidebar sector under the all-sectors scope.
  const formSectorId = sectorFilterValue(scope) ?? currentSector?.id ?? null;
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [primaryOnly, setPrimaryOnly] = useState(false);
  const [view, setView] = useState<"grid" | "table">("grid");
  const [sort, setSort] = useState<SortState<ContactSortKey>>({
    key: "full_name",
    direction: "asc",
  });
  const [showCreate, setShowCreate] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    null
  );

  // Distinct companies present, for the filter dropdown.
  const companyOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contacts ?? []) {
      if (c.company) map.set(c.company.id, c.company.name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [contacts]);

  const filtered = useMemo(() => {
    let result = contacts ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.company?.name?.toLowerCase().includes(q) ||
          c.position?.toLowerCase().includes(q)
      );
    }
    if (companyFilter !== "all") {
      result = result.filter((c) => c.company_id === companyFilter);
    }
    if (primaryOnly) {
      result = result.filter((c) => c.is_primary);
    }
    return sortRows(result, sort, contactValue);
  }, [contacts, search, companyFilter, primaryOnly, sort]);

  const hasActiveFilter =
    search.trim() !== "" || companyFilter !== "all" || primaryOnly;

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

  const toggleSort = (key: ContactSortKey) =>
    setSort((s) => nextSortState(s, key));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contatos..."
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
                  nome: c.full_name,
                  email: c.email ?? "",
                  telefone: c.phone ?? "",
                  cargo: c.position ?? "",
                  empresa: c.company?.name ?? "",
                })),
                `contatos-${new Date().toISOString().split("T")[0]}`,
                [
                  { key: "nome", label: "Nome" },
                  { key: "email", label: "Email" },
                  { key: "telefone", label: "Telefone" },
                  { key: "cargo", label: "Cargo" },
                  { key: "empresa", label: "Empresa" },
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
            disabled={!formSectorId}
          >
            <Plus className="h-4 w-4 mr-1" />
            Novo Contato
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <SectorScopeFilter />
        <FilterSelect
          value={companyFilter}
          onValueChange={setCompanyFilter}
          className="w-52"
          aria-label="Filtrar por empresa"
          options={[
            { value: "all", label: "Toda empresa" },
            ...companyOptions.map(([id, name]) => ({ value: id, label: name })),
          ]}
        />
        <Button
          variant={primaryOnly ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setPrimaryOnly((v) => !v)}
        >
          Apenas principais
        </Button>
        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setSearch("");
              setCompanyFilter("all");
              setPrimaryOnly(false);
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

      {!contacts?.length && !hasActiveFilter ? (
        <EmptyState
          icon={UserRound}
          title="Nenhum contato cadastrado"
          description="Adicione seu primeiro contato para começar a gerenciar seu relacionamento com clientes."
          action={
            <Button
              onClick={() => setShowCreate(true)}
              disabled={!formSectorId}
            >
              <Plus className="h-4 w-4 mr-1" />
              Novo Contato
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhum contato encontrado para os filtros.
        </p>
      ) : view === "table" ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <SortHeader
                  label="Nome"
                  sortKey="full_name"
                  activeKey={sort.key}
                  direction={sort.direction}
                  onSort={toggleSort}
                  className="pl-3"
                />
                <SortHeader
                  label="Cargo"
                  sortKey="position"
                  activeKey={sort.key}
                  direction={sort.direction}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Empresa"
                  sortKey="company"
                  activeKey={sort.key}
                  direction={sort.direction}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Email"
                  sortKey="email"
                  activeKey={sort.key}
                  direction={sort.direction}
                  onSort={toggleSort}
                  className="pr-3"
                />
              </tr>
            </thead>
            <tbody>
              {filtered.map((contact) => (
                <tr
                  key={contact.id}
                  className="border-b last:border-0 cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedContactId(contact.id)}
                >
                  <td className="py-2.5 pl-3 font-medium">
                    <span className="flex items-center gap-2">
                      {contact.full_name}
                      {contact.is_primary && (
                        <Badge variant="secondary">Principal</Badge>
                      )}
                    </span>
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {contact.position ?? "—"}
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {contact.company?.name ?? "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground">
                    {contact.email ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((contact) => (
            <Card
              key={contact.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedContactId(contact.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">
                    {contact.full_name}
                  </CardTitle>
                  {contact.is_primary && (
                    <Badge variant="secondary">Principal</Badge>
                  )}
                </div>
                {contact.position && (
                  <p className="text-sm text-muted-foreground">
                    {contact.position}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {contact.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span>{contact.email}</span>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{contact.phone}</span>
                  </div>
                )}
                {contact.company && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{contact.company.name}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {formSectorId && (
        <ContactFormDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          sectorId={formSectorId}
        />
      )}

      {formSectorId && (
        <ContactDetailSheet
          contactId={selectedContactId}
          sectorId={formSectorId}
          open={!!selectedContactId}
          onOpenChange={(o) => !o && setSelectedContactId(null)}
        />
      )}
    </div>
  );
}
