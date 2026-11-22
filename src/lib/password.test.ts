import { describe, expect, it } from "vitest";
import { passwordProblems } from "./password";

describe("admin password policy", () => {
  it("requires at least 12 characters", () => {
    expect(passwordProblems("Ab1!Ab1!Ab1")).toContain("Use at least 12 characters.");
    expect(passwordProblems("Ab1!Ab1!Ab1!")).toEqual([]);
  });
  it("requires mixed case, a number and a symbol", () => {
    expect(passwordProblems("abcdefghijk1!")).toContain("Mix upper and lower case letters.");
    expect(passwordProblems("Abcdefghijkl!")).toContain("Add at least one number.");
    expect(passwordProblems("Abcdefghijk12")).toContain("Add at least one symbol.");
  });
});
