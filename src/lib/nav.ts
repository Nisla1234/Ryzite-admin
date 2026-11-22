import {
  Accessibility, Activity, BarChart3, Bot, Brain, BriefcaseBusiness, CircleGauge, ClipboardList,
  Cloud, Code2, Compass, FileSearch, FileText, Gauge, Globe, History, Image, KeyRound,
  Layers, LayoutDashboard, Lightbulb, ListChecks, Map, Menu, MessageSquareQuote,
  MousePointerClick, Newspaper, PanelsTopLeft, Plug, ScrollText, Search, Settings, Share2,
  Sparkles, TrendingUp, UserCircle, UserPlus, Users, Zap, HeartPulse as Pulse, Eye, Mail,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "./permissions";

export const LIVE_SITE_URL = "https://ryzite-website.thulirkalcom.workers.dev/";

export type IntegrationKey = "content" | "ga4" | "pagespeed" | "ai" | "email" | "github" | "cloudflare";

export const INTEGRATION_LABELS: Record<IntegrationKey, string> = {
  content: "Website content source (GitHub)",
  ga4: "Google Analytics 4",
  pagespeed: "Google PageSpeed Insights",
  ai: "AI provider",
  email: "Email provider",
  github: "GitHub repository",
  cloudflare: "Cloudflare Workers",
};

/** Screens that are actually built. Everything else renders the honest "not built yet" module page. */
export type LiveRoute =
  | "/admin/dashboard"
  | "/admin/preview"
  | "/admin/users"
  | "/admin/access-requests"
  | "/admin/logs"
  | "/admin/integrations"
  | "/admin/profile";

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  summary: string;
  permission: Permission;
  phase: number;
  live?: LiveRoute;
  needs?: IntegrationKey[];
  /** Older menu entries folded into this screen. */
  combines?: string[];
}

export interface NavGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

type Extra = Pick<NavItem, "combines" | "needs" | "phase" | "permission">;
const mk = (defaults: Omit<Extra, "combines">) =>
  (key: string, label: string, icon: LucideIcon, summary: string, extra: Partial<Extra> = {}): NavItem => ({
    key, label, icon, summary, ...defaults, ...extra,
  });

const site = mk({ permission: "content.edit", phase: 3, needs: ["content"] });
const seo = mk({ permission: "seo.view", phase: 4, needs: ["sanity"] });
const ga = mk({ permission: "analytics.view", phase: 5, needs: ["ga4"] });
const perf = mk({ permission: "performance.view", phase: 6, needs: ["pagespeed"] });
const ai = mk({ permission: "ai.view", phase: 7, needs: ["ai", "ga4", "pagespeed"] });

