"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell,
  UserPlus,
  MessageSquare,
  ArrowRightLeft,
  Clock,
  AlertCircle,
  FolderKanban,
  CheckCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  useNotifications,
  useUnreadCount,
  useMarkRead,
  useMarkAllRead,
} from "@/hooks/use-notifications";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";
import { createClient } from "@/lib/supabase/client";

const typeIcons: Record<string, LucideIcon> = {
  card_assigned: UserPlus,
  card_comment: MessageSquare,
  card_escalated: ArrowRightLeft,
  card_due_soon: Clock,
  card_overdue: AlertCircle,
  project_update: FolderKanban,
};

export function NotificationBell() {
  const [userId, setUserId] = useState<string>();
  const { data: notifications = [] } = useNotifications();
  const { data: unreadCount = 0 } = useUnreadCount();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id);
    });
  }, []);

  useRealtimeNotifications(userId);

  function handleNotificationClick(id: string, isRead: boolean) {
    if (!isRead) {
      markRead.mutate(id);
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative w-full justify-center" />
        }
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        <span className="sr-only">Notificacoes</span>
      </PopoverTrigger>

      <PopoverContent
        side="right"
        align="end"
        sideOffset={8}
        className="w-80 p-0"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold">Notificacoes</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Marcar tudo como lido
            </Button>
          )}
        </div>

        <Separator />

        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
              <Bell className="mb-2 h-8 w-8 opacity-30" />
              Nenhuma notificacao
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = typeIcons[notification.type] ?? Bell;
              return (
                <button
                  key={notification.id}
                  type="button"
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                    !notification.is_read ? "bg-muted/30" : ""
                  }`}
                  onClick={() =>
                    handleNotificationClick(
                      notification.id,
                      notification.is_read
                    )
                  }
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <span className="text-sm font-medium leading-tight">
                        {notification.title}
                      </span>
                      {!notification.is_read && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                      )}
                    </div>
                    {notification.content && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {notification.content}
                      </p>
                    )}
                    <span className="mt-1 block text-[11px] text-muted-foreground/70">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
