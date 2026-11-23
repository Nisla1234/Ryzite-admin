import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader, Panel } from "@/components/admin/PageHeader";
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
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { createManualEnquiryFn, getEnquiriesFn, updateEnquiryFn } from "@/lib/platform.functions";
import type { EnquiryRecord } from "@/lib/platform-db.server";

const STATUS_BADGE: Record<EnquiryRecord["status"], "info" | "warning" | "success" | "muted"> = {
  new: "info",
  in_review: "warning",
  replied: "success",
  archived: "muted",
};

export function EnquiriesModule() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getEnquiriesFn);
  const createFn = useServerFn(createManualEnquiryFn);
  const updateFn = useServerFn(updateEnquiryFn);

  const [statusFilter, setStatusFilter] = useState<
    "all" | "new" | "in_review" | "replied" | "archived"
  >("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    business: "",
    email: "",
    phone: "",
    service: "",
    subject: "",
    message: "",
    category: "general",
  });

  const query = useQuery({
    queryKey: ["enquiries", statusFilter],
    queryFn: () => fetchFn({ data: { status: statusFilter } }),
  });

  const items = useMemo(() => {
    const list = query.data?.items ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.email.toLowerCase().includes(q) ||
        i.business.toLowerCase().includes(q) ||
        i.message.toLowerCase().includes(q),
    );
  }, [query.data, search]);

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  const updateMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      status?: EnquiryRecord["status"];
      is_read?: boolean;
      assigned_to?: string | null;
      category?: string;
      internal_notes?: string;
    }) => updateFn({ data: payload }),
    onSuccess: () => {
      toast.success("Enquiry updated.");
      void qc.invalidateQueries({ queryKey: ["enquiries"] });
      void qc.invalidateQueries({ queryKey: ["executive-overview"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update enquiry"),
  });

  const createMutation = useMutation({
    mutationFn: () => createFn({ data: form }),
    onSuccess: (res) => {
      toast.success("Enquiry logged.");
      setNewOpen(false);
      setSelectedId(res.item.id);
      setForm({
        name: "",
        business: "",
        email: "",
        phone: "",
        service: "",
        subject: "",
        message: "",
        category: "general",
      });
      void qc.invalidateQueries({ queryKey: ["enquiries"] });
      void qc.invalidateQueries({ queryKey: ["executive-overview"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create enquiry"),
  });

  function selectEnquiry(item: EnquiryRecord) {
    setSelectedId(item.id);
    setNotesDraft(item.internal_notes);
    if (!item.is_read) {
      updateMutation.mutate({ id: item.id, is_read: true });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website Management"
        title="Enquiries & Contact Messages"
        description="Submissions received from /api/enquiries (linked to the public contact forms) and manually logged enquiries."
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <Plus /> Log enquiry
          </Button>
        }
      />

      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="new">New</TabsTrigger>
              <TabsTrigger value="in_review">In Review</TabsTrigger>
              <TabsTrigger value="replied">Replied</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search name, email, business…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </Panel>

      {items.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Mail />}
            title="No enquiries match this filter"
            description="Website submissions posted to /api/enquiries appear here automatically."
          >
            <Button variant="subtle" onClick={() => setNewOpen(true)}>
              <Plus /> Log enquiry manually
            </Button>
          </EmptyState>
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <Panel title={`Inbox (${items.length})`} bodyClassName="p-0">
            <ul className="divide-y max-h-[620px] overflow-y-auto">
              {items.map((item) => {
                const active = selected?.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => selectEnquiry(item)}
                      className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors ${
                        active ? "bg-accent" : "hover:bg-secondary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 truncate text-sm font-semibold">
                          {!item.is_read && (
                            <span className="size-2 shrink-0 rounded-full bg-electric" />
                          )}
                          {item.name}
                        </span>
                        <Badge variant={STATUS_BADGE[item.status]}>{item.status}</Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.business || item.email}
                      </p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                      <p className="text-[0.6875rem] text-muted-foreground">
                        {fmtRelative(item.created_at)} · {item.source_page}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {selected && (
            <Panel
              title={selected.subject || `Enquiry from ${selected.name}`}
              description={`Received ${fmtDateTime(selected.created_at)} via ${selected.source_page}`}
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateMutation.mutate({ id: selected.id, is_read: !selected.is_read })
                  }
                >
                  Mark as {selected.is_read ? "unread" : "read"}
                </Button>
              }
            >
              <div className="space-y-5">
                <div className="grid gap-3 rounded-xl bg-secondary/50 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Contact</p>
                    <p className="font-semibold">{selected.name}</p>
                    <a
                      className="text-xs text-electric hover:underline"
                      href={`mailto:${selected.email}`}
                    >
                      {selected.email}
                    </a>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Business & Phone</p>
                    <p className="font-semibold">{selected.business || "—"}</p>
                    <p className="text-xs text-muted-foreground">{selected.phone || "No phone"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Service Interest</p>
                    <p className="font-medium">{selected.service || "General"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Category</p>
                    <p className="font-medium capitalize">{selected.category}</p>
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Message
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{selected.message}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select
                      value={selected.status}
                      onValueChange={(v) =>
                        updateMutation.mutate({
                          id: selected.id,
                          status: v as EnquiryRecord["status"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="in_review">In Review</SelectItem>
                        <SelectItem value="replied">Replied</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select
                      value={selected.category}
                      onValueChange={(v) => updateMutation.mutate({ id: selected.id, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="seo">SEO</SelectItem>
                        <SelectItem value="web-dev">Web & Apps</SelectItem>
                        <SelectItem value="ai-automation">AI Automation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Assigned to</Label>
                    <Select
                      value={selected.assigned_to || "unassigned"}
                      onValueChange={(v) =>
                        updateMutation.mutate({
                          id: selected.id,
                          assigned_to: v === "unassigned" ? null : v,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {(query.data?.admins ?? []).map((a) => (
                          <SelectItem key={a.id} value={a.username}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="enq-notes">Internal Admin Notes</Label>
                  <Textarea
                    id="enq-notes"
                    rows={3}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="Record call outcomes, quote sent, or follow-up steps…"
                  />
                  <Button
                    size="sm"
                    disabled={updateMutation.isPending}
                    onClick={() =>
                      updateMutation.mutate({ id: selected.id, internal_notes: notesDraft })
                    }
                  >
                    Save notes
                  </Button>
                </div>
              </div>
            </Panel>
          )}
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log customer enquiry</DialogTitle>
            <DialogDescription>
              Stores an enquiry in Control Centre (D1) alongside website contact form submissions.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Business</Label>
                <Input
                  value={form.business}
                  onChange={(e) => setForm({ ...form, business: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Phone / WhatsApp</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Service</Label>
                <Input
                  value={form.service}
                  onChange={(e) => setForm({ ...form, service: e.target.value })}
                  placeholder="e.g., Growth Package"
                />
              </div>
              <div className="space-y-1">
                <Label>Subject</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Message *</Label>
              <Textarea
                rows={3}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={createMutation.isPending || !form.name || !form.email || !form.message}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Saving…" : "Save enquiry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
