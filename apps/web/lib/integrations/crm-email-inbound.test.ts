import { describe, it, expect } from "vitest";
import {
  parseInboundEmail,
  logInboundEmail,
  extractAddress,
} from "./crm-email-inbound";

/** A Resend inbound-email webhook body carrying one received email. */
function inboundEmailBody(
  overrides: {
    id?: string;
    from?: string;
    subject?: string;
    text?: string;
    html?: string;
    createdAt?: string;
  } = {}
) {
  const data: Record<string, unknown> = {
    email_id: overrides.id ?? "email_abc123",
    from: overrides.from ?? "Cliente <cliente@empresa.com>",
    subject: overrides.subject ?? "Re: Proposta comercial",
    created_at: overrides.createdAt ?? "2026-05-18T10:00:00.000Z",
  };
  if (overrides.html !== undefined) data.html = overrides.html;
  else data.text = overrides.text ?? "Obrigado pelo retorno.";
  return { type: "inbound.email.received", data };
}

describe("extractAddress", () => {
  it("extracts the address from a `Name <addr>` value", () => {
    expect(extractAddress("Ana Lima <ana@x.com>")).toBe("ana@x.com");
  });

  it("returns a bare address lower-cased", () => {
    expect(extractAddress("Bob@Example.COM")).toBe("bob@example.com");
  });

  it("returns null for a non-address / non-string", () => {
    expect(extractAddress("not-an-address")).toBeNull();
    expect(extractAddress(null)).toBeNull();
    expect(extractAddress(42)).toBeNull();
    expect(extractAddress("")).toBeNull();
  });
});

describe("parseInboundEmail", () => {
  it("extracts an inbound email with its id, sender, subject and timestamp", () => {
    const email = parseInboundEmail(inboundEmailBody());
    expect(email).toMatchObject({
      externalId: "email_abc123",
      from: "cliente@empresa.com",
      subject: "Re: Proposta comercial",
      text: "Obrigado pelo retorno.",
    });
    expect(email?.occurredAt).toBe(
      new Date("2026-05-18T10:00:00.000Z").toISOString()
    );
  });

  it("falls back to plain text derived from HTML when no text part exists", () => {
    const email = parseInboundEmail(
      inboundEmailBody({ html: "<p>Olá</p><p>Tudo bem?</p>" })
    );
    expect(email?.text).toBe("Olá\nTudo bem?");
  });

  it("uses a placeholder subject when the subject is absent", () => {
    const email = parseInboundEmail(inboundEmailBody({ subject: "" }));
    expect(email?.subject).toBe("(sem assunto)");
  });

  it("accepts a flat body without the `data` envelope", () => {
    const email = parseInboundEmail({
      id: "email_flat",
      from: "x@y.com",
      subject: "Oi",
      text: "corpo",
    });
    expect(email?.externalId).toBe("email_flat");
    expect(email?.from).toBe("x@y.com");
  });

  it("returns null when there is no usable id", () => {
    const body = inboundEmailBody();
    delete (body.data as Record<string, unknown>).email_id;
    expect(parseInboundEmail(body)).toBeNull();
  });

  it("returns null when the sender has no resolvable address", () => {
    expect(parseInboundEmail(inboundEmailBody({ from: "no-address" }))).toBeNull();
  });

  it("tolerates a malformed body without throwing", () => {
    expect(parseInboundEmail(null)).toBeNull();
    expect(parseInboundEmail("nope")).toBeNull();
    expect(parseInboundEmail({})).toBeNull();
  });

  it("falls back to a null timestamp when created_at is absent/invalid", () => {
    const email = parseInboundEmail(
      inboundEmailBody({ createdAt: "not-a-date" })
    );
    expect(email?.occurredAt).toBeNull();
  });
});

/**
 * A minimal Supabase-client stub. `findContactByEmail` selects from
 * `crm_contacts`; `crm_deals` resolves an open deal; `crm_activities` insert
 * records the row. Each builder is a thenable returning the configured data.
 */
