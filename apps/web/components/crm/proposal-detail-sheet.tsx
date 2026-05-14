"use client";

import { useState } from "react";
import {
  useProposalDetail,
  useUpdateProposalStatus,
  useDeleteProposal,
} from "@/hooks/crm/use-proposals";
import { ProposalFormDialog } from "./proposal-form-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Send, Check, X, Pencil, Trash2 } from "lucide-react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const dateFormat = new Intl.DateTimeFormat("pt-BR");

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  draft: {
    label: "Rascunho",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  sent: {
    label: "Enviada",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  viewed: {
    label: "Visualizada",
    className:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  },
  accepted: {
    label: "Aceita",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  rejected: {
    label: "Rejeitada",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  expired: {
    label: "Expirada",
    className:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
};

interface ProposalDetailSheetProps {
  proposalId: string | null;
  sectorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProposalDetailSheet({
  proposalId,
  sectorId,
  open,
  onOpenChange,
}: ProposalDetailSheetProps) {
  const { data: proposal, isLoading } = useProposalDetail(proposalId);
  const updateStatus = useUpdateProposalStatus();
  const deleteProposal = useDeleteProposal();
  const [showEdit, setShowEdit] = useState(false);

  const handleStatusChange = async (status: string) => {
    if (!proposalId) return;
    const result = await updateStatus.mutateAsync({ id: proposalId, status });
    if (result && "error" in result && result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao atualizar status"
      );
      return;
    }
    const label = statusConfig[status]?.label ?? status;
    toast.success(`Proposta marcada como ${label}`);
  };

  const handleDelete = async () => {
    if (!proposalId) return;
    const result = await deleteProposal.mutateAsync(proposalId);
    if (result && "error" in result && result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao excluir proposta"
      );
      return;
    }
    toast.success("Proposta excluida");
    onOpenChange(false);
  };

  const status = statusConfig[proposal?.status ?? ""] ?? {
    label: proposal?.status ?? "",
    className: "",
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4 p-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : !proposal ? (
            <div className="p-4 text-muted-foreground">
              Proposta nao encontrada.
            </div>
          ) : (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between gap-2">
                  <SheetTitle className="flex-1">{proposal.title}</SheetTitle>
                  <Badge variant="secondary" className={status.className}>
                    {status.label}
                  </Badge>
                </div>
                <SheetDescription>
                  <span className="text-lg font-semibold text-foreground">
                    {formatCurrency(proposal.value)}
                  </span>
                </SheetDescription>
              </SheetHeader>

              <div className="px-4 space-y-4 mt-4">
                {proposal.deal_title && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Deal</p>
                    <p className="text-sm font-medium">{proposal.deal_title}</p>
                  </div>
                )}

                {proposal.content && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Descricao</p>
                    <p className="text-sm whitespace-pre-wrap">
                      {proposal.content}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {proposal.sent_at && (
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        Enviada em
                      </p>
                      <p className="text-sm font-medium">
                        {dateFormat.format(new Date(proposal.sent_at))}
                      </p>
                    </div>
                  )}
                  {proposal.expires_at && (
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        Expira em
                      </p>
                      <p className="text-sm font-medium">
                        {dateFormat.format(new Date(proposal.expires_at))}
                      </p>
                    </div>
                  )}
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Criada em</p>
                    <p className="text-sm font-medium">
                      {dateFormat.format(new Date(proposal.created_at))}
                    </p>
                  </div>
                </div>

                <Separator />

                {proposal.items.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Itens</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted text-muted-foreground text-xs">
                            <th className="py-2 px-3 text-left font-medium">
                              Descricao
                            </th>
                            <th className="py-2 px-3 text-right font-medium">
                              Qtd
                            </th>
                            <th className="py-2 px-3 text-right font-medium">
                              Preco Unit.
                            </th>
                            <th className="py-2 px-3 text-right font-medium">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {proposal.items.map((item) => (
                            <tr key={item.id} className="border-t">
                              <td className="py-2 px-3">
                                {item.description}
                              </td>
                              <td className="py-2 px-3 text-right">
                                {item.quantity}
                              </td>
                              <td className="py-2 px-3 text-right">
                                {formatCurrency(item.unit_price)}
                              </td>
                              <td className="py-2 px-3 text-right font-medium">
                                {formatCurrency(
                                  item.quantity * item.unit_price
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t bg-muted/50">
                            <td
                              colSpan={3}
                              className="py-2 px-3 text-right font-medium"
                            >
                              Total
                            </td>
                            <td className="py-2 px-3 text-right font-bold">
                              {formatCurrency(proposal.value)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex flex-wrap gap-2">
                  {proposal.status === "draft" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleStatusChange("sent")}
                        disabled={updateStatus.isPending}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Enviar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowEdit(true)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={deleteProposal.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Excluir
                      </Button>
                    </>
                  )}
                  {(proposal.status === "sent" ||
                    proposal.status === "viewed") && (
                    <>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleStatusChange("accepted")}
                        disabled={updateStatus.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Aceitar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleStatusChange("rejected")}
                        disabled={updateStatus.isPending}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Rejeitar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {proposal && (
        <ProposalFormDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          sectorId={sectorId}
          proposal={proposal}
        />
      )}
    </>
  );
}
