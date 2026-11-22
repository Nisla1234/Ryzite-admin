import type { ReactNode } from "react";
import { CheckCircle2, CircleDashed, CircleOff, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ROBOT_URL = "/assets/aistudio/image_42ad1c12.png";

export type SignalState = "ok" | "down" | "missing" | "pending" | "checking";
export interface Signal {
  label: string;
  state: SignalState;
  detail: string;
}

const ICON: Record<SignalState, ReactNode> = {
  ok: <CheckCircle2 className="size-4 text-success" />,
  down: <XCircle className="size-4 text-destructive" />,
  missing: <CircleOff className="size-4 text-muted-foreground" />,
  pending: <CircleDashed className="size-4 text-muted-foreground" />,
  checking: <Loader2 className="size-4 animate-spin text-muted-foreground" />,
};

/**
 * Phase 2: the robot shows its "waiting for data" state. It never scores the site
 * without enough connected signals (weighted scoring and moods arrive in Phase 7).
 */
export function RobotPanel({ signals }: { signals: Signal[] }) {
  const connected = signals.filter((s) => s.state === "ok" || s.state === "down").length;
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-deep text-surface-deep-foreground shadow-elevated">
      <div className="absolute inset-0 bg-grid-faint opacity-60" aria-hidden />
      <div
        className="absolute -right-16 -top-20 size-72 rounded-full bg-ai/25 blur-3xl"
        aria-hidden
      />
      <div className="relative grid gap-6 p-6 sm:grid-cols-[auto_1fr] md:p-7">
        <div className="flex justify-center sm:items-center">
          <img
            src={ROBOT_URL}
            alt="RYZITE robot assistant, analysing"
            className="h-56 w-auto animate-float object-contain drop-shadow-[0_24px_30px_oklch(0.1_0.05_268/0.6)] md:h-64"
          />
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-eyebrow text-lime">RYZITE Robot</p>
            <Badge variant="ai" className="bg-ai/25 text-surface-deep-foreground">
              Waiting for data
            </Badge>
          </div>
          <div className="relative mt-3 rounded-2xl rounded-tl-sm bg-surface-deep-foreground/10 p-4 ring-1 ring-surface-deep-foreground/10 backdrop-blur">
            <p className="text-[0.9375rem] leading-relaxed">
              Hello! I can't judge the website's health yet — only {connected} of {signals.length}{" "}
              signals are connected. Once Google Analytics and PageSpeed are connected, I'll score
              the site every day and explain my mood.
            </p>
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
                  <span className="block truncate text-xs text-surface-deep-foreground/60">
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
