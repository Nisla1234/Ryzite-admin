import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Gauge, Play, Plus, RefreshCw, Zap } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { EmptyState, PageHeader, Panel } from "@/components/admin/PageHeader";
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
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { LIVE_SITE_URL } from "@/lib/nav";
import { can } from "@/lib/permissions";
import { createAiTaskFn, getPerformanceFn, runPageSpeedFn } from "@/lib/platform.functions";

export type PerformanceSection =
  "overview" | "web-vitals" | "accessibility" | "suggestions" | "history";

const HEADERS: Record<PerformanceSection, { title: string; description: string }> = {
  overview: {
    title: "PageSpeed & Lighthouse",
    description:
      "Real Google PageSpeed Insights v5 scores for Mobile and Desktop on the live website.",
  },
  "web-vitals": {
    title: "Core Web Vitals",
    description: "Lab Lighthouse measurements separated cleanly from CrUX real-visitor field data.",
  },
  accessibility: {
    title: "Accessibility & Best Practices",
    description:
      "Failing accessibility, best-practices, and technical SEO audits detected by Lighthouse.",
  },
  suggestions: {
    title: "Performance Recommendations",
    description:
      "Prioritized Lighthouse opportunities with estimated savings and one-click task tracking.",
  },
  history: {
    title: "Performance History",
    description: "Historical trend of saved Mobile and Desktop PageSpeed Insights tests.",
  },
};

