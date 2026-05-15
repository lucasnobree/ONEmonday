import { describe, it, expect } from "vitest";
import { createProjectSchema, updateProjectSchema } from "./projects";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("createProjectSchema", () => {
  it("accepts a valid active project", () => {
    const result = createProjectSchema.safeParse({
      name: "Website revamp",
      status: "active",
      sectorIds: [UUID],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown status", () => {
    const result = createProjectSchema.safeParse({
      name: "Project",
      status: "on_hold",
      sectorIds: [UUID],
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one sector", () => {
    const result = createProjectSchema.safeParse({
      name: "Project",
      status: "active",
      sectorIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a name longer than 100 characters", () => {
    const result = createProjectSchema.safeParse({
      name: "x".repeat(101),
      status: "active",
      sectorIds: [UUID],
    });
    expect(result.success).toBe(false);
  });
});

describe("updateProjectSchema", () => {
  it("accepts a partial status change", () => {
    const result = updateProjectSchema.safeParse({
      id: UUID,
      status: "completed",
    });
    expect(result.success).toBe(true);
  });

  it("requires the id", () => {
    expect(
      updateProjectSchema.safeParse({ status: "paused" }).success
    ).toBe(false);
  });
});
