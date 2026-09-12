import { mkdirSync } from "node:fs";
import path from "node:path";
import { app } from "electron";
import Database from "better-sqlite3";

export interface DatabaseOptions {
  path?: string;
  inMemory?: boolean;
  verbose?: (message?: unknown, ...additionalArgs: unknown[]) => void;
  readonly?: boolean;
  fileMustExist?: boolean;
  timeout?: number;
}

let dbInstance: Database.Database | null = null;
let customDbPath: string | null = null;

/**
 * Configure an explicit path for the database file, or null to revert to default.
 * Closes any currently open database instance to ensure path switch is clean.
 */
export function setDatabasePath(dbPath: string | null): void {
  if (dbInstance?.open) {
    closeDatabase();
  }
  customDbPath = dbPath;
}

/**
 * Resolves the target database path.
 * Priority: custom configured path -> app.getPath("userData")/milo.db -> ":memory:" fallback.
 */
export function resolveDatabasePath(): string {
  if (customDbPath) {
    return customDbPath;
  }
  try {
    if (typeof app !== "undefined" && app !== null && typeof app.getPath === "function") {
      return path.join(app.getPath("userData"), "milo.db");
    }
  } catch {
    // Fallback when electron app is unavailable or in non-electron test context
  }
  return ":memory:";
}

/**
 * Returns the singleton SQLite database instance, lazily initializing if not already open.
 */
export function getDatabase(options?: DatabaseOptions): Database.Database {
  if (dbInstance?.open) {
    return dbInstance;
  }

  const targetPath = options?.inMemory
    ? ":memory:"
    : (options?.path ?? resolveDatabasePath());

  if (targetPath !== ":memory:") {
    mkdirSync(path.dirname(targetPath), { recursive: true });
  }

  const sqliteOptions: Database.Options = {};
  if (options?.verbose !== undefined) sqliteOptions.verbose = options.verbose;
  if (options?.readonly !== undefined) sqliteOptions.readonly = options.readonly;
  if (options?.fileMustExist !== undefined) sqliteOptions.fileMustExist = options.fileMustExist;
  if (options?.timeout !== undefined) sqliteOptions.timeout = options.timeout;

  const db = new Database(targetPath, sqliteOptions);

  // Enable WAL mode for high concurrency and performance when writing to disk (guard against readonly handles)
  if (!db.readonly && targetPath !== ":memory:") {
    db.pragma("journal_mode = WAL");
  }

  // Configure busy timeout (default 5000ms) to avoid immediate lock errors under concurrency
  const busyTimeout = options?.timeout ?? 5000;
  db.pragma(`busy_timeout = ${busyTimeout}`);

  // Enforce foreign key constraints
  db.pragma("foreign_keys = ON");

  dbInstance = db;
  return dbInstance;
}

/**
 * Closes the database singleton and resets internal reference.
 */
export function closeDatabase(): void {
  if (dbInstance) {
    try {
      if (dbInstance.open) {
        dbInstance.close();
      }
    } finally {
      dbInstance = null;
    }
  }
}

/**
 * Returns true if the database singleton is currently open.
 */
export function isDatabaseOpen(): boolean {
  return Boolean(dbInstance?.open);
}
