import { describe, it, expect } from "vitest";
import {
  parseInboundMessages,
  logInboundWhatsApp,
} from "./crm-inbound";

/** A WhatsApp Cloud API webhook body carrying one inbound text message. */
function textMessageBody(
  overrides: {
    id?: string;
    from?: string;
    text?: string;
    timestamp?: string;
  } = {}
) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              messages: [
                {
                  id: overrides.id ?? "wamid.HBgL001",
                  from: overrides.from ?? "5511999998888",
                  timestamp: overrides.timestamp ?? "1716000000",
                  type: "text",
                  text: { body: overrides.text ?? "Olá, tudo bem?" },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe("parseInboundMessages", () => {
  it("extracts an inbound text message with its provider id and timestamp", () => {
    const msgs = parseInboundMessages(textMessageBody());
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({
      externalId: "wamid.HBgL001",
      from: "5511999998888",
      text: "Olá, tudo bem?",
    });
    expect(msgs[0].occurredAt).toBe(
      new Date(1716000000 * 1000).toISOString()
    );
  });

  it("returns an empty array for a delivery-status callback (no messages)", () => {
    const statusBody = {
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  { id: "wamid.S1", status: "delivered" },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(parseInboundMessages(statusBody)).toEqual([]);
  });

  it("replaces a non-text message with a media placeholder", () => {
    const body = textMessageBody();
    const msg = body.entry[0].changes[0].value.messages[0] as Record<
      string,
      unknown
    >;
    msg.type = "image";
    delete msg.text;
    const parsed = parseInboundMessages(body);
    expect(parsed[0].text).toBe("[imagem recebida]");
  });

  it("normalises the sender phone to digits only", () => {
    const parsed = parseInboundMessages(
      textMessageBody({ from: "+55 (11) 99999-8888" })
    );
    expect(parsed[0].from).toBe("5511999998888");
  });

  it("skips messages with no id or no sender", () => {
    const body = textMessageBody();
    delete (body.entry[0].changes[0].value.messages[0] as Record<
      string,
      unknown
    >).id;
    expect(parseInboundMessages(body)).toEqual([]);
  });

  it("tolerates a malformed body without throwing", () => {
    expect(parseInboundMessages(null)).toEqual([]);
    expect(parseInboundMessages({})).toEqual([]);
    expect(parseInboundMessages({ entry: "nope" })).toEqual([]);
  });

  it("falls back to a null timestamp when the epoch is absent/invalid", () => {
    const parsed = parseInboundMessages(
      textMessageBody({ timestamp: "not-a-number" })
    );
    expect(parsed[0].occurredAt).toBeNull();
  });
});

/**
 * A minimal Supabase-client stub. `findContactByPhone` selects from
 * `crm_contacts`; `crm_deals` resolves an open deal; `crm_activities` insert
 * records the row. Each builder is a thenable returning the configured data.
 */
function stubClient(opts: {
  contacts?: { id: string; sector_id: string; phone: string | null }[];
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
          maybeSingle: () =>
            Promise.resolve({ data: opts.deal ?? null }),
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

describe("logInboundWhatsApp", () => {
  it("logs an inbound activity when the sender matches a contact", async () => {
    const { client, inserted } = stubClient({
      contacts: [
        { id: "c1", sector_id: "s1", phone: "+55 11 99999-8888" },
      ],
      deal: { id: "d1" },
    });
    const result = await logInboundWhatsApp(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      textMessageBody()
    );
    expect(result).toMatchObject({ parsed: 1, logged: 1, unmatched: 0 });
    expect(inserted[0]).toMatchObject({
      sector_id: "s1",
      contact_id: "c1",
      deal_id: "d1",
      channel: "whatsapp",
      direction: "inbound",
      external_ref: "wamid.HBgL001",
      performed_by: null,
    });
  });

  it("counts an unknown sender as unmatched without inserting", async () => {
    const { client, inserted } = stubClient({ contacts: [] });
    const result = await logInboundWhatsApp(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      textMessageBody()
    );
    expect(result).toMatchObject({ parsed: 1, logged: 0, unmatched: 1 });
    expect(inserted).toHaveLength(0);
  });

  it("threads onto a contact-only activity when there is no open deal", async () => {
    const { client, inserted } = stubClient({
      contacts: [{ id: "c1", sector_id: "s1", phone: "5511999998888" }],
      deal: null,
    });
    await logInboundWhatsApp(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      textMessageBody()
    );
    expect(inserted[0].deal_id).toBeNull();
  });

  it("counts a unique-violation insert as a duplicate (idempotency)", async () => {
    const { client } = stubClient({
      contacts: [{ id: "c1", sector_id: "s1", phone: "5511999998888" }],
      deal: { id: "d1" },
      insertError: { code: "23505" },
    });
    const result = await logInboundWhatsApp(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      textMessageBody()
    );
    expect(result).toMatchObject({ logged: 0, duplicate: 1 });
  });
});
