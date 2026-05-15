"use client";

import { useCurrentSector } from "@/hooks/use-current-sector";
import { useHRStats } from "@/hooks/hr/use-hr-stats";
import { useTimeOffRequests } from "@/hooks/hr/use-time-off-requests";
import { useOnboardingInstances } from "@/hooks/hr/use-onboarding";
import { useEmployees } from "@/hooks/hr/use-employees";
import { useExpiringDocuments } from "@/hooks/hr/use-expiring-documents";
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
} from "lucide-react";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

const DOCUMENT_CATEGORY_MAP: Record<string, string> = {
  contract: "Contrato",
  id: "Documento",
  certificate: "Certificado",
  other: "Outro",
};

export default function HRDashboardPage() {
  const { currentSector } = useCurrentSector();
  const { data: stats, isLoading: statsLoading } = useHRStats(
    currentSector?.id
  );
  const { data: timeOffRequests, isLoading: timeOffLoading } =
    useTimeOffRequests(currentSector?.id);
  const { data: onboardings, isLoading: onboardingsLoading } =
    useOnboardingInstances(currentSector?.id);
  const { data: employees, isLoading: employeesLoading } = useEmployees(
    currentSector?.id
  );
  const { data: expiringDocs, isLoading: expiringDocsLoading } =
    useExpiringDocuments(currentSector?.id);

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar o RH.
      </p>
    );
  }

  if (statsLoading) {
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

  const statCards = [
    {
      title: "Colaboradores",
      value: stats?.totalEmployees ?? 0,
      icon: Users,
    },
    {
      title: "Em Licenca",
      value: stats?.onLeave ?? 0,
      icon: UserMinus,
    },
    {
      title: "Solicitacoes Pendentes",
      value: stats?.pendingRequests ?? 0,
      icon: Clock,
    },
    {
      title: "Vagas Abertas",
      value: stats?.openPositions ?? 0,
      icon: Briefcase,
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
    ? "Aniversarios do Mes"
    : "Aniversarios de Empresa";

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
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.title}>
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
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Department Distribution */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">
                Distribuicao por Departamento
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
                Nenhum aniversario este mes.
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
                Ferias nos Proximos 7 Dias
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
                Nenhuma ferias programada nos proximos 7 dias.
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
                Nenhum documento vencendo nos proximos 30 dias.
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