function stubClient(opts: {
  contacts?: { id: string; sector_id: string; email: string | null }[];
  deal?: { id: string } | null;
  insertError?: { code?: string } | null;
}) {
  const inserted: Record<string, unknown>[] = [];
  const client = {
    from(table: string) {
      if (table === "crm_contacts") {
        const builder: Record<string, unknown> = {
          select: () => builder,
          eq: () => builder,
          ilike: () => builder,
          limit: () => Promise.resolve({ data: opts.contacts ?? [] }),
        };
        return builder;
      }
      if (table === "crm_deals") {
        const builder: Record<string, unknown> = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          order: () => builder,
          limit: () => builder,
          maybeSingle: () => Promise.resolve({ data: opts.deal ?? null }),
        };
        return builder;
      }
      if (table === "crm_activities") {
        return {
          insert: (row: Record<string, unknown>) => {
            if (!opts.insertError) inserted.push(row);
            return Promise.resolve({ error: opts.insertError ?? null });
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { client, inserted };
}

describe("logInboundEmail", () => {
  it("logs an inbound email activity when the sender matches a contact", async () => {
    const { client, inserted } = stubClient({
      contacts: [
        { id: "c1", sector_id: "s1", email: "cliente@empresa.com" },
      ],
      deal: { id: "d1" },
    });
    const result = await logInboundEmail(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      inboundEmailBody()
    );
    expect(result).toMatchObject({
      parsed: true,
      logged: true,
      unmatched: false,
      duplicate: false,
    });
    expect(inserted[0]).toMatchObject({
      sector_id: "s1",
      contact_id: "c1",
      deal_id: "d1",
      type: "email",
      channel: "email",
      direction: "inbound",
      subject: "Re: Proposta comercial",
      external_ref: "email_abc123",
      performed_by: null,
    });
  });

  it("matches case-insensitively on the sender address", async () => {
    const { client, inserted } = stubClient({
      contacts: [
        { id: "c1", sector_id: "s1", email: "Cliente@Empresa.COM" },
      ],
      deal: { id: "d1" },
    });
    const result = await logInboundEmail(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      inboundEmailBody({ from: "cliente@empresa.com" })
    );
    expect(result.logged).toBe(true);
    expect(inserted[0].contact_id).toBe("c1");
  });

  it("counts an unknown sender as unmatched without inserting", async () => {
    const { client, inserted } = stubClient({ contacts: [] });
    const result = await logInboundEmail(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      inboundEmailBody()
    );
    expect(result).toMatchObject({ parsed: true, logged: false, unmatched: true });
    expect(inserted).toHaveLength(0);
  });

  it("threads onto a contact-only activity when there is no open deal", async () => {
    const { client, inserted } = stubClient({
      contacts: [
        { id: "c1", sector_id: "s1", email: "cliente@empresa.com" },
      ],
      deal: null,
    });
    await logInboundEmail(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      inboundEmailBody()
    );
    expect(inserted[0].deal_id).toBeNull();
  });

  it("counts a unique-violation insert as a duplicate (idempotency)", async () => {
    const { client } = stubClient({
      contacts: [
        { id: "c1", sector_id: "s1", email: "cliente@empresa.com" },
      ],
      deal: { id: "d1" },
      insertError: { code: "23505" },
    });
    const result = await logInboundEmail(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      inboundEmailBody()
    );
    expect(result).toMatchObject({ logged: false, duplicate: true });
  });

  it("treats an ambiguous multi-match as unmatched", async () => {
    const { client, inserted } = stubClient({
      contacts: [
        { id: "c1", sector_id: "s1", email: "cliente@empresa.com" },
        { id: "c2", sector_id: "s2", email: "cliente@empresa.com" },
      ],
      deal: { id: "d1" },
    });
    const result = await logInboundEmail(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      inboundEmailBody()
    );
    expect(result).toMatchObject({ logged: false, unmatched: true });
    expect(inserted).toHaveLength(0);
  });

  it("reports parsed:false for a non-inbound / unparseable body", async () => {
    const { client, inserted } = stubClient({ contacts: [] });
    const result = await logInboundEmail(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      { type: "email.delivered", data: { status: "delivered" } }
    );
    expect(result).toMatchObject({ parsed: false, logged: false });
    expect(inserted).toHaveLength(0);
  });
});
