"use client";

import { useState } from "react";
import { useCreateLead } from "@/hooks/crm/use-leads";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAD_SOURCES, leadSourceLabel } from "@/lib/crm/lead-sources";
import { toast } from "sonner";

interface LeadCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
}

/** Manually add a lead to the inbox (for leads captured off-platform). */
export function LeadCreateDialog({
  open,
  onOpenChange,
  sectorId,
}: LeadCreateDialogProps) {
  const createLead = useCreateLead();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [source, setSource] = useState("manual");

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setSource("manual");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await createLead.mutateAsync({
      sectorId,
      name,
      email: email || undefined,
      phone: phone || undefined,
      company: company || undefined,
      source: source.trim() || "manual",
    });
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao criar lead"
      );
      return;
    }
    toast.success("Lead adicionado à caixa de entrada");
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo lead</DialogTitle>
            <DialogDescription>
              Adicione um lead manualmente. Ele será pontuado automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="lead-name">Nome</Label>
              <Input
                id="lead-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="lead-email">E-mail</Label>
                <Input
                  id="lead-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lead-phone">Telefone</Label>
                <Input
                  id="lead-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="lead-company">Empresa</Label>
                <Input
                  id="lead-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lead-source">Origem</Label>
                <Select
                  value={source}
                  onValueChange={(v) => setSource(v ?? "manual")}
                >
                  <SelectTrigger id="lead-source" className="w-full">
                    <SelectValue>
                      {(value: string | null) =>
                        value ? leadSourceLabel(value) : "Origem"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {leadSourceLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            <Button type="submit" disabled={createLead.isPending || !name}>
              {createLead.isPending ? "Salvando..." : "Adicionar lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
