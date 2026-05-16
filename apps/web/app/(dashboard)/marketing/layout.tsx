"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const marketingNav = [
  { label: "Visão Geral", href: "/marketing" },
  { label: "Campanhas", href: "/marketing/campaigns" },
  { label: "Calendário", href: "/marketing/calendar" },
  { label: "Audiências", href: "/marketing/audiences" },
];

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Marketing</h1>
        <p className="text-muted-foreground text-sm">
          Campanhas, calendário editorial, audiências e métricas
        </p>
      </div>

      <div className="inline-flex h-8 items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground">
        {marketingNav.map((item) => {
          const isActive =
            item.href === "/marketing"
              ? pathname === "/marketing"
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
