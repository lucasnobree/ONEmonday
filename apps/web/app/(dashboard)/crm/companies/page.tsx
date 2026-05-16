"use client";

import { useState, useMemo } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useCompanies } from "@/hooks/crm/use-companies";
import { CompanyFormDialog } from "@/components/crm/company-form-dialog";
import { CompanyDetailSheet } from "@/components/crm/company-detail-sheet";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Globe, Users, MapPin, Building2, Download } from "lucide-react";
import { exportToCSV } from "@/lib/utils/export-csv";
import { EmptyState } from "@/components/shared/empty-state";

const sizeLabels: Record<string, string> = {
  micro: "Micro",
  small: "Pequena",
  medium: "Média",
  large: "Grande",
  enterprise: "Enterprise",
};

export default function CompaniesPage() {
  const { currentSector } = useCurrentSector();
  const { data: companies, isLoading } = useCompanies(currentSector?.id);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!companies) return [];
    if (!search.trim()) return companies;
    const q = search.toLowerCase();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q)
    );
  }, [companies, search]);

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar as empresas.
      </p>
    );
  }

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
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nova Empresa
          </Button>
        </div>
      </div>

      {!companies?.length && !search ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma empresa cadastrada"
          description="Adicione sua primeira empresa para começar a organizar seus clientes."
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Nova Empresa
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhuma empresa encontrada para a busca.
        </p>
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

      <CompanyFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        sectorId={currentSector.id}
      />

      <CompanyDetailSheet
        companyId={selectedCompanyId}
        open={!!selectedCompanyId}
        onOpenChange={(o) => !o && setSelectedCompanyId(null)}
      />
    </div>
  );
}
