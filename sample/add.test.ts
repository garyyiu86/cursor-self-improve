import { describe, expect, it } from "vitest";
import { add } from "./add";

describe("add", () => {
  it("adds two numbers", () => {
    expect(add(2, 3)).toBe(5);
  });

  it("handles negatives", () => {
    expect(add(-1, 4)).toBe(3);
  });
});
