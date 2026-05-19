/**
 * Shared Settings layout.
 *
 * Nav phase 2: the sidebar's bottom-zone "Configurações" group now exposes
 * every Settings sub-page (Geral / Perfil / Administração / Integrações), so
 * the in-screen sub-tab strip that used to live here was removed to avoid
 * duplicate navigation. The layout stays as a thin spacing wrapper.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="space-y-6">{children}</div>;
}
