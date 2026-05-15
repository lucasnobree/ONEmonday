"use client";

import { useCompanyDetail } from "@/hooks/crm/use-company-detail";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Globe,
  MapPin,
  Phone,
  Mail,
  Star,
} from "lucide-react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const dateFormat = new Intl.DateTimeFormat("pt-BR");

const sizeLabels: Record<string, string> = {
  micro: "Micro",
  small: "Pequena",
  medium: "Media",
  large: "Grande",
  enterprise: "Enterprise",
};

interface CompanyDetailSheetProps {
  companyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompanyDetailSheet({
  companyId,
  open,
  onOpenChange,
}: CompanyDetailSheetProps) {
  const { data: company, isLoading } = useCompanyDetail(companyId);

  const openDeals = company?.deals.filter((d) => !d.actual_close_date) ?? [];
  const totalPipelineValue = openDeals.reduce(
    (sum, d) => sum + (d.value ?? 0),
    0
  );
  const wonDeals = company?.deals.filter(
    (d) => d.actual_close_date && !d.lost_reason
  ) ?? [];
  const totalWonValue = wonDeals.reduce(
    (sum, d) => sum + (d.value ?? 0),
    0
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !company ? (
          <div className="p-4 text-muted-foreground">
            Empresa nao encontrada.
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <SheetTitle>{company.name}</SheetTitle>
                  <SheetDescription>
                    {[company.industry, company.size && sizeLabels[company.size]]
                      .filter(Boolean)
                      .join(" · ")}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <Tabs defaultValue="info" className="px-4">
              <TabsList variant="line" className="w-full justify-start">
                <TabsTrigger value="info">Informacoes</TabsTrigger>
                <TabsTrigger value="contatos">
                  Contatos ({company.contacts.length})
                </TabsTrigger>
                <TabsTrigger value="deals">
                  Deals ({company.deals.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Pipeline aberto
                    </p>
                    <p className="text-sm font-semibold">
                      {formatCurrency(totalPipelineValue)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {openDeals.length} deals
                    </p>
                  </div>
                  <div className="rounded-lg border p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Receita ganha
                    </p>
                    <p className="text-sm font-semibold text-green-600">
                      {formatCurrency(totalWonValue)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {wonDeals.length} deals
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3 text-sm">
                  {company.domain && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe className="h-4 w-4 shrink-0" />
                      <span>{company.domain}</span>
                    </div>
                  )}
                  {company.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4 shrink-0" />
                      <span>{company.email}</span>
                    </div>
                  )}
                  {company.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4 shrink-0" />
                      <span>{company.phone}</span>
                    </div>
                  )}
                  {(company.city || company.state) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span>
                        {[company.city, company.state]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                  {company.size && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span>Porte: {sizeLabels[company.size] ?? company.size}</span>
                    </div>
                  )}
                </div>

                {company.notes && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Notas</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {company.notes}
                      </p>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="contatos" className="mt-4">
                {company.contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Nenhum contato vinculado a esta empresa.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {company.contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="border rounded-lg p-3 space-y-1"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                            {contact.full_name
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium flex items-center gap-1.5">
                              {contact.full_name}
                              {contact.is_primary && (
                                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                              )}
                            </p>
                            {contact.position && (
                              <p className="text-xs text-muted-foreground">
                                {contact.position}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground pl-9">
                          {contact.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </span>
                          )}
                          {contact.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {contact.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="deals" className="mt-4">
                {company.deals.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Nenhum deal vinculado a esta empresa.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {company.deals.map((deal) => {
                      const isClosed = deal.actual_close_date != null;
                      const isWon = isClosed && !deal.lost_reason;
                      const isLost = isClosed && !!deal.lost_reason;

                      return (
                        <div
                          key={deal.id}
                          className="border rounded-lg p-3 space-y-1"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">
                              {deal.card?.title}
                            </p>
                            {deal.column && (
                              <Badge
                                variant="secondary"
                                style={{
                                  backgroundColor: deal.column.color + "20",
                                  color: deal.column.color,
                                }}
                              >
                                {deal.column.name}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            {deal.value != null && (
                              <span className="font-semibold">
                                {formatCurrency(deal.value)}
                              </span>
                            )}
                            {deal.win_probability != null && (
                              <span className="text-muted-foreground">
                                {deal.win_probability}%
                              </span>
                            )}
                            {isWon && (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                Ganho
                              </Badge>
                            )}
                            {isLost && (
                              <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                Perdido
                              </Badge>
                            )}
                          </div>
                          {deal.expected_close_date && !isClosed && (
                            <p className="text-xs text-muted-foreground">
                              Previsao:{" "}
                              {dateFormat.format(
                                new Date(deal.expected_close_date)
                              )}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
