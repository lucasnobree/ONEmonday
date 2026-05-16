"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MarketingErrorProps {
  /** Short description of what failed to load (e.g. "as campanhas"). */
  subject: string;
  /** Optional retry handler — typically `query.refetch`. */
  onRetry?: () => void;
}

/**
 * Inline error state for Marketing data hooks. The hooks `throw` on failure;
 * pages render this instead of a blank screen or a crash.
 */
export function MarketingError({ subject, onRetry }: MarketingErrorProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-destructive/40 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Não foi possível carregar {subject}.</p>
        <p className="text-xs text-muted-foreground">
          Verifique sua conexão e tente novamente.
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
