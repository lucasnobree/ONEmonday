"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { moveCandidate, addCandidateNote } from "@/lib/actions/hr/candidates";
import {
  useCandidateNotes,
  STAGE_LABELS,
  type RecruitmentCandidate,
} from "@/hooks/hr/use-recruitment-detail";
import { CANDIDATE_STAGES } from "@/lib/validations/hr";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Link2, Building2, Star } from "lucide-react";
import { toast } from "sonner";

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

interface CandidateDetailSheetProps {
  candidate: RecruitmentCandidate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CandidateDetailSheet({
  candidate,
  open,
  onOpenChange,
}: CandidateDetailSheetProps) {
  const queryClient = useQueryClient();
  const { data: notes } = useCandidateNotes(open ? (candidate?.id ?? null) : null);
  const [noteBody, setNoteBody] = useState("");
  const [noteRating, setNoteRating] = useState<string>("none");

  const moveMutation = useMutation({
    mutationFn: (stage: string) =>
      moveCandidate({ candidateId: candidate?.id, stage }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Erro ao mover candidato"
        );
        return;
      }
      toast.success("Estágio atualizado");
      queryClient.invalidateQueries({ queryKey: ["hr-recruitment-board"] });
    },
  });

  const noteMutation = useMutation({
    mutationFn: () =>
      addCandidateNote({
        candidateId: candidate?.id,
        body: noteBody,
        rating: noteRating === "none" ? undefined : Number(noteRating),
      }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Erro ao salvar avaliação"
        );
        return;
      }
      toast.success("Avaliação registrada");
      queryClient.invalidateQueries({ queryKey: ["hr-candidate-notes"] });
      setNoteBody("");
      setNoteRating("none");
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{candidate?.full_name ?? "Candidato"}</SheetTitle>
          <SheetDescription>
            {candidate?.current_position
              ? `${candidate.current_position}${
                  candidate.current_company
                    ? ` · ${candidate.current_company}`
                    : ""
                }`
              : "Detalhes do candidato"}
          </SheetDescription>
        </SheetHeader>

        {candidate && (
          <div className="px-4 pb-6 space-y-5">
            <div className="space-y-2 text-sm">
              {candidate.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{candidate.email}</span>
                </div>
              )}
              {candidate.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{candidate.phone}</span>
                </div>
              )}
              {candidate.linkedin_url && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Link2 className="h-4 w-4" />
                  <a
                    href={candidate.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline truncate"
                  >
                    {candidate.linkedin_url}
                  </a>
                </div>
              )}
              {candidate.source && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>Origem: {candidate.source}</span>
                </div>
              )}
              {candidate.expected_salary != null && (
                <p className="text-muted-foreground">
                  Pretensão salarial:{" "}
                  {candidate.expected_salary.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
              )}
              {candidate.notes && (
                <p className="text-muted-foreground">{candidate.notes}</p>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Estágio no pipeline</Label>
              <Select
                value={candidate.stage}
                onValueChange={(v) => v && moveMutation.mutate(v)}
              >
                <SelectTrigger className="w-full" disabled={moveMutation.isPending}>
                  <SelectValue>
                    {(value) =>
                      STAGE_LABELS[value as string] ?? (value as string)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CANDIDATE_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STAGE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Avaliações da entrevista</Label>
              <div className="space-y-2">
                <Textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Registre suas impressões sobre o candidato"
                />
                <div className="flex items-center gap-2">
                  <Select value={noteRating} onValueChange={(v) => setNoteRating(v ?? "none")}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue>
                        {(value) =>
                          value === "none" ? "Sem nota" : `Nota ${value}`
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem nota</SelectItem>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          Nota {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => noteMutation.mutate()}
                    disabled={noteMutation.isPending || !noteBody.trim()}
                  >
                    {noteMutation.isPending ? "Salvando..." : "Adicionar"}
                  </Button>
                </div>
              </div>

              {notes && notes.length > 0 ? (
                <div className="space-y-2">
                  {notes.map((note) => (
                    <div key={note.id} className="rounded-md border p-2.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          {dateTimeFormat.format(new Date(note.created_at))}
                        </span>
                        {note.rating != null && (
                          <Badge
                            variant="secondary"
                            className="flex items-center gap-0.5"
                          >
                            <Star className="h-3 w-3 fill-current text-amber-500" />
                            {note.rating}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">{note.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nenhuma avaliação registrada.
                </p>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
