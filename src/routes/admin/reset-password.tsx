import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/admin/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completePasswordReset, verifyPasswordResetSession } from "@/lib/auth.functions";
import { passwordProblems } from "@/lib/password";

export const Route = createFileRoute("/admin/reset-password")({
  validateSearch: (s: Record<string, unknown>): { token?: string } => ({
    ...(typeof s["token"] === "string" ? { token: s["token"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Set New Password · RYZITE Control Centre" },
      {
        name: "description",
        content: "Choose a new password for your RYZITE Control Centre account.",
      },
      { property: "og:title", content: "Set New Password · RYZITE Control Centre" },
      {
        property: "og:description",
        content: "Choose a new password for your RYZITE Control Centre account.",
      },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const verify = useServerFn(verifyPasswordResetSession);
  const complete = useServerFn(completePasswordReset);
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    verify({ data: { ...(token ? { token } : {}) } })
      .then((res) => {
        if (active) setReady(res.valid ? "ok" : "invalid");
      })
      .catch(() => {
        if (active) setReady("invalid");
      });
    return () => {
      active = false;
    };
  }, [token, verify]);

  const problems = passwordProblems(password);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (problems.length) return setError(problems[0] ?? null);
    if (password !== confirm) return setError("The passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      const res = await complete({ data: { ...(token ? { token } : {}), password } });
      if (!res.ok) {
        setBusy(false);
        setError(res.error);
        return;
      }
      navigate({ to: "/admin/dashboard", replace: true });
    } catch {
      setBusy(false);
      setError("The password couldn't be updated. The link may have expired.");
    }
  }

  return (
    <AuthShell
      title="Set a new password"
      description="Use at least 12 characters, mixing letters, numbers and symbols."
    >
      {ready === "checking" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Verifying your link…
        </p>
      )}
      {ready === "invalid" && (
        <div className="space-y-4">
          <p className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            This reset link is invalid or has expired. Reset links are single-use.
          </p>
          <Button asChild variant="hero" size="lg" className="w-full">
            <Link to="/admin/forgot-password">Request a new link</Link>
          </Button>
        </div>
      )}
      {ready === "ok" && (
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="new">New password</Label>
            <Input
              id="new"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-card"
            />
            <ul className="space-y-1 pt-1 text-xs text-muted-foreground">
              {[
                "At least 12 characters",
                "Upper and lower case letters",
                "At least one number",
                "At least one symbol",
              ].map((rule, i) => {
                const met = password.length > 0 && !problems.includes(PROBLEM_KEYS[i] ?? "");
                return (
                  <li key={rule} className={met ? "text-success" : undefined}>
                    {met ? "✓" : "•"} {rule}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-11 bg-card"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Save password and
            continue
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

const PROBLEM_KEYS = [
  "Use at least 12 characters.",
  "Mix upper and lower case letters.",
  "Add at least one number.",
  "Add at least one symbol.",
];
