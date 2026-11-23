import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleSlash,
  Loader2,
  PlugZap,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useIntegrationStatus } from "@/hooks/use-integrations";
import { fmtRelative } from "@/lib/format";
import { requirePermission } from "@/lib/guard";
import {
  STATE_BADGE,
  STATE_LABELS,
  type IntegrationCheck,
  type IntegrationState,
} from "@/lib/integrations";
import { testIntegration } from "@/lib/integrations.functions";
import { INTEGRATION_LABELS } from "@/lib/nav";

export const Route = createFileRoute("/_authenticated/admin/integrations")({
  beforeLoad: requirePermission("integrations.manage"),
  head: () => ({
    meta: [
      { title: "Integrations · RYZITE Control Centre" },
      {
        name: "description",
        content: "Real connection status, tests and setup steps for every RYZITE service.",
      },
    ],
  }),
  component: IntegrationsPage,
});

const LEGEND: { state: IntegrationState; text: string }[] = [
  { state: "connected", text: "Tested and working." },
  { state: "configuration_required", text: "Reachable or ready, but credentials are missing." },
  { state: "disconnected", text: "Credentials or service failing right now." },
  { state: "planned", text: "The screens that use it aren't built yet." },
];

function IntegrationsPage() {
  const status = useIntegrationStatus();
  return (
    <div>
      <PageHeader
        eyebrow="System Management"
        title="Integrations"
        description="Every service is checked live from the server when this page opens. Secret values are never shown — only whether they are saved."
        actions={
          <Button variant="subtle" onClick={() => status.refetch()} disabled={status.isFetching}>
            <RefreshCw className={status.isFetching ? "animate-spin" : ""} /> Check all again
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {LEGEND.map((l) => (
          <span key={l.state} className="flex items-center gap-2">
            <Badge variant={STATE_BADGE[l.state]}>{STATE_LABELS[l.state]}</Badge>
            {l.text}
          </span>
        ))}
      </div>
      {status.isLoading && (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      )}
      {status.error && (
        <Panel>
          <p className="text-sm text-destructive">
            The status check failed: {status.error.message}
          </p>
        </Panel>
      )}
      {status.data && (
        <div className="grid gap-4 lg:grid-cols-2">
          {status.data.checks.map((c) => (
            <IntegrationCard key={c.key} check={c} lastSuccess={status.data.lastSuccess[c.key]} />
          ))}
        </div>
      )}
    </div>
  );
}

function IntegrationCard({
  check,
  lastSuccess,
}: {
  check: IntegrationCheck;
  lastSuccess: string | undefined;
}) {
  const qc = useQueryClient();
  const test = useServerFn(testIntegration);
  const run = useMutation({
    mutationFn: () => test({ data: { key: check.key } }),
    onSuccess: (r) => {
      toast[r.state === "disconnected" ? "error" : "success"](
        `${INTEGRATION_LABELS[check.key]}: ${STATE_LABELS[r.state]}`,
      );
      qc.invalidateQueries({ queryKey: ["integration-status"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Test failed"),
  });
  const shown = run.data ?? check;

  return (
    <Panel
      title={INTEGRATION_LABELS[check.key]}
      description={`Checked ${fmtRelative(shown.checkedAt)} · last successful test ${lastSuccess ? fmtRelative(lastSuccess) : "never recorded"}`}
      actions={
        <Badge variant={STATE_BADGE[shown.state]} className="shrink-0">
          {STATE_LABELS[shown.state]}
        </Badge>
      }
    >
      <p className="text-sm">{shown.summary}</p>
      {shown.capabilities.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {shown.capabilities.map((cap) => (
            <li key={cap.label} className="flex items-start gap-2 text-sm">
              {cap.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              ) : (
                <CircleSlash className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <span>
                {cap.label}
                {cap.detail && <span className="text-muted-foreground"> — {cap.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {shown.missing.length > 0 && (
        <p className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="size-3.5 text-warning" /> Still needed:
          {shown.missing.map((m) => (
            <code key={m} className="rounded bg-muted px-1.5 py-0.5 text-foreground">
              {m}
            </code>
          ))}
        </p>
      )}
      {shown.error && (
        <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Error: {shown.error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => run.mutate()} disabled={run.isPending}>
          {run.isPending ? <Loader2 className="animate-spin" /> : <PlugZap />} Test connection
        </Button>
        <Collapsible className="w-full">
          <CollapsibleTrigger className="group flex items-center gap-1 text-xs font-semibold text-electric">
            Setup instructions{" "}
            <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
              {shown.setup.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </Panel>
  );
}
