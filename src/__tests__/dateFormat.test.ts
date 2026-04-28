/**
 * dateFormat.test.ts — Tests de las utilidades de formato (Phase 3).
 *
 * Tests puros, sin DB ni network. Usan jest.useFakeTimers para fijar "ahora".
 */
import { formatDateEs, formatRelativeBackup, formatSize } from '../utils/dateFormat';

describe('formatDateEs', () => {
  test('27 abril 2026 → "27 abr 2026"', () => {
    // Construimos con componentes locales para evitar shifts de timezone en CI
    const d = new Date(2026, 3, 27); // mes index 3 = abril
    expect(formatDateEs(d)).toBe('27 abr 2026');
  });

  test('1 enero 2027 → "1 ene 2027"', () => {
    const d = new Date(2027, 0, 1);
    expect(formatDateEs(d)).toBe('1 ene 2027');
  });

  test('31 diciembre 2025 → "31 dic 2025"', () => {
    const d = new Date(2025, 11, 31);
    expect(formatDateEs(d)).toBe('31 dic 2025');
  });
});

describe('formatRelativeBackup', () => {
  const NOW = new Date('2026-04-27T12:00:00Z');

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('null → "Aún no hiciste un backup"', () => {
    expect(formatRelativeBackup(null)).toBe('Aún no hiciste un backup');
  });

  test('hace 30 minutos → "hace menos de una hora"', () => {
    const iso = new Date(NOW.getTime() - 30 * 60 * 1000).toISOString();
    expect(formatRelativeBackup(iso)).toBe('Último backup: hace menos de una hora');
  });

  test('hace 5 horas → "hace 5 h"', () => {
    const iso = new Date(NOW.getTime() - 5 * 3600 * 1000).toISOString();
    expect(formatRelativeBackup(iso)).toBe('Último backup: hace 5 h');
  });

  test('hace 30 horas → "ayer"', () => {
    const iso = new Date(NOW.getTime() - 30 * 3600 * 1000).toISOString();
    expect(formatRelativeBackup(iso)).toBe('Último backup: ayer');
  });

  test('hace 5 días → "el {fecha}"', () => {
    const iso = new Date(NOW.getTime() - 5 * 24 * 3600 * 1000).toISOString();
    expect(formatRelativeBackup(iso)).toMatch(/^Último backup: el \d+ \w{3} 2026$/);
  });
});

describe('formatSize', () => {
  test('500 bytes → "500 B"', () => expect(formatSize('500')).toBe('500 B'));
  test('1024 bytes → "1 KB"', () => expect(formatSize('1024')).toBe('1 KB'));
  test('1572864 bytes → "1.5 MB"', () => expect(formatSize('1572864')).toBe('1.5 MB'));
  test('NaN → ""', () => expect(formatSize('not-a-number')).toBe(''));
});
