import {
  Terminal,
  GitBranch,
  Activity,
  Rocket,
} from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function DevToolsPage() {
  return (
    <ComingSoon
      moduleName="Dev Tools"
      icon={Terminal}
      color="orange"
      description="Ferramentas para desenvolvimento: CI/CD, logs, monitoramento e deploy."
      features={[
        {
          icon: GitBranch,
          title: "CI/CD",
          description: "Pipelines de build, testes e deploy integrados.",
        },
        {
          icon: Activity,
          title: "Monitoramento",
          description: "Logs, alertas e metricas de aplicacoes em tempo real.",
        },
        {
          icon: Terminal,
          title: "Console",
          description: "Terminal integrado para execucao de comandos.",
        },
        {
          icon: Rocket,
          title: "Deploy",
          description: "Deploy com um clique para staging e producao.",
        },
      ]}
    />
  );
}
