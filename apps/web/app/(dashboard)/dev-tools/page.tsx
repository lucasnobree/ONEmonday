"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Rocket, Server, ToggleLeft } from "lucide-react";
import { toast } from "sonner";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useDevToolsStats } from "@/hooks/dev-tools/use-dev-tools-stats";
import {
  useIncidents,
  useDeleteIncident,
  type DevIncident,
} from "@/hooks/dev-tools/use-incidents";
import {
  useServices,
  useDeleteService,
  type DevService,
} from "@/hooks/dev-tools/use-services";
import {
  useDeployments,
  type DevDeployment,
} from "@/hooks/dev-tools/use-deployments";
import {
  useFeatureFlags,
  useToggleFeatureFlag,
  type DevFeatureFlag,
} from "@/hooks/dev-tools/use-feature-flags";
import {
  summarizeIncidents,
  formatDuration,
} from "@/lib/dev-tools/incident-metrics";
import {
  CRITICALITY_LABELS,
  DEPLOYMENT_STATUS_LABELS,
  ENVIRONMENT_LABELS,
  HEALTH_LABELS,
  INCIDENT_STATUS_LABELS,
  SEVERITY_LABELS,
} from "@/lib/dev-tools/labels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceFormDialog } from "@/components/dev-tools/service-form-dialog";
import { IncidentFormDialog } from "@/components/dev-tools/incident-form-dialog";
import { DeploymentFormDialog } from "@/components/dev-tools/deployment-form-dialog";
import { FeatureFlagFormDialog } from "@/components/dev-tools/feature-flag-form-dialog";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      {children}
    </div>
  );
}

