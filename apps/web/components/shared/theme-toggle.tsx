"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const themeConfig = {
  light: { icon: Sun, next: "dark", label: "Tema claro" },
  dark: { icon: Moon, next: "system", label: "Tema escuro" },
  system: { icon: Monitor, next: "light", label: "Tema do sistema" },
} as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9" disabled>
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  const current = themeConfig[theme as keyof typeof themeConfig] ?? themeConfig.system;
  const Icon = current.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setTheme(current.next)}
            />
          }
        >
          <Icon className="h-4 w-4" />
          <span className="sr-only">{current.label}</span>
        </TooltipTrigger>
        <TooltipContent side="right">{current.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
