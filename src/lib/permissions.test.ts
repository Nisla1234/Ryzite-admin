import { describe, expect, it } from "vitest";
import { can } from "./permissions";

describe("role permissions", () => {
  it("only super admins can manage users and approve access", () => {
    expect(can(["super_admin"], "users.manage")).toBe(true);
    expect(can(["super_admin"], "access.review")).toBe(true);
    expect(can(["admin"], "users.manage")).toBe(false);
    expect(can(["admin"], "access.review")).toBe(false);
  });

  it("editors can edit content and media but cannot publish", () => {
    expect(can(["editor"], "content.edit")).toBe(true);
    expect(can(["editor"], "media.manage")).toBe(true);
    expect(can(["editor"], "content.publish")).toBe(false);
    expect(can(["editor"], "settings.manage")).toBe(false);
  });

  it("analysts are read-only for analytics, SEO and performance", () => {
    expect(can(["analyst"], "analytics.view")).toBe(true);
    expect(can(["analyst"], "seo.view")).toBe(true);
    expect(can(["analyst"], "performance.view")).toBe(true);
    expect(can(["analyst"], "content.edit")).toBe(false);
    expect(can(["analyst"], "seo.manage")).toBe(false);
  });

  it("admins manage website, SEO, analytics and performance but not integrations or security logs", () => {
    expect(can(["admin"], "content.publish")).toBe(true);
    expect(can(["admin"], "seo.manage")).toBe(true);
    expect(can(["admin"], "performance.run")).toBe(true);
    expect(can(["admin"], "integrations.manage")).toBe(false);
    expect(can(["admin"], "logs.security")).toBe(false);
  });

  it("users with no role get no access", () => {
    expect(can([], "dashboard.view")).toBe(false);
  });
});
