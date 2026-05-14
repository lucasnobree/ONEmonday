import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/shared/sidebar";
import { CommandPalette } from "@/components/shared/command-palette";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, full_name, avatar_url, is_global_admin")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={profile} />
      <main className="flex-1 flex flex-col overflow-hidden pt-14 md:pt-0">
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
      <CommandPalette />
    </div>
  );
}
