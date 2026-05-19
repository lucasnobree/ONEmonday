/**
 * RH (HR) module layout.
 *
 * The in-screen navigation tab strip was removed in the nav-shell refactor —
 * HR sub-pages now live in the collapsible sidebar tree. This layout is a
 * clean pass-through that keeps only the module title.
 */
export default function HRLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">RH</h1>
        <p className="text-muted-foreground text-sm">
          Gestão de pessoas, férias e recrutamento
        </p>
      </div>

      {children}
    </div>
  );
}
