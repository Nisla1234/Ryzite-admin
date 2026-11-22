import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Inbox, Loader2, Mail, X } from "lucide-react";
import { PageHeader, Panel, EmptyState } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  approveAccessRequest,
  listAccessRequests,
  rejectAccessRequest,
} from "@/lib/admin.functions";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { requirePermission } from "@/lib/guard";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, type Role } from "@/lib/permissions";
import type { AccessRequestRow } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/admin/access-requests")({
  beforeLoad: requirePermission("access.review"),
  head: () => ({
    meta: [
      { title: "Access Requests · RYZITE Control Centre" },
      {
        name: "description",
        content: "Review, approve or reject requests for Control Centre access.",
      },
    ],
  }),
  component: AccessRequests,
});

type Req = AccessRequestRow;
type Status = "pending" | "approved" | "rejected";

function suggestUsername(email: string) {
  return (email.split("@")[0] ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "")
    .slice(0, 32);
}

function AccessRequests() {
  const qc = useQueryClient();
  const fetchRequests = useServerFn(listAccessRequests);
  const approve = useServerFn(approveAccessRequest);
  const reject = useServerFn(rejectAccessRequest);
  const [tab, setTab] = useState<Status>("pending");
  const [approving, setApproving] = useState<Req | null>(null);
  const [rejecting, setRejecting] = useState<Req | null>(null);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const list = useQuery({
    queryKey: ["access-requests", tab],
    queryFn: () => fetchRequests({ data: { status: tab } }),
  });

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["access-requests"] }),
      qc.invalidateQueries({ queryKey: ["pending-access-count"] }),
    ]);

  async function doApprove() {
    if (!approving) return;
    setBusy(true);
    try {
      const res = await approve({
        data: {
          id: approving.id,
          role,
          username,
          origin: window.location.origin,
          ...(note ? { note } : {}),
        },
      });
      if (res.ok) {
        toast.success(`Approved access for ${approving.email}`);
        setApproving(null);
      } else toast.error(res.error);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approval failed.");
    } finally {
      setBusy(false);
    }
  }

  async function doReject() {
    if (!rejecting) return;
    setBusy(true);
    try {
      const res = await reject({ data: { id: rejecting.id, ...(note ? { note } : {}) } });
      if (res.ok) {
        toast.success("Request rejected");
        setRejecting(null);
      } else toast.error(res.error);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rejection failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="System Management"
        title="Access Requests"
        description="Requests never grant access on their own. Approving sends a secure invitation email so the person can set their own password."
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Status)} className="mb-4">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>
      {list.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </p>
      ) : !list.data?.length ? (
        <Panel>
          <EmptyState
            icon={<Inbox />}
            title={`No ${tab} requests`}
            description="Requests submitted from the Request Admin Access page appear here."
          />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.data.map((r) => (
            <article key={r.id} className="rounded-2xl border bg-card p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{r.full_name}</p>
                  <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                    <Mail className="size-3.5" /> {r.email}
                  </p>
                </div>
                <Badge
                  variant={
                    r.status === "pending"
                      ? "warning"
                      : r.status === "approved"
                        ? "success"
                        : "danger"
                  }
                  className="capitalize"
                >
                  {r.status}
                </Badge>
              </div>
              <p className="mt-4 whitespace-pre-wrap rounded-xl bg-secondary/50 p-3 text-sm leading-relaxed">
                {r.reason}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Submitted {fmtRelative(r.created_at)}
                {r.decided_at && ` · Decided ${fmtDateTime(r.decided_at)}`}
                {r.assigned_role && ` · ${ROLE_LABELS[r.assigned_role]}`}
              </p>
              {r.decision_note && (
                <p className="mt-1 text-xs text-muted-foreground">Note: {r.decision_note}</p>
              )}
              {r.status === "pending" && (
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="electric"
                    size="sm"
                    onClick={() => {
                      setApproving(r);
                      setUsername(suggestUsername(r.email));
                      setRole("editor");
                      setNote("");
                    }}
                  >
                    <Check /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-card"
                    onClick={() => {
                      setRejecting(r);
                      setNote("");
                    }}
                  >
                    <X /> Reject
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve {approving?.full_name}</DialogTitle>
            <DialogDescription>
              An invitation goes to {approving?.email}. They'll set their own password from the
              email link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="u">Username</Label>
              <Input
                id="u"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                maxLength={32}
              />
              <p className="text-xs text-muted-foreground">
                3–32 lowercase letters, numbers, dots, dashes or underscores. Used to sign in.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
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
              <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="n">Decision note (optional)</Label>
              <Textarea
                id="n"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApproving(null)}>
              Cancel
            </Button>
            <Button
              variant="electric"
              onClick={doApprove}
              disabled={busy || !/^[a-z0-9_.-]{3,32}$/.test(username)}
            >
              {busy && <Loader2 className="animate-spin" />} Approve and send invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject request from {rejecting?.full_name}?</DialogTitle>
            <DialogDescription>
              The person is not notified automatically. The decision is recorded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rn">Reason (optional)</Label>
            <Textarea
              id="rn"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={doReject} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
