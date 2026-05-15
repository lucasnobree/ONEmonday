"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Kanban,
  Ticket,
  Users,
  Briefcase,
  MessageSquare,
  Clock,
} from "lucide-react";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

interface RecentItem {
  id: string;
  type: "card" | "ticket" | "deal" | "employee" | "activity";
  title: string;
  subtitle: string | null;
  created_at: string;
}

function useRecentActivity(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard-recent", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const [cardsRes, ticketsRes, dealsRes] = await Promise.all([
        supabase
          .from("cards")
          .select("id, title, priority, created_at")
          .eq("sector_id", sectorId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("support_tickets")
          .select("id, category, created_at, cards!inner(title)")
          .eq("sector_id", sectorId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("crm_deals")
          .select("id, value, created_at, cards!inner(title)")
          .eq("sector_id", sectorId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const items: RecentItem[] = [];

      for (const card of cardsRes.data || []) {
        items.push({
          id: `card-${card.id}`,
          type: "card",
          title: card.title,
          subtitle: card.priority,
          created_at: card.created_at,
        });
      }

      for (const ticket of ticketsRes.data || []) {
        const t = ticket as { cards?: { title?: string } | null };
        items.push({
          id: `ticket-${ticket.id}`,
          type: "ticket",
          title: t.cards?.title ?? "Ticket",
          subtitle: ticket.category,
          created_at: ticket.created_at,
        });
      }

      for (const deal of dealsRes.data || []) {
        const d = deal as { cards?: { title?: string } | null };
        items.push({
          id: `deal-${deal.id}`,
          type: "deal",
          title: d.cards?.title ?? "Deal",
          subtitle: deal.value
            ? new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(deal.value)
            : null,
          created_at: deal.created_at,
        });
      }

      items.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return items.slice(0, 10);
    },
    enabled: !!sectorId,
    staleTime: 60 * 1000,
  });
}

const typeConfig: Record<
  string,
  { icon: typeof Kanban; label: string; color: string }
> = {
  card: { icon: Kanban, label: "Card", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  ticket: { icon: Ticket, label: "Ticket", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  deal: { icon: Briefcase, label: "Deal", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  employee: { icon: Users, label: "Colaborador", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  activity: { icon: MessageSquare, label: "Atividade", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

export function RecentActivity({ sectorId }: { sectorId: string }) {
  const { data: items, isLoading } = useRecentActivity(sectorId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Atividade Recente
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : !items?.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma atividade recente.
          </p>
        ) : (
          <div className="space-y-1">
            {items.map((item) => {
              const config = typeConfig[item.type] ?? typeConfig.card;
              const Icon = config.icon;

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {dateFormat.format(new Date(item.created_at))}
                    </p>
                  </div>
                  <Badge variant="secondary" className={`text-[10px] shrink-0 ${config.color}`}>
                    {config.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
