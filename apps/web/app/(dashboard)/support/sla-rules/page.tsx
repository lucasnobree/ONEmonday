"use client";

import { useCurrentSector } from "@/hooks/use-current-sector";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { PermissionGate } from "@/components/shared/permission-gate";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck } from "lucide-react";

const priorityLabels: Record<string, string> = {
  critical: "Critica",
  high: "Alta",
  medium: "Media",
  low: "Baixa",
};

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

function useSLARules(sectorId: string | undefined) {
  return useQuery({
    queryKey: ["sla-rules", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from("sla_rules")
        .select("*")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("priority", { ascending: true });
      return data || [];
    },
    enabled: !!sectorId,
  });
}

function formatHours(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remaining = hours % 24;
  if (remaining === 0) return `${days}d`;
  return `${days}d ${remaining}h`;
}

export default function SLARulesPage() {
  const { currentSector } = useCurrentSector();
  const { data: rules, isLoading } = useSLARules(currentSector?.id);

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar as Regras SLA.
      </p>
    );
  }

  return (
    <PermissionGate
      sectorId={currentSector.id}
      resource="sla_rule"
      action="read"
      fallback={
        <p className="text-muted-foreground">
          Voce nao tem permissao para acessar as Regras SLA deste setor.
        </p>
      }
    >
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Regras de SLA</CardTitle>
            <CardDescription>
              Tempos de resposta e resolucao configurados por prioridade
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !rules?.length ? (
              <div className="py-12 text-center">
                <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma regra SLA configurada ainda.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Nome</th>
                      <th className="pb-2 font-medium">Prioridade</th>
                      <th className="pb-2 font-medium">Categoria</th>
                      <th className="pb-2 font-medium">Tempo de Resposta</th>
                      <th className="pb-2 font-medium">Tempo de Resolucao</th>
                      <th className="pb-2 font-medium">Horario Comercial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule: any) => (
                      <tr
                        key={rule.id}
                        className="border-b last:border-0 hover:bg-muted/50"
                      >
                        <td className="py-3 pr-4 font-medium">{rule.name}</td>
                        <td className="py-3 pr-4">
                          <Badge
                            variant="secondary"
                            className={priorityColors[rule.priority] || ""}
                          >
                            {priorityLabels[rule.priority] || rule.priority}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {rule.category || "Todas"}
                        </td>
                        <td className="py-3 pr-4 font-mono text-muted-foreground">
                          {formatHours(rule.response_time_hours)}
                        </td>
                        <td className="py-3 pr-4 font-mono text-muted-foreground">
                          {formatHours(rule.resolve_time_hours)}
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              rule.business_hours_only ? "secondary" : "outline"
                            }
                          >
                            {rule.business_hours_only ? "Sim" : "Nao"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  );
}
