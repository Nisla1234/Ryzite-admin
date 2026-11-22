import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Download, Loader2, ScrollText, Search } from "lucide-react";
import { EmptyState, Panel } from "./PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAuditLogs } from "@/lib/admin.functions";
import { actionLabel, fmtDateTime } from "@/lib/format";

export function LogTable({ category }: { category: "activity" | "security" }) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState("all");
  const fetchLogs = useServerFn(getAuditLogs);
  const logs = useQuery({
    queryKey: ["audit-logs", category],
    queryFn: () => fetchLogs({ data: { category } }),
  });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (logs.data ?? []).filter(
      (r) =>
        (result === "all" || r.result === result) &&
        (!term ||
          [r.action, actionLabel(r.action), r.actor_label, r.subject, r.ip, r.entity_type].some(
            (v) => v?.toLowerCase().includes(term),
          )),
    );
  }, [logs.data, q, result]);

  function exportCsv() {
    const header = [
      "time",
      "action",
      "result",
      "actor",
      "subject",
      "entity_type",
      "entity_id",
      "ip",
    ];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.created_at,
          r.action,
          r.result,
          r.actor_label,
          r.subject,
          r.entity_type,
          r.entity_id,
          r.ip,
        ]
          .map(esc)
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ryzite-${category}-log.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Panel
      bodyClassName="p-0"
      title={
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search action, person, email or IP"
              className="h-9 w-72 bg-card pl-8 font-normal"
            />
          </div>
          <Select value={result} onValueChange={setResult}>
            <SelectTrigger className="h-9 w-36 bg-card font-normal">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All results</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failure">Failure</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
      actions={
        <Button
          variant="outline"
          size="sm"
          className="bg-card"
          onClick={exportCsv}
          disabled={!rows.length}
        >
          <Download /> Export CSV
        </Button>
      }
    >
      {logs.isLoading ? (
        <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading log…
        </p>
      ) : !rows.length ? (
        <EmptyState
          icon={<ScrollText />}
          title="No matching entries"
          description={
            logs.data?.length
              ? "Try a different search or filter."
              : "Events will appear here as they happen."
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Event</th>
                <th className="px-5 py-3 font-medium">Result</th>
                <th className="px-5 py-3 font-medium">Administrator</th>
                <th className="px-5 py-3 font-medium">Subject</th>
                <th className="px-5 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                    {fmtDateTime(r.created_at)}
                  </td>
                  <td className="px-5 py-3 font-medium">{actionLabel(r.action)}</td>
                  <td className="px-5 py-3">
                    <Badge
                      variant={
                        r.result === "success"
                          ? "success"
                          : r.result === "blocked"
                            ? "danger"
                            : "warning"
                      }
                      className="capitalize"
                    >
                      {r.result}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">{r.actor_label ?? "—"}</td>
                  <td className="max-w-56 truncate px-5 py-3 text-muted-foreground">
                    {r.subject ?? (r.entity_type ? `${r.entity_type}` : "—")}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-muted-foreground">
                    {r.ip ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
