/**
 * Support Desk module layout.
 *
 * The in-screen navigation tab strip was removed in the nav-shell refactor —
 * Support sub-pages now live in the collapsible sidebar tree. This layout is
 * a clean pass-through that keeps only the module title.
 */
export default function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Support Desk</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Central de atendimento com tickets, SLA e base de conhecimento.
        </p>
      </div>

      {children}
    </div>
  );
}
