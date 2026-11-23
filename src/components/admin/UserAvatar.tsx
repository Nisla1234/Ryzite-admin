import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAvatarUrl } from "@/hooks/use-avatar-url";
import { cn } from "@/lib/utils";

export function initials(name: string, fallback = "R") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function UserAvatar({
  path,
  name,
  className,
}: {
  path: string | null | undefined;
  name: string;
  className?: string;
}) {
  const { data: url } = useAvatarUrl(path);
  return (
    <Avatar className={cn("size-9 ring-2 ring-background", className)}>
      {url && <AvatarImage src={url} alt={name} className="object-cover" />}
      <AvatarFallback className="bg-gradient-brand text-xs font-semibold text-primary-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
