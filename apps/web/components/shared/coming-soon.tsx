import { Lock, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ComingSoonProps {
  moduleName: string;
  description?: string;
  icon?: LucideIcon;
}

export function ComingSoon({ moduleName, description, icon: Icon }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.32))] text-center">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-6">
        {Icon ? (
          <Icon className="h-8 w-8 text-muted-foreground" />
        ) : (
          <Lock className="h-8 w-8 text-muted-foreground" />
        )}
        {Icon && (
          <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-background border">
            <Lock className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
      </div>
      <Badge variant="secondary" className="mb-4">Em breve</Badge>
      <h2 className="text-2xl font-bold">{moduleName}</h2>
      <p className="text-muted-foreground mt-2 max-w-md">
        {description || "Este modulo estara disponivel em breve. Fique atento para novidades!"}
      </p>
    </div>
  );
}
