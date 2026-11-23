import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/admin/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitAccessRequest } from "@/lib/auth.functions";

export const Route = createFileRoute("/admin/request-access")({
  head: () => ({
    meta: [
      { title: "Request Admin Access · RYZITE Control Centre" },
      {
        name: "description",
        content: "Submit your details for review by an authorised RYZITE super administrator.",
      },
      { property: "og:title", content: "Request Admin Access · RYZITE Control Centre" },
      {
        property: "og:description",
        content: "Submit your details for review by an authorised RYZITE super administrator.",
      },
    ],
  }),
  component: RequestAccess,
});

function RequestAccess() {
  const submit = useServerFn(submitAccessRequest);
  const [form, setForm] = useState({ fullName: "", email: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    form.fullName.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(form.email) &&
    form.reason.trim().length >= 10;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await submit({ data: form });
      if (res.ok) setDone(true);
      else setError(res.error);
    } catch {
      setError("Please check your details. The reason needs at least 10 characters.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Request Admin Access"
      description="Submit your details for review by an authorised RYZITE super administrator."
    >
      {done ? (
        <div className="space-y-6">
          <div className="flex gap-3 rounded-xl border bg-card p-5 shadow-card">
            <CheckCircle2 className="size-6 shrink-0 text-success" />
            <div className="text-sm leading-relaxed">
              <p className="font-semibold">Request received</p>
              <p className="mt-1 text-muted-foreground">
                A RYZITE super administrator will review your request. If it's approved, you'll
                receive an email invitation to set your password. Submitting a request does not
                grant access by itself.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="lg" className="w-full bg-card">
            <Link to="/admin">
              <ArrowLeft /> Back to sign in
            </Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              autoComplete="name"
              value={form.fullName}
              maxLength={120}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="h-11 bg-card"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Work Email Address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              maxLength={254}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="h-11 bg-card"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Access</Label>
            <Textarea
              id="reason"
              rows={4}
              value={form.reason}
              maxLength={1500}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="bg-card"
              placeholder="Your role and what you need to manage."
            />
            <p className="text-right text-xs text-muted-foreground">{form.reason.length}/1500</p>
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
            disabled={busy || !valid}
          >
            {busy && <Loader2 className="animate-spin" />} Submit Access Request
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
