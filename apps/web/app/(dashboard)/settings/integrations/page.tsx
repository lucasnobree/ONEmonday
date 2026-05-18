"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { PermissionGate } from "@/components/shared/permission-gate";
import {
  upsertIntegrationCredential,
  deleteIntegrationCredential,
  testIntegrationCredential,
} from "@/lib/actions/integrations/credentials";
import {
  upsertChannelRoute,
  deleteChannelRoute,
} from "@/lib/actions/integrations/routes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  ROUTABLE_EVENT_TYPES,
  ROUTABLE_CHANNELS,
  eventLabel,
  channelLabel,
} from "@/lib/integrations/labels";
import { toast } from "sonner";
import { Loader2, Plug, Trash2, Activity } from "lucide-react";

/** Provider display metadata. */
const PROVIDERS = [
  { slug: "teams", label: "Microsoft Teams" },
  { slug: "whatsapp", label: "WhatsApp Cloud API" },
] as const;

/** Notification event types that can route to an outbound channel. */
const EVENT_TYPES = ROUTABLE_EVENT_TYPES;

const CHANNELS = ROUTABLE_CHANNELS;

interface Credential {
  id: string;
  provider: string;
  capability: string;
  is_enabled: boolean;
  has_secret: boolean;
}

interface ChannelRoute {
  id: string;
  event_type: string;
  channel: string;
  is_enabled: boolean;
}

