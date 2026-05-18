/**
 * bootSequence.test.ts — Cobertura del Plan 06 Task 1.
 *
 * Verifica:
 *   1. happy path → {status:'ok'}
 *   2. initDatabase rechaza → {status:'failed'} con error preservado
 *   3. backfill falla → {status:'ok'} + console.warn (non-blocking)
 *   4. console.error / warn solo loguean err.message, nunca payloads (T-04-01)
 */

import { bootSequence, type MigrationState } from '../services/bootSequence';

describe('bootSequence', () => {
  let errSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('happy path → {status:"ok"}', async () => {
    const initDatabase = jest.fn().mockResolvedValue(undefined);
    const checkAndBackfillHistory = jest.fn().mockResolvedValue(undefined);

    const result: MigrationState = await bootSequence({ initDatabase, checkAndBackfillHistory });

    expect(result).toEqual({ status: 'ok' });
    expect(initDatabase).toHaveBeenCalledTimes(1);
    expect(checkAndBackfillHistory).toHaveBeenCalledTimes(1);
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('initDatabase rejects → {status:"failed"}; backfill NO se ejecuta', async () => {
    const initErr = new Error('migration v2 schema migration falló');
    const initDatabase = jest.fn().mockRejectedValue(initErr);
    const checkAndBackfillHistory = jest.fn().mockResolvedValue(undefined);

    const result = await bootSequence({ initDatabase, checkAndBackfillHistory });

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.error).toBe(initErr);
    }
    expect(checkAndBackfillHistory).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('[bootSequence] initDatabase falló'),
      'migration v2 schema migration falló',
    );
  });

  test('backfill rejects → {status:"ok"} con warn; no es blocking', async () => {
    const initDatabase = jest.fn().mockResolvedValue(undefined);
    const backfillErr = new Error('backfill helper crashed');
    const checkAndBackfillHistory = jest.fn().mockRejectedValue(backfillErr);

    const result = await bootSequence({ initDatabase, checkAndBackfillHistory });

    expect(result).toEqual({ status: 'ok' });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[bootSequence] backfill falló'),
      'backfill helper crashed',
    );
    expect(errSpy).not.toHaveBeenCalled();
  });

  test('console output solo incluye err.message, nunca el error raw (ASVS V7 / T-04-01)', async () => {
    // Sembramos un Error con propiedades sensibles que NO deberían loggearse.
    const sensitive = new Error('schema migration falló') as Error & { payload?: string };
    sensitive.payload = 'mood_value=7.5 comment="dato sensible"';
    const initDatabase = jest.fn().mockRejectedValue(sensitive);
    const checkAndBackfillHistory = jest.fn();

    await bootSequence({ initDatabase, checkAndBackfillHistory });

    const allArgs = errSpy.mock.calls.flat().map((a) => String(a)).join(' ');
    expect(allArgs).toContain('schema migration falló'); // message OK
    expect(allArgs).not.toContain('mood_value'); // payload NUNCA
    expect(allArgs).not.toContain('dato sensible');
  });
});
