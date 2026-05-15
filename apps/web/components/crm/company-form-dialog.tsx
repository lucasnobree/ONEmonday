"use client";

import { useState } from "react";
import { useCreateCompany, useUpdateCompany } from "@/hooks/crm/use-companies";
import type { Company } from "@/hooks/crm/use-companies";
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
import { toast } from "sonner";

interface CompanyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  company?: Company;
}

export function CompanyFormDialog({
  open,
  onOpenChange,
  sectorId,
  company,
}: CompanyFormDialogProps) {
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const isEdit = !!company;

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [notes, setNotes] = useState("");

  // Re-seed form fields when the dialog (re)opens, by adjusting state during
  // render — the React-recommended alternative to a syncing effect.
  const formKey = `${open}:${company?.id ?? "new"}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setName(company?.name ?? "");
    setDomain(company?.domain ?? "");
    setIndustry(company?.industry ?? "");
    setSize(company?.size ?? "");
    setPhone(company?.phone ?? "");
    setEmail(company?.email ?? "");
    setCity(company?.city ?? "");
    setState(company?.state ?? "");
    setNotes(company?.notes ?? "");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      sectorId,
      name,
      domain: domain || undefined,
      industry: industry || undefined,
      size: size || undefined,
      phone: phone || undefined,
      email: email || undefined,
      city: city || undefined,
      state: state || undefined,
      notes: notes || undefined,
      ...(isEdit ? { id: company.id } : {}),
    };

    const result = isEdit
      ? await updateCompany.mutateAsync(payload)
      : await createCompany.mutateAsync(payload);

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : `Erro ao ${isEdit ? "atualizar" : "criar"} empresa`
      );
      return;
    }

    toast.success(isEdit ? "Empresa atualizada" : "Empresa criada");
    onOpenChange(false);
  };

  const isPending = createCompany.isPending || updateCompany.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar Empresa" : "Nova Empresa"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Atualize os dados da empresa"
                : "Cadastre uma nova empresa no CRM"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="company-name">Nome</Label>
              <Input
                id="company-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome da empresa"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="company-domain">Dominio</Label>
                <Input
                  id="company-domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="empresa.com.br"
                />
              </div>

              <div className="grid gap-2">
                <Label>Porte</Label>
                <Select value={size} onValueChange={(v) => setSize(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="micro">Micro</SelectItem>
                    <SelectItem value="small">Pequena</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="large">Grande</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="company-industry">Setor/Industria</Label>
              <Input
                id="company-industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Tecnologia, Saude, etc."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="company-phone">Telefone</Label>
                <Input
                  id="company-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="company-email">Email</Label>
                <Input
                  id="company-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contato@empresa.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="company-city">Cidade</Label>
                <Input
                  id="company-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Sao Paulo"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="company-state">Estado</Label>
                <Input
                  id="company-state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="company-notes">Observacoes</Label>
              <Textarea
                id="company-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas sobre a empresa"
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
            <Button type="submit" disabled={isPending || !name}>
              {isPending
                ? isEdit
                  ? "Salvando..."
                  : "Criando..."
                : isEdit
                  ? "Salvar"
                  : "Criar Empresa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
