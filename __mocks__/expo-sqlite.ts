/**
 * __mocks__/expo-sqlite.ts
 *
 * Mock manual de expo-sqlite.
 * Envuelve better-sqlite3 (síncrono) con la API async que usa la app.
 * La instancia de DB es inyectada por testDatabase.ts antes de cada test.
 */
import Database from 'better-sqlite3';

let _mockDb: Database.Database | null = null;

export function setMockDatabase(db: Database.Database): void {
  _mockDb = db;
}

export function clearMockDatabase(): void {
  _mockDb = null;
}

function getDb(): Database.Database {
  if (!_mockDb) {
    throw new Error('[expo-sqlite mock] No hay DB inyectada. Llamá createTestDatabase() en beforeEach.');
  }
  return _mockDb;
}

class MockSQLiteDatabase {
  async execAsync(sql: string): Promise<void> {
    getDb().exec(sql);
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<{ lastInsertRowid: number; changes: number }> {
    const stmt = getDb().prepare(sql);
    const result = stmt.run(...params);
    return { lastInsertRowid: Number(result.lastInsertRowid), changes: result.changes };
  }

  async getFirstAsync<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    const stmt = getDb().prepare(sql);
    const row = stmt.get(...params) as T | undefined;
    return row ?? null;
  }

  async getAllAsync<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const stmt = getDb().prepare(sql);
    return stmt.all(...params) as T[];
  }

  /**
   * Shim de withTransactionAsync — emula el contrato de expo-sqlite real:
   *  - BEGIN antes del callback
   *  - COMMIT si el callback resuelve
   *  - ROLLBACK + re-throw si el callback rechaza
   *
   * Usa exec() síncrono de better-sqlite3 (envuelto en async wrapper).
   * No soporta transacciones anidadas (la app real tampoco lo hace).
   */
  async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
    const db = getDb();
    db.exec('BEGIN');
    try {
      await fn();
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

const _sharedInstance = new MockSQLiteDatabase();

export async function openDatabaseAsync(_name: string): Promise<MockSQLiteDatabase> {
  return _sharedInstance;
}

export default { openDatabaseAsync };
