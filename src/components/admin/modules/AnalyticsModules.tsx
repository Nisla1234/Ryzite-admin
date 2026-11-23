import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, CheckCircle2, PlugZap, RefreshCw, XCircle } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState, PageHeader, Panel } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getGa4AnalyticsFn } from "@/lib/platform.functions";

export type AnalyticsSection =
  "overview" | "visitors" | "acquisition" | "social" | "geo" | "events";

const HEADERS: Record<AnalyticsSection, { title: string; description: string }> = {
  overview: {
    title: "GA4 Dashboard",
    description:
      "Real users, sessions, page views, engagement rate, and conversions from Google Analytics 4.",
  },
  visitors: {
    title: "Visitors & Engagement",
    description: "New vs returning visitors, active users, and session engagement duration.",
  },
  acquisition: {
    title: "Traffic Sources & Campaigns",
    description: "Acquisition channels, source/medium attribution, organic search, and campaigns.",
  },
  social: {
    title: "Social & AI Referral Traffic",
    description:
      "Facebook, Instagram, LinkedIn, TikTok, YouTube, and AI assistants (ChatGPT, Perplexity, Claude, Gemini).",
  },
  geo: {
    title: "Geographic & Device Analytics",
    description: "Visitor countries, cities, device categories, and browsers.",
  },
  events: {
    title: "Events & Conversions",
    description: "Tracked website events and key conversion counts from GA4.",
  },
};

const SOCIAL_PATTERN = /facebook|instagram|linkedin|tiktok|youtube|t\.co|twitter|x\.com/i;
const AI_REFERRAL_PATTERN = /chatgpt|openai|perplexity|claude|anthropic|gemini|bard|copilot/i;

