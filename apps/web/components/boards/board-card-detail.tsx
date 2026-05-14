"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Tag,
  Users,
  CheckSquare,
  Paperclip,
  MessageSquare,
  Activity,
  Plus,
  ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useCardDetail } from "@/hooks/use-card-detail";
import { createComment } from "@/lib/actions/comments";
import {
  createChecklist,
  createChecklistItem,
  toggleChecklistItem,
} from "@/lib/actions/checklists";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserAvatarGroup } from "@/components/shared/user-avatar-group";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { FileUpload } from "@/components/shared/file-upload";
import { EscalateDialog } from "./escalate-dialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const refTypeLabels: Record<string, string> = {
  escalation: "Escalacao",
  related: "Relacionado",
  blocks: "Bloqueia",
  blocked_by: "Bloqueado por",
};

const refStatusLabels: Record<string, string> = {
  open: "Aberto",
  resolved: "Resolvido",
  dismissed: "Descartado",
};

const priorityLabels = {
  critical: "Critico",
  high: "Alta",
  medium: "Media",
  low: "Baixa",
};
const priorityColors = {
  critical: "text-red-500",
  high: "text-orange-500",
  medium: "text-blue-500",
  low: "text-slate-400",
};

interface BoardCardDetailProps {
  cardId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  sectorId: string;
}

