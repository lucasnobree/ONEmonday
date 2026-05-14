"use client";

import { useState } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { PermissionGate } from "@/components/shared/permission-gate";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { MessageSquareText, Copy, Check } from "lucide-react";

function useCannedResponses(sectorId: string | undefined) {
  return useQuery({
    queryKey: ["canned-responses", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from("canned_responses")
        .select("*")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("title", { ascending: true });
      return data || [];
    },
    enabled: !!sectorId,
  });
}

export default function CannedResponsesPage() {
  const { currentSector } = useCurrentSector();
  const { data: responses, isLoading } = useCannedResponses(
    currentSector?.id
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleCopy(content: string, id: string) {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success("Copiado para a area de transferencia");
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar as Respostas Prontas.
      </p>
    );
  }

  return (
    <PermissionGate
      sectorId={currentSector.id}
      resource="canned_response"
      action="read"
      fallback={
        <p className="text-muted-foreground">
          Voce nao tem permissao para acessar as Respostas Prontas deste setor.
        </p>
      }
    >
      <div className="space-y-4">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-lg" />
            ))}
          </div>
        ) : !responses?.length ? (
          <div className="py-16 text-center">
            <MessageSquareText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhuma resposta pronta cadastrada ainda.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {responses.map((response: any) => (
              <Card
                key={response.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() =>
                  setExpandedId(
                    expandedId === response.id ? null : response.id
                  )
                }
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      {response.title}
                    </CardTitle>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {response.shortcut && (
                        <Badge variant="outline" className="text-xs font-mono">
                          /{response.shortcut}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(response.content, response.id);
                        }}
                        title="Copiar conteudo"
                      >
                        {copiedId === response.id ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {response.category && (
                    <Badge variant="secondary" className="mb-2 text-xs">
                      {response.category}
                    </Badge>
                  )}
                  <p
                    className={`text-sm text-muted-foreground whitespace-pre-wrap ${
                      expandedId === response.id ? "" : "line-clamp-3"
                    }`}
                  >
                    {response.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PermissionGate>
  );
}