export default function DevToolsPage() {
  const { currentSector } = useCurrentSector();
  const sectorId = currentSector?.id;

  const { data: stats } = useDevToolsStats(sectorId);
  const { data: incidents } = useIncidents(sectorId);
  const { data: services } = useServices(sectorId);
  const { data: deployments } = useDeployments(sectorId);
  const { data: flags } = useFeatureFlags(sectorId);

  const deleteIncident = useDeleteIncident();
  const deleteService = useDeleteService();
  const toggleFlag = useToggleFeatureFlag();

  const [serviceDialog, setServiceDialog] = useState(false);
  const [editService, setEditService] = useState<DevService>();
  const [incidentDialog, setIncidentDialog] = useState(false);
  const [editIncident, setEditIncident] = useState<DevIncident>();
  const [deployDialog, setDeployDialog] = useState(false);
  const [editDeploy, setEditDeploy] = useState<DevDeployment>();
  const [flagDialog, setFlagDialog] = useState(false);
  const [editFlag, setEditFlag] = useState<DevFeatureFlag>();

  const metrics = useMemo(
    () => summarizeIncidents(incidents ?? []),
    [incidents]
  );
  const serviceName = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of services ?? []) map.set(s.id, s.name);
    return map;
  }, [services]);

  if (!currentSector) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Dev Tools</h1>
        <p className="mt-1 text-muted-foreground">
          Selecione um setor no menu lateral para visualizar as ferramentas.
        </p>
      </div>
    );
  }

  const handleToggleFlag = async (flag: DevFeatureFlag) => {
    const result = await toggleFlag.mutateAsync({
      id: flag.id,
      isEnabled: !flag.is_enabled,
    });
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao alternar flag"
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dev Tools</h1>
        <p className="text-muted-foreground">{currentSector.name}</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visao Geral</TabsTrigger>
          <TabsTrigger value="incidents">Incidentes</TabsTrigger>
          <TabsTrigger value="services">Servicos</TabsTrigger>
          <TabsTrigger value="deployments">Deploys</TabsTrigger>
          <TabsTrigger value="flags">Flags</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={AlertTriangle}
              color="text-red-500"
              label="Incidentes Abertos"
              value={stats?.openIncidents ?? 0}
            />
            <StatCard
              icon={AlertTriangle}
              color="text-orange-500"
              label="SEV1 Abertos"
              value={stats?.sev1Open ?? 0}
            />
            <StatCard
              icon={Server}
              color="text-amber-500"
              label="Servicos com Falha"
              value={stats?.servicesDown ?? 0}
            />
            <StatCard
              icon={Rocket}
              color="text-sky-500"
              label="Deploys (7 dias)"
              value={stats?.deploys7d ?? 0}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={ToggleLeft}
              color="text-emerald-500"
              label="Flags Ativas"
              value={stats?.activeFlags ?? 0}
            />
            <StatCard
              icon={AlertTriangle}
              color="text-violet-500"
              label="MTTA medio"
              value={formatDuration(metrics.mttaMinutes)}
            />
            <StatCard
              icon={AlertTriangle}
              color="text-indigo-500"
              label="MTTR medio"
              value={formatDuration(metrics.mttrMinutes)}
            />
          </div>
        </TabsContent>

        <TabsContent value="incidents" className="space-y-3">
          <SectionHeader
            title="Incidentes"
            onNew={() => {
              setEditIncident(undefined);
              setIncidentDialog(true);
            }}
          />
          <Card>
            <CardContent className="p-0">
              {(incidents ?? []).length === 0 ? (
                <Empty label="Nenhum incidente registrado" />
              ) : (
                (incidents ?? []).map((inc) => (
                  <Row key={inc.id}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{inc.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {inc.service_id
                          ? (serviceName.get(inc.service_id) ?? "Servico")
                          : "Sem servico"}{" "}
                        · {fmtDate(inc.created_at)}
                      </p>
                    </div>
                    <Badge variant={SEVERITY_LABELS[inc.severity]?.variant}>
                      {SEVERITY_LABELS[inc.severity]?.label ?? inc.severity}
                    </Badge>
                    <Badge
                      variant={INCIDENT_STATUS_LABELS[inc.status]?.variant}
                    >
                      {INCIDENT_STATUS_LABELS[inc.status]?.label ?? inc.status}
                    </Badge>
                    <RowActions
                      onEdit={() => {
                        setEditIncident(inc);
                        setIncidentDialog(true);
                      }}
                      onDelete={async () => {
                        const r = await deleteIncident.mutateAsync(inc.id);
                        if (r.error) toast.error("Erro ao excluir");
                      }}
                    />
                  </Row>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-3">
          <SectionHeader
            title="Servicos"
            onNew={() => {
              setEditService(undefined);
              setServiceDialog(true);
            }}
          />
          <Card>
            <CardContent className="p-0">
              {(services ?? []).length === 0 ? (
                <Empty label="Nenhum servico registrado" />
              ) : (
                (services ?? []).map((svc) => (
                  <Row key={svc.id}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{svc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {svc.slug} · {ENVIRONMENT_LABELS[svc.environment]}
                      </p>
                    </div>
                    <Badge
                      variant={CRITICALITY_LABELS[svc.criticality]?.variant}
                    >
                      {CRITICALITY_LABELS[svc.criticality]?.label ??
                        svc.criticality}
                    </Badge>
                    <Badge variant={HEALTH_LABELS[svc.health]?.variant}>
                      {HEALTH_LABELS[svc.health]?.label ?? svc.health}
                    </Badge>
                    <RowActions
                      onEdit={() => {
                        setEditService(svc);
                        setServiceDialog(true);
                      }}
                      onDelete={async () => {
                        const r = await deleteService.mutateAsync(svc.id);
                        if (r.error) toast.error("Erro ao excluir");
                      }}
                    />
                  </Row>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deployments" className="space-y-3">
          <SectionHeader
            title="Deploys"
            onNew={() => {
              setEditDeploy(undefined);
              setDeployDialog(true);
            }}
          />
          <Card>
            <CardContent className="p-0">
              {(deployments ?? []).length === 0 ? (
                <Empty label="Nenhum deploy registrado" />
              ) : (
                (deployments ?? []).map((dep) => (
                  <Row key={dep.id}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {serviceName.get(dep.service_id) ?? "Servico"}{" "}
                        <span className="text-muted-foreground">
                          {dep.version}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ENVIRONMENT_LABELS[dep.environment]} ·{" "}
                        {fmtDate(dep.deployed_at)}
                      </p>
                    </div>
                    <Badge
                      variant={DEPLOYMENT_STATUS_LABELS[dep.status]?.variant}
                    >
                      {DEPLOYMENT_STATUS_LABELS[dep.status]?.label ??
                        dep.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditDeploy(dep);
                        setDeployDialog(true);
                      }}
                    >
                      Editar
                    </Button>
                  </Row>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flags" className="space-y-3">
          <SectionHeader
            title="Feature Flags"
            onNew={() => {
              setEditFlag(undefined);
              setFlagDialog(true);
            }}
          />
          <Card>
            <CardContent className="p-0">
              {(flags ?? []).length === 0 ? (
                <Empty label="Nenhuma flag criada" />
              ) : (
                (flags ?? []).map((flag) => (
                  <Row key={flag.id}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{flag.key}</p>
                      <p className="text-xs text-muted-foreground">
                        {ENVIRONMENT_LABELS[flag.environment]} · rollout{" "}
                        {flag.rollout_percentage}%
                      </p>
                    </div>
                    <Switch
                      checked={flag.is_enabled}
                      onCheckedChange={() => handleToggleFlag(flag)}
                      aria-label={`Alternar ${flag.key}`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditFlag(flag);
                        setFlagDialog(true);
                      }}
                    >
                      Editar
                    </Button>
                  </Row>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ServiceFormDialog
        open={serviceDialog}
        onOpenChange={setServiceDialog}
        sectorId={currentSector.id}
        service={editService}
      />
      <IncidentFormDialog
        open={incidentDialog}
        onOpenChange={setIncidentDialog}
        sectorId={currentSector.id}
        incident={editIncident}
      />
      <DeploymentFormDialog
        open={deployDialog}
        onOpenChange={setDeployDialog}
        sectorId={currentSector.id}
        deployment={editDeploy}
      />
      <FeatureFlagFormDialog
        open={flagDialog}
        onOpenChange={setFlagDialog}
        sectorId={currentSector.id}
        flag={editFlag}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: typeof AlertTriangle;
  color: string;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className={`h-7 w-7 shrink-0 ${color}`} />
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeader({ title, onNew }: { title: string; onNew: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Button size="sm" onClick={onNew}>
        <Plus className="mr-1 h-4 w-4" />
        Novo
      </Button>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <p className="px-4 py-10 text-center text-sm text-muted-foreground">
      {label}
    </p>
  );
}

function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button variant="ghost" size="sm" onClick={onEdit}>
        Editar
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-red-500"
        onClick={onDelete}
      >
        Excluir
      </Button>
    </div>
  );
}
