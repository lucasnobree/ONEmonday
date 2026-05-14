"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useActivities } from "@/hooks/crm/use-activities";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  Mail,
  Phone,
  Building2,
  Star,
  FileText,
  Calendar,
} from "lucide-react";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

const activityTypeLabels: Record<string, string> = {
  call: "Ligacao",
  email: "Email",
  meeting: "Reuniao",
  note: "Nota",
  task: "Tarefa",
};

const activityTypeDots: Record<string, string> = {
  call: "bg-blue-500",
  email: "bg-green-500",
  meeting: "bg-purple-500",
  note: "bg-gray-400",
  task: "bg-yellow-500",
};

interface ContactDetailSheetProps {
  contactId: string | null;
  sectorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactDetailSheet({
  contactId,
  sectorId,
  open,
  onOpenChange,
}: ContactDetailSheetProps) {
  const supabase = createClient();

  const { data: contact, isLoading } = useQuery({
    queryKey: ["crm-contact-detail", contactId],
    queryFn: async () => {
      if (!contactId) return null;
      const { data, error } = await supabase
        .from("crm_contacts")
        .select(
          `
          id, sector_id, full_name, email, phone, position,
          is_primary, notes, created_at,
          crm_companies (id, name, industry)
        `
        )
        .eq("id", contactId)
        .single();
      if (error) throw error;
      const company = Array.isArray(data.crm_companies) ? data.crm_companies[0] : data.crm_companies;
      return { ...data, company };
    },
    enabled: !!contactId,
  });

  const { data: activities } = useActivities({
    sectorId,
    contactId: contactId ?? undefined,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !contact ? (
          <div className="p-4 text-muted-foreground">
            Contato nao encontrado.
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                  {contact.full_name
                    .split(" ")
                    .map((n: string) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div>
                  <SheetTitle className="flex items-center gap-1.5">
                    {contact.full_name}
                    {contact.is_primary && (
                      <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                    )}
                  </SheetTitle>
                  <SheetDescription>
                    {[contact.position, contact.company?.name]
                      .filter(Boolean)
                      .join(" · ")}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <Tabs defaultValue="info" className="px-4">
              <TabsList variant="line" className="w-full justify-start">
                <TabsTrigger value="info">Informacoes</TabsTrigger>
                <TabsTrigger value="atividades">
                  Atividades ({activities?.length ?? 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4 space-y-4">
                <div className="space-y-3 text-sm">
                  {contact.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{contact.email}</span>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{contact.phone}</span>
                    </div>
                  )}
                  {contact.position && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{contact.position}</span>
                    </div>
                  )}
                  {contact.company && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>
                        {contact.company.name}
                        {contact.company.industry &&
                          ` · ${contact.company.industry}`}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>
                      Cadastrado em{" "}
                      {dateFormat.format(new Date(contact.created_at))}
                    </span>
                  </div>
                </div>

                {contact.notes && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Notas</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {contact.notes}
                      </p>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="atividades" className="mt-4">
                {!activities?.length ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Nenhuma atividade registrada para este contato.
                  </p>
                ) : (
                  <div className="space-y-0 border-l-2 border-muted ml-3">
                    {activities.map((activity) => (
                      <div
                        key={activity.id}
                        className="relative pl-6 pb-4"
                      >
                        <div
                          className={`absolute -left-[5px] top-1 h-2 w-2 rounded-full ${
                            activityTypeDots[activity.type] || "bg-gray-400"
                          }`}
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground uppercase">
                              {activityTypeLabels[activity.type] ||
                                activity.type}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {dateFormat.format(
                                new Date(activity.created_at)
                              )}
                            </span>
                          </div>
                          <p className="text-sm font-medium">
                            {activity.subject}
                          </p>
                          {activity.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {activity.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            por {activity.user?.full_name ?? "—"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
