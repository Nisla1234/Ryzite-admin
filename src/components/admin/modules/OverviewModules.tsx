import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUpRight,
  Bot,
  Gauge,
  Globe,
  Mail,
  RefreshCw,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader, Panel } from "@/components/admin/PageHeader";
import { RobotPanel, type Signal } from "@/components/admin/RobotPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { checkLiveSite } from "@/lib/admin.functions";
import { fmtRelative } from "@/lib/format";
import { LIVE_SITE_URL } from "@/lib/nav";
import {
  askAiAssistantFn,
  generateAiReportFn,
  getExecutiveOverview,
} from "@/lib/platform.functions";

export function computeWeightedHealth(input: {
  siteOnline?: boolean | undefined;
  pagesCrawled: number;
  openErrors: number;
  openWarnings: number;
  mobilePerfScore: number | null;
  ga4Connected: boolean;
}) {
  const parts: Array<{ name: string; weight: number; score: number }> = [];
  if (typeof input.siteOnline === "boolean") {
    parts.push({ name: "Website availability", weight: 30, score: input.siteOnline ? 100 : 0 });
  }
  if (input.pagesCrawled > 0) {
    const penalty = input.openErrors * 14 + input.openWarnings * 4;
    parts.push({ name: "SEO technical health", weight: 35, score: Math.max(0, 100 - penalty) });
  }
  if (typeof input.mobilePerfScore === "number") {
    parts.push({ name: "PageSpeed mobile", weight: 35, score: input.mobilePerfScore });
  }
  if (parts.length < 2) return null;
  const totalWeight = parts.reduce((acc, p) => acc + p.weight, 0);
  const weighted = parts.reduce((acc, p) => acc + p.score * p.weight, 0) / totalWeight;
  return {
    score: Math.round(weighted),
    breakdown: parts,
  };
}

