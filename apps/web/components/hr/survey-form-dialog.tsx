"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSurvey } from "@/lib/actions/hr/surveys";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface SurveyFormDialogProps {
  sectorId: string;
}

interface DraftQuestion {
  prompt: string;
  questionType: "score" | "enps" | "text";
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  score: "Escala 1-5",
  enps: "eNPS 0-10",
  text: "Comentário",
};

export function SurveyFormDialog({ sectorId }: SurveyFormDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [surveyType, setSurveyType] = useState<"climate" | "enps">("climate");
  const [questions, setQuestions] = useState<DraftQuestion[]>([
    { prompt: "", questionType: "score" },
  ]);

  const mutation = useMutation({
    mutationFn: () =>
      createSurvey({
        sectorId,
        title,
        description,
        surveyType,
        questions: questions.filter((q) => q.prompt.trim()),
      }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Erro ao criar pesquisa"
        );
        return;
      }
      toast.success("Pesquisa criada");
      queryClient.invalidateQueries({ queryKey: ["hr-surveys"] });
      reset();
      setOpen(false);
    },
  });

  function reset() {
    setTitle("");
    setDescription("");
    setSurveyType("climate");
    setQuestions([{ prompt: "", questionType: "score" }]);
  }

  function updateQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (questions.filter((q) => q.prompt.trim()).length === 0) {
      toast.error("Adicione ao menos uma pergunta");
      return;
    }
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="h-4 w-4 mr-1" />
        Nova pesquisa
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nova pesquisa de clima</DialogTitle>
            <DialogDescription>
              As respostas são anônimas. Configure as perguntas abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="survey-title">Título</Label>
              <Input
                id="survey-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Pesquisa de clima 2026.1"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select
                  value={surveyType}
                  onValueChange={(v) =>
                    setSurveyType((v as "climate" | "enps") ?? "climate")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value) =>
                        value === "enps" ? "eNPS" : "Clima geral"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="climate">Clima geral</SelectItem>
                    <SelectItem value="enps">eNPS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="survey-desc">Descrição</Label>
              <Textarea
                id="survey-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Perguntas</Label>
              {questions.map((q, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Input
                    value={q.prompt}
                    onChange={(e) =>
                      updateQuestion(index, { prompt: e.target.value })
                    }
                    placeholder={`Pergunta ${index + 1}`}
                  />
                  <Select
                    value={q.questionType}
                    onValueChange={(v) =>
                      updateQuestion(index, {
                        questionType: (v as DraftQuestion["questionType"]) ?? "score",
                      })
                    }
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue>
                        {(value) =>
                          QUESTION_TYPE_LABELS[value as string] ?? "Escala 1-5"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="score">Escala 1-5</SelectItem>
                      <SelectItem value="enps">eNPS 0-10</SelectItem>
                      <SelectItem value="text">Comentário</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setQuestions((prev) =>
                        prev.length > 1
                          ? prev.filter((_, i) => i !== index)
                          : prev
                      )
                    }
                    disabled={questions.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setQuestions((prev) => [
                    ...prev,
                    { prompt: "", questionType: "score" },
                  ])
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar pergunta
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Criando..." : "Criar pesquisa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
