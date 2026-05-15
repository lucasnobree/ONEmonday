import { describe, it, expect } from "vitest";
import { createBoardSchema, updateBoardSchema } from "./boards";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("createBoardSchema", () => {
  it("accepts a valid board with one sector", () => {
    const result = createBoardSchema.safeParse({
      name: "Sprint Q2",
      visibility: "sector",
      sectorIds: [UUID],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = createBoardSchema.safeParse({
      name: "",
      visibility: "sector",
      sectorIds: [UUID],
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one sector", () => {
    const result = createBoardSchema.safeParse({
      name: "Board",
      visibility: "sector",
      sectorIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown visibility value", () => {
    const result = createBoardSchema.safeParse({
      name: "Board",
      visibility: "everyone",
      sectorIds: [UUID],
    });
    expect(result.success).toBe(false);
  });
});

describe("updateBoardSchema", () => {
  it("accepts a partial update carrying only the id and name", () => {
    const result = updateBoardSchema.safeParse({ id: UUID, name: "Renamed" });
    expect(result.success).toBe(true);
  });

  it("requires the id", () => {
    expect(updateBoardSchema.safeParse({ name: "Renamed" }).success).toBe(
      false
    );
  });
});
