import { DollarSign } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function FinancePage() {
  return <ComingSoon moduleName="Financeiro" icon={DollarSign} description="Contas a pagar e receber, fluxo de caixa e controle financeiro simplificado." />;
}
