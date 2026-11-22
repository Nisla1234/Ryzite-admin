import type { IntegrationKey } from "./nav";

export type IntegrationState = "connected" | "configuration_required" | "disconnected" | "planned";

export const STATE_LABELS: Record<IntegrationState, string> = {
  connected: "Connected",
  configuration_required: "Configuration required",
  disconnected: "Disconnected",
  planned: "Planned",
};

export const STATE_BADGE: Record<IntegrationState, "success" | "warning" | "danger" | "muted"> = {
  connected: "success",
  configuration_required: "warning",
  disconnected: "danger",
  planned: "muted",
};

export interface Capability {
  label: string;
  ok: boolean;
  detail?: string;
}

export interface IntegrationCheck {
  key: IntegrationKey;
  state: IntegrationState;
  summary: string;
  capabilities: Capability[];
  /** Names of server secrets still needed. Never their values. */
  missing: string[];
  error?: string;
  setup: string[];
  checkedAt: string;
}

export const INTEGRATION_ORDER: IntegrationKey[] = ["github", "sanity", "ga4", "pagespeed", "cloudflare", "ai", "email"];
