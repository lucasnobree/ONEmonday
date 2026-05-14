"use client";

import { useState, useMemo } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useKBArticles } from "@/hooks/support/use-kb-articles";
import { PermissionGate } from "@/components/shared/permission-gate";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, FileText } from "lucide-react";
import { KBArticleSheet } from "@/components/support/kb-article-sheet";

export default function KnowledgeBasePage() {
  const { currentSector } = useCurrentSector();
  const { data: articles, isLoading } = useKBArticles(currentSector?.id);
  const [search, setSearch] = useState("");
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!articles) return [];
    if (!search.trim()) return articles;
    const q = search.toLowerCase();
    return articles.filter(
      (a: any) =>
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

  return (
    <PermissionGate
      sectorId={currentSector.id}
      resource="kb_article"
      action="read"
      fallback={
        <p className="text-muted-foreground">
          Voce nao tem permissao para acessar a Base de Conhecimento deste
          setor.
        </p>
      }
    >
      <div className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar artigos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
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
            {filtered.map((article: any) => (
              <Card key={article.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedArticleId(article.id)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-2">
                      {article.title}
                    </CardTitle>
                    <Badge
                      variant="secondary"
                      className={
                        article.status === "published"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : ""
                      }
                    >
                      {article.status === "published"
                        ? "Publicado"
                        : "Rascunho"}
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
                      {article.content}
                    </p>
                  )}
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
    </PermissionGate>
  );
}
