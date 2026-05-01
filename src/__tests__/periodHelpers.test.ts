import { getPeriodKey, getISOWeekKey, getMonthKey } from '../utils/periodHelpers';

describe('getPeriodKey — REQ-04-12', () => {
  describe('daily passthrough', () => {
    test('REQ-04-12: daily retorna el datePrefix sin cambios', () => {
      expect(getPeriodKey('2026-03-15', 'daily')).toBe('2026-03-15');
    });
  });

  describe('monthly', () => {
    test('REQ-04-12: mid-month', () => {
      expect(getPeriodKey('2026-03-15', 'monthly')).toBe('2026-03');
    });
    test('REQ-04-12: último día del mes', () => {
      expect(getPeriodKey('2026-03-31', 'monthly')).toBe('2026-03');
    });
    test('REQ-04-12: primer día del mes siguiente', () => {
      expect(getPeriodKey('2026-04-01', 'monthly')).toBe('2026-04');
    });
  });

  describe('weekly (ISO 8601 Thursday-anchor)', () => {
    test('REQ-04-12: miércoles → semana correcta', () => {
      // 2026-03-11 es miércoles → W11 de 2026
      expect(getPeriodKey('2026-03-11', 'weekly')).toBe('2026-W11');
    });
    test('REQ-04-12: lunes anclado al mismo bloque que el miércoles', () => {
      // 2026-03-09 es lunes; mismo bloque ISO-week que 2026-03-11
      expect(getPeriodKey('2026-03-09', 'weekly')).toBe('2026-W11');
    });
    test('REQ-04-12: domingo anclado al mismo bloque que el lunes', () => {
      // 2026-03-15 es domingo (último día ISO de la semana); mismo bloque
      expect(getPeriodKey('2026-03-15', 'weekly')).toBe('2026-W11');
    });
    test('REQ-04-12: año cruza — viernes 2027-01-01 pertenece a 2026-W53', () => {
      // 2027-01-01 es viernes; ISO 2026 tiene 53 semanas, esa semana corre 2026-12-28..2027-01-03
      expect(getPeriodKey('2027-01-01', 'weekly')).toBe('2026-W53');
    });
    test('REQ-04-12: lunes 2027-01-04 → 2027-W01', () => {
      expect(getPeriodKey('2027-01-04', 'weekly')).toBe('2027-W01');
    });
    test('REQ-04-12: zero-padded a dos dígitos', () => {
      // 2026-01-05 es lunes; W02 de 2026 (W01 corre 2025-12-29..2026-01-04)
      expect(getPeriodKey('2026-01-05', 'weekly')).toBe('2026-W02');
    });
  });
});

describe('getMonthKey', () => {
  test('extrae prefijo YYYY-MM', () => {
    expect(getMonthKey('2026-03-15')).toBe('2026-03');
  });
});

describe('getISOWeekKey', () => {
  test('alias usable individualmente', () => {
    expect(getISOWeekKey('2026-03-11')).toBe('2026-W11');
  });
});
