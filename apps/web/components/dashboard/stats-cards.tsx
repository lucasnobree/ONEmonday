"use client";

import {
  LayoutDashboard,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  FolderKanban,
} from "lucide-react";
import type { DashboardStats } from "@/hooks/use-dashboard-stats";

interface StatsCardsProps {
  stats: DashboardStats;
}

const cards = [
  {
    key: "totalCards" as const,
    label: "Total de Cards",
    icon: LayoutDashboard,
    color: "text-blue-500",
  },
  {
    key: "overdueCards" as const,
    label: "Atrasados",
    icon: AlertCircle,
    colorFn: (value: number) =>
      value > 0 ? "text-red-500" : "text-muted-foreground",
  },
  {
    key: "cardsThisWeek" as const,
    label: "Criados na Semana",
    icon: TrendingUp,
    color: "text-emerald-500",
  },
  {
    key: "completedThisWeek" as const,
    label: "Concluídos na Semana",
    icon: CheckCircle2,
    color: "text-teal-500",
  },
  {
    key: "activeProjects" as const,
    label: "Projetos Ativos",
    icon: FolderKanban,
    color: "text-violet-500",
  },
] as const;

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const value = stats[card.key];
        const iconColor =
          "colorFn" in card ? card.colorFn(value) : card.color;

        return (
          <div
            key={card.key}
            className="rounded-lg border border-border bg-card p-4 flex items-center gap-4"
          >
            <div className={`shrink-0 ${iconColor}`}>
              <Icon className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
