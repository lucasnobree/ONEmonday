import { describe, it, expect } from "vitest";
import {
  createCardSchema,
  updateCardSchema,
  reorderCardsSchema,
  setCardTagsSchema,
} from "./cards";

const UUID = "11111111-1111-4111-8111-111111111111";
const UUID2 = "22222222-2222-4222-8222-222222222222";

describe("createCardSchema", () => {
  it("accepts a minimal valid card and defaults priority to medium", () => {
    const result = createCardSchema.safeParse({
      title: "Fix login bug",
      columnId: UUID,
      boardId: UUID2,
      sectorId: UUID,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.priority).toBe("medium");
  });

  it("rejects an empty title", () => {
    const result = createCardSchema.safeParse({
      title: "",
      columnId: UUID,
      boardId: UUID2,
      sectorId: UUID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a title longer than 200 characters", () => {
    const result = createCardSchema.safeParse({
      title: "x".repeat(201),
      columnId: UUID,
      boardId: UUID2,
      sectorId: UUID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid columnId", () => {
    const result = createCardSchema.safeParse({
      title: "ok",
      columnId: "not-a-uuid",
      boardId: UUID2,
      sectorId: UUID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown priority value", () => {
    const result = createCardSchema.safeParse({
      title: "ok",
      columnId: UUID,
      boardId: UUID2,
      sectorId: UUID,
      priority: "urgent",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateCardSchema", () => {
  it("accepts a partial update with only a priority change", () => {
    const result = updateCardSchema.safeParse({ id: UUID, priority: "high" });
    expect(result.success).toBe(true);
  });

  it("allows description and dueDate to be explicitly null (cleared)", () => {
    const result = updateCardSchema.safeParse({
      id: UUID,
      description: null,
      dueDate: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty title when one is supplied", () => {
    const result = updateCardSchema.safeParse({ id: UUID, title: "" });
    expect(result.success).toBe(false);
  });

  it("requires the id field", () => {
    expect(updateCardSchema.safeParse({ priority: "low" }).success).toBe(
      false
    );
  });
});

describe("reorderCardsSchema", () => {
  it("accepts a well-formed reorder payload", () => {
    const result = reorderCardsSchema.safeParse({
      boardId: UUID,
      columnId: UUID2,
      cardPositions: [{ card_id: UUID, position: 0 }],
      expectedBoardUpdatedAt: "2026-05-15T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative position", () => {
    const result = reorderCardsSchema.safeParse({
      boardId: UUID,
      columnId: UUID2,
      cardPositions: [{ card_id: UUID, position: -1 }],
      expectedBoardUpdatedAt: "2026-05-15T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("setCardTagsSchema", () => {
  it("accepts an empty tag list (clearing all tags)", () => {
    const result = setCardTagsSchema.safeParse({ cardId: UUID, tagIds: [] });
    expect(result.success).toBe(true);
  });

  it("accepts multiple uuid tags", () => {
    const result = setCardTagsSchema.safeParse({
      cardId: UUID,
      tagIds: [UUID, UUID2],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid tag id", () => {
    const result = setCardTagsSchema.safeParse({
      cardId: UUID,
      tagIds: ["nope"],
    });
    expect(result.success).toBe(false);
  });
});