function ScoreRing({ label, score }: { label: string; score: number | null | undefined }) {
  const val = typeof score === "number" ? score : null;
  const ringClass =
    val === null
      ? "border-muted text-muted-foreground"
      : val >= 90
        ? "border-success text-success"
        : val >= 50
          ? "border-warning text-warning"
          : "border-destructive text-destructive";
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div
        className={`flex size-16 items-center justify-center rounded-full border-4 font-display text-xl sm:size-20 ${ringClass}`}
      >
        {val ?? "—"}
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

const TARGET_PATHS = [
  "/",
  "/about/",
  "/services/",
  "/solutions/",
  "/our-work/",
  "/packages/",
  "/contact/",
];

export function PerformanceModule({ view }: { view: PerformanceSection }) {
  const me = useMe();
  const canRun = can(me.roles, "performance.run");
  const qc = useQueryClient();

  const fetchPerf = useServerFn(getPerformanceFn);
  const runSpeedFn = useServerFn(runPageSpeedFn);
  const addTaskFn = useServerFn(createAiTaskFn);

  const [path, setPath] = useState("/");
  const [strategy, setStrategy] = useState<"mobile" | "desktop">("mobile");

  const query = useQuery({
    queryKey: ["performance-snapshot"],
    queryFn: () => fetchPerf(),
  });

  const runMutation = useMutation({
    mutationFn: () => {
      const origin = LIVE_SITE_URL.replace(/\/+$/, "");
      return runSpeedFn({ data: { url: `${origin}${path}`, strategy } });
    },
    onSuccess: (rep) => {
      if (rep.error) {
        toast.error(rep.error);
      } else {
        toast.success(
          `Saved ${rep.strategy} PageSpeed report · Performance ${rep.performance_score}/100`,
        );
      }
      void qc.invalidateQueries({ queryKey: ["performance-snapshot"] });
      void qc.invalidateQueries({ queryKey: ["executive-overview"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "PageSpeed run failed"),
  });

  const taskMutation = useMutation({
    mutationFn: (opp: { title: string; description: string; savingsMs?: number }) =>
      addTaskFn({
        data: {
          title: `PageSpeed: ${opp.title}`,
          description: `${opp.description}${opp.savingsMs ? ` (Est. ${Math.round(opp.savingsMs)} ms savings)` : ""}`,
          priority: opp.savingsMs && opp.savingsMs > 500 ? "high" : "medium",
          source: "performance",
          related_url: `${LIVE_SITE_URL.replace(/\/+$/, "")}${path}`,
        },
      }),
    onSuccess: () => {
      toast.success("Added to AI Priority Tasks.");
      void qc.invalidateQueries({ queryKey: ["ai-workspace"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add task"),
  });

  const mobile = query.data?.mobile ?? null;
  const desktop = query.data?.desktop ?? null;
  const history = query.data?.history ?? [];
  const activeReport = (strategy === "mobile" ? mobile : desktop) ?? mobile ?? desktop;
  const hdr = HEADERS[view];

  const chartData = history
    .filter((h) => !h.error && typeof h.performance_score === "number")
    .slice(0, 15)
    .reverse()
    .map((h) => ({
      date: fmtDateTime(h.created_at),
      performance: h.performance_score,
      seo: h.seo_score,
      accessibility: h.accessibility_score,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Performance"
        title={hdr.title}
        description={hdr.description}
        actions={
          canRun ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={path} onValueChange={setPath}>
                <SelectTrigger className="w-36 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_PATHS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={strategy}
                onValueChange={(v) => setStrategy(v as "mobile" | "desktop")}
              >
                <SelectTrigger className="w-28 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="desktop">Desktop</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
                {runMutation.isPending ? (
                  <>
                    <RefreshCw className="animate-spin" /> Running Lighthouse…
                  </>
                ) : (
                  <>
                    <Play className="size-4" /> Run live test
                  </>
                )}
              </Button>
            </div>
          ) : undefined
        }
      />

      {!activeReport && !runMutation.isPending ? (
        <Panel>
          <EmptyState
            icon={<Gauge />}
            title="No PageSpeed Insights reports saved yet"
            description="Run a live Mobile or Desktop Lighthouse test above to store real Core Web Vitals and opportunities."
          >
            {canRun && (
              <Button onClick={() => runMutation.mutate()}>
                <Play className="size-4" /> Run Mobile PageSpeed Test
              </Button>
            )}
          </EmptyState>
        </Panel>
      ) : (
        <>
          {view === "overview" && (
            <div className="grid gap-6 lg:grid-cols-2">
              {(
                [
                  ["Mobile Lighthouse", mobile],
                  ["Desktop Lighthouse", desktop],
                ] as const
              ).map(([title, rep]) => (
                <Panel
                  key={title}
                  title={title}
                  description={rep ? `${rep.url} · ${fmtRelative(rep.created_at)}` : "Not run yet"}
                >
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <ScoreRing label="Performance" score={rep?.performance_score} />
                    <ScoreRing label="Accessibility" score={rep?.accessibility_score} />
                    <ScoreRing label="Best Practices" score={rep?.best_practices_score} />
                    <ScoreRing label="SEO" score={rep?.seo_score} />
                  </div>
                </Panel>
              ))}
            </div>
          )}

          {view === "web-vitals" && activeReport && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel
                title={`Lab Data (${activeReport.strategy})`}
                description="Controlled Lighthouse simulation measurements"
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    [
                      "LCP",
                      activeReport.lcp_ms != null
                        ? `${(activeReport.lcp_ms / 1000).toFixed(2)} s`
                        : "—",
                    ],
                    [
                      "TBT / INP proxy",
                      activeReport.inp_ms != null ? `${Math.round(activeReport.inp_ms)} ms` : "—",
                    ],
                    [
                      "CLS",
                      activeReport.cls_score != null ? activeReport.cls_score.toFixed(3) : "—",
                    ],
                    [
                      "FCP",
                      activeReport.fcp_ms != null
                        ? `${(activeReport.fcp_ms / 1000).toFixed(2)} s`
                        : "—",
                    ],
                    [
                      "TTFB",
                      activeReport.ttfb_ms != null ? `${Math.round(activeReport.ttfb_ms)} ms` : "—",
                    ],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="rounded-xl bg-secondary/60 p-3">
                      <p className="text-xs text-muted-foreground">{k}</p>
                      <p className="mt-1 font-display text-2xl text-primary">{v}</p>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel
                title="CrUX Real-Visitor Field Data"
                description="28-day Chrome UX Report percentiles when sufficient real traffic exists"
              >
                {activeReport.field_lcp_ms != null || activeReport.field_inp_ms != null ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-secondary/60 p-3">
                      <p className="text-xs text-muted-foreground">Field LCP</p>
                      <p className="mt-1 font-display text-2xl">
                        {(activeReport.field_lcp_ms! / 1000).toFixed(2)} s
                      </p>
                    </div>
                    <div className="rounded-xl bg-secondary/60 p-3">
                      <p className="text-xs text-muted-foreground">Field INP</p>
                      <p className="mt-1 font-display text-2xl">
                        {activeReport.field_inp_ms != null
                          ? `${activeReport.field_inp_ms} ms`
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-secondary/60 p-3">
                      <p className="text-xs text-muted-foreground">Field CLS</p>
                      <p className="mt-1 font-display text-2xl">
                        {activeReport.field_cls != null ? activeReport.field_cls : "—"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={<Activity />}
                    title="Insufficient CrUX field traffic"
                    description="Google PageSpeed Insights returned lab telemetry only because this origin does not yet have 28-day CrUX visitor volume."
                  />
                )}
              </Panel>
            </div>
          )}

          {view === "accessibility" && activeReport && (
            <Panel
              title={`Notable Audits (${activeReport.strategy})`}
              description="Accessibility, Best Practices, and SEO audits scoring below 100"
            >
              {activeReport.audits.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No failing audits recorded in the latest {activeReport.strategy} run.
                </p>
              ) : (
                <ul className="divide-y text-sm">
                  {activeReport.audits.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {a.category} {a.displayValue ? `· ${a.displayValue}` : ""}
                        </p>
                      </div>
                      <Badge variant={a.score && a.score >= 50 ? "warning" : "danger"}>
                        {a.score ?? 0}/100
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {view === "suggestions" && activeReport && (
            <Panel
              title={`Optimization Opportunities (${activeReport.strategy})`}
              description="Direct Lighthouse opportunities from the latest report"
            >
              {activeReport.opportunities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No significant optimization opportunities returned.
                </p>
              ) : (
                <ul className="divide-y">
                  {activeReport.opportunities.map((opp) => (
                    <li
                      key={opp.id}
                      className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Zap className="size-4 text-warning" />
                          <span className="font-semibold text-sm">{opp.title}</span>
                          {opp.savingsMs ? (
                            <Badge variant="warning">~{Math.round(opp.savingsMs)} ms</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">{opp.description}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={taskMutation.isPending}
                        onClick={() => taskMutation.mutate(opp)}
                      >
                        <Plus className="size-3.5" /> Track task
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {view === "history" && (
            <div className="space-y-6">
              {chartData.length > 0 && (
                <Panel title="Score Trend">
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="performance"
                          stroke="#2563eb"
                          name="Performance"
                        />
                        <Line type="monotone" dataKey="seo" stroke="#16a34a" name="SEO" />
                        <Line
                          type="monotone"
                          dataKey="accessibility"
                          stroke="#9333ea"
                          name="Accessibility"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              )}

              <Panel title={`Saved Reports (${history.length})`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3">When</th>
                        <th className="py-2 pr-3">Strategy</th>
                        <th className="py-2 pr-3">URL</th>
                        <th className="py-2 pr-3">Perf</th>
                        <th className="py-2 pr-3">A11y</th>
                        <th className="py-2 pr-3">Best</th>
                        <th className="py-2">SEO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {history.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2 pr-3 text-xs text-muted-foreground">
                            {fmtDateTime(r.created_at)}
                          </td>
                          <td className="py-2 pr-3 capitalize">{r.strategy}</td>
                          <td className="py-2 pr-3 truncate max-w-[200px]">{r.url}</td>
                          <td className="py-2 pr-3 font-semibold">{r.performance_score ?? "—"}</td>
                          <td className="py-2 pr-3">{r.accessibility_score ?? "—"}</td>
                          <td className="py-2 pr-3">{r.best_practices_score ?? "—"}</td>
                          <td className="py-2">{r.seo_score ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  );
}
