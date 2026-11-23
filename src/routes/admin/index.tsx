import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, LockKeyhole, ShieldAlert, User } from "lucide-react";
import { AuthShell } from "@/components/admin/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthStatus, signInWithUsername } from "@/lib/auth.functions";

type LoginSearch = { redirect?: string; error?: string };

function safeRedirect(value: string | undefined) {
  if (!value) return "/admin/dashboard";
  try {
    const u = new URL(value, "http://x");
    if (!u.pathname.startsWith("/admin/") || u.pathname === "/admin/") return "/admin/dashboard";
    return u.pathname + u.search;
  } catch {
    return "/admin/dashboard";
  }
}

export const Route = createFileRoute("/admin/")({
  validateSearch: (s: Record<string, unknown>): LoginSearch => ({
    ...(typeof s["redirect"] === "string" ? { redirect: s["redirect"] } : {}),
    ...(typeof s["error"] === "string" ? { error: s["error"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Administrator Sign In · RYZITE Control Centre" },
      { name: "description", content: "Authenticate with your RYZITE Control Centre credentials." },
      { property: "og:title", content: "Administrator Sign In · RYZITE Control Centre" },
      {
        property: "og:description",
        content: "Authenticate with your RYZITE Control Centre credentials.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authStatus = useServerFn(getAuthStatus);
  const signIn = useServerFn(signInWithUsername);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    search.error === "no_access" ? "This account doesn't have Control Centre access." : null,
  );

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let active = true;
    authStatus()
      .then((res) => {
        if (!active) return;
        if (res.signedIn) navigate({ href: safeRedirect(search.redirect), replace: true });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [authStatus, navigate, search.redirect]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await signIn({ data: { username, password } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      queryClient.clear();
      await navigate({ href: safeRedirect(search.redirect), replace: true });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
      setPassword("");
    }
  }

  return (
    <AuthShell
      title="Administrator Sign In"
      description="Authenticate with your RYZITE Control Centre credentials."
    >
      {!mounted ? (
        <div className="space-y-5" aria-busy="true">
          <div className="space-y-2">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-11 w-full rounded-md border border-input bg-card" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-3.5 w-24 rounded bg-muted" />
            </div>
            <div className="h-11 w-full rounded-md border border-input bg-card" />
          </div>
          <div className="h-11 w-full rounded-xl bg-primary/20" />
          <div className="h-11 w-full rounded-xl border border-input bg-card" />
          <p className="rounded-xl border border-dashed bg-secondary/50 p-4 text-xs leading-relaxed text-muted-foreground">
            Access is restricted to authorised RYZITE administrators. Failed login attempts are
            rate-limited and recorded in the server-side security audit log.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11 bg-card pl-9"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                to="/admin/forgot-password"
                className="text-xs font-medium text-electric hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-card px-9"
                required
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              <ShieldAlert className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}

          <Button
            type="submit"
            variant="hero"
            size="lg"
            className="w-full"
            disabled={busy || !username || !password}
          >
            {busy && <Loader2 className="animate-spin" />} Sign In to Control Centre
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> Need an account?{" "}
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button asChild variant="outline" size="lg" className="w-full bg-card">
            <Link to="/admin/request-access">Request Admin Access</Link>
          </Button>

          <p className="rounded-xl border border-dashed bg-secondary/50 p-4 text-xs leading-relaxed text-muted-foreground">
            Access is restricted to authorised RYZITE administrators. Failed login attempts are
            rate-limited and recorded in the server-side security audit log.
          </p>
        </form>
      )}
    </AuthShell>
  );
}
