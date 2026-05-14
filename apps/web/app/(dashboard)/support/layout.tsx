"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const supportNav = [
  { label: "Dashboard", href: "/support" },
  { label: "Tickets", href: "/support/tickets" },
  { label: "Base de Conhecimento", href: "/support/knowledge-base" },
  { label: "Respostas Prontas", href: "/support/canned-responses" },
  { label: "Regras SLA", href: "/support/sla-rules" },
];

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Support Desk</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Central de atendimento com tickets, SLA e base de conhecimento.
        </p>
      </div>

      <div className="inline-flex h-8 items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground">
        {supportNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-all",
              pathname === item.href
                ? "bg-background text-foreground shadow-sm"
                : "hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}
