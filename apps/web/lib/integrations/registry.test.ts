import { describe, it, expect } from "vitest";
import {
  resolveProvider,
  resolveChannel,
  isKnownProvider,
  listProviders,
} from "./registry";
import { TeamsAdapter } from "./messaging/teams-adapter";
import { WhatsAppAdapter } from "./messaging/whatsapp-adapter";

describe("integration registry", () => {
  it("lists every registered provider", () => {
    expect(listProviders().sort()).toEqual(["teams", "whatsapp"]);
  });

  it("recognises known provider slugs", () => {
    expect(isKnownProvider("teams")).toBe(true);
    expect(isKnownProvider("whatsapp")).toBe(true);
    expect(isKnownProvider("carrier-pigeon")).toBe(false);
  });

  it("resolves a provider slug to the right adapter class", () => {
    const teams = resolveProvider("teams", { secret: null, metadata: {} });
    expect(teams).toBeInstanceOf(TeamsAdapter);
    const wa = resolveProvider("whatsapp", { secret: null, metadata: {} });
    expect(wa).toBeInstanceOf(WhatsAppAdapter);
  });

  it("throws on an unknown provider slug", () => {
    expect(() =>
      resolveProvider("nope", { secret: null, metadata: {} })
    ).toThrow(/desconhecido/);
  });

  it("resolves a channel to its provider adapter", () => {
    expect(
      resolveChannel("teams", { secret: null, metadata: {} })
    ).toBeInstanceOf(TeamsAdapter);
    expect(
      resolveChannel("whatsapp", { secret: null, metadata: {} })
    ).toBeInstanceOf(WhatsAppAdapter);
  });

  it("rejects the in_app channel (no external adapter)", () => {
    expect(() =>
      resolveChannel("in_app", { secret: null, metadata: {} })
    ).toThrow(/in_app/);
  });
});
