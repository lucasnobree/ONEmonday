import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GlobalOverviewView } from "@/components/overview/global-overview-view";

export const metadata: Metadata = {
  title: "Visão Geral",
};

/**
 * Admin-only "Visão Geral" — a cross-sector monitoring screen.
 *
 * Access is enforced server-side: a non-admin is redirected to `/` before any
 * data is fetched. The backing `get_global_sector_overview` RPC is itself
 * admin-only (migration 00208), so this is defence in depth, not the only gate.
 */
export default async function OverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("is_global_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_global_admin) redirect("/");

  return <GlobalOverviewView />;
}
