import { formatDistanceToNowStrict, format } from "date-fns";

export const fmtRelative = (iso: string | null | undefined) =>
  iso ? `${formatDistanceToNowStrict(new Date(iso))} ago` : "Never";
export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? format(new Date(iso), "d MMM yyyy, HH:mm") : "—";

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.logout": "Signed out",
  "auth.login_failed": "Failed sign-in attempt",
  "auth.login_blocked": "Sign-in blocked (rate limit)",
  "auth.reset_requested": "Password reset requested",
  "auth.reset_throttled": "Password reset throttled",
  "auth.password_changed": "Password changed",
  "auth.bootstrap_super_admin": "Initial Super Admin provisioned",
  "access.requested": "Access requested",
  "access.approved": "Access request approved",
  "access.rejected": "Access request rejected",
  "access.approve": "Access approval attempt",
  "user.role_changed": "Role changed",
  "user.access_revoked": "Access revoked",
  "user.access_restored": "Access restored",
  "profile.updated": "Profile updated",
  "profile.avatar_updated": "Profile photo updated",
  "integration.test": "Integration tested",
  "cms.saved": "Content draft saved",
  "cms.published": "Content published",
  "cms.restored": "Content version restored",
  "cms.deleted": "Content item deleted",
  "media.uploaded": "Media asset uploaded",
  "media.updated": "Media metadata updated",
  "media.deleted": "Media asset deleted",
  "enquiry.received": "Website enquiry received",
  "enquiry.updated": "Enquiry updated",
  "seo.crawled": "Live SEO audit run",
  "seo.issue_updated": "SEO issue status changed",
  "performance.tested": "PageSpeed test run",
  "ai.report_generated": "AI diagnostic report generated",
  "ai.task_updated": "Priority task updated",
  "settings.updated": "System settings updated",
};
export const actionLabel = (a: string) => ACTION_LABELS[a] ?? a;
