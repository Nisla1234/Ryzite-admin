import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { BrandLogo } from "./BrandLogo";

const ROBOT_URL = "/assets/aistudio/image_42ad1c12.png";

export function AuthShell({
  children,
  title,
  description,
}: {
  children: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-deep text-surface-deep-foreground lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-grid-faint opacity-70" aria-hidden />
        <div
          className="absolute -left-24 top-1/3 size-[28rem] rounded-full bg-electric/25 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -right-10 bottom-0 size-80 rounded-full bg-ai/20 blur-3xl"
          aria-hidden
        />
        <div className="relative z-10 flex flex-1 flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <BrandLogo plate className="w-36" />
            <span className="text-eyebrow text-surface-deep-foreground/70">Control Centre</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-end gap-6">
            <div className="max-w-md pb-10 animate-fade-up">
              <p className="text-eyebrow text-lime">Website intelligence</p>
              <h2 className="mt-4 font-display text-5xl leading-[1.02] xl:text-6xl">
                Manage, measure and improve the RYZITE website.
              </h2>
              <p className="mt-5 text-base leading-relaxed text-surface-deep-foreground/75">
                Content, SEO, analytics, Lighthouse performance and AI recommendations — all in one
                secure place.
              </p>
            </div>
            <img
              src={ROBOT_URL}
              alt="RYZITE AI assistant robot"
              className="h-auto w-36 animate-float object-contain drop-shadow-[0_30px_40px_oklch(0.1_0.05_268/0.6)] xl:w-44"
            />
          </div>
          <p className="flex items-center gap-2 text-xs text-surface-deep-foreground/60">
            <ShieldCheck className="size-4" /> Restricted system · Activity is recorded in the
            security audit log
          </p>
        </div>
      </aside>
      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-8 lg:hidden">
            <BrandLogo className="w-40" />
          </div>
          <h1 className="font-display text-4xl text-primary">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
