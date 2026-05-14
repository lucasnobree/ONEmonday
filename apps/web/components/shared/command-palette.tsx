"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Kanban,
  FolderKanban,
  Headphones,
  Users,
  UserCog,
  Settings,
  Search,
  Plus,
  CreditCard,
  User,
  Clock,
  DollarSign,
  Building2,
  UserCircle,
} from "lucide-react";
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { createClient } from "@/lib/supabase/client";
import { useCurrentSector } from "@/hooks/use-current-sector";

const RECENT_SEARCHES_KEY = "onemonday-recent-searches";
const MAX_RECENT = 5;

const currencyFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

interface SearchResult {
  id: string;
  label: string;
  href: string;
  type: "board" | "card" | "user" | "ticket" | "deal" | "contact" | "company" | "employee";
}

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(query: string) {
  if (!query.trim()) return;
  const recent = getRecentSearches().filter((s) => s !== query);
  recent.unshift(query);
  localStorage.setItem(
    RECENT_SEARCHES_KEY,
    JSON.stringify(recent.slice(0, MAX_RECENT))
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [boards, setBoards] = useState<SearchResult[]>([]);
  const [cards, setCards] = useState<SearchResult[]>([]);
  const [users, setUsers] = useState<SearchResult[]>([]);
  const [tickets, setTickets] = useState<SearchResult[]>([]);
  const [deals, setDeals] = useState<SearchResult[]>([]);
  const [contacts, setContacts] = useState<SearchResult[]>([]);
  const [companies, setCompanies] = useState<SearchResult[]>([]);
  const [employees, setEmployees] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const { currentSector } = useCurrentSector();
  const supabase = createClient();

  const basePath = currentSector ? `/${currentSector.slug}` : "";

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function handleOpen() {
      setOpen(true);
    }
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleOpen);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleOpen);
    };
  }, []);

  function clearResults() {
    setBoards([]);
    setCards([]);
    setUsers([]);
    setTickets([]);
    setDeals([]);
    setContacts([]);
    setCompanies([]);
    setEmployees([]);
  }

  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
      setQuery("");
      clearResults();
    }
  }, [open]);

  const searchSupabase = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        clearResults();
        return;
      }

      setLoading(true);
      const term = `%${searchQuery}%`;

      try {
        const boardsQuery = currentSector
          ? supabase
              .from("board_sectors")
              .select("board_id, boards!inner(id, name)")
              .eq("sector_id", currentSector.id)
              .ilike("boards.name", term)
              .limit(5)
          : supabase
              .from("boards")
              .select("id, name")
              .ilike("name", term)
              .limit(5);

        const cardsQuery = currentSector
          ? supabase
              .from("cards")
              .select("id, title, board_id")
              .eq("sector_id", currentSector.id)
              .ilike("title", term)
              .limit(5)
          : supabase
              .from("cards")
              .select("id, title, board_id")
              .ilike("title", term)
              .limit(5);

        const usersQuery = supabase
          .from("users")
          .select("id, full_name, email")
          .or(`full_name.ilike.${term},email.ilike.${term}`)
          .eq("is_active", true)
          .limit(5);

        const ticketsQuery = supabase
          .from("support_tickets")
          .select("id, title, priority, status")
          .ilike("title", term)
          .limit(5);

        const dealsQuery = supabase
          .from("crm_deals")
          .select("id, name, value, stage")
          .ilike("name", term)
          .limit(5);

        const contactsQuery = supabase
          .from("crm_contacts")
          .select("id, full_name, email")
          .or(`full_name.ilike.${term},email.ilike.${term}`)
          .limit(5);

        const companiesQuery = supabase
          .from("crm_companies")
          .select("id, name, industry")
          .ilike("name", term)
          .limit(5);

        const employeesQuery = supabase
          .from("hr_employees")
          .select("id, full_name, position")
          .or(`full_name.ilike.${term},position.ilike.${term}`)
          .limit(5);

        const [
          boardsRes,
          cardsRes,
          usersRes,
          ticketsRes,
          dealsRes,
          contactsRes,
          companiesRes,
          employeesRes,
        ] = await Promise.all([
          boardsQuery,
          cardsQuery,
          usersQuery,
          ticketsQuery,
          dealsQuery,
          contactsQuery,
          companiesQuery,
          employeesQuery,
        ]);

        if (boardsRes.data) {
          const mapped: SearchResult[] = currentSector
            ? (boardsRes.data as any[]).map((bs) => ({
                id: bs.boards.id,
                label: bs.boards.name,
                href: `${basePath}/boards/${bs.boards.id}`,
                type: "board" as const,
              }))
            : (boardsRes.data as any[]).map((b) => ({
                id: b.id,
                label: b.name,
                href: `/boards/${b.id}`,
                type: "board" as const,
              }));
          setBoards(mapped);
        }

        if (cardsRes.data) {
          setCards(
            (cardsRes.data as any[]).map((c) => ({
              id: c.id,
              label: c.title,
              href: `${basePath}/boards/${c.board_id}?card=${c.id}`,
              type: "card" as const,
            }))
          );
        }

        if (usersRes.data) {
          setUsers(
            (usersRes.data as any[]).map((u) => ({
              id: u.id,
              label: u.full_name,
              href: `/settings`,
              type: "user" as const,
            }))
          );
        }

        if (ticketsRes.data) {
          setTickets(
            (ticketsRes.data as any[]).map((t) => ({
              id: t.id,
              label: `#${t.id.slice(0, 8)} ${t.title}`,
              href: `/support/tickets`,
              type: "ticket" as const,
            }))
          );
        }

        if (dealsRes.data) {
          setDeals(
            (dealsRes.data as any[]).map((d) => ({
              id: d.id,
              label: d.value
                ? `${d.name} \u00B7 ${currencyFmt.format(d.value)}`
                : d.name,
              href: `/crm/deals`,
              type: "deal" as const,
            }))
          );
        }

        if (contactsRes.data) {
          setContacts(
            (contactsRes.data as any[]).map((c) => ({
              id: c.id,
              label: c.email ? `${c.full_name} (${c.email})` : c.full_name,
              href: `/crm/contacts`,
              type: "contact" as const,
            }))
          );
        }

        if (companiesRes.data) {
          setCompanies(
            (companiesRes.data as any[]).map((c) => ({
              id: c.id,
              label: c.industry ? `${c.name} \u00B7 ${c.industry}` : c.name,
              href: `/crm/companies`,
              type: "company" as const,
            }))
          );
        }

        if (employeesRes.data) {
          setEmployees(
            (employeesRes.data as any[]).map((e) => ({
              id: e.id,
              label: e.position
                ? `${e.full_name} \u00B7 ${e.position}`
                : e.full_name,
              href: `/hr/employees`,
              type: "employee" as const,
            }))
          );
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    },
    [currentSector, basePath, supabase]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      clearResults();
      return;
    }
    debounceRef.current = setTimeout(() => {
      searchSupabase(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchSupabase]);

  function navigate(href: string) {
    if (query.trim()) addRecentSearch(query);
    setOpen(false);
    router.push(href);
  }

  function handleRecentClick(recent: string) {
    setQuery(recent);
  }

  const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Boards", href: `${basePath}/boards`, icon: Kanban },
    { label: "Projetos", href: `${basePath}/projects`, icon: FolderKanban },
    { label: "Support Desk", href: "/support", icon: Headphones },
    { label: "CRM", href: "/crm", icon: Users },
    { label: "RH Portal", href: "/hr", icon: UserCog },
    { label: "Configuracoes", href: "/settings", icon: Settings },
  ];

  const actionItems = [
    { label: "Novo Ticket", href: "/support", icon: Plus },
    { label: "Novo Deal", href: "/crm", icon: Plus },
    { label: "Novo Contato", href: "/crm", icon: Plus },
    { label: "Nova Empresa", href: "/crm", icon: Plus },
    { label: "Novo Colaborador", href: "/hr", icon: Plus },
  ];

  const hasQuery = query.trim().length > 0;
  const hasDynamicResults =
    boards.length > 0 ||
    cards.length > 0 ||
    users.length > 0 ||
    tickets.length > 0 ||
    deals.length > 0 ||
    contacts.length > 0 ||
    companies.length > 0 ||
    employees.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Buscar paginas, boards, cards e pessoas"
      className="sm:max-w-lg"
    >
      <Command>
        <CommandInput
          placeholder="Buscar..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {loading ? "Buscando..." : "Nenhum resultado encontrado."}
          </CommandEmpty>

          {!hasQuery && recentSearches.length > 0 && (
            <CommandGroup heading="Recentes">
              {recentSearches.map((recent) => (
                <CommandItem
                  key={recent}
                  value={`recent-${recent}`}
                  onSelect={() => handleRecentClick(recent)}
                >
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{recent}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="Navegacao">
            {navItems.map((item) => (
              <CommandItem
                key={item.href}
                value={item.label}
                onSelect={() => navigate(item.href)}
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Acoes">
            {actionItems.map((item, i) => (
              <CommandItem
                key={`${item.label}-${i}`}
                value={item.label}
                onSelect={() => navigate(item.href)}
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          {hasQuery && boards.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Boards">
                {boards.map((board) => (
                  <CommandItem
                    key={board.id}
                    value={`board-${board.label}`}
                    onSelect={() => navigate(board.href)}
                  >
                    <Kanban className="h-4 w-4 text-muted-foreground" />
                    <span>{board.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {hasQuery && cards.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Cards">
                {cards.map((card) => (
                  <CommandItem
                    key={card.id}
                    value={`card-${card.label}`}
                    onSelect={() => navigate(card.href)}
                  >
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span>{card.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {hasQuery && tickets.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Tickets">
                {tickets.map((ticket) => (
                  <CommandItem
                    key={ticket.id}
                    value={`ticket-${ticket.label}`}
                    onSelect={() => navigate(ticket.href)}
                  >
                    <Headphones className="h-4 w-4 text-muted-foreground" />
                    <span>{ticket.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {hasQuery && deals.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Deals">
                {deals.map((deal) => (
                  <CommandItem
                    key={deal.id}
                    value={`deal-${deal.label}`}
                    onSelect={() => navigate(deal.href)}
                  >
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>{deal.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {hasQuery && contacts.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Contatos">
                {contacts.map((contact) => (
                  <CommandItem
                    key={contact.id}
                    value={`contact-${contact.label}`}
                    onSelect={() => navigate(contact.href)}
                  >
                    <UserCircle className="h-4 w-4 text-muted-foreground" />
                    <span>{contact.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {hasQuery && companies.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Empresas">
                {companies.map((company) => (
                  <CommandItem
                    key={company.id}
                    value={`company-${company.label}`}
                    onSelect={() => navigate(company.href)}
                  >
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{company.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {hasQuery && employees.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Colaboradores">
                {employees.map((emp) => (
                  <CommandItem
                    key={emp.id}
                    value={`employee-${emp.label}`}
                    onSelect={() => navigate(emp.href)}
                  >
                    <UserCog className="h-4 w-4 text-muted-foreground" />
                    <span>{emp.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {hasQuery && users.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Pessoas">
                {users.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={`user-${user.label}`}
                    onSelect={() => navigate(user.href)}
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{user.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {hasQuery && loading && !hasDynamicResults && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Buscando...
            </div>
          )}

          <CommandSeparator />

          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                ↑↓
              </kbd>
              <span>navegar</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                Enter
              </kbd>
              <span>selecionar</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                Esc
              </kbd>
              <span>fechar</span>
            </div>
          </div>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

export function CommandPaletteTrigger() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
    >
      <Search className="h-4 w-4" />
      <span className="flex-1 text-left">Buscar...</span>
      <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
        Ctrl+K
      </kbd>
    </button>
  );
}
