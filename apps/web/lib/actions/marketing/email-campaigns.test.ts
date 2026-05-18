import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression coverage for Marketing B1.
 *
 * The automation-sequence runner used to call the campaign-blast
 * `sendEmailCampaign`, which marks the email campaign `sent` and locks it — so
 * only the FIRST enrolled recipient ever got an email; every later enrollment
 * hit "Campanha já enviada" and was silently advanced with no send.
 *
 * The fix is `sendCampaignEmailToRecipient`: a per-recipient primitive that
 * sends one email via the ESP adapter and records ONE `marketing_email_sends`
 * row, WITHOUT ever updating `marketing_email_campaigns` (no status flip, no
 * counter mutation). These tests assert exactly that invariant.
 */

/** A configurable ESP-adapter send result. */
let adapterSend = vi.fn();

vi.mock("@/lib/integrations/email-registry", () => ({
  DEFAULT_EMAIL_PROVIDER: "resend",
  resolveEmailAdapter: () => ({
    provider: "resend",
    isConfigured: () => true,
    send: adapterSend,
  }),
}));

vi.mock("@/lib/integrations/email-credential-loader", () => ({
  loadEmailCredential: async () => ({
    provider: "resend",
    config: { secret: { apiKey: "re_test" }, metadata: {} },
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/** Tables the supabase stub was asked to write, for assertions. */
const writes: { table: string; op: string; row: unknown }[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from(table: string) {
      if (table === "marketing_email_campaigns") {
        const builder: Record<string, unknown> = {
          select: () => builder,
          eq: () => builder,
          single: () =>
            Promise.resolve({
              data: {
                id: "ec-1",
                sector_id: "s1",
                subject: "Olá",
                from_name: "Equipe",
                from_email: "no-reply@acme.com",
                reply_to: null,
                body_html: "<p>hi</p>",
                body_text: "hi",
              },
            }),
          // A campaign UPDATE here would be the B1 bug — record it so the test
          // can fail loudly if the primitive ever mutates campaign state.
          update: (row: unknown) => {
            writes.push({ table, op: "update", row });
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
        return builder;
      }
      if (table === "marketing_email_sends") {
        return {
          insert: (row: unknown) => {
            writes.push({ table, op: "insert", row });
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { sendCampaignEmailToRecipient } from "./email-campaigns";

describe("sendCampaignEmailToRecipient (Marketing B1 per-recipient primitive)", () => {
  beforeEach(() => {
    writes.length = 0;
    adapterSend = vi.fn();
  });

  it("records exactly one email-send row and NEVER touches the campaign", async () => {
    adapterSend.mockResolvedValue({ ok: true, providerRef: "esp-1" });
    const result = await sendCampaignEmailToRecipient({
      emailCampaignId: "ec-1",
      recipient: { email: "lead@acme.com", name: "Lead" },
    });
    expect(result.status).toBe("sent");

    // The B1 invariant: a per-recipient send must NOT update the campaign row.
    const campaignWrites = writes.filter(
      (w) => w.table === "marketing_email_campaigns"
    );
    expect(campaignWrites).toEqual([]);

    // Exactly one send row, scoped to the campaign + recipient.
    const sendWrites = writes.filter(
      (w) => w.table === "marketing_email_sends"
    );
    expect(sendWrites).toHaveLength(1);
    expect(sendWrites[0].row).toMatchObject({
      email_campaign_id: "ec-1",
      recipient_email: "lead@acme.com",
      status: "sent",
    });
  });

  it("can send the same campaign to many recipients (no lock after the first)", async () => {
    adapterSend.mockResolvedValue({ ok: true, providerRef: "esp-x" });
    for (const email of ["a@x.com", "b@x.com", "c@x.com"]) {
      const r = await sendCampaignEmailToRecipient({
        emailCampaignId: "ec-1",
        recipient: { email },
      });
      expect(r.status).toBe("sent");
    }
    // Three independent send rows, zero campaign mutations.
    expect(
      writes.filter((w) => w.table === "marketing_email_sends")
    ).toHaveLength(3);
    expect(
      writes.filter((w) => w.table === "marketing_email_campaigns")
    ).toEqual([]);
  });

  it("surfaces an ESP failure as `failed` with a reason (runner must not advance)", async () => {
    adapterSend.mockResolvedValue({ ok: false, error: "ESP rejected" });
    const result = await sendCampaignEmailToRecipient({
      emailCampaignId: "ec-1",
      recipient: { email: "bad@acme.com" },
    });
    expect(result.status).toBe("failed");
    expect(result.error).toContain("ESP rejected");
    // The failed attempt is still recorded as a send row for the audit trail.
    expect(
      writes.filter((w) => w.table === "marketing_email_sends")
    ).toHaveLength(1);
  });

  it("reports `skipped` when the ESP adapter is in no-op mode", async () => {
    adapterSend.mockResolvedValue({ ok: true, noop: true });
    const result = await sendCampaignEmailToRecipient({
      emailCampaignId: "ec-1",
      recipient: { email: "lead@acme.com" },
    });
    expect(result.status).toBe("skipped");
  });

  it("uses a per-(campaign,recipient) idempotency key", async () => {
    adapterSend.mockResolvedValue({ ok: true, providerRef: "esp-1" });
    await sendCampaignEmailToRecipient({
      emailCampaignId: "ec-1",
      recipient: { email: "lead@acme.com" },
    });
    expect(adapterSend).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "seq-ec-1-lead@acme.com",
      })
    );
  });
});
