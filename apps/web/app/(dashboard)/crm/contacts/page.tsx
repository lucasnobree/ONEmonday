"use client";

import { useState, useMemo } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useContacts } from "@/hooks/crm/use-contacts";
import { ContactFormDialog } from "@/components/crm/contact-form-dialog";
import { ContactDetailSheet } from "@/components/crm/contact-detail-sheet";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Mail, Phone, Building2, UserRound } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function ContactsPage() {
  const { currentSector } = useCurrentSector();
  const { data: contacts, isLoading } = useContacts(currentSector?.id);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!contacts) return [];
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.company?.name?.toLowerCase().includes(q) ||
        c.position?.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar os contatos.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 rounded-lg bg-muted animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contatos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Novo Contato
        </Button>
      </div>

      {!contacts?.length && !search ? (
        <EmptyState
          icon={UserRound}
          title="Nenhum contato cadastrado"
          description="Adicione seu primeiro contato para comecar a gerenciar seu relacionamento com clientes."
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Novo Contato
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhum contato encontrado para a busca.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((contact) => (
            <Card
              key={contact.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedContactId(contact.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">
                    {contact.full_name}
                  </CardTitle>
                  {contact.is_primary && (
                    <Badge variant="secondary">Principal</Badge>
                  )}
                </div>
                {contact.position && (
                  <p className="text-sm text-muted-foreground">
                    {contact.position}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {contact.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span>{contact.email}</span>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{contact.phone}</span>
                  </div>
                )}
                {contact.company && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{contact.company.name}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ContactFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        sectorId={currentSector.id}
      />

      <ContactDetailSheet
        contactId={selectedContactId}
        sectorId={currentSector.id}
        open={!!selectedContactId}
        onOpenChange={(o) => !o && setSelectedContactId(null)}
      />
    </div>
  );
}
