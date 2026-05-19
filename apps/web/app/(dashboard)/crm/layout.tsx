/**
 * CRM module layout.
 *
 * The in-screen navigation tab strip was removed in the nav-shell refactor —
 * CRM sub-pages (Leads, Pipeline, Contatos, ...) are now reached from the
 * collapsible sidebar tree. This layout is a clean pass-through that keeps
 * only the module title; each screen owns its own data filters.
 */
export default function CRMLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">CRM</h1>
        <p className="text-muted-foreground text-sm">
          Gestão de relacionamento com clientes
        </p>
      </div>

      {children}
    </div>
  );
}
