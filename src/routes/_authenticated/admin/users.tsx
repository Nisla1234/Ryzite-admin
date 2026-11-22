import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldOff, ShieldPlus, Users } from "lucide-react";
import { PageHeader, Panel, EmptyState } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMe } from "@/hooks/use-me";
import {
  listAdminUsers,
  restoreUserAccess,
  revokeUserAccess,
  setUserRole,
} from "@/lib/admin.functions";
import { fmtRelative } from "@/lib/format";
import { requirePermission } from "@/lib/guard";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, type Role } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  beforeLoad: requirePermission("users.manage"),
  head: () => ({
    meta: [
      { title: "Admin Users & Roles · RYZITE Control Centre" },
      { name: "description", content: "Manage RYZITE administrators and their roles." },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const me = useMe();
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listAdminUsers);
  const changeRole = useServerFn(setUserRole);
  const revoke = useServerFn(revokeUserAccess);
  const restore = useServerFn(restoreUserAccess);
  const [busy, setBusy] = useState<string | null>(null);

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
  });

  async function run(
    id: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    setBusy(id);
    try {
      const res = await fn();
      if (res.ok) toast.success(success);
      else toast.error(res.error ?? "That didn't work.");
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="System Management"
        title="Admin Users & Roles"
        description="Every role change and revocation is recorded in the security log. New administrators join through approved access requests."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ROLES.map((r) => (
          <div key={r} className="rounded-2xl border bg-card p-4 shadow-card">
            <p className="font-semibold">{ROLE_LABELS[r]}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {ROLE_DESCRIPTIONS[r]}
            </p>
          </div>
        ))}
      </div>
      <Panel bodyClassName="p-0">
        {users.isLoading ? (
          <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading administrators…
          </p>
        ) : !users.data?.length ? (
          <EmptyState
            icon={<Users />}
            title="No administrators"
            description="Approved access requests will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Administrator</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Last sign-in</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.data.map((u) => {
                  const role = u.roles[0];
                  const self = u.id === me.user.id;
                  return (
                    <tr key={u.id} className="align-middle">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar path={u.avatar_url} name={u.full_name || u.username} />
                          <div className="min-w-0">
                            <p className="font-semibold">
                              {u.full_name || u.username}
                              {self && (
                                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                  (you)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-5 py-3">
                        {role ? (
                          <Select
                            value={role}
                            disabled={busy === u.id}
                            onValueChange={(v) =>
                              run(
                                u.id,
                                () => changeRole({ data: { userId: u.id, role: v as Role } }),
                                "Role updated",
                              )
                            }
                          >
                            <SelectTrigger className="h-8 w-40 bg-card">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="danger">No access</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {fmtRelative(u.last_sign_in_at)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {role ? (
                          !self && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  disabled={busy === u.id}
                                >
                                  <ShieldOff /> Revoke
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Revoke access for {u.full_name || u.username}?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    They will be signed out of the Control Centre and unable to sign
                                    in. You can restore access later.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() =>
                                      run(
                                        u.id,
                                        () => revoke({ data: { userId: u.id } }),
                                        "Access revoked",
                                      )
                                    }
                                  >
                                    Revoke access
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )
                        ) : (
                          <Button
                            size="sm"
                            variant="subtle"
                            disabled={busy === u.id}
                            onClick={() =>
                              run(
                                u.id,
                                () => restore({ data: { userId: u.id, role: "editor" } }),
                                "Access restored as Editor",
                              )
                            }
                          >
                            <ShieldPlus /> Restore as Editor
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
