"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addCandidate } from "@/lib/actions/hr/candidates";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface AddCandidateDialogProps {
  jobOpeningId: string;
  sectorId: string;
}

export function AddCandidateDialog({
  jobOpeningId,
  sectorId,
}: AddCandidateDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => addCandidate(data),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Erro ao adicionar candidato"
        );
        return;
      }
      toast.success("Candidato adicionado");
      queryClient.invalidateQueries({ queryKey: ["hr-recruitment-board"] });
      queryClient.invalidateQueries({ queryKey: ["hr-job-openings"] });
      reset();
      setOpen(false);
    },
  });

  function reset() {
    setFullName("");
    setEmail("");
    setPhone("");
    setSource("");
    setLinkedinUrl("");
    setNotes("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      jobOpeningId,
      sectorId,
      fullName,
      email,
      phone,
      source,
      linkedinUrl,
      notes,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="h-4 w-4 mr-1" />
        Adicionar candidato
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Adicionar candidato</DialogTitle>
            <DialogDescription>
              O candidato entra no estágio &quot;Inscritos&quot; do pipeline.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="cand-name">Nome completo</Label>
              <Input
                id="cand-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cand-email">Email</Label>
                <Input
                  id="cand-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cand-phone">Telefone</Label>
                <Input
                  id="cand-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cand-source">Origem</Label>
                <Input
                  id="cand-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Ex: LinkedIn, indicação"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cand-linkedin">LinkedIn</Label>
                <Input
                  id="cand-linkedin"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cand-notes">Observações</Label>
              <Textarea
                id="cand-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
