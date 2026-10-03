import { describe, expect, it } from "vitest";
import * as rules from "@/lib/rules";

describe("rules module", () => {
  it("loads", () => {
    expect(rules).toBeDefined();
  });
});
