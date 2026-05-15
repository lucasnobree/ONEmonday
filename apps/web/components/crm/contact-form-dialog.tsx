"use client";

import { useState } from "react";
import { useCreateContact, useUpdateContact } from "@/hooks/crm/use-contacts";
import { useCompanies } from "@/hooks/crm/use-companies";
import type { Contact } from "@/hooks/crm/use-contacts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  contact?: Contact;
}

export function ContactFormDialog({
  open,
  onOpenChange,
  sectorId,
  contact,
}: ContactFormDialogProps) {
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const { data: companies } = useCompanies(sectorId);
  const isEdit = !!contact;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState("");

  // Re-seed form fields when the dialog (re)opens, by adjusting state during
  // render — the React-recommended alternative to a syncing effect.
  const formKey = `${open}:${contact?.id ?? "new"}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setFullName(contact?.full_name ?? "");
    setEmail(contact?.email ?? "");
    setPhone(contact?.phone ?? "");
    setPosition(contact?.position ?? "");
    setCompanyId(contact?.company_id ?? "");
    setIsPrimary(contact?.is_primary ?? false);
    setNotes(contact?.notes ?? "");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      sectorId,
      fullName,
      email: email || undefined,
      phone: phone || undefined,
      position: position || undefined,
      companyId: companyId || undefined,
      isPrimary,
      notes: notes || undefined,
      ...(isEdit ? { id: contact.id } : {}),
    };

    const result = isEdit
      ? await updateContact.mutateAsync(payload)
      : await createContact.mutateAsync(payload);

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : `Erro ao ${isEdit ? "atualizar" : "criar"} contato`
      );
      return;
    }

    toast.success(isEdit ? "Contato atualizado" : "Contato criado");
    onOpenChange(false);
  };

  const isPending = createContact.isPending || updateContact.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar Contato" : "Novo Contato"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Atualize os dados do contato"
                : "Cadastre um novo contato no CRM"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="contact-name">Nome completo</Label>
              <Input
                id="contact-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nome do contato"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="contact-phone">Telefone</Label>
                <Input
                  id="contact-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contact-position">Cargo</Label>
                <Input
                  id="contact-position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="Diretor, Gerente, etc."
                />
              </div>

              <div className="grid gap-2">
                <Label>Empresa</Label>
                <Select value={companyId} onValueChange={(v) => setCompanyId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    {(companies || []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="contact-primary">Contato principal</Label>
              <Switch
                checked={isPrimary}
                onCheckedChange={setIsPrimary}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="contact-notes">Observacoes</Label>
              <Textarea
                id="contact-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas sobre o contato"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !fullName}>
              {isPending
                ? isEdit
                  ? "Salvando..."
                  : "Criando..."
                : isEdit
                  ? "Salvar"
                  : "Criar Contato"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
