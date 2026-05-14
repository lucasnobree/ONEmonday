import {
  DollarSign,
  Receipt,
  TrendingUp,
  PiggyBank,
  FileSpreadsheet,
} from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function FinancePage() {
  return (
    <ComingSoon
      moduleName="Financeiro"
      icon={DollarSign}
      color="emerald"
      description="Contas a pagar e receber, fluxo de caixa e controle financeiro simplificado."
      features={[
        {
          icon: Receipt,
          title: "Contas a Pagar/Receber",
          description: "Controle de vencimentos, parcelas e conciliacoes.",
        },
        {
          icon: TrendingUp,
          title: "Fluxo de Caixa",
          description: "Visao em tempo real das entradas e saidas.",
        },
        {
          icon: PiggyBank,
          title: "Orcamentos",
          description: "Planejamento e acompanhamento orcamentario por setor.",
        },
        {
          icon: FileSpreadsheet,
          title: "Relatorios",
          description: "DRE, balancete e exportacao para contabilidade.",
        },
      ]}
    />
  );
}
