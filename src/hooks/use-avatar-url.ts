import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAvatarUrl } from "@/lib/auth.functions";

/** Avatars are stored securely in D1/server storage and resolved on demand. */
export function useAvatarUrl(path: string | null | undefined) {
  const fetchAvatar = useServerFn(getAvatarUrl);
  return useQuery({
    queryKey: ["avatar-url", path],
    enabled: !!path,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const res = await fetchAvatar({ data: { path: path! } });
      return res.url;
    },
  });
}
