import { redirect } from "@tanstack/react-router";
import { can, type Permission } from "./permissions";
import type { Me } from "./session";

/** Route-level permission gate (UI only — server functions and RLS enforce the same rules). */
export function requirePermission(permission: Permission) {
  return ({ context }: { context: { me: Me } }) => {
    if (!can(context.me.roles, permission)) throw redirect({ to: "/admin/dashboard" });
  };
}
