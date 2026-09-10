import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  closeDatabase,
  getDatabase,
  isDatabaseOpen,
  resolveDatabasePath,
  setDatabasePath,
} from "../src/main/db";

describe("SQLite Database Singleton (apps/desktop/src/main/db)", () => {
  afterEach(() => {
    closeDatabase();
    setDatabasePath(null);
  });

  // --- Basic Connection & Singleton Lifecycle ---

  it("instantiates an in-memory database and executes SELECT 1 without error", () => {
    const db = getDatabase({ inMemory: true });
    expect(db.open).toBe(true);
    expect(isDatabaseOpen()).toBe(true);

    const row = db.prepare("SELECT 1 AS alive").get() as { alive: number };
    expect(row).toBeDefined();
    expect(row.alive).toBe(1);
  });

  it("maintains a singleton instance across multiple getDatabase() calls", () => {
    const db1 = getDatabase({ inMemory: true });
    const db2 = getDatabase();
    expect(db1).toBe(db2);
  });

  it("closes the database connection and resets singleton state", () => {
    const db = getDatabase({ inMemory: true });
    expect(isDatabaseOpen()).toBe(true);

    closeDatabase();
    expect(isDatabaseOpen()).toBe(false);
    expect(db.open).toBe(false);

    // Calling getDatabase again creates a new open instance
    const dbNew = getDatabase({ inMemory: true });
    expect(isDatabaseOpen()).toBe(true);
    expect(dbNew.open).toBe(true);
    expect(dbNew).not.toBe(db);
  });

  it("executes DDL and DML statements with foreign keys enabled", () => {
    const db = getDatabase({ inMemory: true });

    db.exec(`
      CREATE TABLE test_parent (id INTEGER PRIMARY KEY, name TEXT);
      CREATE TABLE test_child (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES test_parent(id));
    `);

    db.prepare("INSERT INTO test_parent (id, name) VALUES (?, ?)").run(1, "Alpha");
    db.prepare("INSERT INTO test_child (id, parent_id) VALUES (?, ?)").run(10, 1);

    const child = db.prepare("SELECT * FROM test_child WHERE id = ?").get(10) as { id: number; parent_id: number };
    expect(child.parent_id).toBe(1);

    // Verify foreign key violation is rejected
    expect(() => {
      db.prepare("INSERT INTO test_child (id, parent_id) VALUES (?, ?)").run(20, 999);
    }).toThrow();
  });

  // --- Options Object Sanitization ---

  it("handles undefined options without throwing TypeError (sanitization check)", () => {
    // Better-sqlite3 throws TypeError if { readonly: undefined } is passed.
    // getDatabase must sanitize options so undefined fields are not passed.
    const db = getDatabase({
      readonly: undefined,
      fileMustExist: undefined,
      verbose: undefined,
      timeout: undefined,
    });
    expect(db.open).toBe(true);
    expect(isDatabaseOpen()).toBe(true);
  });

  // --- Pragmas Verification (WAL mode & busy_timeout) ---

  it("configures WAL mode on disk databases and sets busy_timeout to 5000ms by default", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "milo-db-pragma-"));
    const diskDbPath = path.join(tempDir, "pragma-test.db");

    try {
      const db = getDatabase({ path: diskDbPath });
      expect(db.open).toBe(true);

      const journalMode = db.pragma("journal_mode", { simple: true });
      expect(journalMode).toBe("wal");

      const fk = db.pragma("foreign_keys", { simple: true });
      expect(fk).toBe(1);

      const timeout = db.pragma("busy_timeout", { simple: true });
      expect(timeout).toBe(5000);
    } finally {
      closeDatabase();
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 15000);

  it("supports custom timeout option and reflects in busy_timeout pragma", () => {
    const db = getDatabase({ inMemory: true, timeout: 8000 });
    const timeout = db.pragma("busy_timeout", { simple: true });
    expect(timeout).toBe(8000);
  });

  // --- Readonly Database Mode & WAL Guard ---

  it("supports opening a disk database in readonly mode without WAL write crash", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "milo-db-ro-"));
    const diskDbPath = path.join(tempDir, "ro-test.db");

    try {
      // 1. Initialize and populate disk DB
      const initDb = getDatabase({ path: diskDbPath });
      initDb.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, title TEXT);");
      initDb.prepare("INSERT INTO items VALUES (?, ?)").run(1, "Widget");
      closeDatabase();

      // 2. Open readonly: must not crash on journal_mode = WAL
      const roDb = getDatabase({ path: diskDbPath, readonly: true });
      expect(roDb.open).toBe(true);
      expect(roDb.readonly).toBe(true);

      // Verify read queries succeed
      const row = roDb.prepare("SELECT title FROM items WHERE id = ?").get(1) as { title: string };
      expect(row.title).toBe("Widget");

      // Verify write attempts are rejected by SQLite
      expect(() => {
        roDb.prepare("INSERT INTO items VALUES (?, ?)").run(2, "Gadget");
      }).toThrow();
    } finally {
      closeDatabase();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // --- Disk Custom Path & Windows File Release ---

  it("supports configuring a custom file path on disk and re-opening", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "milo-db-test-"));
    const diskDbPath = path.join(tempDir, "custom-milo.db");

    try {
      setDatabasePath(diskDbPath);
      expect(resolveDatabasePath()).toBe(diskDbPath);

      const db = getDatabase();
      expect(isDatabaseOpen()).toBe(true);

      db.exec("CREATE TABLE test_disk (val TEXT);");
      db.prepare("INSERT INTO test_disk VALUES (?)").run("persisted");

      closeDatabase();
      expect(isDatabaseOpen()).toBe(false);

      // Re-open from same disk path
      const dbReopened = getDatabase();
      const row = dbReopened.prepare("SELECT val FROM test_disk").get() as { val: string };
      expect(row.val).toBe("persisted");
    } finally {
      closeDatabase();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("cleanly releases Windows file locks upon closeDatabase", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "milo-db-lock-"));
    const diskDbPath = path.join(tempDir, "lock-test.db");

    try {
      const db = getDatabase({ path: diskDbPath });
      db.exec("CREATE TABLE lock_check (id INT); INSERT INTO lock_check VALUES (1);");
      expect(existsSync(diskDbPath)).toBe(true);

      closeDatabase();
      expect(isDatabaseOpen()).toBe(false);

      // On Windows, deleting an open file descriptor throws EBUSY / EPERM.
      // Unlink verification guarantees all file handles and WAL/SHM locks are released.
      unlinkSync(diskDbPath);
      if (existsSync(`${diskDbPath}-wal`)) unlinkSync(`${diskDbPath}-wal`);
      if (existsSync(`${diskDbPath}-shm`)) unlinkSync(`${diskDbPath}-shm`);
      expect(existsSync(diskDbPath)).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
