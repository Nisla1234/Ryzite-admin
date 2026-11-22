import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Circle,
  Gauge,
  Globe,
  PlugZap,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { PageHeader, Panel, EmptyState } from "@/components/admin/PageHeader";
import { RobotPanel, type Signal } from "@/components/admin/RobotPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { checkLiveSite, getDashboardSummary } from "@/lib/admin.functions";
import { actionLabel, fmtRelative } from "@/lib/format";
import { can } from "@/lib/permissions";
import { useMe } from "@/hooks/use-me";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Executive Dashboard · RYZITE Control Centre" },
      {
        name: "description",
        content: "Verified RYZITE website availability, integration readiness and administrator activity.",
      },
    ],
  }),
  component: Dashboard,
});

const LIVE_URL = "https://ryzite-website.thulirkalcom.workers.dev/";

const TRAFFIC_METRICS = [
  "Total visitors",
  "Active users",
  "New visitors",
  "Returning visitors",
  "Page views",
  "Sessions",
  "Engagement rate",
  "Avg. engagement time",
  "Conversions",
  "Organic traffic",
  "Social traffic",
  "AI referral traffic",
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Dashboard() {
  const me = useMe();
  const checkSite = useServerFn(checkLiveSite);
  const fetchSummary = useServerFn(getDashboardSummary);
  const site = useQuery({
    queryKey: ["live-site"],
    queryFn: () => checkSite(),
    refetchInterval: 5 * 60_000,
  });
  const isSuper = can(me.roles, "access.review");

  const summary = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => fetchSummary(),
  });
  const activity = { data: summary.data?.activity };
  const team = {
    data: summary.data
      ? { members: summary.data.members, pending: summary.data.pending }
      : undefined,
  };

  const s = site.data;
  const signals: Signal[] = [
    {
      label: "Website availability",
      state: site.isLoading ? "checking" : s?.ok ? "ok" : "down",
      detail: site.isLoading
        ? "Checking…"
        : s?.ok
          ? `Online · ${s.ms} ms`
          : `Unreachable (${s?.status ?? "error"})`,
    },
    {
      label: "GA4 traffic & conversions",
      state: "missing",
      detail: "GA4 reporting is not configured in this dashboard yet.",
    },
    { label: "PageSpeed & Web Vitals", state: "pending", detail: "Automated reports are not implemented yet." },
    { label: "SEO issues", state: "pending", detail: "No automated SEO scan has been run." },
    { label: "Deployment health", state: "pending", detail: "Deployment history is not available yet." },
    { label: "Open recommendations", state: "pending", detail: "AI recommendations are not implemented yet." },
  ];

  const name = (me.profile.full_name || me.profile.username).split(" ")[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Executive Dashboard"
        title={`${greeting()}, ${name}`}
        description={new Date().toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        actions={
          <Button asChild variant="outline" className="bg-card">
            <a href={LIVE_URL} target="_blank" rel="noreferrer">
              <Globe /> View live website <ArrowUpRight />
            </a>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RobotPanel signals={signals} />
        </div>
        <Panel
          title="Live website"
          description="Real request from the server, every 5 minutes"
          actions={
            <Button
              size="icon"
              variant="ghost"
              onClick={() => site.refetch()}
              disabled={site.isFetching}
              aria-label="Check again"
            >
              <RefreshCw className={site.isFetching ? "animate-spin" : undefined} />
            </Button>
          }
        >
          <div className="flex items-center gap-3">
            <span
              className={`relative flex size-3 rounded-full ${s?.ok ? "bg-success animate-pulse-ring" : site.isLoading ? "bg-muted-foreground" : "bg-destructive"}`}
            />
            <p className="font-display text-3xl">
              {site.isLoading ? "Checking…" : s?.ok ? "Online" : "Unreachable"}
            </p>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-secondary/60 p-3">
              <dt className="text-xs text-muted-foreground">HTTP status</dt>
              <dd className="mt-1 font-semibold">{s?.status || "—"}</dd>
            </div>
            <div className="rounded-xl bg-secondary/60 p-3">
              <dt className="text-xs text-muted-foreground">Response time</dt>
              <dd className="mt-1 font-semibold">{s ? `${s.ms} ms` : "—"}</dd>
            </div>
            <div className="col-span-2 rounded-xl bg-secondary/60 p-3">
              <dt className="text-xs text-muted-foreground">Homepage title</dt>
              <dd className="mt-1 truncate font-semibold">{s?.title ?? "—"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Last checked {s ? fmtRelative(s.checkedAt) : "—"}
          </p>
        </Panel>
      </div>

      <Panel
        title={
          <span className="flex items-center gap-2">
            <BarChart3 className="size-4 text-electric" /> Traffic & engagement
          </span>
        }
        description="Analytics data will appear here after the GA4 reporting integration is implemented."
        actions={<Badge variant="muted">Not connected</Badge>}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {TRAFFIC_METRICS.map((m) => (
            <div key={m} className="rounded-xl border border-dashed bg-secondary/30 p-4">
              <p className="text-xs text-muted-foreground">{m}</p>
              <p className="mt-2 font-display text-2xl text-muted-foreground/60">—</p>
            </div>
          ))}
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <PlugZap className="size-4" /> No visitor or conversion figures are displayed until a verified GA4 report is available.
        </p>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title={
            <span className="flex items-center gap-2">
              <Gauge className="size-4 text-electric" /> Lighthouse performance
            </span>
          }
          description="PageSpeed reports will appear here after the audit integration is implemented."
          actions={<Badge variant="muted">Not connected</Badge>}
        >
          <div className="grid grid-cols-4 gap-3">
            {["Performance", "Accessibility", "Best Practices", "SEO"].map((l) => (
              <div key={l} className="flex flex-col items-center gap-2 text-center">
                <div className="flex size-16 items-center justify-center rounded-full border-4 border-dashed border-muted font-display text-lg text-muted-foreground/60 sm:size-20">
                  —
                </div>
                <p className="text-xs text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No performance scores are displayed because an automated PageSpeed test has not been run.
          </p>
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-2">
              <Search className="size-4 text-electric" /> SEO health
            </span>
          }
          description="Live SEO audit status"
          actions={<Badge variant="muted">Not scanned</Badge>}
        >
          <p className="text-sm text-muted-foreground">
            An automated SEO audit has not been run from the Control Centre. No errors, warnings or
            SEO scores are being reported here yet.
          </p>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title={
            <span className="flex items-center gap-2">
              <Activity className="size-4 text-electric" /> Recent administrator activity
            </span>
          }
          actions={
            can(me.roles, "logs.activity") ? (
              <Button asChild size="sm" variant="ghost">
                <Link to="/admin/logs" search={{ tab: "activity" }}>
                  View all
                </Link>
              </Button>
            ) : undefined
          }
          bodyClassName="p-0"
        >
          {activity.data && activity.data.length > 0 ? (
            <ul className="divide-y">
              {activity.data.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span
                    className={`size-2 shrink-0 rounded-full ${a.result === "success" ? "bg-success" : a.result === "blocked" ? "bg-destructive" : "bg-warning"}`}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{actionLabel(a.action)}</span>
                    {(a.actor_label || a.subject) && (
                      <span className="text-muted-foreground"> · {a.actor_label ?? a.subject}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {fmtRelative(a.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Activity />}
              title="No activity yet"
              description="Sign-ins, approvals and content changes will appear here."
            />
          )}
        </Panel>

        <div className="space-y-6">
          <Panel
            title={
              <span className="flex items-center gap-2">
                <Users className="size-4 text-electric" /> Team & access
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-secondary/60 p-4">
                <p className="text-xs text-muted-foreground">Administrators</p>
                <p className="mt-1 font-display text-3xl text-primary">
                  {team.data?.members ?? "—"}
                </p>
              </div>
              <div className="rounded-xl bg-secondary/60 p-4">
                <p className="text-xs text-muted-foreground">Pending requests</p>
                <p className="mt-1 font-display text-3xl text-primary">
                  {isSuper ? (team.data?.pending ?? "—") : "—"}
                </p>
              </div>
            </div>
            {isSuper && (
              <Button asChild variant="subtle" className="mt-3 w-full">
                <Link to="/admin/access-requests">
                  <UserPlus /> Review access requests
                </Link>
              </Button>
            )}
          </Panel>
          <Panel
            title={
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-electric" /> Setup checklist
              </span>
            }
          >
            <ul className="space-y-2.5 text-sm">
              {[
                { done: true, t: "Secure sign-in, roles and audit logs" },
                { done: false, t: "Connect Sanity editing and verify draft/publish permissions" },
                { done: false, t: "Run a fresh SEO audit and review verified findings" },
                { done: false, t: "Configure GA4 reporting and verify the property" },
                { done: false, t: "Enable and run a PageSpeed audit" },
                { done: false, t: "Connect a sender domain for emails" },
              ].map((i) => (
                <li key={i.t} className="flex items-start gap-2.5">
                  {i.done ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={i.done ? "text-muted-foreground line-through" : undefined}>
                    {i.t}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
