"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, User } from "lucide-react";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

interface KBArticleSheetProps {
  articleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KBArticleSheet({
  articleId,
  open,
  onOpenChange,
}: KBArticleSheetProps) {
  const supabase = createClient();

  const { data: article, isLoading } = useQuery({
    queryKey: ["kb-article-detail", articleId],
    queryFn: async () => {
      if (!articleId) return null;
      const { data, error } = await supabase
        .from("kb_articles")
        .select("*, users(full_name)")
        .eq("id", articleId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!articleId,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !article ? (
          <div className="p-4 text-muted-foreground">
            Artigo nao encontrado.
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="leading-snug pr-6">
                {article.title}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Detalhes do artigo da base de conhecimento
              </SheetDescription>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="secondary"
                  className={
                    article.status === "published"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : ""
                  }
                >
                  {article.status === "published" ? "Publicado" : "Rascunho"}
                </Badge>
                {article.category && (
                  <Badge variant="outline">{article.category}</Badge>
                )}
              </div>
            </SheetHeader>

            <div className="px-4 space-y-4">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {(article as any).users?.full_name ?? "Autor desconhecido"}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {dateFormat.format(new Date(article.created_at))}
                </span>
              </div>

              <Separator />

              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {article.content}
                </div>
              </div>

              {article.tags && article.tags.length > 0 && (
                <>
                  <Separator />
                  <div className="flex flex-wrap gap-1.5">
                    {article.tags.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
