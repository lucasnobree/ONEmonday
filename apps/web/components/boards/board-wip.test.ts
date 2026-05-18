import { describe, it, expect } from "vitest";
import {
  isWipLimitReached,
  wouldExceedWipLimit,
  wipLimitMessage,
} from "./board-wip";

describe("isWipLimitReached", () => {
  it("is false for a column without a WIP limit", () => {
    expect(isWipLimitReached({ wip_limit: null, cardCount: 99 })).toBe(false);
  });

  it("is false when the column is below its limit", () => {
    expect(isWipLimitReached({ wip_limit: 5, cardCount: 3 })).toBe(false);
  });

  it("is true when the column is exactly at its limit", () => {
    expect(isWipLimitReached({ wip_limit: 5, cardCount: 5 })).toBe(true);
  });

  it("is true when the column is over its limit", () => {
    expect(isWipLimitReached({ wip_limit: 5, cardCount: 7 })).toBe(true);
  });

  it("treats a zero limit as immediately full", () => {
    expect(isWipLimitReached({ wip_limit: 0, cardCount: 0 })).toBe(true);
  });
});

describe("wouldExceedWipLimit", () => {
  it("matches isWipLimitReached for the next-card decision", () => {
    expect(wouldExceedWipLimit({ wip_limit: 2, cardCount: 2 })).toBe(true);
    expect(wouldExceedWipLimit({ wip_limit: 2, cardCount: 1 })).toBe(false);
  });
});

describe("wipLimitMessage", () => {
  it("pluralizes the card count", () => {
    expect(wipLimitMessage(3)).toBe("Coluna no limite de 3 cards.");
  });

  it("uses the singular for a limit of 1", () => {
    expect(wipLimitMessage(1)).toBe("Coluna no limite de 1 card.");
  });
});