export function BoardCardDetail({
  cardId,
  open,
  onOpenChange,
  boardId,
  sectorId,
}: BoardCardDetailProps) {
  const { data: card, isLoading } = useCardDetail(cardId);
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({});
  const [escalateOpen, setEscalateOpen] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["card-detail", cardId] });
    queryClient.invalidateQueries({ queryKey: ["board", boardId] });
  }

  async function handleAddComment() {
    if (!commentText.trim() || !cardId) return;
    const result = await createComment({
      cardId,
      content: commentText.trim(),
    });
    if (result.error) {
      toast.error("Erro ao comentar");
      return;
    }
    setCommentText("");
    invalidate();
  }

  async function handleAddChecklist() {
    if (!newChecklistTitle.trim() || !cardId) return;
    const result = await createChecklist({
      cardId,
      title: newChecklistTitle.trim(),
    });
    if (result.error) {
      toast.error("Erro ao criar checklist");
      return;
    }
    setNewChecklistTitle("");
    setAddingChecklist(false);
    invalidate();
  }

  async function handleAddChecklistItem(checklistId: string) {
    const text = newItemTexts[checklistId]?.trim();
    if (!text) return;
    const result = await createChecklistItem({ checklistId, content: text });
    if (result.error) {
      toast.error("Erro ao adicionar item");
      return;
    }
    setNewItemTexts((prev) => ({ ...prev, [checklistId]: "" }));
    invalidate();
  }

  async function handleToggleItem(itemId: string, isCompleted: boolean) {
    await toggleChecklistItem(itemId, isCompleted);
    invalidate();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-auto"
        showCloseButton={true}
      >
        <SheetTitle className="sr-only">Detalhes do card</SheetTitle>

        {isLoading || !card ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">{card.title}</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEscalateOpen(true)}
                >
                  <ArrowRightLeft className="h-4 w-4 mr-1" />
                  Escalar
                </Button>
              </div>
              <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span
                  className={cn(
                    "font-medium",
                    priorityColors[
                      card.priority as keyof typeof priorityColors
                    ]
                  )}
                >
                  {
                    priorityLabels[
                      card.priority as keyof typeof priorityLabels
                    ]
                  }
                </span>
                <span>em {(card as any).board_columns?.name}</span>
                {card.due_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(card.due_date).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            {card.description && (
              <div>
                <h3 className="text-sm font-medium mb-2">Descricao</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {card.description}
                </p>
              </div>
            )}

            {/* Assignees */}
            {(card as any).card_assignees?.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" /> Responsaveis
                </h3>
                <UserAvatarGroup
                  users={(card as any).card_assignees.map((a: any) => ({
                    user_id: a.user_id,
                    full_name: a.users?.full_name ?? "",
                    avatar_url: a.users?.avatar_url ?? null,
                  }))}
                  size="default"
                  max={8}
                />
              </div>
            )}

            {/* Tags */}
            {(card as any).card_tags?.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Tag className="h-4 w-4" /> Tags
                </h3>
                <div className="flex flex-wrap gap-1">
                  {(card as any).card_tags.map((t: any) => (
                    <Badge
                      key={t.tags?.id}
                      variant="secondary"
                      style={{
                        backgroundColor: t.tags?.color + "20",
                        color: t.tags?.color,
                      }}
                    >
                      {t.tags?.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Cross-references */}
            {(card as any).card_cross_references?.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" /> Referencias cruzadas
                </h3>
                <div className="space-y-2">
                  {(card as any).card_cross_references.map((ref: any) => (
                    <div
                      key={ref.id}
                      className="flex items-center justify-between rounded-md border p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {ref.cards?.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[10px]">
                            {refTypeLabels[ref.reference_type] ?? ref.reference_type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {ref.cards?.sectors?.name}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={ref.status === "open" ? "default" : "secondary"}
                        className="text-[10px] shrink-0 ml-2"
                      >
                        {refStatusLabels[ref.status] ?? ref.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Tabs */}
            <Tabs defaultValue={0}>
              <TabsList>
                <TabsTrigger value={0}>
                  <MessageSquare className="h-4 w-4 mr-1" /> Comentarios
                </TabsTrigger>
                <TabsTrigger value={1}>
                  <CheckSquare className="h-4 w-4 mr-1" /> Checklists
                </TabsTrigger>
                <TabsTrigger value={2}>
                  <Paperclip className="h-4 w-4 mr-1" /> Anexos
                </TabsTrigger>
                <TabsTrigger value={3}>
                  <Activity className="h-4 w-4 mr-1" /> Atividade
                </TabsTrigger>
              </TabsList>

              {/* Comments tab */}
              <TabsContent value={0} className="space-y-4 mt-4">
                <div className="flex gap-2">
                  <Textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Escreva um comentario..."
                    className="min-h-[80px]"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleAddComment}
                  disabled={!commentText.trim()}
                >
                  Comentar
                </Button>

                <div className="space-y-4 mt-4">
                  {(card as any).card_comments
                    ?.filter((c: any) => c.is_active)
                    .sort(
                      (a: any, b: any) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime()
                    )
                    .map((comment: any) => {
                      const initials =
                        comment.users?.full_name
                          ?.split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase() ?? "?";
                      return (
                        <div key={comment.id} className="flex gap-3">
                          <Avatar className="shrink-0">
                            <AvatarFallback>{initials}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {comment.users?.full_name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(
                                  new Date(comment.created_at),
                                  { addSuffix: true, locale: ptBR }
                                )}
                              </span>
                            </div>
                            <p className="text-sm mt-1 whitespace-pre-wrap">
                              {comment.content}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </TabsContent>

              {/* Checklists tab */}
              <TabsContent value={1} className="space-y-4 mt-4">
                {(card as any).card_checklists
                  ?.sort((a: any, b: any) => a.position - b.position)
                  .map((checklist: any) => {
                    const items =
                      checklist.checklist_items?.sort(
                        (a: any, b: any) => a.position - b.position
                      ) ?? [];
                    const completed = items.filter(
                      (i: any) => i.is_completed
                    ).length;

                    return (
                      <div key={checklist.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">
                            {checklist.title}
                          </h4>
                          <span className="text-xs text-muted-foreground">
                            {completed}/{items.length}
                          </span>
                        </div>
                        {items.length > 0 && (
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{
                                width: `${items.length ? (completed / items.length) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        )}
                        <div className="space-y-1">
                          {items.map((item: any) => (
                            <label
                              key={item.id}
                              className="flex items-center gap-2 text-sm cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={item.is_completed}
                                onChange={(e) =>
                                  handleToggleItem(item.id, e.target.checked)
                                }
                                className="rounded"
                              />
                              <span
                                className={cn(
                                  item.is_completed &&
                                    "line-through text-muted-foreground"
                                )}
                              >
                                {item.content}
                              </span>
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            value={newItemTexts[checklist.id] ?? ""}
                            onChange={(e) =>
                              setNewItemTexts((prev) => ({
                                ...prev,
                                [checklist.id]: e.target.value,
                              }))
                            }
                            placeholder="Novo item"
                            className="h-8 text-sm"
                            onKeyDown={(e) =>
                              e.key === "Enter" &&
                              handleAddChecklistItem(checklist.id)
                            }
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleAddChecklistItem(checklist.id)
                            }
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                {addingChecklist ? (
                  <div className="flex gap-2">
                    <Input
                      value={newChecklistTitle}
                      onChange={(e) => setNewChecklistTitle(e.target.value)}
                      placeholder="Titulo da checklist"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddChecklist();
                        if (e.key === "Escape") setAddingChecklist(false);
                      }}
                    />
                    <Button size="sm" onClick={handleAddChecklist}>
                      Criar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAddingChecklist(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddingChecklist(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Nova Checklist
                  </Button>
                )}
              </TabsContent>

              {/* Attachments tab */}
              <TabsContent value={2} className="space-y-4 mt-4">
                <FileUpload cardId={card.id} onUploaded={invalidate} />
                <div className="space-y-2">
                  {(card as any).card_attachments?.map((att: any) => (
                    <button
                      key={att.id}
                      type="button"
                      onClick={async () => {
                        const sb = createClient();
                        const { data } = await sb.storage
                          .from("card-attachments")
                          .createSignedUrl(att.file_url, 3600);
                        if (data?.signedUrl) {
                          window.open(data.signedUrl, "_blank", "noopener,noreferrer");
                        } else {
                          toast.error("Erro ao abrir arquivo");
                        }
                      }}
                      className="flex items-center gap-3 rounded-md border p-3 hover:bg-accent transition-colors w-full text-left"
                    >
                      <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {att.file_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(att.file_size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </TabsContent>

              {/* Activity tab */}
              <TabsContent value={3} className="mt-4">
                <ActivityFeed
                  activities={((card as any).card_activity_log ?? []).sort(
                    (a: any, b: any) =>
                      new Date(b.created_at).getTime() -
                      new Date(a.created_at).getTime()
                  )}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>

      {cardId && card && (
        <EscalateDialog
          cardId={cardId}
          cardTitle={card.title}
          currentSectorId={sectorId}
          open={escalateOpen}
          onOpenChange={setEscalateOpen}
        />
      )}
    </Sheet>
  );
}