export function AnalyticsModule({ view }: { view: AnalyticsSection }) {
  const [days, setDays] = useState<7 | 28 | 90>(28);
  const fetchGa4 = useServerFn(getGa4AnalyticsFn);
  const query = useQuery({
    queryKey: ["ga4-analytics", days],
    queryFn: () => fetchGa4({ data: { days } }),
  });

  const data = query.data;
  const hdr = HEADERS[view];
  const connected = Boolean(data && data.configured && !("error" in data));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title={hdr.title}
        description={hdr.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v) as 7 | 28 | 90)}>
              <TabsList>
                <TabsTrigger value="7">7d</TabsTrigger>
                <TabsTrigger value="28">28d</TabsTrigger>
                <TabsTrigger value="90">90d</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw className={query.isFetching ? "animate-spin" : undefined} /> Refresh
            </Button>
          </div>
        }
      />

      {/* Live Website GA4 Tag & API Status */}
      <Panel title="GA4 Telemetry & Measurement Tag Verification">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border p-3.5">
            {data?.tagInstalled ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
            ) : (
              <XCircle className="mt-0.5 size-5 shrink-0 text-warning" />
            )}
            <div className="text-sm">
              <p className="font-semibold">
                {data?.tagInstalled
                  ? `Live GA4 tag detected (${data.measurementId})`
                  : "No GA4 measurement tag detected on live website"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Checked live HTML at https://ryzite-website.thulirkalcom.workers.dev/
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border p-3.5">
            {connected ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
            ) : (
              <PlugZap className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            )}
            <div className="text-sm">
              <p className="font-semibold">
                {connected
                  ? "GA4 Data API connected"
                  : data && "error" in data && data.error
                    ? `GA4 API error: ${data.error}`
                    : "GA4 Data API credentials not configured"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data && !data.configured && data.missing.length
                  ? `Missing server env vars: ${data.missing.join(", ")}`
                  : "Server-side RS256 service account authentication."}
              </p>
            </div>
          </div>
        </div>
      </Panel>

      {connected && data && !data.tagInstalled && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
          <strong>GA4 Data API is connected, but no measurement tag is live yet:</strong> the live
          Astro website does not currently emit <code className="font-mono text-xs">gtag.js</code>,
          so real GA4 traffic remains at 0 until the tracking snippet is deployed with{" "}
          <code className="font-mono text-xs">PUBLIC_GA_MEASUREMENT_ID</code>.
        </div>
      )}

      {!data || !data.configured || "error" in data ? (
        <Panel>
          <EmptyState
            icon={<BarChart3 />}
            title="Real GA4 traffic will appear here once configured"
            description="No visitor counts, sessions, or referral numbers are simulated or estimated here."
          >
            <Button asChild variant="subtle">
              <Link to="/admin/integrations">Review GA4 connection checklist</Link>
            </Button>
          </EmptyState>
        </Panel>
      ) : (
        <>
          {(view === "overview" || view === "visitors") && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Total Users", data.summary.totalUsers],
                  ["Active Users", data.summary.activeUsers],
                  ["New / Returning", `${data.summary.newUsers} / ${data.summary.returningUsers}`],
                  ["Sessions", data.summary.sessions],
                  ["Page Views", data.summary.pageViews],
                  ["Engagement Rate", `${data.summary.engagementRate}%`],
                  ["Avg. Session", `${data.summary.avgSessionSeconds}s`],
                  ["Conversions", data.summary.conversions],
                ].map(([label, val]) => (
                  <Panel key={String(label)}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 font-display text-3xl text-primary">{val}</p>
                  </Panel>
                ))}
              </div>

              <Panel title={`Daily Users & Sessions (${days} days)`}>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.daily}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="users"
                        stroke="#2563eb"
                        fill="#2563eb"
                        fillOpacity={0.18}
                        name="Active Users"
                      />
                      <Area
                        type="monotone"
                        dataKey="sessions"
                        stroke="#16a34a"
                        fill="#16a34a"
                        fillOpacity={0.12}
                        name="Sessions"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </>
          )}

          {view === "acquisition" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Acquisition Channels">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.channels}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="sessions" fill="#2563eb" name="Sessions" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
              <Panel title="Source / Medium Breakdown">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3">Source</th>
                        <th className="py-2 pr-3">Medium</th>
                        <th className="py-2 pr-3">Sessions</th>
                        <th className="py-2">Users</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.sources.map((s, idx) => (
                        <tr key={idx}>
                          <td className="py-2 pr-3 font-medium">{s.source}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{s.medium}</td>
                          <td className="py-2 pr-3">{s.sessions}</td>
                          <td className="py-2">{s.users}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          )}

          {view === "social" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Social Media Referrals">
                <ul className="divide-y text-sm">
                  {data.sources.filter((s) => SOCIAL_PATTERN.test(s.source)).length ? (
                    data.sources
                      .filter((s) => SOCIAL_PATTERN.test(s.source))
                      .map((s, i) => (
                        <li key={i} className="flex items-center justify-between py-2.5">
                          <span className="font-medium">{s.source}</span>
                          <span>{s.sessions} sessions</span>
                        </li>
                      ))
                  ) : (
                    <li className="py-6 text-center text-muted-foreground">
                      No social referrals recorded in the selected window.
                    </li>
                  )}
                </ul>
              </Panel>
              <Panel title="AI Assistant Referrals (ChatGPT, Perplexity, Claude, Gemini)">
                <ul className="divide-y text-sm">
                  {data.sources.filter((s) => AI_REFERRAL_PATTERN.test(s.source)).length ? (
                    data.sources
                      .filter((s) => AI_REFERRAL_PATTERN.test(s.source))
                      .map((s, i) => (
                        <li key={i} className="flex items-center justify-between py-2.5">
                          <span className="font-medium">{s.source}</span>
                          <Badge variant="ai">{s.sessions} sessions</Badge>
                        </li>
                      ))
                  ) : (
                    <li className="py-6 text-center text-muted-foreground">
                      No AI referral traffic recorded in the selected window.
                    </li>
                  )}
                </ul>
              </Panel>
            </div>
          )}

          {view === "geo" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Top Countries & Cities">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3">Country</th>
                        <th className="py-2 pr-3">City</th>
                        <th className="py-2">Users</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.geo.map((g, i) => (
                        <tr key={i}>
                          <td className="py-2 pr-3 font-medium">{g.country}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{g.city}</td>
                          <td className="py-2">{g.users}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
              <Panel title="Devices & Browsers">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3">Device</th>
                        <th className="py-2 pr-3">Browser</th>
                        <th className="py-2">Sessions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.devices.map((d, i) => (
                        <tr key={i}>
                          <td className="py-2 pr-3 font-medium capitalize">{d.device}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{d.browser}</td>
                          <td className="py-2">{d.sessions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          )}

          {view === "events" && (
            <Panel title="Tracked Events & Conversions">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Event Name</th>
                      <th className="py-2 pr-3">Event Count</th>
                      <th className="py-2">Conversions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.events.map((ev, i) => (
                      <tr key={i}>
                        <td className="py-2 pr-3 font-mono text-xs">{ev.event}</td>
                        <td className="py-2 pr-3">{ev.count}</td>
                        <td className="py-2">{ev.conversions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