export const NAV: NavGroup[] = [
  {
    key: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    items: [
      { key: "dashboard", label: "Executive Dashboard", icon: LayoutDashboard, summary: "Headline view of traffic, health, SEO, speed and admin activity.", permission: "dashboard.view", phase: 2, live: "/admin/dashboard" },
      { key: "website-performance", label: "Website Performance", icon: Pulse, summary: "Day-over-day comparison of visitors, acquisition, conversions and page speed.", permission: "dashboard.view", phase: 7, needs: ["ga4", "pagespeed"], combines: ["Daily Performance"] },
      { key: "assistant", label: "RYZITE AI Assistant", icon: Bot, summary: "The RYZITE robot's weighted health score, mood, reasons, daily reports and questions about your website.", permission: "ai.view", phase: 7, needs: ["ai", "ga4", "pagespeed"], combines: ["AI Robot Assistant", "AI Assistant"] },
    ],
  },
  {
    key: "website",
    label: "Website Management",
    icon: PanelsTopLeft,
    items: [
      site("pages", "Pages & Content", FileText, "Edit page sections, headings, images, links and calls to action in English, Tamil and Sinhala."),
      site("portfolio", "Portfolio / Projects", BriefcaseBusiness, "Approved case studies with galleries, technologies, links and SEO."),
      site("services", "Services & Solutions", Layers, "The marketing services and technology solutions: descriptions, features, benefits, FAQs and SEO.", { combines: ["Services", "Solutions"] }),
      site("team", "Team Members", Users, "Team members, roles, biographies, photos and social links."),
      site("articles", "Articles & Blog", Newspaper, "Rich-text articles with authors, categories, tags and social metadata."),
      site("testimonials", "Testimonials", MessageSquareQuote, "Verified client testimonials with company, role and display order."),
      site("media", "Media Library", Image, "Website images tracked in the live GitHub repository: search, preview, alt text and new uploads.", { permission: "media.manage", needs: ["content", "github"] }),
      site("navigation", "Navigation & Footer", Menu, "Header and footer menus, company details, contact information and social links.", { combines: ["Navigation & Menus", "Site Settings"] }),
      site("enquiries", "Enquiries & Contact Messages", Mail, "Messages sent through the website's contact and quote forms.", { needs: ["email"] }),
      { key: "preview", label: "Live Website Preview", icon: Eye, summary: "See the live website on desktop, tablet and mobile without leaving the Control Centre.", permission: "dashboard.view", phase: 2, live: "/admin/preview" },
      site("history", "Content Version History", History, "Every saved draft and published version, with who changed what and when."),
    ],
  },
  {
    key: "seo",
    label: "SEO Centre",
    icon: Search,
    items: [
      seo("overview", "SEO Overview", CircleGauge, "Site-wide SEO health with errors and warnings separated."),
      seo("pages", "Page SEO Manager", FileSearch, "Every page's title, description, canonical URL and robots settings, with a live search preview.", { combines: ["Page-by-Page SEO", "Meta Titles & Descriptions"] }),
      seo("social", "Social & Open Graph", Share2, "Social share titles, descriptions and images."),
      seo("technical", "Technical SEO & Schema", Code2, "Headings, canonical URLs, broken links, indexing problems and structured data.", { combines: ["Technical SEO", "Structured Data"] }),
      seo("suggestions", "AI SEO Recommendations", Lightbulb, "AI-suggested corrections: edit, apply to draft, publish or revert. Never published automatically.", { needs: ["content", "ai"], combines: ["SEO Suggestions", "AI SEO Recommendations"] }),
      seo("issues", "SEO Issues & Corrections", ListChecks, "Tracked issues with priority, status and decision history."),
      seo("sitemap", "Sitemap & Robots.txt", Map, "Sitemap generation and robots directives."),
    ],
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: BarChart3,
    items: [
      ga("overview", "GA4 Dashboard", BarChart3, "Users, sessions, page views, engagement and conversions, with date filters."),
      ga("visitors", "Visitors & Engagement", Users, "New, returning and active users and how long they stay."),
      ga("acquisition", "Traffic Sources & Campaigns", Compass, "Channels, source and medium, organic search, landing pages and UTM campaigns.", { combines: ["Traffic Acquisition", "Organic Search", "Landing Pages", "Campaign Performance"] }),
      ga("social", "Social & AI Referral Traffic", Sparkles, "Facebook, Instagram, LinkedIn, TikTok, YouTube, plus ChatGPT, Perplexity, Claude and Gemini referrals.", { combines: ["Social Media Traffic", "AI Referral Traffic"] }),
      ga("geo", "Geographic & Device Analytics", Globe, "Countries, cities, devices, browsers and operating systems.", { combines: ["Geographic Analytics", "Devices & Browsers"] }),
      ga("events", "Events & Conversions", MousePointerClick, "Key events and conversion trends."),
    ],
  },
  {
    key: "performance",
    label: "Performance",
    icon: Gauge,
    items: [
      perf("overview", "PageSpeed & Lighthouse", Gauge, "Latest Lighthouse scores for the live site, on mobile and desktop.", { combines: ["PageSpeed Overview", "Lighthouse Scores", "Mobile Performance", "Desktop Performance"] }),
      perf("web-vitals", "Core Web Vitals", Activity, "LCP, INP, CLS, FCP and TTFB — real-visitor and lab data kept separate."),
      perf("accessibility", "Accessibility & Best Practices", Accessibility, "Accessibility and best-practice audits with the affected elements.", { combines: ["Accessibility", "Best Practices"] }),
      perf("suggestions", "Performance Recommendations", Zap, "Lighthouse opportunities with plain-language explanations and tracked fixes.", { combines: ["Performance Suggestions", "AI Performance Recommendations"] }),
      perf("history", "Performance History", TrendingUp, "Score and Web Vitals history with comparisons."),
    ],
  },
  {
    key: "ai",
    label: "AI Intelligence",
    icon: Brain,
    items: [
      ai("daily-report", "Daily AI Reports", Newspaper, "Daily summary grounded in connected data, including what changed in traffic and why.", { combines: ["AI Daily Report", "Traffic Insights"] }),
      ai("health", "Website Health Analysis", Pulse, "Combined GA4, PageSpeed, SEO and deployment health."),
      ai("tasks", "Priority Tasks", ClipboardList, "Tracked AI tasks with status and completion history."),
      ai("content", "AI Content Suggestions", Lightbulb, "Article ideas, missing topics and internal links. Suggestions only — nothing is published automatically.", { needs: ["ai", "sanity"] }),
    ],
  },
  {
    key: "system",
    label: "System Management",
    icon: Settings,
    items: [
      { key: "users", label: "Admin Users & Roles", icon: Users, summary: "Administrators, roles and access.", permission: "users.manage", phase: 2, live: "/admin/users" },
      { key: "access-requests", label: "Access Requests", icon: UserPlus, summary: "Review, approve or reject admin access requests.", permission: "access.review", phase: 2, live: "/admin/access-requests" },
      { key: "logs", label: "Activity & Security Logs", icon: ScrollText, summary: "Administrator actions, sign-ins, failed attempts, blocks and password events.", permission: "logs.activity", phase: 2, live: "/admin/logs", combines: ["Activity Logs", "Security Logs"] },
      { key: "integrations", label: "Integrations", icon: Plug, summary: "Real connection status, tests and setup steps for every service.", permission: "integrations.manage", phase: 2, live: "/admin/integrations" },
      { key: "deployments", label: "Deployment & Website Health", icon: Cloud, summary: "Live Worker status, latest commit and deployment history.", permission: "deployments.view", phase: 8, needs: ["github", "cloudflare"] },
      { key: "settings", label: "System Settings", icon: KeyRound, summary: "SEO defaults, analytics, performance, AI, email, security and session settings.", permission: "settings.manage", phase: 8 },
      { key: "profile", label: "My Profile", icon: UserCircle, summary: "Your name, photo, password and recent activity.", permission: "profile.manage", phase: 2, live: "/admin/profile" },
    ],
  },
];