export default function IntegrationsSettingsPage() {
  const { currentSector } = useCurrentSector();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [routes, setRoutes] = useState<ChannelRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Per-credential connectivity test state (W20).
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testTargets, setTestTargets] = useState<Record<string, string>>({});

  // Credential form state.
  const [provider, setProvider] = useState<string>("teams");
  const [teamsUrl, setTeamsUrl] = useState("");
  const [waToken, setWaToken] = useState("");
  const [waPhoneId, setWaPhoneId] = useState("");

  // Route form state.
  const [routeEvent, setRouteEvent] = useState<string>(EVENT_TYPES[0]);
  const [routeChannel, setRouteChannel] = useState<string>("teams");

  const load = useCallback(async () => {
    if (!currentSector) return;
    const supabase = createClient();

    const { data: credData } = await supabase
      .from("integration_credentials")
      .select("id, provider, capability, is_enabled, secret")
      .eq("sector_id", currentSector.id)
      .eq("is_active", true);

    setCredentials(
      (credData ?? []).map((c) => ({
        id: c.id,
        provider: c.provider,
        capability: c.capability,
        is_enabled: c.is_enabled,
        has_secret: Boolean(c.secret),
      }))
    );

    const { data: routeData } = await supabase
      .from("notification_channel_routes")
      .select("id, event_type, channel, is_enabled")
      .eq("sector_id", currentSector.id);

    setRoutes(routeData ?? []);
    setLoading(false);
  }, [currentSector]);

  useEffect(() => {
    // Wrapped so the data fetch (and its setState calls) run asynchronously,
    // never synchronously within the effect body.
    void (async () => {
      await load();
    })();
  }, [load]);

  async function handleSaveCredential() {
    if (!currentSector) return;
    setSaving(true);
    const secret =
      provider === "teams"
        ? { webhookUrl: teamsUrl.trim() }
        : { accessToken: waToken.trim(), phoneNumberId: waPhoneId.trim() };

    const result = await upsertIntegrationCredential({
      sectorId: currentSector.id,
      provider,
      capability: "messaging",
      isEnabled: true,
      secret,
      metadata: {},
    });
    setSaving(false);

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao salvar credencial"
      );
      return;
    }
    toast.success("Credencial salva");
    setTeamsUrl("");
    setWaToken("");
    setWaPhoneId("");
    load();
  }

  async function handleTestCredential(cred: Credential) {
    setTestingId(cred.id);
    const result = await testIntegrationCredential({
      id: cred.id,
      target:
        cred.provider === "whatsapp"
          ? testTargets[cred.id]?.trim() || undefined
          : undefined,
    });
    setTestingId(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.noop) {
      toast.warning(result.message ?? "Credencial sem segredo.", {
        duration: 6000,
      });
      return;
    }
    if (result.ok) {
      toast.success(result.message ?? "Conexão verificada com sucesso");
      return;
    }
    toast.error(result.message ?? "Falha no teste de conexão");
  }

  async function handleDeleteCredential(id: string) {
    const result = await deleteIntegrationCredential({ id });
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao remover"
      );
      return;
    }
    toast.success("Credencial removida");
    load();
  }

  async function handleAddRoute() {
    if (!currentSector) return;
    setSaving(true);
    const result = await upsertChannelRoute({
      sectorId: currentSector.id,
      eventType: routeEvent,
      channel: routeChannel,
      isEnabled: true,
    });
    setSaving(false);
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao salvar rota"
      );
      return;
    }
    toast.success("Rota adicionada");
    load();
  }

  async function handleToggleRoute(route: ChannelRoute, enabled: boolean) {
    if (!currentSector) return;
    setRoutes((prev) =>
      prev.map((r) => (r.id === route.id ? { ...r, is_enabled: enabled } : r))
    );
    const result = await upsertChannelRoute({
      sectorId: currentSector.id,
      eventType: route.event_type,
      channel: route.channel,
      isEnabled: enabled,
    });
    if (result.error) {
      toast.error("Erro ao atualizar rota");
      load();
    }
  }

  async function handleDeleteRoute(id: string) {
    const result = await deleteChannelRoute({ id });
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao remover"
      );
      return;
    }
    toast.success("Rota removida");
    load();
  }

  if (!currentSector) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Integrações</h1>
        <p className="text-muted-foreground">
          Selecione um setor para configurar as integrações.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Integrações</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-48 rounded-xl bg-muted" />
          <div className="h-48 rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <PermissionGate
      sectorId={currentSector.id}
      resource="integration"
      action="manage"
      fallback={
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Integrações</h1>
          <p className="text-muted-foreground">
            Você não tem permissão para gerenciar integrações deste setor.
          </p>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Integrações</h1>
          <p className="text-sm text-muted-foreground">
            Configure provedores externos e quais eventos disparam alertas para
            cada canal. Segredos são armazenados criptografados.
          </p>
        </div>

        {/* Configured credentials */}
        <Card>
          <CardHeader>
            <CardTitle>Provedores configurados</CardTitle>
            <CardDescription>
              Credenciais de integração do setor {currentSector.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {credentials.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum provedor configurado.
              </p>
            ) : (
              <div className="space-y-1">
                {credentials.map((c) => {
                  const providerLabel =
                    PROVIDERS.find((p) => p.slug === c.provider)?.label ??
                    c.provider;
                  return (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Plug className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {providerLabel}
                        </span>
                        <Badge
                          variant={c.has_secret ? "default" : "secondary"}
                        >
                          {c.has_secret ? "Configurado" : "Sem segredo"}
                        </Badge>
                        {!c.is_enabled && (
                          <Badge variant="outline">Desativado</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {c.provider === "whatsapp" && (
                          <Input
                            value={testTargets[c.id] ?? ""}
                            onChange={(e) =>
                              setTestTargets((prev) => ({
                                ...prev,
                                [c.id]: e.target.value,
                              }))
                            }
                            placeholder="Nº de teste (E.164)"
                            aria-label={`Número de WhatsApp para testar ${providerLabel}`}
                            className="h-8 w-44 text-xs"
                          />
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={testingId === c.id || !c.is_enabled}
                          onClick={() => handleTestCredential(c)}
                          aria-label={`Testar conexão ${providerLabel}`}
                        >
                          {testingId === c.id ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Activity className="mr-1 h-3.5 w-3.5" />
                          )}
                          Testar
                        </Button>
                        <ConfirmDialog
                          title="Remover credencial"
                          description={`Remover a credencial de ${providerLabel}? Os alertas roteados para este canal deixarão de funcionar.`}
                          onConfirm={() => handleDeleteCredential(c.id)}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Remover ${c.provider}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </ConfirmDialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add / update a credential */}
        <Card>
          <CardHeader>
            <CardTitle>Adicionar / atualizar provedor</CardTitle>
            <CardDescription>
              As credenciais são criptografadas antes de serem salvas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="w-full sm:w-64 space-y-2">
              <Label>Provedor</Label>
              <Select
                value={provider}
                onValueChange={(v: string | null) => v && setProvider(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.slug} value={p.slug}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {provider === "teams" ? (
              <div className="space-y-2">
                <Label htmlFor="teams-url">URL do Workflow (Teams)</Label>
                <Input
                  id="teams-url"
                  type="url"
                  placeholder="https://prod-XX.westus.logic.azure.com/..."
                  value={teamsUrl}
                  onChange={(e) => setTeamsUrl(e.target.value)}
                />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="wa-token">Access Token</Label>
                  <Input
                    id="wa-token"
                    type="password"
                    placeholder="EAAB..."
                    value={waToken}
                    onChange={(e) => setWaToken(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wa-phone">Phone Number ID</Label>
                  <Input
                    id="wa-phone"
                    placeholder="1234567890"
                    value={waPhoneId}
                    onChange={(e) => setWaPhoneId(e.target.value)}
                  />
                </div>
              </div>
            )}

            <Button
              onClick={handleSaveCredential}
              disabled={saving}
              className="gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar credencial
            </Button>
          </CardContent>
        </Card>

        {/* Event-to-channel routing */}
        <Card>
          <CardHeader>
            <CardTitle>Roteamento de eventos</CardTitle>
            <CardDescription>
              Escolha quais eventos também disparam alertas em cada canal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {routes.length > 0 && (
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-4 pb-2 text-xs font-medium text-muted-foreground">
                  <span>Evento</span>
                  <span>Canal</span>
                  <span>Ativo</span>
                  <span />
                </div>
                <Separator />
                {routes.map((r) => (
                  <div
                    key={r.id}
                    className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-4 py-3"
                  >
                    <span className="text-sm">
                      {eventLabel(r.event_type)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {channelLabel(r.channel)}
                    </span>
                    <Switch
                      checked={r.is_enabled}
                      aria-label={`${eventLabel(r.event_type)} para ${channelLabel(
                        r.channel
                      )}`}
                      onCheckedChange={(v) => handleToggleRoute(r, v)}
                    />
                    <ConfirmDialog
                      title="Remover rota"
                      description={`Remover a rota "${eventLabel(
                        r.event_type
                      )} → ${channelLabel(
                        r.channel
                      )}"? Este evento deixará de ser enviado para o canal.`}
                      onConfirm={() => handleDeleteRoute(r.id)}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remover rota ${eventLabel(r.event_type)}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </ConfirmDialog>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label>Evento</Label>
                <Select
                  value={routeEvent}
                  onValueChange={(v: string | null) => v && setRouteEvent(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((e) => (
                      <SelectItem key={e} value={e}>
                        {eventLabel(e)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-48 space-y-2">
                <Label>Canal</Label>
                <Select
                  value={routeChannel}
                  onValueChange={(v: string | null) => v && setRouteChannel(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {channelLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleAddRoute}
                disabled={saving}
                className="gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Adicionar rota
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  );
}
