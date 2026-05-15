"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AuthError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">Algo deu errado</h2>
      <p className="text-sm text-muted-foreground">
        Ocorreu um erro inesperado.
      </p>
      <Link
        href="/login"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Voltar para login
      </Link>
    </div>
  );
}
