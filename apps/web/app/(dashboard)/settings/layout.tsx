"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";

const settingsNav = [
  { label: "Geral", href: "/settings" },
  { label: "Perfil", href: "/settings/profile" },
  { label: "Administração", href: "/settings/admin" },
  { label: "Integrações", href: "/settings/integrations" },
];

/**
 * Shared Settings layout — renders the sub-tab strip on every Settings page so
 * Geral / Perfil / Administração / Integrações are navigable from any of them
 * (previously the strip lived only on the Geral page).
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isGlobalAdmin } = usePermissions();

  return (
    <div className="space-y-6">
      {isGlobalAdmin && (
        <nav
          aria-label="Seções de configurações"
          className="inline-flex h-8 items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground"
        >
          {settingsNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-all",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}

      {children}
    </div>
  );
}
