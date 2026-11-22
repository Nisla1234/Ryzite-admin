import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { signOutAdmin } from "@/lib/auth.functions";

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const signOut = useServerFn(signOutAdmin);
  return async () => {
    await signOut().catch(() => undefined);
    await queryClient.cancelQueries();
    queryClient.clear();
    await router.invalidate();
    navigate({ to: "/admin", replace: true });
  };
}
