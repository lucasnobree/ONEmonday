"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { usePermissions } from "@/hooks/use-permissions";
import { PermissionGate } from "@/components/shared/permission-gate";
import { updateNotificationPreferences } from "@/lib/actions/settings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface UserProfile {
  full_name: string;
  email: string;
  avatar_url: string | null;
}

type Channel = "in_app" | "email" | "both" | "none";

interface NotificationPref {
  type: string;
  channel: Channel;
}

function channelToFlags(ch: Channel) {
  return {
    in_app: ch === "in_app" || ch === "both",
    email: ch === "email" || ch === "both",
  };
}

function flagsToChannel(inApp: boolean, email: boolean): Channel {
  if (inApp && email) return "both";
  if (inApp) return "in_app";
  if (email) return "email";
  return "none";
}

const NOTIFICATION_TYPES = [
  { type: "card_assigned", label: "Card atribuído" },
  { type: "card_comment", label: "Comentário em card" },
  { type: "card_escalated", label: "Card escalado" },
  { type: "card_due_soon", label: "Card vencendo" },
  { type: "card_overdue", label: "Card atrasado" },
] as const;

const DEFAULT_PREFS: NotificationPref[] = NOTIFICATION_TYPES.map((nt) => ({
  type: nt.type,
  channel: "in_app" as Channel,
}));

export default function SettingsPage() {
  const { currentSector } = useCurrentSector();
  const { isGlobalAdmin } = usePermissions();
  const pathname = usePathname();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [prefs, setPrefs] = useState<NotificationPref[]>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from("users")
        .select("full_name, email, avatar_url")
        .eq("id", user.id)
        .single();

      if (userData) setProfile(userData);

      const { data: prefData } = await supabase
        .from("notification_preferences")
        .select("type, channel")
        .eq("user_id", user.id);

      if (prefData && prefData.length > 0) {
        const merged = DEFAULT_PREFS.map((dp) => {
          const saved = prefData.find((p) => p.type === dp.type);
          return saved ? { type: saved.type, channel: saved.channel as Channel } : dp;
        });
        setPrefs(merged);
      }

      setLoading(false);
    }
    load();
  }, []);

  const handleToggle = useCallback(
    async (type: string, field: "in_app" | "email", value: boolean) => {
      const pref = prefs.find((p) => p.type === type);
      if (!pref) return;

      const flags = channelToFlags(pref.channel);
      const oldChannel = pref.channel;
      const newFlags = { ...flags, [field]: value };
      const newChannel = flagsToChannel(newFlags.in_app, newFlags.email);

      setPrefs((prev) =>
        prev.map((p) => (p.type === type ? { ...p, channel: newChannel } : p))
      );

      const result = await updateNotificationPreferences(type, newChannel);
      if (result.error) {
        toast.error("Erro ao salvar preferência");
        setPrefs((prev) =>
          prev.map((p) => (p.type === type ? { ...p, channel: oldChannel } : p))
        );
      } else {
        toast.success("Preferência salva");
      }
    },
    [prefs]
  );

  if (!currentSector) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Selecione um setor para acessar as configurações.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Configurações</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-32 rounded-xl bg-muted" />
          <div className="h-64 rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <PermissionGate
      sectorId={currentSector.id}
      resource="settings"
      action="read"
      fallback={
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar as configurações deste setor.
          </p>
        </div>
      }
    >
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Configurações</h1>

        {isGlobalAdmin && (
          <div className="inline-flex h-8 items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground">
            <Link
              href="/settings"
              className={cn(
                "inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-all",
                pathname === "/settings"
                  ? "bg-background text-foreground shadow-sm"
                  : "hover:text-foreground"
              )}
            >
              Geral
            </Link>
            <Link
              href="/settings/admin"
              className={cn(
                "inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-all",
                pathname === "/settings/admin"
                  ? "bg-background text-foreground shadow-sm"
                  : "hover:text-foreground"
              )}
            >
              Administração
            </Link>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
            <CardDescription>
              Informações da sua conta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1">
              <Label className="text-muted-foreground text-xs">Nome</Label>
              <p className="text-sm font-medium">
                {profile?.full_name || "—"}
              </p>
            </div>
            <div className="grid gap-1">
              <Label className="text-muted-foreground text-xs">Email</Label>
              <p className="text-sm font-medium">{profile?.email || "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferências de Notificação</CardTitle>
            <CardDescription>
              Escolha como deseja ser notificado para cada tipo de evento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_80px_80px] items-center gap-2 pb-2 text-xs font-medium text-muted-foreground">
                <span>Evento</span>
                <span className="text-center">In-app</span>
                <span className="text-center">Email</span>
              </div>
              <Separator />
              {NOTIFICATION_TYPES.map((nt) => {
                const pref = prefs.find((p) => p.type === nt.type);
                const flags = channelToFlags(pref?.channel ?? "in_app");
                return (
                  <div
                    key={nt.type}
                    className="grid grid-cols-[1fr_80px_80px] items-center gap-2 py-3"
                  >
                    <Label className="text-sm font-normal">{nt.label}</Label>
                    <div className="flex justify-center">
                      <Switch
                        checked={flags.in_app}
                        onCheckedChange={(checked) =>
                          handleToggle(nt.type, "in_app", checked)
                        }
                      />
                    </div>
                    <div className="flex justify-center">
                      <Switch
                        checked={flags.email}
                        onCheckedChange={(checked) =>
                          handleToggle(nt.type, "email", checked)
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  );
}
