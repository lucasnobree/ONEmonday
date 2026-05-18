import { describe, it, expect } from "vitest";
import {
  createBoardColumnSchema,
  updateBoardColumnSchema,
  reorderBoardColumnsSchema,
} from "./board-columns";

const UUID = "11111111-1111-4111-8111-111111111111";
const UUID2 = "22222222-2222-4222-8222-222222222222";

describe("createBoardColumnSchema", () => {
  it("accepts a minimal valid column", () => {
    const result = createBoardColumnSchema.safeParse({
      boardId: UUID,
      name: "A Fazer",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a full column with colour, WIP and done flag", () => {
    const result = createBoardColumnSchema.safeParse({
      boardId: UUID,
      name: "Concluído",
      color: "#22c55e",
      wipLimit: 5,
      isDoneColumn: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = createBoardColumnSchema.safeParse({
      boardId: UUID,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-hex colour", () => {
    const result = createBoardColumnSchema.safeParse({
      boardId: UUID,
      name: "X",
      color: "blue",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a WIP limit below 1", () => {
    const result = createBoardColumnSchema.safeParse({
      boardId: UUID,
      name: "X",
      wipLimit: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer WIP limit", () => {
    const result = createBoardColumnSchema.safeParse({
      boardId: UUID,
      name: "X",
      wipLimit: 2.5,
    });
    expect(result.success).toBe(false);
  });

  it("allows a null WIP limit (clears the limit)", () => {
    const result = createBoardColumnSchema.safeParse({
      boardId: UUID,
      name: "X",
      wipLimit: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("updateBoardColumnSchema", () => {
  it("accepts a partial update with just a new name", () => {
    const result = updateBoardColumnSchema.safeParse({
      id: UUID,
      name: "Renomeada",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a null colour (clears the colour)", () => {
    const result = updateBoardColumnSchema.safeParse({
      id: UUID,
      color: null,
    });
    expect(result.success).toBe(true);
  });

  it("requires a valid id", () => {
    const result = updateBoardColumnSchema.safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});

describe("reorderBoardColumnsSchema", () => {
  it("accepts a non-empty ordered id list", () => {
    const result = reorderBoardColumnsSchema.safeParse({
      boardId: UUID,
      columnIds: [UUID, UUID2],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty id list", () => {
    const result = reorderBoardColumnsSchema.safeParse({
      boardId: UUID,
      columnIds: [],
    });
    expect(result.success).toBe(false);
  });
});
