import {
  BarChart3,
  PieChart,
  TrendingUp,
  Target,
} from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function AnalyticsPage() {
  return (
    <ComingSoon
      moduleName="Analytics"
      icon={BarChart3}
      color="sky"
      description="Metricas e dashboards avancados para acompanhar a performance dos seus setores."
      features={[
        {
          icon: PieChart,
          title: "Dashboards Customizaveis",
          description: "Monte paineis com os indicadores que importam.",
        },
        {
          icon: TrendingUp,
          title: "Tendencias",
          description: "Analise de tendencias e previsoes baseadas em dados.",
        },
        {
          icon: Target,
          title: "OKRs e Metas",
          description: "Defina e acompanhe metas por equipe e periodo.",
        },
        {
          icon: BarChart3,
          title: "Relatorios Automaticos",
          description: "Envio recorrente de relatorios por email.",
        },
      ]}
    />
  );
}
