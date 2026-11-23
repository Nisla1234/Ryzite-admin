import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowUpRight,
  Bell,
  ChevronDown,
  ChevronRight,
  Globe,
  LogOut,
  UserCircle,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getPendingAccessCount } from "@/lib/admin.functions";
import { useSignOut } from "@/hooks/use-sign-out";
import { LIVE_SITE_URL, NAV, type NavItem } from "@/lib/nav";
import { can, primaryRole, ROLE_LABELS } from "@/lib/permissions";
import type { Me } from "@/lib/session";
import { cn } from "@/lib/utils";
import { BrandLogo } from "./BrandLogo";
import { UserAvatar } from "./UserAvatar";

function itemPath(groupKey: string, item: NavItem) {
  return item.live ?? `/admin/${groupKey}/${item.key}`;
}

function NavLink({ groupKey, item, active }: { groupKey: string; item: NavItem; active: boolean }) {
  const { setOpenMobile } = useSidebar();
  const Icon = item.icon;
  const inner = (
    <>
      <Icon />
      <span className="truncate">{item.label}</span>
    </>
  );
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.label}
        className="h-9 rounded-lg text-[0.8125rem] text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-card"
        onClick={() => setOpenMobile(false)}
      >
        {item.live ? (
          <Link to={item.live}>{inner}</Link>
        ) : (
          <Link to="/admin/$section/$page" params={{ section: groupKey, page: item.key }}>
            {inner}
          </Link>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function AppSidebar({ me }: { me: Me }) {
  const { pathname } = useLocation();
  const signOut = useSignOut();
  const role = primaryRole(me.roles);
  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => can(me.roles, i.permission)),
  })).filter((g) => g.items.length);
  const isActive = (groupKey: string, item: NavItem) =>
    pathname.replace(/\/$/, "") === itemPath(groupKey, item);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-3 pb-2 pt-4">
        <Link
          to="/admin/dashboard"
          className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center"
        >
          <BrandLogo plate className="w-[7.5rem] group-data-[collapsible=icon]:hidden" />
          <span className="hidden size-8 items-center justify-center rounded-lg bg-sidebar-primary font-display text-lg text-sidebar-primary-foreground group-data-[collapsible=icon]:flex">
            R
          </span>
        </Link>
        <p className="text-eyebrow px-1 pt-2 text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
          Control Centre
        </p>
      </SidebarHeader>
      <SidebarContent className="gap-0 px-1 pb-4">
        {groups.map((group) => {
          const open = group.items.some((i) => isActive(group.key, i)) || group.key === "overview";
          return (
            <Collapsible key={group.key} defaultOpen={open} className="group/collapsible">
              <SidebarGroup className="py-1">
                <SidebarGroupLabel
                  asChild
                  className="text-eyebrow h-8 text-sidebar-foreground/55 hover:text-sidebar-foreground"
                >
                  <CollapsibleTrigger className="flex w-full items-center">
                    {group.label}
                    <ChevronDown className="ml-auto transition-transform group-data-[state=closed]/collapsible:-rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-0.5">
                      {group.items.map((item) => (
                        <NavLink
                          key={item.key}
                          groupKey={group.key}
                          item={item}
                          active={isActive(group.key, item)}
                        />
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="View live website"
              className="h-9 rounded-lg text-[0.8125rem] text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <a href={LIVE_SITE_URL} target="_blank" rel="noreferrer">
                <Globe />
                <span>View Live Website</span>
                <ArrowUpRight className="ml-auto" />
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <UserAvatar
            path={me.profile.avatar_url}
            name={me.profile.full_name || me.profile.username}
            className="ring-sidebar"
          />
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">
              {me.profile.full_name || me.profile.username}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/60">
              {role ? ROLE_LABELS[role] : ""}
            </p>
          </div>
          <button
            onClick={signOut}
            className="rounded-md p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function useCrumbs() {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/$/, "");
  for (const g of NAV)
    for (const i of g.items)
      if (itemPath(g.key, i) === path) return { group: g.label, item: i.label };
  return null;
}

function Header({ me }: { me: Me }) {
  const crumbs = useCrumbs();
  const signOut = useSignOut();
  const fetchPendingCount = useServerFn(getPendingAccessCount);
  const isSuper = can(me.roles, "access.review");
  const { data: pending } = useQuery({
    queryKey: ["pending-access-count"],
    enabled: isSuper,
    refetchInterval: 60_000,
    queryFn: async () => {
      const res = await fetchPendingCount();
      return res.count;
    },
  });

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md md:px-6">
      <SidebarTrigger className="-ml-1" />
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="hidden text-muted-foreground sm:inline">
          {crumbs?.group ?? "Control Centre"}
        </span>
        {crumbs && <ChevronRight className="hidden size-3.5 text-muted-foreground sm:inline" />}
        <span className="truncate font-semibold">{crumbs?.item ?? ""}</span>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {isSuper && (
          <Link
            to="/admin/access-requests"
            className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={`${pending ?? 0} pending access requests`}
          >
            <Bell className="size-5" />
            {!!pending && (
              <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-ai px-1 text-[0.625rem] font-bold text-ai-foreground">
                {pending}
              </span>
            )}
          </Link>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-accent">
            <UserAvatar
              path={me.profile.avatar_url}
              name={me.profile.full_name || me.profile.username}
              className="size-8"
            />
            <span className="hidden text-left leading-tight md:block">
              <span className="block text-sm font-semibold">
                {me.profile.full_name || me.profile.username}
              </span>
              <span className="block text-xs text-muted-foreground">@{me.profile.username}</span>
            </span>
            <ChevronDown className="hidden size-4 text-muted-foreground md:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-sm font-semibold">
                {me.profile.full_name || me.profile.username}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{me.user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/admin/profile">
                <UserCircle /> My profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function AdminShell({ me, children }: { me: Me; children: ReactNode }) {
  return (
    <SidebarProvider style={{ "--sidebar-width": "17rem" } as CSSProperties}>
      <AppSidebar me={me} />
      <SidebarInset className={cn("min-w-0 overflow-x-hidden bg-background")}>
        <Header me={me} />
        <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
