import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { CalendarClock, Plug } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { findModule, INTEGRATION_LABELS, resolveLegacy } from "@/lib/nav";
import { can } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin/$section/$page")({
  beforeLoad: ({ params, context }) => {
    const legacy = resolveLegacy(params.section, params.page);
    if (legacy) throw redirect({ to: "/admin/$section/$page", params: legacy, replace: true });
    const found = findModule(params.section, params.page);
    if (!found || !can(context.me.roles, found.item.permission)) throw notFound();
  },
  head: () => ({ meta: [{ title: "RYZITE Control Centre" }] }),
  component: ModulePage,
});

function ModulePage() {
  const { section, page } = Route.useParams();
  const found = findModule(section, page);
  if (!found) return null;
  const { group, item } = found;
  const Icon = item.icon;
  return (
    <div>
      <PageHeader eyebrow={group.label} title={item.label} description={item.summary} />
      <Panel>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-electric"><Icon className="size-7" /></div>
          <div className="space-y-4">
            <p className="flex items-center gap-2 font-semibold"><CalendarClock className="size-4 text-electric" /> Scheduled for Phase {item.phase}</p>
            <p className="max-w-2xl text-sm text-muted-foreground">
              This page isn't built yet. It will only show real data from connected services. No sample numbers are shown here.
            </p>
            {item.needs && item.needs.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Plug className="size-4 text-muted-foreground" />
                {item.needs.map((n) => <Badge key={n} variant="muted">{INTEGRATION_LABELS[n]} · not connected</Badge>)}
              </div>
            )}
            <Button asChild variant="subtle"><Link to="/admin/dashboard">Back to dashboard</Link></Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
