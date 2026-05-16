"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const crmNav = [
  { label: "Dashboard", href: "/crm" },
  { label: "Pipeline", href: "/crm/pipeline" },
  { label: "Propostas", href: "/crm/proposals" },
  { label: "Contatos", href: "/crm/contacts" },
  { label: "Empresas", href: "/crm/companies" },
  { label: "Atividades", href: "/crm/activities" },
];

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">CRM</h1>
        <p className="text-muted-foreground text-sm">
          Gestão de relacionamento com clientes
        </p>
      </div>

      <div className="inline-flex h-8 items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground">
        {crmNav.map((item) => {
          const isActive =
            item.href === "/crm"
              ? pathname === "/crm"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
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
      </div>

      {children}
    </div>
  );
}
