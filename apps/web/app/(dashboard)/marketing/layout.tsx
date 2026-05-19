/**
 * Marketing module layout.
 *
 * The in-screen navigation tab strip was removed in the nav-shell refactor —
 * Marketing sub-pages now live in the collapsible sidebar tree. This layout
 * is a clean pass-through that keeps only the module title.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Marketing</h1>
        <p className="text-muted-foreground text-sm">
          Campanhas, calendário editorial, audiências e métricas
        </p>
      </div>

      {children}
    </div>
  );
}
