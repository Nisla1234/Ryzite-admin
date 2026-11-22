import { createFileRoute, redirect } from "@tanstack/react-router";

// Kept so old bookmarks still work: the activity log now lives in the combined logs screen.
export const Route = createFileRoute("/_authenticated/admin/activity")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/logs", search: { tab: "activity" }, replace: true });
  },
});
