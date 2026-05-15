import { describe, it, expect } from "vitest";
import {
  idleDaysSince,
  getDealRotting,
  rottingLabel,
  type RottingConfig,
} from "./deal-rotting";

const NOW = new Date("2026-05-15T12:00:00.000Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe("idleDaysSince", () => {
  it("returns 0 for a timestamp at `now`", () => {
    expect(idleDaysSince(NOW.toISOString(), NOW)).toBe(0);
  });

  it("floors partial days", () => {
    const since = new Date(NOW.getTime() - 1.9 * 24 * 60 * 60 * 1000);
    expect(idleDaysSince(since.toISOString(), NOW)).toBe(1);
  });

  it("counts whole elapsed days", () => {
    expect(idleDaysSince(daysAgo(10), NOW)).toBe(10);
  });

  it("clamps future timestamps to 0", () => {
    expect(idleDaysSince(daysAgo(-5), NOW)).toBe(0);
  });

  it("returns 0 for an invalid date string", () => {
    expect(idleDaysSince("not-a-date", NOW)).toBe(0);
  });
});

describe("getDealRotting", () => {
  const config: RottingConfig = { Negociacao: 7, Proposta: 14, Ganho: 0 };

  it("is disabled when the stage has no threshold", () => {
    const r = getDealRotting("Ganho", daysAgo(30), config, NOW);
    expect(r.enabled).toBe(false);
    expect(r.isRotting).toBe(false);
  });

  it("is disabled for an unknown stage", () => {
    const r = getDealRotting("Inexistente", daysAgo(30), config, NOW);
    expect(r.enabled).toBe(false);
  });

  it("is disabled when last stage change is missing", () => {
    const r = getDealRotting("Negociacao", null, config, NOW);
    expect(r.enabled).toBe(false);
    expect(r.isRotting).toBe(false);
  });

  it("does not rot before the threshold is reached", () => {
    const r = getDealRotting("Negociacao", daysAgo(6), config, NOW);
    expect(r.enabled).toBe(true);
    expect(r.idleDays).toBe(6);
    expect(r.isRotting).toBe(false);
  });

  it("rots exactly at the threshold (inclusive)", () => {
    const r = getDealRotting("Negociacao", daysAgo(7), config, NOW);
    expect(r.isRotting).toBe(true);
    expect(r.thresholdDays).toBe(7);
  });

  it("rots past the threshold", () => {
    const r = getDealRotting("Proposta", daysAgo(20), config, NOW);
    expect(r.isRotting).toBe(true);
    expect(r.idleDays).toBe(20);
  });
});

describe("rottingLabel", () => {
  it("returns null when the deal is not rotting", () => {
    const r = getDealRotting("Negociacao", daysAgo(1), { Negociacao: 7 }, NOW);
    expect(rottingLabel(r)).toBeNull();
  });

  it("uses the singular form for one day", () => {
    const r = getDealRotting("Negociacao", daysAgo(1), { Negociacao: 1 }, NOW);
    expect(rottingLabel(r)).toBe("Parada ha 1 dia");
  });

  it("uses the plural form for multiple days", () => {
    const r = getDealRotting("Negociacao", daysAgo(9), { Negociacao: 7 }, NOW);
    expect(rottingLabel(r)).toBe("Parada ha 9 dias");
  });
});
