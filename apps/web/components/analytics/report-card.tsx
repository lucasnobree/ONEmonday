"use client";

import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useAnalyticsTrend,
} from "@/hooks/analytics/use-analytics-trend";
import {
  useDeleteReport,
  type AnalyticsReport,
} from "@/hooks/analytics/use-reports";
import { getMetric } from "@/lib/analytics/metrics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ReportChart } from "./report-chart";

interface ReportCardProps {
  report: AnalyticsReport;
  sectorId: string;
  onEdit: (report: AnalyticsReport) => void;
}

export function ReportCard({ report, sectorId, onEdit }: ReportCardProps) {
  const metric = getMetric(report.metric);
  const { data, isLoading } = useAnalyticsTrend(
    sectorId,
    report.metric,
    report.date_range_days
  );
  const deleteReport = useDeleteReport();

  const handleDelete = async () => {
    const result = await deleteReport.mutateAsync(report.id);
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao excluir"
      );
      return;
    }
    toast.success("Relatório excluído");
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{report.name}</CardTitle>
            {report.is_default && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                Padrão
              </Badge>
            )}
          </div>
          <CardDescription>
            {report.description || metric?.label}
          </CardDescription>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Editar relatório"
            onClick={() => onEdit(report)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <ConfirmDialog
            title="Excluir relatório?"
            description={`O relatório "${report.name}" será removido. Esta ação não pode ser desfeita.`}
            onConfirm={handleDelete}
          >
            <Button
              variant="ghost"
              size="icon"
              aria-label="Excluir relatório"
              disabled={deleteReport.isPending}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </ConfirmDialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || !metric ? (
          <Skeleton className="h-[220px] w-full" />
        ) : (
          <ReportChart
            data={data ?? []}
            chartType={report.chart_type}
            metric={metric}
          />
        )}
      </CardContent>
    </Card>
  );
}
