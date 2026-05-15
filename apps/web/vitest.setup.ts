import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount React trees rendered during a test once it finishes.
afterEach(() => {
  cleanup();
});
