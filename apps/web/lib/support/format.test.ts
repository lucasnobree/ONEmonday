import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "./format";

const NOW = new Date("2026-05-15T12:00:00Z");

describe("formatRelativeTime", () => {
  it("returns 'agora' for a sub-minute difference", () => {
    expect(formatRelativeTime("2026-05-15T11:59:30Z", NOW)).toBe("agora");
  });

  it("uses minutes with the correct diacritic", () => {
    expect(formatRelativeTime("2026-05-15T11:45:00Z", NOW)).toBe("15min atrás");
  });

  it("uses hours with the correct diacritic", () => {
    expect(formatRelativeTime("2026-05-15T09:00:00Z", NOW)).toBe("3h atrás");
  });

  it("uses days with the correct diacritic", () => {
    expect(formatRelativeTime("2026-05-13T12:00:00Z", NOW)).toBe("2d atrás");
  });

  it("falls back to an absolute date once a week old", () => {
    expect(formatRelativeTime("2026-05-01T12:00:00Z", NOW)).toBe(
      new Date("2026-05-01T12:00:00Z").toLocaleDateString("pt-BR")
    );
  });

  it("never emits the accent-stripped 'atras'", () => {
    const samples = [
      "2026-05-15T11:30:00Z",
      "2026-05-15T08:00:00Z",
      "2026-05-12T12:00:00Z",
    ];
    for (const s of samples) {
      expect(formatRelativeTime(s, NOW)).not.toContain("atras");
    }
  });
});
