import { describe, it, expect } from "vitest";
import {
  nineBoxCell,
  enpsBucket,
  calculateEnps,
  averageScore,
} from "./performance";

describe("nineBoxCell", () => {
  it("labels the top-right cell as Estrela", () => {
    expect(nineBoxCell(3, 3)?.label).toBe("Estrela");
  });

  it("labels the bottom-left cell as Risco", () => {
    expect(nineBoxCell(1, 1)?.label).toBe("Risco");
  });

  it("labels the centre cell as Mantenedor", () => {
    expect(nineBoxCell(2, 2)?.label).toBe("Mantenedor");
  });

  it("distinguishes high-performance/low-potential from the inverse", () => {
    expect(nineBoxCell(3, 1)?.label).toBe("Enigma");
    expect(nineBoxCell(1, 3)?.label).toBe("Especialista");
  });

  it("returns null for out-of-range scores", () => {
    expect(nineBoxCell(0, 2)).toBeNull();
    expect(nineBoxCell(2, 4)).toBeNull();
    expect(nineBoxCell(2.5, 2)).toBeNull();
  });
});

describe("enpsBucket", () => {
  it("classifies 9-10 as promoters", () => {
    expect(enpsBucket(9)).toBe("promoter");
    expect(enpsBucket(10)).toBe("promoter");
  });

  it("classifies 7-8 as passives", () => {
    expect(enpsBucket(7)).toBe("passive");
    expect(enpsBucket(8)).toBe("passive");
  });

  it("classifies 0-6 as detractors", () => {
    expect(enpsBucket(0)).toBe("detractor");
    expect(enpsBucket(6)).toBe("detractor");
  });

  it("returns null for out-of-range scores", () => {
    expect(enpsBucket(-1)).toBeNull();
    expect(enpsBucket(11)).toBeNull();
  });
});

describe("calculateEnps", () => {
  it("returns null for an empty set", () => {
    expect(calculateEnps([])).toBeNull();
  });

  it("returns 100 when everyone is a promoter", () => {
    expect(calculateEnps([9, 10, 9])).toBe(100);
  });

  it("returns -100 when everyone is a detractor", () => {
    expect(calculateEnps([0, 3, 6])).toBe(-100);
  });

  it("subtracts detractor share from promoter share", () => {
    // 2 promoters, 1 passive, 1 detractor -> (50 - 25) = 25
    expect(calculateEnps([9, 10, 7, 2])).toBe(25);
  });

  it("ignores out-of-range scores", () => {
    expect(calculateEnps([9, 10, 99])).toBe(100);
  });

  it("rounds to one decimal place", () => {
    // 1 promoter of 3 -> 33.333... -> 33.3
    expect(calculateEnps([9, 7, 8])).toBe(33.3);
  });
});

describe("averageScore", () => {
  it("returns null for an empty set", () => {
    expect(averageScore([])).toBeNull();
  });

  it("averages and rounds to two decimals", () => {
    expect(averageScore([1, 2, 4])).toBe(2.33);
    expect(averageScore([5, 5, 5])).toBe(5);
  });
});
