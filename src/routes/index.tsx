import { createFileRoute, redirect } from "@tanstack/react-router";

// The Control Centre lives under /admin so it can later be served at the website's /admin/ path.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
  head: () => ({
    meta: [
      { title: "RYZITE Control Centre" },
      { name: "description", content: "RYZITE Control Centre — administrator access." },
      { property: "og:title", content: "RYZITE Control Centre" },
      { property: "og:description", content: "RYZITE Control Centre — administrator access." },
    ],
  }),
});
