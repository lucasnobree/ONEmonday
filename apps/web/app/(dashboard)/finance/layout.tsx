/**
 * Financeiro (Finance) module layout.
 *
 * The in-screen navigation tab strip was removed in the nav-shell refactor —
 * Finance sub-pages now live in the collapsible sidebar tree. This layout is
 * a clean pass-through that keeps only the module title.
 */
export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="text-muted-foreground text-sm">
          Contas a pagar e receber, orçamentos e fluxo de caixa
        </p>
      </div>

      {children}
    </div>
  );
}
