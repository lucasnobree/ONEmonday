"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Clause } from "@/hooks/legal/use-clauses";
import { ClauseFormDialog } from "./clause-form-dialog";
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
import { CLAUSE_CATEGORY_LABELS } from "@/lib/legal/labels";
import { ScrollText, Pencil, Copy, CheckCircle2 } from "lucide-react";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

interface ClauseDetailSheetProps {
  clause: Clause | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Read-only clause record view with a copy-to-clipboard action — the fastest
 * realistic use of the library when drafting. "Editar" is a deliberate action.
 */
export function ClauseDetailSheet({
  clause,
  open,
  onOpenChange,
}: ClauseDetailSheetProps) {
  const [showEdit, setShowEdit] = useState(false);

  if (!clause) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(clause!.body);
      toast.success("Texto da cláusula copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <ScrollText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle>{clause.title}</SheetTitle>
                <SheetDescription>
                  {CLAUSE_CATEGORY_LABELS[clause.category] ?? clause.category}
                </SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              {clause.is_approved ? (
                <Badge variant="default">
                  <CheckCircle2 className="size-3 mr-1" />
                  Aprovada
                </Badge>
              ) : (
                <Badge variant="outline">Rascunho</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowEdit(true)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Button>
              <Button size="sm" variant="outline" onClick={handleCopy}>
                <Copy className="h-4 w-4 mr-1" />
                Copiar texto
              </Button>
            </div>
          </SheetHeader>

          <div className="px-4 space-y-4">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Conteúdo</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {clause.body}
              </p>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">
              Criada em {dateFormat.format(new Date(clause.created_at))}
            </p>
          </div>
        </SheetContent>
      </Sheet>

      <ClauseFormDialog
        key={clause.id}
        clause={clause}
        open={showEdit}
        onOpenChange={setShowEdit}
        hideTrigger
      />
    </>
  );
}
