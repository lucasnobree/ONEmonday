"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Contract } from "@/hooks/legal/use-contracts";
import { useMatters } from "@/hooks/legal/use-matters";
import { useSectorMembers } from "@/hooks/legal/use-sector-members";
import {
  useContractDocuments,
  type ContractDocument,
} from "@/hooks/legal/use-contract-documents";
import {
  useContractClauses,
  type ContractClauseLink,
} from "@/hooks/legal/use-contract-clauses";
import {
  deleteContractDocument,
  getContractDocumentUrl,
} from "@/lib/actions/legal/documents";
import { unlinkClauseFromContract } from "@/lib/actions/legal/contract-clauses";
import { ContractFormDialog } from "./contract-form-dialog";
import { ContractDocumentUpload } from "./contract-document-upload";
import { ClausePicker } from "./clause-picker";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  RENEWAL_STATUS_LABELS,
  RENEWAL_TYPE_LABELS,
  CLAUSE_CATEGORY_LABELS,
  MATTER_STATUS_LABELS,
  formatCurrency,
  formatFileSize,
} from "@/lib/legal/labels";
import { getRenewalStatus, noticeDeadline } from "@/lib/legal/renewal";
import { FileText, Download, Trash2, Pencil, ScrollText } from "lucide-react";
import { toast } from "sonner";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

interface ContractDetailSheetProps {
  contract: Contract | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** A labelled read-only field row. */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

/**
 * Read-only contract record view. Replaces the "click row -> edit dialog" flow
 * with a proper detail surface: contract metadata, attached documents, linked
 * library clauses and related matters. "Editar" is a deliberate action.
 */
export function ContractDetailSheet({
  contract,
  open,
  onOpenChange,
}: ContractDetailSheetProps) {
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);

  const { data: documents } = useContractDocuments(contract?.id);
  const { data: links } = useContractClauses(contract?.id);
  const { data: matters } = useMatters(contract?.sector_id);
  const { data: members } = useSectorMembers(contract?.sector_id);

  if (!contract) return null;

  const statusInfo = CONTRACT_STATUS_LABELS[contract.status] ?? {
    label: contract.status,
    variant: "secondary" as const,
  };
  const renewalStatus = getRenewalStatus(
    contract.expiry_date,
    contract.notice_period_days
  );
  const renewalInfo = RENEWAL_STATUS_LABELS[renewalStatus];
  const ownerName = contract.owner_id
    ? ((members ?? []).find((m) => m.id === contract.owner_id)?.full_name ??
      "-")
    : "-";
  const deadline = noticeDeadline(
    contract.expiry_date,
    contract.notice_period_days
  );
  const relatedMatters = (matters ?? []).filter(
    (m) => m.contract_id === contract.id
  );

