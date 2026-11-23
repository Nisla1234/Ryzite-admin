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
  Mail,
  PlugZap,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/admin/PageHeader";
import { RobotPanel, type Signal } from "@/components/admin/RobotPanel";
import { computeWeightedHealth } from "@/components/admin/modules/OverviewModules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/use-me";
import { checkLiveSite } from "@/lib/admin.functions";
import { actionLabel, fmtRelative } from "@/lib/format";
import { LIVE_SITE_URL } from "@/lib/nav";
import { can } from "@/lib/permissions";
import { getExecutiveOverview } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Executive Dashboard · RYZITE Control Centre" },
      {
        name: "description",
        content: "RYZITE website health, traffic, SEO, performance and admin activity.",
      },
    ],
  }),
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Dashboard() {
  const me = useMe();
  const checkSite = useServerFn(checkLiveSite);
  const fetchOverview = useServerFn(getExecutiveOverview);

  const site = useQuery({
    queryKey: ["live-site"],
    queryFn: () => checkSite(),
    refetchInterval: 5 * 60_000,
  });

  const overview = useQuery({
    queryKey: ["executive-overview"],
    queryFn: () => fetchOverview(),
  });

  const isSuper = can(me.roles, "access.review");
  const s = site.data;
  const o = overview.data;

  const weighted = o
    ? computeWeightedHealth({
        siteOnline: s?.ok,
        pagesCrawled: o.seoSummary.pagesCrawled,
        openErrors: o.seoSummary.openErrors,
        openWarnings: o.seoSummary.openWarnings,
        mobilePerfScore: o.performance.mobile?.performance_score ?? null,
        ga4Connected: o.ga4.connected,
      })
    : null;

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
      label: "GA4 traffic & tag",
      state: o?.ga4.connected ? (o.ga4.tagInstalled ? "ok" : "pending") : "missing",
      detail: o?.ga4.connected
        ? o.ga4.tagInstalled
          ? `${o.ga4.summary.activeUsers} active users (28d)`
          : "API connected · install gtag.js on live site"
        : o?.ga4.tagInstalled
          ? `Tag ${o.ga4.measurementId} found; add GA4 API credentials`
          : "No GA4 tag or Data API credentials",
    },
    {
      label: "PageSpeed & Web Vitals",
      state: o?.performance.mobile ? "ok" : "pending",
      detail: o?.performance.mobile
        ? `Mobile ${o.performance.mobile.performance_score}/100 · SEO ${o.performance.mobile.seo_score}/100`
        : "Run a test in Performance -> PageSpeed",
    },
    {
      label: "SEO live crawl",
      state: o?.seoSummary.pagesCrawled ? (o.seoSummary.openErrors > 0 ? "down" : "ok") : "pending",
      detail: o?.seoSummary.pagesCrawled
        ? `${o.seoSummary.pagesCrawled} pages · ${o.seoSummary.openErrors} errors, ${o.seoSummary.openWarnings} warnings`
        : "Run scan in SEO Centre -> Overview",
    },
    {
      label: "Website enquiries",
      state: "ok",
      detail: o ? `${o.openEnquiriesCount} open (${o.unreadEnquiriesCount} unread)` : "Ready",
    },
    {
      label: "AI priority tasks",
      state: "ok",
      detail: o ? `${o.tasks.openCount} active tasks` : "Ready",
    },
  ];

  const name = (me.profile.full_name || me.profile.username).split(" ")[0];
  const mobilePerf = o?.performance.mobile;

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
            <a href={LIVE_SITE_URL} target="_blank" rel="noreferrer">
              <Globe /> View live website <ArrowUpRight />
            </a>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <RobotPanel signals={signals} healthScore={weighted?.score ?? null} />
        </div>
        <Panel
          title="Live website"
          description="Real request from the server, every 5 minutes"
          actions={
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                void site.refetch();
                void overview.refetch();
              }}
              disabled={site.isFetching || overview.isFetching}
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
            <BarChart3 className="size-4 text-electric" /> Traffic & engagement (GA4)
          </span>
        }
        description="Real figures from Google Analytics 4 Data API — nothing is estimated."
        actions={
          o?.ga4.connected ? (
            o.ga4.tagInstalled ? (
              <Badge variant="success">Connected</Badge>
            ) : (
              <Badge variant="warning">Tag missing on site</Badge>
            )
          ) : (
            <Badge variant="muted">Not connected</Badge>
          )
        }
      >
        {o?.ga4.connected ? (
          <div className="space-y-4">
            {!o.ga4.tagInstalled && (
              <div className="flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-foreground">
                  GA4 Data API credentials are connected, but no{" "}
                  <code className="font-mono text-xs">gtag.js</code> measurement tag was detected on
                  the live website — counts stay 0 until GA4 is deployed on the site.
                </p>
                <Button asChild size="sm" variant="outline" className="shrink-0 bg-card">
                  <Link
                    to="/admin/$section/$page"
                    params={{ section: "analytics", page: "overview" }}
                  >
                    Check GA4 status
                  </Link>
                </Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {[
                ["Total users", o.ga4.summary.totalUsers],
                ["Active users", o.ga4.summary.activeUsers],
                ["New visitors", o.ga4.summary.newUsers],
                ["Returning", o.ga4.summary.returningUsers],
                ["Page views", o.ga4.summary.pageViews],
                ["Sessions", o.ga4.summary.sessions],
                ["Engagement", `${o.ga4.summary.engagementRate}%`],
                ["Conversions", o.ga4.summary.conversions],
              ].map(([label, val]) => (
                <div key={String(label)} className="rounded-xl bg-secondary/50 p-3.5">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 font-display text-2xl text-primary">{val}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <PlugZap className="size-4 shrink-0" />
              {o?.ga4.tagInstalled
                ? `GA4 tag ${o.ga4.measurementId} found on live site; configure GA4_PROPERTY_ID, GA4_CLIENT_EMAIL and GA4_PRIVATE_KEY.`
                : "No GA4 measurement tag detected on the live website yet and server GA4 credentials are not set."}
            </p>
            <Button asChild size="sm" variant="subtle">
              <Link to="/admin/$section/$page" params={{ section: "analytics", page: "overview" }}>
                Open GA4 Analytics
              </Link>
            </Button>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title={
            <span className="flex items-center gap-2">
              <Gauge className="size-4 text-electric" /> Lighthouse performance
            </span>
          }
          description={
            mobilePerf
              ? `Latest mobile report ${fmtRelative(mobilePerf.created_at)}`
              : "Real Google PageSpeed Insights v5 scores for the live site"
          }
          actions={
            <Button asChild size="sm" variant="ghost">
              <Link
                to="/admin/$section/$page"
                params={{ section: "performance", page: "overview" }}
              >
                {mobilePerf ? "Open report" : "Run test"}
              </Link>
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Performance", mobilePerf?.performance_score],
              ["Accessibility", mobilePerf?.accessibility_score],
              ["Best Practices", mobilePerf?.best_practices_score],
              ["SEO", mobilePerf?.seo_score],
            ].map(([l, score]) => (
              <div key={String(l)} className="flex flex-col items-center gap-2 text-center">
                <div
                  className={`flex size-16 items-center justify-center rounded-full border-4 font-display text-lg sm:size-20 ${
                    typeof score === "number"
                      ? score >= 90
                        ? "border-success text-success"
                        : score >= 50
                          ? "border-warning text-warning"
                          : "border-destructive text-destructive"
                      : "border-dashed border-muted text-muted-foreground/60"
                  }`}
                >
                  {typeof score === "number" ? score : "—"}
                </div>
                <p className="text-xs text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-2">
              <Search className="size-4 text-electric" /> SEO health
            </span>
          }
          description={
            o?.seoSummary.pagesCrawled
              ? `Scanned ${o.seoSummary.pagesCrawled} pages · ${fmtRelative(o.seoSummary.lastCheckedAt)}`
              : "Live multi-page SEO crawl findings"
          }
          actions={
            <Button asChild size="sm" variant="ghost">
              <Link to="/admin/$section/$page" params={{ section: "seo", page: "overview" }}>
                SEO Centre
              </Link>
            </Button>
          }
        >
          {o?.seoSummary.topIssues.length ? (
            <ul className="space-y-2">
              {o.seoSummary.topIssues.map((f) => (
                <li key={f.id} className="flex items-start gap-2.5 text-sm">
                  <Badge
                    variant={f.severity === "error" ? "danger" : "warning"}
                    className="mt-0.5 shrink-0 capitalize"
                  >
                    {f.severity}
                  </Badge>
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-xs text-muted-foreground">{f.page_path}</span>{" "}
                    {f.title}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                {o?.seoSummary.pagesCrawled
                  ? "No open SEO errors or warnings in the latest crawl."
                  : "Run a live website crawl in SEO Centre to inspect titles, canonicals, Open Graph, schema, and sitemap status."}
              </p>
              <Button asChild size="sm" variant="subtle">
                <Link to="/admin/$section/$page" params={{ section: "seo", page: "overview" }}>
                  Run live SEO crawl
                </Link>
              </Button>
            </div>
          )}
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
          {o?.activity && o.activity.length > 0 ? (
            <ul className="divide-y">
              {o.activity.map((a) => (
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

        <div className="min-w-0 space-y-6">
          <Panel
            title={
              <span className="flex items-center gap-2">
                <Users className="size-4 text-electric" /> Team & Enquiries
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-secondary/60 p-4">
                <p className="text-xs text-muted-foreground">Administrators</p>
                <p className="mt-1 font-display text-3xl text-primary">{o?.members ?? "—"}</p>
              </div>
              <div className="rounded-xl bg-secondary/60 p-4">
                <p className="text-xs text-muted-foreground">Open enquiries</p>
                <p className="mt-1 font-display text-3xl text-primary">
                  {o?.openEnquiriesCount ?? "—"}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Button asChild variant="subtle" className="w-full">
                <Link to="/admin/$section/$page" params={{ section: "website", page: "enquiries" }}>
                  <Mail /> Open enquiry inbox
                </Link>
              </Button>
              {isSuper && (o?.pendingAccess ?? 0) > 0 && (
                <Button asChild variant="outline" className="w-full">
                  <Link to="/admin/access-requests">
                    <UserPlus /> Review {o?.pendingAccess} access requests
                  </Link>
                </Button>
              )}
            </div>
          </Panel>

          <Panel
            title={
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-electric" /> Platform readiness
              </span>
            }
          >
            <ul className="space-y-2.5 text-sm">
              {[
                { done: true, t: "Secure sign-in, roles, D1 schema & audit logs" },
                { done: true, t: "CMS modules, media inventory & enquiries endpoint" },
                {
                  done: Boolean(o?.seoSummary.pagesCrawled),
                  t: "Live multi-page SEO crawl executed",
                },
                { done: Boolean(mobilePerf), t: "PageSpeed Insights Lighthouse test stored" },
                { done: Boolean(o?.ga4.tagInstalled), t: "Install GA4 measurement tag on website" },
                { done: Boolean(o?.ga4.connected), t: "Connect GA4 Data API credentials" },
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
