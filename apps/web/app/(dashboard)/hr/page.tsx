"use client";

import Link from "next/link";
import { useSectorScope } from "@/hooks/use-sector-scope";
import { SectorScopeFilter } from "@/components/shared/sector-scope-filter";
import { useHRStats } from "@/hooks/hr/use-hr-stats";
import { useTimeOffRequests } from "@/hooks/hr/use-time-off-requests";
import { useOnboardingInstances } from "@/hooks/hr/use-onboarding";
import { useEmployees } from "@/hooks/hr/use-employees";
import { useExpiringDocuments } from "@/hooks/hr/use-expiring-documents";
import { useHeadcountAnalytics } from "@/hooks/hr/use-headcount-analytics";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserMinus,
  Clock,
  Briefcase,
  Cake,
  BarChart3,
  CalendarCheck,
  UserCog,
  FileWarning,
  TrendingUp,
  UserPlus,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

const DOCUMENT_CATEGORY_MAP: Record<string, string> = {
  contract: "Contrato",
  id: "Documento",
  certificate: "Certificado",
  other: "Outro",
};

export default function HRDashboardPage() {
  const { scope, isLoading: scopeLoading } = useSectorScope();
  const { data: stats, isLoading: statsLoading } = useHRStats(scope);
  const { data: timeOffRequests, isLoading: timeOffLoading } =
    useTimeOffRequests(scope);
  const { data: onboardings, isLoading: onboardingsLoading } =
    useOnboardingInstances(scope);
  const { data: employees, isLoading: employeesLoading } = useEmployees(scope);
  const { data: expiringDocs, isLoading: expiringDocsLoading } =
    useExpiringDocuments(scope);
  const { data: headcount, isLoading: headcountLoading } =
    useHeadcountAnalytics(scope, 12);

  if (scopeLoading || statsLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-muted" />
      </div>
    );
  }

  const statCards: {
    title: string;
    value: number;
    icon: typeof Users;
    href?: string;
  }[] = [
    {
      title: "Colaboradores",
      value: stats?.totalEmployees ?? 0,
      icon: Users,
      href: "/hr/employees",
    },
    {
      title: "Em Licença",
      value: stats?.onLeave ?? 0,
      icon: UserMinus,
      href: "/hr/employees?status=on_leave",
    },
    {
      title: "Solicitações Pendentes",
      value: stats?.pendingRequests ?? 0,
      icon: Clock,
      href: "/hr/time-off?status=pending",
    },
    {
      title: "Vagas Abertas",
      value: stats?.openPositions ?? 0,
      icon: Briefcase,
      href: "/hr/recruitment",
    },
  ];

  // Department distribution
  const deptCounts: Record<string, number> = {};
  const activeEmployees = (employees ?? []).filter(
    (e) => e.status !== "terminated"
  );
  activeEmployees.forEach((e) => {
    const dept = e.department || "Sem departamento";
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  });
  const maxDeptCount = Math.max(...Object.values(deptCounts), 1);
  const deptEntries = Object.entries(deptCounts).sort(
    ([, a], [, b]) => b - a
  );

  // Single "now" reference reused across the dashboard's date math.
  const now = new Date();

  // Birthdays this month
  const currentMonth = now.getMonth() + 1;
  const birthdaysThisMonth = activeEmployees.filter((e) => {
    if (!e.birth_date) return false;
    const month = new Date(e.birth_date).getMonth() + 1;
    return month === currentMonth;
  });

  const hireAnniversaries = activeEmployees.filter((e) => {
    const month = new Date(e.hire_date).getMonth() + 1;
    return month === currentMonth;
  });

  const hasBirthdays = birthdaysThisMonth.length > 0;
  const celebrationList = hasBirthdays ? birthdaysThisMonth : hireAnniversaries;
  const celebrationTitle = hasBirthdays
    ? "Aniversários do Mês"
    : "Aniversários de Empresa";

  // Active onboardings
  const activeOnboardings = (onboardings ?? []).filter(
    (o) => o.status === "in_progress"
  );

  // Upcoming time-off (next 7 days)
  const weekFromNow = new Date(now);
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const upcomingTimeOff = (timeOffRequests ?? [])
    .filter((r) => {
      if (r.status !== "approved") return false;
      const start = new Date(r.start_date);
      return start >= now && start <= weekFromNow;
    })
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <SectorScopeFilter />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const content = (
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <card.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-bold">{card.value}</p>
                </div>
              </div>
            </CardContent>
          );

          return card.href ? (
            <Link
              key={card.title}
              href={card.href}
              className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="transition-colors hover:bg-muted/50">
                {content}
              </Card>
            </Link>
          ) : (
            <Card key={card.title}>{content}</Card>
          );
        })}
      </div>

      {/* Headcount & turnover analytics (trailing 12 months) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">
                Headcount e Rotatividade
              </CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              Últimos 12 meses
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {headcountLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  Headcount atual
                </div>
                <p className="mt-1 text-2xl font-bold">
                  {headcount?.current_headcount ?? 0}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UserPlus className="h-3.5 w-3.5" />
                  Contratações
                </div>
                <p className="mt-1 text-2xl font-bold text-green-600">
                  {headcount?.hires_in_window ?? 0}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UserMinus className="h-3.5 w-3.5" />
                  Desligamentos
                </div>
                <p className="mt-1 text-2xl font-bold text-red-600">
                  {headcount?.exits_in_window ?? 0}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Rotatividade
                </div>
                <p className="mt-1 text-2xl font-bold">
                  {(headcount?.turnover_rate ?? 0).toLocaleString("pt-BR")}%
                </p>
              </div>
            </div>
          )}
          {!headcountLoading && (
            <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              {(headcount?.net_change ?? 0) >= 0 ? (
                <ArrowUp className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5 text-red-600" />
              )}
              Variação líquida de{" "}
              <span className="font-medium text-foreground">
                {(headcount?.net_change ?? 0) > 0 ? "+" : ""}
                {headcount?.net_change ?? 0}
              </span>{" "}
              colaborador{Math.abs(headcount?.net_change ?? 0) === 1 ? "" : "es"}{" "}
              no período.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Department Distribution */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">
                Distribuição por Departamento
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {employeesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-6 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : deptEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum departamento encontrado.
              </p>
            ) : (
              <div className="space-y-3">
                {deptEntries.map(([dept, count]) => (
                  <div key={dept} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{dept}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${(count / maxDeptCount) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Birthdays / Hire anniversaries */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Cake className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">{celebrationTitle}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {employeesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-8 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : celebrationList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum aniversário este mês.
              </p>
            ) : (
              <div className="space-y-2">
                {celebrationList.slice(0, 8).map((emp) => {
                  const dateStr = hasBirthdays
                    ? emp.birth_date!
                    : emp.hire_date;
                  const d = new Date(dateStr);
                  const dayMonth = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
                  const initials = emp.full_name
                    .split(/\s+/)
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  return (
                    <div
                      key={emp.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                        {initials}
                      </div>
                      <span className="flex-1 truncate">
                        {emp.full_name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {dayMonth}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Onboardings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCog className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Onboardings Ativos</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {onboardingsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-16 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : activeOnboardings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum onboarding em andamento.
              </p>
            ) : (
              <div className="space-y-3">
                {activeOnboardings.slice(0, 5).map((ob) => {
                  const completed = ob.items.filter(
                    (i) => i.is_completed
                  ).length;
                  const total = ob.items.length;
                  const pct =
                    total > 0 ? Math.round((completed / total) * 100) : 0;
                  const daysSince = Math.floor(
                    (now.getTime() - new Date(ob.start_date).getTime()) /
                      (1000 * 60 * 60 * 24)
                  );

                  return (
                    <div key={ob.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {ob.employee.full_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {daysSince}d
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {ob.template.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {completed}/{total}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Time-Off */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">
                Férias nos Próximos 7 Dias
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {timeOffLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-8 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : upcomingTimeOff.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma férias programada nos próximos 7 dias.
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingTimeOff.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-medium">
                        {req.hr_employees.full_name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {dateFormat.format(new Date(req.start_date))} -{" "}
                        {dateFormat.format(new Date(req.end_date))}
                      </span>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {req.days_count}d
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiring Documents */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Documentos Vencendo</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {expiringDocsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-8 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : (expiringDocs ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum documento vencendo nos próximos 30 dias.
              </p>
            ) : (
              <div className="space-y-2">
                {(expiringDocs ?? []).slice(0, 6).map((doc) => {
                  const expired = doc.days_until_expiry < 0;
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="min-w-0">
                        <span className="font-medium truncate block">
                          {doc.employee_name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {DOCUMENT_CATEGORY_MAP[doc.category] ?? doc.category}
                          {" - "}
                          {dateFormat.format(new Date(doc.expiry_date))}
                        </span>
                      </div>
                      <Badge
                        variant={expired ? "destructive" : "outline"}
                        className="shrink-0 text-xs"
                      >
                        {expired
                          ? "Vencido"
                          : `${doc.days_until_expiry}d`}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
