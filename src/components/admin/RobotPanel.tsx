import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, CircleDashed, CircleOff, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ROBOT_URL = "/assets/aistudio/image_42ad1c12.png";

export type SignalState = "ok" | "down" | "missing" | "pending" | "checking";
export interface Signal {
  label: string;
  state: SignalState;
  detail: string;
  weight?: number;
}

const ICON: Record<SignalState, ReactNode> = {
  ok: <CheckCircle2 className="size-4 text-success" />,
  down: <XCircle className="size-4 text-destructive" />,
  missing: <CircleOff className="size-4 text-muted-foreground" />,
  pending: <CircleDashed className="size-4 text-warning" />,
  checking: <Loader2 className="size-4 animate-spin text-muted-foreground" />,
};

export function RobotPanel({
  signals,
  healthScore,
  moodLabel,
  narrative,
  showAssistantLink = true,
}: {
  signals: Signal[];
  healthScore?: number | null;
  moodLabel?: string;
  narrative?: string;
  showAssistantLink?: boolean;
}) {
  const connected = signals.filter((s) => s.state === "ok" || s.state === "down").length;
  const computedReady = typeof healthScore === "number";

  const badgeText =
    moodLabel ??
    (computedReady
      ? healthScore >= 85
        ? "Healthy"
        : healthScore >= 60
          ? "Needs attention"
          : "Action needed"
      : "Partial telemetry");

  const speech =
    narrative ??
    (computedReady
      ? `Overall connected telemetry score is ${healthScore}/100 across ${connected} of ${signals.length} active platform signals. Unconnected services are excluded rather than estimated.`
      : `Connected to ${connected} of ${signals.length} live signals. Run an SEO crawl, PageSpeed test, or connect GA4 to unlock full weighted scoring.`);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-deep text-surface-deep-foreground shadow-elevated">
      <div className="absolute inset-0 bg-grid-faint opacity-60" aria-hidden />
      <div
        className="absolute -right-16 -top-20 size-72 rounded-full bg-ai/25 blur-3xl"
        aria-hidden
      />
      <div className="relative grid gap-6 p-6 sm:grid-cols-[auto_1fr] md:p-7">
        <div className="flex flex-col items-center justify-center gap-3">
          <img
            src={ROBOT_URL}
            alt="RYZITE robot assistant"
            className="h-52 w-auto animate-float object-contain drop-shadow-[0_24px_30px_oklch(0.1_0.05_268/0.6)] md:h-60"
          />
          {computedReady && (
            <div className="rounded-xl bg-surface-deep-foreground/10 px-4 py-2 text-center ring-1 ring-surface-deep-foreground/15">
              <p className="text-[0.6875rem] uppercase tracking-wider text-surface-deep-foreground/70">
                Weighted Score
              </p>
              <p className="font-display text-2xl text-lime">{healthScore}/100</p>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-eyebrow text-lime">RYZITE AI Assistant</p>
            <Badge variant="ai" className="bg-ai/25 text-surface-deep-foreground">
              {badgeText}
            </Badge>
            {showAssistantLink && (
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="ml-auto h-7 text-xs text-surface-deep-foreground/85 hover:bg-surface-deep-foreground/10 hover:text-surface-deep-foreground"
              >
                <Link
                  to="/admin/$section/$page"
                  params={{ section: "overview", page: "assistant" }}
                >
                  Open assistant <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            )}
          </div>
          <div className="relative mt-3 rounded-2xl rounded-tl-sm bg-surface-deep-foreground/10 p-4 ring-1 ring-surface-deep-foreground/10 backdrop-blur">
            <p className="text-[0.9375rem] leading-relaxed">{speech}</p>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {signals.map((s) => (
              <li
                key={s.label}
                className="flex items-start gap-2.5 rounded-xl bg-surface-deep-foreground/5 px-3 py-2.5"
              >
                <span className="mt-0.5">{ICON[s.state]}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{s.label}</span>
                  <span className="block truncate text-xs text-surface-deep-foreground/65">
                    {s.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
