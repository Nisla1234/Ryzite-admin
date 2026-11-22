import type { Role } from "./permissions";

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface AdminProfile {
  id: string;
  username: string;
  full_name: string;
  email: string;
  job_title: string;
  avatar_url: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccessRequestRow {
  id: string;
  full_name: string;
  email: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  assigned_role: Role | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  requester_ip: string | null;
  created_at: string;
}

export type JsonValue =
  string | number | boolean | null | { [key: string]: JsonValue | undefined } | JsonValue[];

export interface AuditLogRow {
  id: string;
  category: "activity" | "security";
  action: string;
  result: "success" | "failure" | "blocked";
  actor_id: string | null;
  actor_label: string | null;
  subject: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, JsonValue | undefined>;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Me {
  user: AdminUser;
  profile: AdminProfile;
  roles: Role[];
}
