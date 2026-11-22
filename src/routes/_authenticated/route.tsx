import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { BrandLogo } from "@/components/admin/BrandLogo";
import { getCurrentSession } from "@/lib/auth.functions";
import type { Me } from "@/lib/session";
import { useMe } from "@/hooks/use-me";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }): Promise<{ me: Me }> => {
    const { me } = await getCurrentSession();
    if (!me) {
      throw redirect({ to: "/admin", search: { redirect: location.href } });
    }
    return { me };
  },
  pendingComponent: ShellLoading,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const me = useMe();
  return (
    <AdminShell me={me}>
      <Outlet />
    </AdminShell>
  );
}

function ShellLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-deep">
      <div className="flex flex-col items-center gap-5 text-surface-deep-foreground">
        <BrandLogo plate className="w-40" />
        <div className="size-12 animate-spin rounded-full border-2 border-surface-deep-foreground/20 border-t-lime" />
        <p className="text-eyebrow text-surface-deep-foreground/70">Loading Control Centre</p>
      </div>
    </div>
  );
}
