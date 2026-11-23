import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Cloud,
  ExternalLink,
  GitBranch,
  RefreshCw,
  Save,
  Shield,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtDateTime } from "@/lib/format";
import {
  getDeploymentsHealthFn,
  getSystemSettingsFn,
  saveSystemSettingsFn,
} from "@/lib/platform.functions";

export function DeploymentsModule() {
  const fetchHealth = useServerFn(getDeploymentsHealthFn);
  const query = useQuery({
    queryKey: ["deployments-health"],
    queryFn: () => fetchHealth(),
  });

  const d = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System Management"
        title="Deployment & Website Health"
        description="Live Cloudflare Worker health, D1 runtime status, and GitHub commit history for Nisla1234/ryzite-unified-platform."
        actions={
          <Button
            variant="outline"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={query.isFetching ? "animate-spin" : undefined} /> Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Panel>
          <p className="text-xs text-muted-foreground">Live Astro Worker</p>
          <p className="mt-1 font-display text-3xl text-primary">
            {query.isLoading ? "Checking…" : d?.site.ok ? "Online" : "Check"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {d ? `HTTP ${d.site.status} · ${d.site.ms} ms` : ""}
          </p>
        </Panel>

        <Panel>
          <p className="text-xs text-muted-foreground">Control Centre Database</p>
          <p className="mt-1 font-display text-3xl text-primary">
            {d?.d1Bound ? "Cloudflare D1" : "Node Dev Store"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {d?.d1Bound
              ? "Worker D1 binding DB active"
              : "D1 binding activates in Wrangler / Cloudflare Workers"}
          </p>
        </Panel>

        <Panel>
          <p className="text-xs text-muted-foreground">Website Repo Branches</p>
          <p className="mt-1 font-display text-3xl text-primary">{d?.branches.length ?? 0}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {(d?.branches ?? []).map((b) => (
              <Badge key={b.name} variant="muted">
                <GitBranch className="mr-1 size-3" /> {b.name} ({b.sha})
              </Badge>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="GitHub Repository Commits"
          description={d?.githubRepo ?? "Nisla1234/ryzite-unified-platform"}
        >
          {d?.commits.ok && d.commits.commits.length ? (
            <ul className="divide-y text-sm">
              {d.commits.commits.map((c) => (
                <li key={c.fullSha} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.author} · {c.date ? fmtDateTime(c.date) : ""}
                    </p>
                  </div>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs hover:bg-accent"
                  >
                    {c.sha} <ExternalLink className="size-3" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {d?.commits.error ?? "Loading repository commits…"}
            </p>
          )}
        </Panel>

        <Panel
          title="Cloudflare Worker Deployments"
          description="Official Worker script deployment log"
        >
          {!d?.cloudflare.configured ? (
            <div className="flex items-start gap-3 rounded-xl border border-dashed p-4 text-sm">
              <Cloud className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-semibold">Cloudflare API credentials not configured</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {"note" in (d?.cloudflare ?? {})
                    ? (d?.cloudflare as { note?: string }).note
                    : "Configure CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID."}
                </p>
              </div>
            </div>
          ) : d.cloudflare.deployments.length ? (
            <ul className="divide-y text-sm">
              {d.cloudflare.deployments.map((dep) => (
                <li key={dep.id} className="flex items-center justify-between py-2.5">
                  <span className="font-mono text-xs">{dep.id.slice(0, 12)}</span>
                  <span className="text-xs text-muted-foreground">
                    {fmtDateTime(dep.createdOn)} · {dep.source}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {"error" in d.cloudflare && d.cloudflare.error
                ? d.cloudflare.error
                : "No deployments returned."}
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

export function SettingsModule() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getSystemSettingsFn);
  const saveFn = useServerFn(saveSystemSettingsFn);

  const query = useQuery({
    queryKey: ["system-settings"],
    queryFn: () => fetchSettings(),
  });

  const [form, setForm] = useState({
    liveSiteUrl: "https://ryzite-website.thulirkalcom.workers.dev",
    defaultSeoTitleSuffix: " | RYZITE",
    defaultOgImage: "https://ryzite-website.thulirkalcom.workers.dev/images/ryzite-logo.webp",
    defaultRobotsDirective: "index, follow",
    ga4MeasurementTagExpected: "",
    preferredAiProvider: "auto" as "auto" | "gemini" | "openai",
    pagespeedStrategyDefault: "mobile" as "mobile" | "desktop",
    sessionMaxAgeHours: 24,
    enquiryNotificationEmail: "info@ryzite.lk",
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (query.data && !loaded) {
      setLoaded(true);
      setForm({
        liveSiteUrl: query.data.settings.liveSiteUrl,
        defaultSeoTitleSuffix: query.data.settings.defaultSeoTitleSuffix,
        defaultOgImage: query.data.settings.defaultOgImage,
        defaultRobotsDirective: query.data.settings.defaultRobotsDirective,
        ga4MeasurementTagExpected: query.data.settings.ga4MeasurementTagExpected,
        preferredAiProvider: query.data.settings.preferredAiProvider,
        pagespeedStrategyDefault: query.data.settings.pagespeedStrategyDefault,
        sessionMaxAgeHours: query.data.settings.sessionMaxAgeHours,
        enquiryNotificationEmail: query.data.settings.enquiryNotificationEmail,
      });
    }
  }, [query.data, loaded]);

  const saveMutation = useMutation({
    mutationFn: () => saveFn({ data: form }),
    onSuccess: () => {
      toast.success("System settings saved to D1.");
      void qc.invalidateQueries({ queryKey: ["system-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save settings"),
  });

  const secrets = query.data?.secretPresence ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System Management"
        title="System Settings"
        description="Configure non-secret platform defaults stored in D1. Private API keys remain exclusively in Cloudflare Workers server environment variables."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Platform Configuration" className="lg:col-span-2">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Live Website URL</Label>
                <Input
                  value={form.liveSiteUrl}
                  onChange={(e) => setForm({ ...form, liveSiteUrl: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Enquiry Notification Email</Label>
                <Input
                  type="email"
                  value={form.enquiryNotificationEmail}
                  onChange={(e) => setForm({ ...form, enquiryNotificationEmail: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Default SEO Title Suffix</Label>
                <Input
                  value={form.defaultSeoTitleSuffix}
                  onChange={(e) => setForm({ ...form, defaultSeoTitleSuffix: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Default Robots Directive</Label>
                <Input
                  value={form.defaultRobotsDirective}
                  onChange={(e) => setForm({ ...form, defaultRobotsDirective: e.target.value })}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Default Open Graph Image URL</Label>
                <Input
                  value={form.defaultOgImage}
                  onChange={(e) => setForm({ ...form, defaultOgImage: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Expected GA4 Measurement ID</Label>
                <Input
                  value={form.ga4MeasurementTagExpected}
                  onChange={(e) => setForm({ ...form, ga4MeasurementTagExpected: e.target.value })}
                  placeholder="G-XXXXXXXXXX"
                />
              </div>
              <div className="space-y-1">
                <Label>Session Lifetime (Hours)</Label>
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={form.sessionMaxAgeHours}
                  onChange={(e) =>
                    setForm({ ...form, sessionMaxAgeHours: Number(e.target.value) || 24 })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Preferred AI Provider</Label>
                <Select
                  value={form.preferredAiProvider}
                  onValueChange={(v) =>
                    setForm({ ...form, preferredAiProvider: v as "auto" | "gemini" | "openai" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (Gemini then OpenAI)</SelectItem>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Default PageSpeed Strategy</Label>
                <Select
                  value={form.pagespeedStrategyDefault}
                  onValueChange={(v) =>
                    setForm({ ...form, pagespeedStrategyDefault: v as "mobile" | "desktop" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mobile">Mobile</SelectItem>
                    <SelectItem value="desktop">Desktop</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" disabled={saveMutation.isPending}>
              <Save className="size-4" />
              {saveMutation.isPending ? "Saving…" : "Save settings"}
            </Button>
          </form>
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-2">
              <Shield className="size-4 text-electric" /> Server Secrets Checklist
            </span>
          }
          description="Read-only presence flags from the server runtime (values are never sent to the browser)."
        >
          <ul className="space-y-2 text-xs">
            {Object.entries(secrets).map(([key, ok]) => (
              <li
                key={key}
                className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2"
              >
                <span className="font-mono">{key}</span>
                {ok ? (
                  <span className="inline-flex items-center gap-1 font-medium text-success">
                    <CheckCircle2 className="size-3.5" /> Set
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <XCircle className="size-3.5" /> Unset
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
