import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/admin/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/auth.functions";

export const Route = createFileRoute("/admin/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset Password · RYZITE Control Centre" },
      {
        name: "description",
        content:
          "Request a secure, single-use password reset link for your RYZITE Control Centre account.",
      },
      { property: "og:title", content: "Reset Password · RYZITE Control Centre" },
      { property: "og:description", content: "Request a secure, single-use password reset link." },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const send = useServerFn(requestPasswordReset);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await send({ data: { email, origin: window.location.origin } });
      setSent(true);
    } catch {
      setError("Please enter a valid email address.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Forgot your password?"
      description="Enter the email address registered to your administrator account."
    >
      {sent ? (
        <div className="space-y-6">
          <div className="flex gap-3 rounded-xl border bg-card p-5 shadow-card">
            <MailCheck className="size-6 shrink-0 text-success" />
            <div className="text-sm leading-relaxed">
              <p className="font-semibold">Check your inbox</p>
              <p className="mt-1 text-muted-foreground">
                If that email belongs to an administrator account, a single-use reset link is on its
                way. The link expires after one hour.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="w-full bg-card" size="lg">
            <Link to="/admin">
              <ArrowLeft /> Back to sign in
            </Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Work email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 bg-card"
              required
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="hero"
            size="lg"
            className="w-full"
            disabled={busy || !email}
          >
            {busy && <Loader2 className="animate-spin" />} Send reset link
          </Button>
          <Link
            to="/admin"
            className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to sign in
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
