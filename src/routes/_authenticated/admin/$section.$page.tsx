import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { AiModule } from "@/components/admin/modules/AiModules";
import { AnalyticsModule } from "@/components/admin/modules/AnalyticsModules";
import { EnquiriesModule } from "@/components/admin/modules/EnquiriesModule";
import { MediaLibraryModule } from "@/components/admin/modules/MediaLibraryModule";
import {
  AssistantModule,
  WebsitePerformanceModule,
} from "@/components/admin/modules/OverviewModules";
import { PerformanceModule } from "@/components/admin/modules/PerformanceModules";
import { SeoModule } from "@/components/admin/modules/SeoModules";
import { DeploymentsModule, SettingsModule } from "@/components/admin/modules/SystemModules";
import {
  CmsManagerModule,
  HistoryModule,
  NavigationFooterModule,
} from "@/components/admin/modules/WebsiteCmsModules";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { findModule, resolveLegacy } from "@/lib/nav";
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

  if (section === "overview") {
    if (page === "website-performance") return <WebsitePerformanceModule />;
    if (page === "assistant") return <AssistantModule />;
  }

  if (section === "website") {
    if (
      page === "pages" ||
      page === "portfolio" ||
      page === "services" ||
      page === "team" ||
      page === "articles" ||
      page === "testimonials"
    ) {
      return <CmsManagerModule section={page} />;
    }
    if (page === "media") return <MediaLibraryModule />;
    if (page === "navigation") return <NavigationFooterModule />;
    if (page === "enquiries") return <EnquiriesModule />;
    if (page === "history") return <HistoryModule />;
  }

  if (section === "seo") {
    if (
      page === "overview" ||
      page === "pages" ||
      page === "social" ||
      page === "technical" ||
      page === "suggestions" ||
      page === "issues" ||
      page === "sitemap"
    ) {
      return <SeoModule view={page} />;
    }
  }

  if (section === "analytics") {
    if (
      page === "overview" ||
      page === "visitors" ||
      page === "acquisition" ||
      page === "social" ||
      page === "geo" ||
      page === "events"
    ) {
      return <AnalyticsModule view={page} />;
    }
  }

  if (section === "performance") {
    if (
      page === "overview" ||
      page === "web-vitals" ||
      page === "accessibility" ||
      page === "suggestions" ||
      page === "history"
    ) {
      return <PerformanceModule view={page} />;
    }
  }

  if (section === "ai") {
    if (page === "daily-report" || page === "health" || page === "tasks" || page === "content") {
      return <AiModule view={page} />;
    }
  }

  if (section === "system") {
    if (page === "deployments") return <DeploymentsModule />;
    if (page === "settings") return <SettingsModule />;
  }

  return (
    <div>
      <PageHeader
        eyebrow={found.group.label}
        title={found.item.label}
        description={found.item.summary}
      />
      <Panel>
        <Button asChild variant="subtle">
          <Link to="/admin/dashboard">Back to dashboard</Link>
        </Button>
      </Panel>
    </div>
  );
}