export function WebsitePerformanceModule() {
  const fetchOverview = useServerFn(getExecutiveOverview);
  const checkSite = useServerFn(checkLiveSite);
  const overview = useQuery({
    queryKey: ["executive-overview"],
    queryFn: () => fetchOverview(),
  });
  const site = useQuery({
    queryKey: ["live-site"],
    queryFn: () => checkSite(),
  });

  const o = overview.data;
  const s = site.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Website Performance"
        description="Live availability, Core Web Vitals, SEO crawl posture, enquiries and GA4 acquisition status."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                void site.refetch();
                void overview.refetch();
              }}
              disabled={site.isFetching || overview.isFetching}
            >
              <RefreshCw
                className={site.isFetching || overview.isFetching ? "animate-spin" : undefined}
              />
              Refresh signals
            </Button>
            <Button asChild variant="subtle">
              <a href={LIVE_SITE_URL} target="_blank" rel="noreferrer">
                Open live site <ArrowUpRight />
              </a>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Availability</span>
            <Globe className="size-4 text-electric" />
          </div>
          <p className="mt-2 font-display text-3xl text-primary">
            {site.isLoading ? "Checking…" : s?.ok ? "Online" : "Check"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {s ? `HTTP ${s.status} · ${s.ms} ms` : "Pending live probe"}
          </p>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Mobile Performance</span>
            <Gauge className="size-4 text-electric" />
          </div>
          <p className="mt-2 font-display text-3xl text-primary">
            {o?.performance.mobile?.performance_score != null
              ? `${o.performance.mobile.performance_score}/100`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {o?.performance.mobile
              ? `Measured ${fmtRelative(o.performance.mobile.created_at)}`
              : "Run a PageSpeed test to populate"}
          </p>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>SEO Findings</span>
            <Search className="size-4 text-electric" />
          </div>
          <p className="mt-2 font-display text-3xl text-primary">
            {o?.seoSummary.pagesCrawled
              ? `${o.seoSummary.openErrors}E / ${o.seoSummary.openWarnings}W`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {o?.seoSummary.pagesCrawled
              ? `${o.seoSummary.pagesCrawled} pages scanned`
              : "Run SEO crawl in SEO Centre"}
          </p>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Open Enquiries</span>
            <Mail className="size-4 text-electric" />
          </div>
          <p className="mt-2 font-display text-3xl text-primary">
            {o ? o.openEnquiriesCount : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {o ? `${o.unreadEnquiriesCount} unread of ${o.enquiriesCount} total` : "Loading…"}
          </p>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Google Analytics 4 (28-day window)"
          description="Live traffic & conversion metrics require GA4 Data API credentials and a website measurement tag."
          actions={
            o?.ga4.connected ? (
              o.ga4.tagInstalled ? (
                <Badge variant="success">Connected</Badge>
              ) : (
                <Badge variant="warning">Tag missing on site</Badge>
              )
            ) : (
              <Badge variant="muted">Setup required</Badge>
            )
          }
        >
          {o?.ga4.connected ? (
            <div className="space-y-3">
              {!o.ga4.tagInstalled && (
                <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
                  GA4 Data API is connected, but no <code className="font-mono">gtag.js</code>{" "}
                  snippet was found on the live website yet — metrics remain 0 until the tracking
                  tag is deployed.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  ["Active users", o.ga4.summary.activeUsers],
                  ["New users", o.ga4.summary.newUsers],
                  ["Sessions", o.ga4.summary.sessions],
                  ["Page views", o.ga4.summary.pageViews],
                  ["Engagement rate", `${o.ga4.summary.engagementRate}%`],
                  ["Conversions", o.ga4.summary.conversions],
                ].map(([k, v]) => (
                  <div key={String(k)} className="rounded-xl bg-secondary/60 p-3">
                    <p className="text-xs text-muted-foreground">{k}</p>
                    <p className="mt-1 font-display text-2xl text-primary">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Live site GA4 tag:{" "}
                <strong className="text-foreground">
                  {o?.ga4.tagInstalled ? `Detected (${o.ga4.measurementId})` : "Not installed yet"}
                </strong>
              </p>
              {o?.ga4 && "missing" in o.ga4 && o.ga4.missing.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Missing server secrets: {o.ga4.missing.join(", ")}
                </p>
              )}
              <Button asChild size="sm" variant="subtle">
                <Link
                  to="/admin/$section/$page"
                  params={{ section: "analytics", page: "overview" }}
                >
                  Open GA4 Setup & Reports
                </Link>
              </Button>
            </div>
          )}
        </Panel>

        <Panel
          title="PageSpeed Snapshot (Mobile vs Desktop)"
          description="Real Lighthouse scores stored in Control Centre."
          actions={
            <Button asChild size="sm" variant="subtle">
              <Link
                to="/admin/$section/$page"
                params={{ section: "performance", page: "overview" }}
              >
                Run PageSpeed test
              </Link>
            </Button>
          }
        >
          {o?.performance.mobile || o?.performance.desktop ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {(["mobile", "desktop"] as const).map((strategy) => {
                const rep = o.performance[strategy];
                return (
                  <div key={strategy} className="rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold capitalize">{strategy}</span>
                      <Badge variant={rep ? "info" : "muted"}>
                        {rep ? fmtRelative(rep.created_at) : "Not tested"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>Perf: {rep?.performance_score ?? "—"}</div>
                      <div>SEO: {rep?.seo_score ?? "—"}</div>
                      <div>A11y: {rep?.accessibility_score ?? "—"}</div>
                      <div>Best: {rep?.best_practices_score ?? "—"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Gauge />}
              title="No PageSpeed tests saved yet"
              description="Run a live Mobile or Desktop Lighthouse audit in the Performance section."
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

export function AssistantModule() {
  const qc = useQueryClient();
  const fetchOverview = useServerFn(getExecutiveOverview);
  const checkSite = useServerFn(checkLiveSite);
  const askFn = useServerFn(askAiAssistantFn);
  const reportFn = useServerFn(generateAiReportFn);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{
    provider: string;
    usedRealAi: boolean;
    text: string;
    warning?: string | undefined;
  } | null>(null);

  const overview = useQuery({
    queryKey: ["executive-overview"],
    queryFn: () => fetchOverview(),
  });
  const site = useQuery({
    queryKey: ["live-site"],
    queryFn: () => checkSite(),
  });

  const askMutation = useMutation({
    mutationFn: () => askFn({ data: { question } }),
    onSuccess: (res) => setAnswer(res),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not run assistant query"),
  });

  const genMutation = useMutation({
    mutationFn: (reportType: "daily" | "health") => reportFn({ data: { reportType } }),
    onSuccess: (res) => {
      toast.success(`Saved ${res.report.title}`);
      setAnswer({
        provider: res.report.provider,
        usedRealAi: !res.warning,
        text: res.report.summary,
        ...(res.warning ? { warning: res.warning } : {}),
      });
      void qc.invalidateQueries({ queryKey: ["ai-workspace"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Report generation failed"),
  });

  const o = overview.data;
  const s = site.data;

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
      detail: s ? `HTTP ${s.status} · ${s.ms} ms` : "Checking…",
    },
    {
      label: "SEO technical crawl",
      state: o?.seoSummary.pagesCrawled ? (o.seoSummary.openErrors > 0 ? "down" : "ok") : "pending",
      detail: o?.seoSummary.pagesCrawled
        ? `${o.seoSummary.pagesCrawled} pages · ${o.seoSummary.openErrors} errors, ${o.seoSummary.openWarnings} warnings`
        : "Run crawl in SEO Centre",
    },
    {
      label: "PageSpeed mobile",
      state: o?.performance.mobile ? "ok" : "pending",
      detail: o?.performance.mobile
        ? `Performance ${o.performance.mobile.performance_score}/100 · SEO ${o.performance.mobile.seo_score}/100`
        : "Run live test in Performance",
    },
    {
      label: "GA4 traffic & tag",
      state: o?.ga4.connected ? (o.ga4.tagInstalled ? "ok" : "pending") : "missing",
      detail: o?.ga4.connected
        ? o.ga4.tagInstalled
          ? `${o.ga4.summary.activeUsers} active users (28d)`
          : "API connected · install gtag.js on live site"
        : o?.ga4.tagInstalled
          ? "Tag installed; API credentials missing"
          : "No GA4 tag or API credentials",
    },
    {
      label: "Enquiries inbox",
      state: "ok",
      detail: o ? `${o.openEnquiriesCount} open enquiries` : "Ready",
    },
    {
      label: "Priority tasks",
      state: "ok",
      detail: o ? `${o.tasks.openCount} active tasks` : "Ready",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="RYZITE AI Assistant"
        description="Weighted website health score based strictly on verified platform signals, plus grounded AI diagnostics."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="subtle"
              disabled={genMutation.isPending}
              onClick={() => genMutation.mutate("daily")}
            >
              <Sparkles /> Generate Daily Report
            </Button>
            <Button
              variant="outline"
              disabled={genMutation.isPending}
              onClick={() => genMutation.mutate("health")}
            >
              Health Analysis
            </Button>
          </div>
        }
      />

      <RobotPanel
        signals={signals}
        healthScore={weighted?.score ?? null}
        showAssistantLink={false}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          title="Ask RYZITE Analyst"
          description="Answers strictly from verified crawl, PageSpeed, enquiry, and GA4 telemetry."
          className="lg:col-span-2"
        >
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (question.trim().length >= 3) askMutation.mutate();
            }}
          >
            <Textarea
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Example: What are the top SEO or technical priorities to fix before adding Google Analytics?"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Summarize open SEO issues",
                  "What is blocking full analytics?",
                  "Recommend top 3 priorities today",
                ].map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setQuestion(preset)}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
              <Button type="submit" disabled={askMutation.isPending || question.trim().length < 3}>
                <Send className="size-4" />
                {askMutation.isPending ? "Analysing…" : "Ask assistant"}
              </Button>
            </div>
          </form>

          {askMutation.isError && (
            <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {askMutation.error instanceof Error
                ? askMutation.error.message
                : "Could not run assistant query."}
            </div>
          )}

          {answer && (
            <div
              data-testid="ai-assistant-answer"
              className="mt-5 rounded-xl border bg-secondary/40 p-4"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Bot className="size-4 text-electric" />
                <span className="text-xs font-semibold">{answer.provider}</span>
                <Badge variant={answer.usedRealAi ? "ai" : "muted"}>
                  {answer.usedRealAi ? "Generative AI" : "Rule-based telemetry"}
                </Badge>
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed">{answer.text}</p>
              {answer.warning && (
                <p className="mt-2 text-xs text-muted-foreground">{answer.warning}</p>
              )}
            </div>
          )}
        </Panel>

        <Panel
          title="Score Weights Breakdown"
          description="Only active, verified signals contribute to the Robot health score."
        >
          {weighted ? (
            <ul className="space-y-3">
              {weighted.breakdown.map((b) => (
                <li key={b.name} className="rounded-xl bg-secondary/50 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{b.name}</span>
                    <span className="font-semibold text-primary">{b.score}/100</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">Weight: {b.weight}%</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Run at least an SEO live crawl or PageSpeed test alongside the HTTP availability probe
              to unlock weighted scoring.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
