import {
  Megaphone,
  CalendarDays,
  BarChart2,
  Mail,
} from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function MarketingPage() {
  return (
    <ComingSoon
      moduleName="Marketing"
      icon={Megaphone}
      color="violet"
      description="Planejamento de campanhas, calendario editorial e metricas de marketing."
      features={[
        {
          icon: CalendarDays,
          title: "Calendario Editorial",
          description: "Planeje e agende publicacoes em um so lugar.",
        },
        {
          icon: Megaphone,
          title: "Campanhas",
          description: "Gerencie campanhas com metas e acompanhamento.",
        },
        {
          icon: BarChart2,
          title: "Metricas",
          description: "Dashboards de performance de canais e conversoes.",
        },
        {
          icon: Mail,
          title: "Email Marketing",
          description: "Automacoes e segmentacao de base de contatos.",
        },
      ]}
    />
  );
}
