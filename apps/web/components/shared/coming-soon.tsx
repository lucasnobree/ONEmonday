import { Lock, Bell, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FeaturePreview {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface ComingSoonProps {
  moduleName: string;
  description?: string;
  icon?: LucideIcon;
  color?: "emerald" | "violet" | "amber" | "sky" | "orange";
  features?: FeaturePreview[];
}

const colorMap = {
  emerald: {
    bg: "bg-emerald-100 dark:bg-emerald-950/30",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  violet: {
    bg: "bg-violet-100 dark:bg-violet-950/30",
    text: "text-violet-600 dark:text-violet-400",
  },
  amber: {
    bg: "bg-amber-100 dark:bg-amber-950/30",
    text: "text-amber-600 dark:text-amber-400",
  },
  sky: {
    bg: "bg-sky-100 dark:bg-sky-950/30",
    text: "text-sky-600 dark:text-sky-400",
  },
  orange: {
    bg: "bg-orange-100 dark:bg-orange-950/30",
    text: "text-orange-600 dark:text-orange-400",
  },
};

export function ComingSoon({
  moduleName,
  description,
  icon: Icon,
  color,
  features,
}: ComingSoonProps) {
  const colors = color ? colorMap[color] : null;

  return (
    <div className="flex flex-col items-center py-12 px-4">
      <div className="flex flex-col items-center text-center mb-10">
        <div
          className={`relative flex h-20 w-20 items-center justify-center rounded-2xl mb-6 ${colors?.bg ?? "bg-muted"}`}
        >
          {Icon ? (
            <Icon className={`h-10 w-10 ${colors?.text ?? "text-muted-foreground"}`} />
          ) : (
            <Lock className="h-10 w-10 text-muted-foreground" />
          )}
          {Icon && (
            <div className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-background border-2 border-background shadow-sm">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          )}
        </div>
        <Badge variant="secondary" className="mb-4 text-xs">
          Em breve
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">{moduleName}</h1>
        <p className="text-muted-foreground mt-3 max-w-lg text-base">
          {description ||
            "Este modulo estara disponivel em breve. Fique atento para novidades!"}
        </p>
      </div>

      {features && features.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 w-full max-w-2xl mb-10 opacity-60">
          {features.map((feature) => (
            <Card key={feature.title} className="border-dashed">
              <CardContent className="flex items-start gap-3 pt-5">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colors?.bg ?? "bg-muted"}`}
                >
                  <feature.icon
                    className={`h-4.5 w-4.5 ${colors?.text ?? "text-muted-foreground"}`}
                  />
                </div>
                <div>
                  <p className="font-medium text-sm">{feature.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {feature.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="w-full max-w-md border-dashed">
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm font-medium">
            Quer ser notificado quando lancar?
          </p>
          <div className="flex w-full gap-2">
            <Input
              placeholder="seu@email.com"
              disabled
              className="flex-1"
            />
            <Button disabled size="sm">
              Notificar-me
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Funcionalidade disponivel em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
