import { getRouteApi } from "@tanstack/react-router";
import type { Me } from "@/lib/session";

const api = getRouteApi("/_authenticated");

/** The signed-in administrator, resolved by the protected layout. */
export function useMe(): Me {
  return api.useRouteContext().me;
}
