import {
  Scale,
  FileText,
  Gavel,
  ShieldCheck,
} from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function LegalPage() {
  return (
    <ComingSoon
      moduleName="Juridico"
      icon={Scale}
      color="amber"
      description="Gestao de contratos, processos judiciais e compliance."
      features={[
        {
          icon: FileText,
          title: "Contratos",
          description: "Cadastro, vencimentos e alertas de renovacao.",
        },
        {
          icon: Gavel,
          title: "Processos",
          description: "Acompanhamento de processos judiciais e prazos.",
        },
        {
          icon: ShieldCheck,
          title: "Compliance",
          description: "Checklists e auditorias de conformidade.",
        },
        {
          icon: Scale,
          title: "Pareceres",
          description: "Solicitacao e historico de pareceres juridicos.",
        },
      ]}
    />
  );
}
