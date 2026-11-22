import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getIntegrationStatus } from "@/lib/integrations.functions";

/** Real, server-checked status of every connected service. Cached for 5 minutes across screens. */
export function useIntegrationStatus() {
  const fn = useServerFn(getIntegrationStatus);
  return useQuery({ queryKey: ["integration-status"], queryFn: () => fn(), staleTime: 5 * 60_000 });
}
