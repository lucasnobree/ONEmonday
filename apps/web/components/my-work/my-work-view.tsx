"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ListTodo } from "lucide-react";
import { useMyWork, type MyWorkItem } from "@/hooks/use-my-work";
import {
  groupTasksByBucket,
  WORK_BUCKET_ORDER,
  WORK_BUCKET_LABELS,
  type WorkBucket,
} from "@/lib/my-work/date-buckets";
import { PRIORITY_CONFIG, formatDateShort, type Priority } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

/** Buckets whose heading should read in an "attention" colour. */
const URGENT_BUCKETS = new Set<WorkBucket>(["overdue", "today"]);

function MyWorkRow({ item }: { item: MyWorkItem }) {
  const priority = PRIORITY_CONFIG[item.priority as Priority];

  return (
    <Link
      href={`/${item.sectorSlug}/boards/${item.boardId}`}
      className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/20 hover:bg-accent/40"
    >
      <span
        className={`font-medium ${
          item.isDone ? "text-muted-foreground line-through" : ""
        }`}
      >
        {item.title}
      </span>
      <span className="text-xs text-muted-foreground">
        {item.sectorName} · {item.boardName}
      </span>
      <span className="ml-auto flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: item.columnColor ?? "#6b7280" }}
            aria-hidden="true"
          />
          {item.columnName}
        </span>
        {priority && (
          <Badge variant={priority.badgeVariant}>{priority.label}</Badge>
        )}
        {item.dueDate && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDateShort(item.dueDate)}
          </span>
        )}
      </span>
    </Link>
  );
}

function MyWorkSection({
  bucket,
  items,
}: {
  bucket: WorkBucket;
  items: MyWorkItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2
        className={`text-sm font-semibold ${
          URGENT_BUCKETS.has(bucket) ? "text-red-500" : "text-foreground"
        }`}
      >
        {WORK_BUCKET_LABELS[bucket]}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {items.length}
        </span>
      </h2>
      <div className="space-y-1.5">
        {items.map((item) => (
          <MyWorkRow key={item.cardId} item={item} />
        ))}
      </div>
    </section>
  );
}

function MyWorkSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 2 }).map((_, s) => (
        <div key={s} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          {Array.from({ length: 3 }).map((__, r) => (
            <Skeleton key={r} className="h-12 rounded-md" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function MyWorkView() {
  const { data: items, isLoading, error } = useMyWork();
  const [showDone, setShowDone] = useState(false);

  const visibleItems = useMemo(
    () => (items ?? []).filter((i) => showDone || !i.isDone),
    [items, showDone]
  );

  const groups = useMemo(
    () => groupTasksByBucket(visibleItems),
    [visibleItems]
  );

  const doneCount = useMemo(
    () => (items ?? []).filter((i) => i.isDone).length,
    [items]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Meu Trabalho</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tarefas atribuídas a você em todos os setores e boards.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showDone} onCheckedChange={setShowDone} />
          Mostrar concluídas
          {doneCount > 0 && (
            <span className="text-xs">({doneCount})</span>
          )}
        </label>
      </div>

      {isLoading ? (
        <MyWorkSkeleton />
      ) : error ? (
        <p className="py-12 text-center text-sm text-destructive">
          Não foi possível carregar suas tarefas.
        </p>
      ) : visibleItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          {items && items.length > 0 ? (
            <>
              <CheckCircle2 className="mb-4 h-12 w-12 text-emerald-500/60" />
              <h2 className="text-lg font-medium">Tudo em dia</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Você não tem tarefas pendentes. Ative &quot;Mostrar
                concluídas&quot; para revê-las.
              </p>
            </>
          ) : (
            <>
              <ListTodo className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h2 className="text-lg font-medium">Nenhuma tarefa atribuída</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cards atribuídos a você aparecerão aqui.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {WORK_BUCKET_ORDER.map((bucket) => (
            <MyWorkSection
              key={bucket}
              bucket={bucket}
              items={groups[bucket]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
