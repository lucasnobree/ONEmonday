import { Terminal } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function DevToolsPage() {
  return <ComingSoon moduleName="Dev Tools" icon={Terminal} description="Ferramentas para desenvolvimento: CI/CD, logs, monitoramento e deploy." />;
}