  async function handleDownload(doc: ContractDocument) {
    const result = await getContractDocumentUrl(doc.id);
    if (result && "error" in result && result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao abrir documento"
      );
      return;
    }
    if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function handleDeleteDoc(doc: ContractDocument) {
    const result = await deleteContractDocument(doc.id);
    if (result && "error" in result && result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao excluir documento"
      );
      return;
    }
    toast.success("Documento excluído");
    queryClient.invalidateQueries({
      queryKey: ["legal-contract-documents", contract!.id],
    });
  }

  async function handleUnlinkClause(link: ContractClauseLink) {
    const result = await unlinkClauseFromContract(link.id);
    if (result && "error" in result && result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao desvincular cláusula"
      );
      return;
    }
    toast.success("Cláusula desvinculada");
    queryClient.invalidateQueries({
      queryKey: ["legal-contract-clauses", contract!.id],
    });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle>{contract.title}</SheetTitle>
                <SheetDescription>{contract.counterparty}</SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              <Badge variant={renewalInfo.variant}>{renewalInfo.label}</Badge>
            </div>
            <div className="pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowEdit(true)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Button>
            </div>
          </SheetHeader>

          <Tabs defaultValue="info" className="px-4">
            <TabsList variant="line" className="w-full justify-start">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="docs">
                Documentos ({documents?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="clauses">
                Cláusulas ({links?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="matters">
                Demandas ({relatedMatters.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Tipo"
                  value={
                    CONTRACT_TYPE_LABELS[contract.contract_type] ??
                    contract.contract_type
                  }
                />
                <Field
                  label="Responsável"
                  value={ownerName}
                />
                <Field
                  label="Valor"
                  value={formatCurrency(
                    contract.value_amount,
                    contract.currency
                  )}
                />
                <Field
                  label="Renovação"
                  value={
                    RENEWAL_TYPE_LABELS[contract.renewal_type] ??
                    contract.renewal_type
                  }
                />
                <Field
                  label="Data de início"
                  value={
                    contract.effective_date
                      ? dateFormat.format(new Date(contract.effective_date))
                      : "-"
                  }
                />
                <Field
                  label="Data de término"
                  value={
                    contract.expiry_date
                      ? dateFormat.format(new Date(contract.expiry_date))
                      : "-"
                  }
                />
                <Field
                  label="Aviso prévio"
                  value={`${contract.notice_period_days} dia(s)`}
                />
                <Field
                  label="Prazo de decisão"
                  value={
                    deadline ? dateFormat.format(new Date(deadline)) : "-"
                  }
                />
              </div>

              {contract.description && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">Observações</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {contract.description}
                    </p>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="docs" className="mt-4 space-y-3">
              <ContractDocumentUpload
                contractId={contract.id}
                sectorId={contract.sector_id}
              />
              {(documents ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum documento anexado.
                </p>
              ) : (
                <div className="space-y-2">
                  {(documents ?? []).map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-2 border rounded-lg p-2.5"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {doc.file_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.file_size)} -{" "}
                          {dateFormat.format(new Date(doc.created_at))}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Baixar documento"
                        onClick={() => handleDownload(doc)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <ConfirmDialog
                        title="Excluir documento?"
                        description={`O arquivo "${doc.file_name}" será removido permanentemente.`}
                        onConfirm={() => handleDeleteDoc(doc)}
                      >
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Excluir documento"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </ConfirmDialog>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="clauses" className="mt-4 space-y-3">
              <div className="flex justify-end">
                <ClausePicker
                  contractId={contract.id}
                  sectorId={contract.sector_id}
                  linkedClauseIds={(links ?? []).map((l) => l.clause_id)}
                />
              </div>
              {(links ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma cláusula vinculada a este contrato.
                </p>
              ) : (
                <div className="space-y-2">
                  {(links ?? []).map((link) => (
                    <div
                      key={link.id}
                      className="border rounded-lg p-3 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <ScrollText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">
                            {link.clause?.title ?? "Cláusula removida"}
                          </span>
                        </div>
                        <ConfirmDialog
                          title="Desvincular cláusula?"
                          description="A cláusula continuará na biblioteca, apenas o vínculo com este contrato será removido."
                          onConfirm={() => handleUnlinkClause(link)}
                        >
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Desvincular cláusula"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </ConfirmDialog>
                      </div>
                      {link.clause && (
                        <>
                          <Badge variant="outline" className="text-xs">
                            {CLAUSE_CATEGORY_LABELS[link.clause.category] ??
                              link.clause.category}
                          </Badge>
                          <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                            {link.clause.body}
                          </p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="matters" className="mt-4">
              {relatedMatters.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma demanda relacionada a este contrato.
                </p>
              ) : (
                <div className="space-y-2">
                  {relatedMatters.map((matter) => {
                    const info = MATTER_STATUS_LABELS[matter.status] ?? {
                      label: matter.status,
                      variant: "secondary" as const,
                    };
                    return (
                      <div
                        key={matter.id}
                        className="flex items-center justify-between gap-2 border rounded-lg p-2.5"
                      >
                        <span className="text-sm font-medium truncate">
                          {matter.title}
                        </span>
                        <Badge variant={info.variant} className="shrink-0">
                          {info.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <ContractFormDialog
        key={contract.id}
        contract={contract}
        open={showEdit}
        onOpenChange={setShowEdit}
        hideTrigger
      />
    </>
  );
}
