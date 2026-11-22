import { describe, expect, it } from "vitest";
import { isD1Configured } from "@/lib/db.server";

describe("legacy integration deprecation", () => {
  it("runs without legacy Supabase or Lovable runtime dependencies", () => {
    expect(isD1Configured()).toBe(false);
  });
});
