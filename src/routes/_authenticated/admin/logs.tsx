import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { LogTable } from "@/components/admin/LogTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can } from "@/lib/permissions";
import { useMe } from "@/hooks/use-me";

type Tab = "activity" | "security";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } =>
    search["tab"] === "security" || search["tab"] === "activity" ? { tab: search["tab"] } : {},
  beforeLoad: ({ context }) => {
    if (!can(context.me.roles, "logs.activity") && !can(context.me.roles, "logs.security")) throw redirect({ to: "/admin/dashboard" });
  },
  head: () => ({ meta: [{ title: "Activity & Security Logs · RYZITE Control Centre" }, { name: "description", content: "Administrator actions, sign-ins, failed attempts, blocks and access decisions." }] }),
  component: LogsPage,
});

function LogsPage() {
  const me = useMe();
  const navigate = useNavigate({ from: "/admin/logs" });
  const { tab } = Route.useSearch();
  const canActivity = can(me.roles, "logs.activity");
  const canSecurity = can(me.roles, "logs.security");
  const current: Tab = tab === "security" && canSecurity ? "security" : canActivity ? "activity" : "security";

  return (
    <div>
      <PageHeader
        eyebrow="System Management"
        title="Activity & Security Logs"
        description={current === "activity"
          ? "Content, SEO, media, profile, integration and settings changes made by administrators. Passwords and tokens are never logged."
          : "Sign-ins, failed attempts, rate-limit blocks, password events, access decisions and role changes. Accounts lock for 15 minutes after 5 failed attempts."}
      />
      {canActivity && canSecurity && (
        <Tabs value={current} onValueChange={(v) => navigate({ search: { tab: v as Tab } })} className="mb-5">
          <TabsList>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      <LogTable key={current} category={current} />
    </div>
  );
}
