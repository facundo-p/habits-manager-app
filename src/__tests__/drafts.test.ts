/**
 * drafts.test.ts — Cobertura de Plan 05 / Wave 4.
 *
 * Tests 1-5: draftsRepository CRUD + purge + boot integration.
 * Tests 6-9: createDraftAutosaveScheduler con fake timers.
 *
 * Convención: createTestDatabase ya incluye la tabla `drafts` (Plan 04 ajustó
 * la fixture a v2 baseline), así que los tests del repo no necesitan setup
 * extra. Boot integration mockea `purgeOlderThan` via jest.spyOn.
 */

// Mocks para evitar imports ESM no transformados de backupService
jest.doMock('expo-sharing', () => ({ shareAsync: jest.fn() }), { virtual: true });
jest.doMock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }), { virtual: true });

import type Database from 'better-sqlite3';
import {
  createTestDatabase,
  resetTestDatabase,
} from './setup/testDatabase';
import * as draftsRepo from '../repositories/draftsRepository';
import { createDraftAutosaveScheduler } from '../hooks/useDraftAutosave';

let db: Database.Database;

beforeEach(() => {
  db = createTestDatabase();
});

afterEach(() => {
  resetTestDatabase();
  jest.restoreAllMocks();
});

// ─── Repo CRUD + purge ──────────────────────────────────────────────

describe('draftsRepository', () => {
  test('upsert + find round-trip preserves payload_json', async () => {
    await draftsRepo.upsert('morning', '2026-05-12', '{"mood":7}');
    const row = await draftsRepo.find('morning', '2026-05-12');
    expect(row).not.toBeNull();
    expect(row!.payload_json).toBe('{"mood":7}');
    expect(row!.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('UNIQUE(kind, key) — second upsert overwrites, no duplicate row', async () => {
    await draftsRepo.upsert('morning', '2026-05-12', '{"mood":5}');
    await draftsRepo.upsert('morning', '2026-05-12', '{"mood":8,"note":"updated"}');

    const count = (db.prepare("SELECT COUNT(*) as c FROM drafts WHERE kind='morning' AND key='2026-05-12'").get() as { c: number }).c;
    expect(count).toBe(1);

    const row = await draftsRepo.find('morning', '2026-05-12');
    expect(row!.payload_json).toBe('{"mood":8,"note":"updated"}');
  });

  test('deleteOne removes the row', async () => {
    await draftsRepo.upsert('note', 'n1', '{"text":"borrador"}');
    await draftsRepo.deleteOne('note', 'n1');
    const row = await draftsRepo.find('note', 'n1');
    expect(row).toBeNull();
  });

  test('purgeOlderThan removes rows with updated_at < cutoff', async () => {
    const NOW = Date.parse('2026-05-12T10:00:00Z');
    const eightDaysAgo = new Date(NOW - 8 * 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString();

    // Insertar drafts con updated_at controlado (bypass de Date.now en el repo).
    db.prepare(
      "INSERT INTO drafts (id, kind, key, payload_json, updated_at) VALUES ('a','note','old','{}',?)",
    ).run(eightDaysAgo);
    db.prepare(
      "INSERT INTO drafts (id, kind, key, payload_json, updated_at) VALUES ('b','note','recent','{}',?)",
    ).run(twoDaysAgo);

    const cutoff = new Date(NOW - 7 * 24 * 60 * 60 * 1000).toISOString();
    await draftsRepo.purgeOlderThan(cutoff);

    const remaining = db.prepare('SELECT key FROM drafts ORDER BY key').all() as Array<{ key: string }>;
    expect(remaining.map((r) => r.key)).toEqual(['recent']);
  });

  test('boot integration: initDatabase invokes purgeOlderThan with 7d cutoff', async () => {
    const purgeSpy = jest.spyOn(draftsRepo, 'purgeOlderThan').mockResolvedValue();
    const fixedNow = Date.parse('2026-05-12T10:00:00Z');
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    const { initDatabase } = require('../services/db');
    await initDatabase();

    expect(purgeSpy).toHaveBeenCalledTimes(1);
    const calledWith = purgeSpy.mock.calls[0][0];
    const expected = new Date(fixedNow - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(calledWith).toBe(expected);
  });
});

// ─── Hook scheduler con fake timers ─────────────────────────────────

describe('createDraftAutosaveScheduler — debounce semantics', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  test('debounce 500ms: 3 schedules en ventana → 1 upsert con el último payload', () => {
    const upsertFn = jest.fn().mockResolvedValue(undefined);
    const sch = createDraftAutosaveScheduler('morning', '2026-05-12', upsertFn);

    sch.schedule('p1');
    jest.advanceTimersByTime(200);
    sch.schedule('p2');
    jest.advanceTimersByTime(200);
    sch.schedule('p3');
    // 400ms pasaron desde p3. Aún no debería ejecutar.
    jest.advanceTimersByTime(400);
    expect(upsertFn).not.toHaveBeenCalled();
    // 100ms más → llegamos a 500ms desde el último schedule.
    jest.advanceTimersByTime(100);
    expect(upsertFn).toHaveBeenCalledTimes(1);
    expect(upsertFn).toHaveBeenCalledWith('morning', '2026-05-12', 'p3');
  });

  test('skip si payloadJson no cambió', () => {
    const upsertFn = jest.fn().mockResolvedValue(undefined);
    const sch = createDraftAutosaveScheduler('note', 'k1', upsertFn);

    sch.schedule('p1');
    jest.advanceTimersByTime(500);
    expect(upsertFn).toHaveBeenCalledTimes(1);

    // Re-schedule mismo payload → no nuevo upsert
    sch.schedule('p1');
    jest.advanceTimersByTime(500);
    expect(upsertFn).toHaveBeenCalledTimes(1);
  });

  test('cancel() cancela el timer pendiente — no upsert', () => {
    const upsertFn = jest.fn().mockResolvedValue(undefined);
    const sch = createDraftAutosaveScheduler('note', 'k1', upsertFn);

    sch.schedule('p1');
    jest.advanceTimersByTime(200);
    sch.cancel();
    jest.advanceTimersByTime(500);
    expect(upsertFn).not.toHaveBeenCalled();
  });

  test('custom debounceMs', () => {
    const upsertFn = jest.fn().mockResolvedValue(undefined);
    const sch = createDraftAutosaveScheduler('note', 'k1', upsertFn, 1000);

    sch.schedule('p1');
    jest.advanceTimersByTime(500);
    expect(upsertFn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(500);
    expect(upsertFn).toHaveBeenCalledTimes(1);
  });
});
