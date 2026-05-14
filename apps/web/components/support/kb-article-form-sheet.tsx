"use client";

import { useState, useEffect } from "react";
import {
  useCreateKBArticle,
  useUpdateKBArticle,
} from "@/hooks/support/use-kb-articles";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Eye, Pencil } from "lucide-react";

interface KBArticleFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  article?: {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    is_published: boolean;
  };
  categories?: string[];
}

export function KBArticleFormSheet({
  open,
  onOpenChange,
  sectorId,
  article,
  categories = [],
}: KBArticleFormSheetProps) {
  const createMutation = useCreateKBArticle();
  const updateMutation = useUpdateKBArticle();
  const isEdit = !!article;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setContent(article.content);
      setCategory(article.category);
      setIsPublished(article.is_published);
    } else {
      setTitle("");
      setContent("");
      setCategory("");
      setIsPublished(false);
    }
    setPreviewMode(false);
  }, [article, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      sectorId,
      title,
      content,
      category: category || "Geral",
      tags: [],
    };

    const result = isEdit
      ? await updateMutation.mutateAsync({ id: article.id, data: payload })
      : await createMutation.mutateAsync(payload);

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : `Erro ao ${isEdit ? "atualizar" : "criar"} artigo`
      );
      return;
    }

    toast.success(isEdit ? "Artigo atualizado" : "Artigo criado");
    onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl flex flex-col overflow-hidden">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Editar Artigo" : "Novo Artigo"}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Atualize o conteudo do artigo"
              : "Crie um novo artigo para a base de conhecimento"}
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col gap-4 overflow-y-auto px-4 pb-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="kb-title">Titulo</Label>
            <Input
              id="kb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titulo do artigo"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="kb-category">Categoria</Label>
            <Input
              id="kb-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex: FAQ, Guias, Tutoriais"
              list="kb-category-suggestions"
            />
            {categories.length > 0 && (
              <datalist id="kb-category-suggestions">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label>Publicado</Label>
            <Switch
              checked={isPublished}
              onCheckedChange={setIsPublished}
            />
          </div>

          <div className="grid gap-2 flex-1">
            <div className="flex items-center justify-between">
              <Label>Conteudo</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPreviewMode(!previewMode)}
              >
                {previewMode ? (
                  <>
                    <Pencil className="size-4 mr-1" />
                    Editar
                  </>
                ) : (
                  <>
                    <Eye className="size-4 mr-1" />
                    Visualizar
                  </>
                )}
              </Button>
            </div>
            {previewMode ? (
              <div className="min-h-[200px] rounded-md border p-3 text-sm whitespace-pre-wrap leading-relaxed bg-muted/30">
                {content || "Nenhum conteudo para visualizar."}
              </div>
            ) : (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escreva o conteudo do artigo..."
                className="min-h-[200px] resize-none"
                required
              />
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !title || !content}>
              {isPending
                ? isEdit
                  ? "Salvando..."
                  : "Criando..."
                : isEdit
                  ? "Salvar"
                  : "Criar Artigo"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
