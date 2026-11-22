import { cn } from "@/lib/utils";

const LOGO_URL = "/assets/aistudio/image_262d5e32.png";

export function BrandLogo({ className, plate = false }: { className?: string; plate?: boolean }) {
  const content = (
    <img
      src={LOGO_URL}
      alt="RYZITE"
      className={cn("h-auto w-full object-contain select-none", !plate && className)}
      draggable={false}
    />
  );
  if (!plate) return content;
  return (
    <div
      className={cn(
        "rounded-xl bg-sidebar-primary px-3 py-2 text-center shadow-card ring-1 ring-sidebar-border",
        className,
      )}
    >
      {content}
    </div>
  );
}
