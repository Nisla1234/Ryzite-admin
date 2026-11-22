import { AsyncLocalStorage } from "node:async_hooks";

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<{ success: boolean; results?: T[]; meta?: unknown }>;
  all<T = Record<string, unknown>>(): Promise<{ success: boolean; results: T[]; meta?: unknown }>;
  raw<T = unknown[]>(): Promise<T[]>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<T[]>;
  exec(query: string): Promise<unknown>;
}

export type WorkerRuntimeEnv = Record<string, unknown> & {
  DB?: D1Database;
};

const envStorage = new AsyncLocalStorage<WorkerRuntimeEnv>();
const GLOBAL_ENV_KEY = "__RYZITE_WORKER_ENV__";

export function runWithWorkerEnv<T>(env: unknown, fn: () => T): T {
  const normalized =
    env && typeof env === "object" ? (env as WorkerRuntimeEnv) : ({} as WorkerRuntimeEnv);
  (globalThis as Record<string, unknown>)[GLOBAL_ENV_KEY] = normalized;
  return envStorage.run(normalized, fn);
}

export function getWorkerEnv(): WorkerRuntimeEnv {
  const fromStorage = envStorage.getStore();
  if (fromStorage) return fromStorage;
  const fromGlobal = (globalThis as Record<string, unknown>)[GLOBAL_ENV_KEY];
  if (fromGlobal && typeof fromGlobal === "object") return fromGlobal as WorkerRuntimeEnv;
  return {};
}

export function getD1Database(): D1Database | null {
  const env = getWorkerEnv();
  const db = env.DB;
  if (db && typeof db.prepare === "function") return db;
  return null;
}

export function getRuntimeSecret(name: string): string | undefined {
  const env = getWorkerEnv();
  const workerVal = env[name];
  if (typeof workerVal === "string" && workerVal.length > 0) return workerVal;
  if (typeof process !== "undefined") {
    const procVal = process.env[name];
    if (typeof procVal === "string" && procVal.length > 0) return procVal;
  }
  return undefined;
}
