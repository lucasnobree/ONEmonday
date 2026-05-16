"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  useCreateReport,
  useUpdateReport,
  type AnalyticsReport,
} from "@/hooks/analytics/use-reports";
import { METRIC_LIST } from "@/lib/analytics/metrics";
import { CHART_TYPES } from "@/lib/validations/analytics";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CHART_LABELS: Record<string, string> = {
  bar: "Barras",
  line: "Linha",
  pie: "Pizza",
  kpi: "Indicador (KPI)",
};

/**
 * Chart types offered in the form. "pie" is intentionally excluded: reports
 * render a monthly time-series, and a pie of 12 monthly buckets is not a
 * meaningful "parts of a whole" visualization. The enum still accepts "pie"
 * so older reports created with it keep validating.
 */
const SELECTABLE_CHART_TYPES = CHART_TYPES.filter((c) => c !== "pie");

interface ReportFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  report?: AnalyticsReport;
}

export function ReportFormDialog({
  open,
  onOpenChange,
  sectorId,
  report,
}: ReportFormDialogProps) {
  const createReport = useCreateReport();
  const updateReport = useUpdateReport();
  const isEdit = !!report;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [metric, setMetric] = useState<string>(METRIC_LIST[0].key);
  const [chartType, setChartType] = useState<string>("bar");
  const [dateRangeDays, setDateRangeDays] = useState("30");

  // Re-seed fields when the dialog (re)opens — adjust state during render.
  const formKey = `${open}:${report?.id ?? "new"}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setName(report?.name ?? "");
    setDescription(report?.description ?? "");
    setMetric(report?.metric ?? METRIC_LIST[0].key);
    // A legacy "pie" report falls back to "bar" in the editable form.
    setChartType(
      report?.chart_type && report.chart_type !== "pie"
        ? report.chart_type
        : "bar"
    );
    setDateRangeDays(String(report?.date_range_days ?? 30));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name,
      description: description || undefined,
      metric,
      chartType,
      dateRangeDays: Number(dateRangeDays) || 30,
      ...(isEdit ? { id: report.id } : { sectorId }),
    };

    const result = isEdit
      ? await updateReport.mutateAsync(payload)
      : await createReport.mutateAsync(payload);

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : `Erro ao ${isEdit ? "atualizar" : "criar"} relatório`
      );
      return;
    }

    toast.success(isEdit ? "Relatório atualizado" : "Relatório criado");
    onOpenChange(false);
  };

  const isPending = createReport.isPending || updateReport.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar Relatório" : "Novo Relatório"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Atualize a configuração do relatório"
                : "Crie um relatório salvo para este setor"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="report-name">Nome</Label>
              <Input
                id="report-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Negócios ganhos por mês"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="report-description">Descrição</Label>
              <Textarea
                id="report-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Opcional"
              />
            </div>

            <div className="grid gap-2">
              <Label>Métrica</Label>
              <Select
                value={metric}
                onValueChange={(v) => v && setMetric(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRIC_LIST.map((m) => (
                    <SelectItem key={m.key} value={m.key}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Tipo de gráfico</Label>
              <Select
                value={chartType}
                onValueChange={(v) => v && setChartType(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SELECTABLE_CHART_TYPES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CHART_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="report-range">Período (dias)</Label>
              <Input
                id="report-range"
                type="number"
                min={0}
                max={3650}
                value={dateRangeDays}
                onChange={(e) => setDateRangeDays(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !name}>
              {isPending
                ? "Salvando..."
                : isEdit
                  ? "Salvar"
                  : "Criar Relatório"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
