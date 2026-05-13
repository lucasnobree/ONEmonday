"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { PermissionGate } from "@/components/shared/permission-gate";
import { inviteUser } from "@/lib/actions/settings";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, Loader2 } from "lucide-react";

interface Member {
  userId: string;
  fullName: string;
  email: string;
  roleName: string;
  roleSlug: string;
}

interface Role {
  id: string;
  name: string;
  slug: string;
}

export default function AdminSettingsPage() {
  const { currentSector } = useCurrentSector();
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!currentSector) return;

    async function load() {
      const supabase = createClient();

      const { data: memberData } = await supabase
        .from("user_sector_roles")
        .select(
          `
          user_id,
          users!inner(full_name, email),
          roles!inner(name, slug)
        `
        )
        .eq("sector_id", currentSector!.id);

      if (memberData) {
        setMembers(
          memberData.map((m: any) => ({
            userId: m.user_id,
            fullName: m.users.full_name,
            email: m.users.email,
            roleName: m.roles.name,
            roleSlug: m.roles.slug,
          }))
        );
      }

      const { data: roleData } = await supabase
        .from("roles")
        .select("id, name, slug")
        .order("level", { ascending: true });

      if (roleData) setRoles(roleData);

      setLoading(false);
    }
    load();
  }, [currentSector]);

  async function handleInvite() {
    if (!currentSector || !inviteEmail.trim() || !inviteRoleId) {
      toast.error("Preencha email e selecione um papel");
      return;
    }

    setInviting(true);
    const result = await inviteUser(
      inviteEmail.trim(),
      currentSector.id,
      inviteRoleId
    );
    setInviting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Convite enviado com sucesso");
    setInviteEmail("");
    setInviteRoleId(null);
  }

  if (!currentSector) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Administracao</h1>
        <p className="text-muted-foreground">
          Selecione um setor para acessar as configuracoes de administracao.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Administracao</h1>
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
      resource="settings"
      action="manage"
      fallback={
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Administracao</h1>
          <p className="text-muted-foreground">
            Voce nao tem permissao para gerenciar as configuracoes deste setor.
          </p>
        </div>
      }
    >
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Administracao</h1>

        <Card>
          <CardHeader>
            <CardTitle>Membros do Setor</CardTitle>
            <CardDescription>
              Usuarios com acesso ao setor {currentSector.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum membro encontrado.
              </p>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 pb-2 text-xs font-medium text-muted-foreground">
                  <span>Nome</span>
                  <span>Email</span>
                  <span>Papel</span>
                </div>
                <Separator />
                {members.map((member) => (
                  <div
                    key={member.userId}
                    className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 py-3"
                  >
                    <span className="text-sm font-medium truncate">
                      {member.fullName}
                    </span>
                    <span className="text-sm text-muted-foreground truncate">
                      {member.email}
                    </span>
                    <Badge variant="secondary">{member.roleName}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Convidar Usuario</CardTitle>
            <CardDescription>
              Envie um convite para adicionar um novo membro ao setor
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="usuario@empresa.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-48 space-y-2">
                <Label>Papel</Label>
                <Select
                  value={inviteRoleId ?? undefined}
                  onValueChange={(val: string | null) =>
                    setInviteRoleId(val)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim() || !inviteRoleId}
                className="gap-2"
              >
                {inviting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Convidar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  );
}
