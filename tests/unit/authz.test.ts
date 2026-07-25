import { describe, expect, it } from "vitest";
import { can, roleLabel, type Capability, type Role } from "@/lib/authz";
import { postLoginRedirect, safeRedirectPath } from "@/lib/safe-redirect";

describe("post-login redirects", () => {
  it("keeps a same-origin path", () => {
    expect(safeRedirectPath("/checkout")).toBe("/checkout");
    expect(safeRedirectPath("/account/orders/DD-20260725-ABC123")).toBe(
      "/account/orders/DD-20260725-ABC123",
    );
  });

  it("refuses anything that could leave the site", () => {
    for (const hostile of [
      "https://evil.example/steal",
      "//evil.example",
      "/\\evil.example",
      "/\\/evil.example",
      "javascript:alert(1)",
      "http://localhost:3000/checkout",
      "  https://evil.example",
      "",
      null,
      undefined,
    ])
      expect(safeRedirectPath(hostile)).toBe("/account");
  });

  it("never bounces the customer back to an auth screen", () => {
    expect(postLoginRedirect("/login")).toBe("/account");
    expect(postLoginRedirect("/signup")).toBe("/account");
    expect(postLoginRedirect("/reset-password?token=x")).toBe("/account");
    expect(postLoginRedirect("/checkout")).toBe("/checkout");
  });
});

describe("role capabilities", () => {
  const adminOnly: Capability[] = [
    "admin.view",
    "catalogue.manage",
    "inventory.manage",
    "orders.view",
    "orders.manage",
    "customers.view",
    "settings.manage",
  ];

  it("gives a signed-in customer no merchant capability at all", () => {
    for (const capability of adminOnly) expect(can("customer", capability)).toBe(false);
  });

  it("does not let staff roles reach owner settings", () => {
    for (const role of ["operations", "catalogue_manager", "admin"] as Role[])
      expect(can(role, "settings.manage")).toBe(false);
    expect(can("owner", "settings.manage")).toBe(true);
  });

  it("separates catalogue staff from order staff", () => {
    expect(can("catalogue_manager", "catalogue.manage")).toBe(true);
    expect(can("catalogue_manager", "orders.manage")).toBe(false);
    expect(can("operations", "orders.manage")).toBe(true);
    expect(can("operations", "catalogue.manage")).toBe(false);
  });

  it("keeps customer data behind admin and owner only", () => {
    expect(can("operations", "customers.view")).toBe(false);
    expect(can("catalogue_manager", "customers.view")).toBe(false);
    expect(can("admin", "customers.view")).toBe(true);
    expect(can("owner", "customers.view")).toBe(true);
  });

  it("labels every role", () => {
    for (const role of [
      "customer",
      "operations",
      "catalogue_manager",
      "admin",
      "owner",
    ] as Role[])
      expect(roleLabel(role).length).toBeGreaterThan(0);
  });
});
