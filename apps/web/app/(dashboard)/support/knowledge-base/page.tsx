"use client";

import { useState, useMemo } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import {
  useKBArticles,
  useDeleteKBArticle,
  useToggleKBArticlePublished,
} from "@/hooks/support/use-kb-articles";
import type {
  PublishedFilter,
  KBArticle,
} from "@/hooks/support/use-kb-articles";
import { PermissionGate } from "@/components/shared/permission-gate";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { KBArticleSheet } from "@/components/support/kb-article-sheet";
import {
  KBArticleFormSheet,
  type KBArticleFormValues,
} from "@/components/support/kb-article-form-sheet";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Search, FileText, Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { stripMarkdown } from "@/lib/support/markdown";

const filterTabs: { label: string; value: PublishedFilter }[] = [
  { label: "Todos", value: "all" },
  { label: "Publicados", value: "published" },
  { label: "Rascunhos", value: "draft" },
];

export default function KnowledgeBasePage() {
  const { currentSector } = useCurrentSector();
  const [publishedFilter, setPublishedFilter] =
    useState<PublishedFilter>("all");
  const { data: articles, isLoading } = useKBArticles(
    currentSector?.id,
    publishedFilter
  );
  const deleteMutation = useDeleteKBArticle();
  const togglePublishMutation = useToggleKBArticlePublished();
  const [search, setSearch] = useState("");
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
    null
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<
    KBArticleFormValues | undefined
  >(undefined);

  const categories = useMemo(() => {
    if (!articles) return [];
    const cats = new Set(
      articles.map((a) => a.category).filter(Boolean)
    );
    return Array.from(cats) as string[];
  }, [articles]);

  const filtered = useMemo(() => {
    if (!articles) return [];
    if (!search.trim()) return articles;
    const q = search.toLowerCase();
    return articles.filter(
      (a) =>
        a.title?.toLowerCase().includes(q) ||
        a.category?.toLowerCase().includes(q) ||
        a.content?.toLowerCase().includes(q)
    );
  }, [articles, search]);

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar a Base de Conhecimento.
      </p>
    );
  }

  function handleCreate() {
    setEditingArticle(undefined);
    setFormOpen(true);
  }

  function handleEdit(article: KBArticle) {
    setEditingArticle({
      id: article.id,
      title: article.title,
      content: article.content,
      category: article.category,
      tags: article.tags ?? [],
      is_published: article.is_published,
    });
    setFormOpen(true);
  }

  async function handleDelete(id: string) {
    const result = await deleteMutation.mutateAsync(id);
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao excluir artigo"
      );
      return;
    }
    toast.success("Artigo excluído");
  }

  async function handleTogglePublish(id: string) {
    const result = await togglePublishMutation.mutateAsync(id);
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao alterar publicação"
      );
      return;
    }
    const published = "is_published" in result && result.is_published;
    toast.success(published ? "Artigo publicado" : "Artigo despublicado");
  }

  return (
    <PermissionGate
      sectorId={currentSector.id}
      resource="kb_article"
      action="read"
      fallback={
        <p className="text-muted-foreground">
          Você não tem permissão para acessar a Base de Conhecimento deste
          setor.
        </p>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex h-8 items-center justify-center rounded-lg bg-muted p-0.75 text-muted-foreground">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setPublishedFilter(tab.value)}
                className={`inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-all ${
                  publishedFilter === tab.value
                    ? "bg-background text-foreground shadow-sm"
                    : "hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar artigos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="ml-auto">
            <Button size="sm" onClick={handleCreate}>
              <Plus className="size-4 mr-1" />
              Novo Artigo
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-lg" />
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="py-16 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {search
                ? "Nenhum artigo encontrado para a busca."
                : "Nenhum artigo cadastrado ainda."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((article) => (
              <Card
                key={article.id}
                className="hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => setSelectedArticleId(article.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-2">
                      {article.title}
                    </CardTitle>
                    <Badge
                      variant="secondary"
                      className={
                        article.is_published
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : ""
                      }
                    >
                      {article.is_published ? "Publicado" : "Rascunho"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {article.category || "Sem categoria"}
                    </Badge>
                    <span>
                      {new Date(article.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  {article.content && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {stripMarkdown(article.content)}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(article);
                      }}
                      title="Editar"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePublish(article.id);
                      }}
                      title={
                        article.is_published ? "Despublicar" : "Publicar"
                      }
                    >
                      {article.is_published ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </Button>
                    {/* span stops the click bubbling to the card's
                        open-detail handler */}
                    <span onClick={(e) => e.stopPropagation()}>
                      <ConfirmDialog
                        title="Excluir artigo"
                        description={`O artigo "${article.title}" será removido permanentemente. Esta ação não pode ser desfeita.`}
                        onConfirm={() => handleDelete(article.id)}
                      >
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Excluir"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </ConfirmDialog>
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <KBArticleSheet
        articleId={selectedArticleId}
        open={!!selectedArticleId}
        onOpenChange={(o) => !o && setSelectedArticleId(null)}
      />

      <KBArticleFormSheet
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditingArticle(undefined);
        }}
        sectorId={currentSector.id}
        article={editingArticle}
        categories={categories}
      />
    </PermissionGate>
  );
}
