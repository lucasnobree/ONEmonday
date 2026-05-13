"use client";

import { Lock } from "lucide-react";

interface ComingSoonProps {
  moduleName: string;
  description?: string;
}

export function ComingSoon({ moduleName, description }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-6">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-bold">{moduleName}</h2>
      <p className="text-muted-foreground mt-2 max-w-md">
        {description || "Este modulo estara disponivel em breve. Fique atento para novidades!"}
      </p>
    </div>
  );
}
