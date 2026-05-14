export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">ONEmonday</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Gestão de projetos e tarefas
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