/** Old /admin/<section>/<page> addresses → the screen that now contains them. */
export const LEGACY_MODULES: Record<string, string> = {
  "overview/daily-performance": "overview/website-performance",
  "overview/robot": "overview/assistant",
  "website/solutions": "website/services",
  "website/site-settings": "website/navigation",
  "seo/meta": "seo/pages",
  "seo/schema": "seo/technical",
  "analytics/organic": "analytics/acquisition",
  "analytics/landing-pages": "analytics/acquisition",
  "analytics/campaigns": "analytics/acquisition",
  "analytics/ai-referrals": "analytics/social",
  "analytics/devices": "analytics/geo",
  "performance/lighthouse": "performance/overview",
  "performance/mobile": "performance/overview",
  "performance/desktop": "performance/overview",
  "performance/best-practices": "performance/accessibility",
  "ai/seo": "seo/suggestions",
  "ai/traffic": "ai/daily-report",
  "ai/performance": "performance/suggestions",
  "ai/assistant": "overview/assistant",
};

export function findModule(section: string, page: string) {
  const group = NAV.find((g) => g.key === section);
  const item = group?.items.find((i) => i.key === page);
  return group && item ? { group, item } : null;
}

export function resolveLegacy(section: string, page: string) {
  const target = LEGACY_MODULES[`${section}/${page}`];
  if (!target) return null;
  const [s, p] = target.split("/");
  return s && p ? { section: s, page: p } : null;
}
