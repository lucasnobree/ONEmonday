"use client";

import { useState } from "react";
import { useEnrollInSequence } from "@/hooks/marketing/use-sequences";
import type { Sequence } from "@/hooks/marketing/use-sequences";
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
import { toast } from "sonner";

interface SequenceEnrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sequence: Sequence | undefined;
}

export function SequenceEnrollDialog({
  open,
  onOpenChange,
  sequence,
}: SequenceEnrollDialogProps) {
  const enroll = useEnrollInSequence();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const formKey = `${open}:${sequence?.id ?? "none"}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setEmail("");
    setName("");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sequence) return;

    const result = await enroll.mutateAsync({
      sequenceId: sequence.id,
      recipientEmail: email,
      recipientName: name || undefined,
    });

    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao inscrever"
      );
      return;
    }

    toast.success("Destinatário inscrito na sequência");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Inscrever na sequência</DialogTitle>
            <DialogDescription>
              {sequence
                ? `Inscrição manual em "${sequence.name}".`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="enroll-email">E-mail</Label>
              <Input
                id="enroll-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="lead@exemplo.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="enroll-name">Nome (opcional)</Label>
              <Input
                id="enroll-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
            <Button type="submit" disabled={enroll.isPending || !email}>
              {enroll.isPending ? "Inscrevendo..." : "Inscrever"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
