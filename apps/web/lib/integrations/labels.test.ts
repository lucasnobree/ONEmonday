import { describe, it, expect } from "vitest";
import {
  EVENT_LABELS,
  CHANNEL_LABELS,
  ROUTABLE_EVENT_TYPES,
  ROUTABLE_CHANNELS,
  eventLabel,
  channelLabel,
} from "./labels";

describe("integration label maps", () => {
  it("has a pt-BR label for every routable event type", () => {
    for (const event of ROUTABLE_EVENT_TYPES) {
      expect(EVENT_LABELS[event]).toBeTruthy();
      expect(EVENT_LABELS[event]).not.toBe(event);
    }
  });

  it("has a pt-BR label for every routable channel", () => {
    for (const channel of ROUTABLE_CHANNELS) {
      expect(CHANNEL_LABELS[channel]).toBeTruthy();
      expect(CHANNEL_LABELS[channel]).not.toBe(channel);
    }
  });
});

describe("eventLabel", () => {
  it("resolves a known event slug to its pt-BR label", () => {
    expect(eventLabel("card_assigned")).toBe("Card atribuído");
    expect(eventLabel("card_overdue")).toBe("Card atrasado");
  });

  it("falls back to the raw slug for an unknown event", () => {
    expect(eventLabel("something_else")).toBe("something_else");
  });
});

describe("channelLabel", () => {
  it("resolves a known channel slug to its pt-BR label", () => {
    expect(channelLabel("teams")).toBe("Microsoft Teams");
    expect(channelLabel("whatsapp")).toBe("WhatsApp");
  });

  it("falls back to the raw slug for an unknown channel", () => {
    expect(channelLabel("slack")).toBe("slack");
  });
});
