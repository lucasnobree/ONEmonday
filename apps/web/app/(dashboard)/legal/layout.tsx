"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const legalNav = [
  { label: "Dashboard", href: "/legal" },
  { label: "Contratos", href: "/legal/contracts" },
  { label: "Demandas", href: "/legal/matters" },
  { label: "Clausulas", href: "/legal/clauses" },
];

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Juridico</h1>
        <p className="text-muted-foreground text-sm">
          Gestao de contratos, renovacoes e demandas juridicas
        </p>
      </div>

      <div className="inline-flex h-8 items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground">
        {legalNav.map((item) => {
          const isActive =
            item.href === "/legal"
              ? pathname === "/legal"
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
