import { describe, it, expect } from "vitest";
import {
  resolveEmailAdapter,
  isKnownEmailProvider,
  listEmailProviders,
  DEFAULT_EMAIL_PROVIDER,
} from "./email-registry";
import { ResendAdapter } from "./email/resend-adapter";

describe("email-registry", () => {
  it("resolves the resend slug to a ResendAdapter", () => {
    const adapter = resolveEmailAdapter("resend", {
      secret: null,
      metadata: {},
    });
    expect(adapter).toBeInstanceOf(ResendAdapter);
    expect(adapter.provider).toBe("resend");
  });

  it("throws on an unknown provider slug", () => {
    expect(() =>
      resolveEmailAdapter("mailchimp", { secret: null, metadata: {} })
    ).toThrow(/desconhecido/);
  });

  it("isKnownEmailProvider only accepts registered slugs", () => {
    expect(isKnownEmailProvider("resend")).toBe(true);
    expect(isKnownEmailProvider("ses")).toBe(false);
  });

  it("lists registered providers and exposes a default", () => {
    expect(listEmailProviders()).toContain("resend");
    expect(DEFAULT_EMAIL_PROVIDER).toBe("resend");
    expect(isKnownEmailProvider(DEFAULT_EMAIL_PROVIDER)).toBe(true);
  });

  it("a resolved adapter is in no-op mode when given no secret", () => {
    const adapter = resolveEmailAdapter(DEFAULT_EMAIL_PROVIDER, {
      secret: null,
      metadata: {},
    });
    expect(adapter.isConfigured()).toBe(false);
  });
});
