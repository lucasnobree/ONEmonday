"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const financeNav = [
  { label: "Visão Geral", href: "/finance" },
  { label: "Faturas", href: "/finance/invoices" },
  { label: "Despesas", href: "/finance/expenses" },
  { label: "Orçamentos", href: "/finance/budgets" },
];

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="text-muted-foreground text-sm">
          Contas a pagar e receber, orçamentos e fluxo de caixa
        </p>
      </div>

      <div className="inline-flex h-8 items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground">
        {financeNav.map((item) => {
          const isActive =
            item.href === "/finance"
              ? pathname === "/finance"
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
