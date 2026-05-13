"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  setPasswordSchema,
  type SetPasswordInput,
} from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

type InviteState =
  | { status: "loading" }
  | { status: "ready"; email: string }
  | { status: "wrong_user"; email: string; currentEmail: string }
  | { status: "expired" }
  | { status: "error"; message: string };

export default function InvitePage() {
  const router = useRouter();
  const supabase = createClient();
  const [state, setState] = useState<InviteState>({ status: "loading" });
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
  });

  useEffect(() => {
    const hash = window.location.hash;

    async function processInvite() {
      if (!hash || !hash.includes("access_token")) {
        setState({ status: "expired" });
        return;
      }

      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");

      if (!accessToken || !refreshToken || type !== "invite") {
        setState({ status: "expired" });
        return;
      }

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error || !data.user?.email) {
        setState({ status: "expired" });
        return;
      }

      const inviteEmail = data.user.email;

      if (currentUser && currentUser.email !== inviteEmail) {
        setState({
          status: "wrong_user",
          email: inviteEmail,
          currentEmail: currentUser.email ?? "",
        });
        return;
      }

      setState({ status: "ready", email: inviteEmail });
    }

    processInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(data: SetPasswordInput) {
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({
      password: data.password,
    });
    setSubmitting(false);

    if (error) {
      toast.error("Erro ao definir senha", { description: error.message });
      return;
    }

    toast.success("Senha definida com sucesso");
    router.push("/");
    router.refresh();
  }

  async function handleForceLogout() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  if (state.status === "loading") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Processando convite...</CardTitle>
          <CardDescription>Aguarde enquanto validamos seu convite.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (state.status === "expired") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Convite expirado</CardTitle>
          <CardDescription>
            Este convite nao e mais valido. Entre em contato com o administrador
            para receber um novo convite.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:underline"
          >
            Ir para o login
          </Link>
        </CardFooter>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Erro</CardTitle>
          <CardDescription>{state.message}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:underline"
          >
            Ir para o login
          </Link>
        </CardFooter>
      </Card>
    );
  }

  if (state.status === "wrong_user") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conta diferente</CardTitle>
          <CardDescription>
            Voce esta logado como {state.currentEmail}, mas este convite e para{" "}
            {state.email}. Saia da conta atual para aceitar o convite.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={handleForceLogout} variant="outline" className="w-full">
            Sair e aceitar convite
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Definir senha</CardTitle>
        <CardDescription>
          Bem-vindo! Defina sua senha para acessar como {state.email}.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minimo 8 caracteres"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Salvando..." : "Definir senha e entrar"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
