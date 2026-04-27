/**
 * parsing.test.ts
 *
 * Tests unitarios para el parser central de categorías (DEBT-02).
 * Cubre: happy path, IDs inválidos + console.warn (D-14), JSON malformado,
 * arrays vacíos y JSON que no es array.
 */

import { parseAndValidateCategories } from '../utils/parsing';

describe('parseAndValidateCategories', () => {
  test('retorna solo IDs válidos de un array bien formado', () => {
    const result = parseAndValidateCategories('["salud_fisica","mental"]');
    expect(result).toEqual(['salud_fisica', 'mental']);
  });

  test('filtra IDs inválidos y emite console.warn', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = parseAndValidateCategories('["salud_fisica","fake_id"]');
    expect(result).toEqual(['salud_fisica']);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][1]).toEqual(expect.arrayContaining(['fake_id']));
    warnSpy.mockRestore();
  });

  test('retorna [] para JSON malformado', () => {
    expect(parseAndValidateCategories('{not json')).toEqual([]);
  });

  test('retorna [] para JSON que no es array', () => {
    expect(parseAndValidateCategories('{"foo":1}')).toEqual([]);
  });

  test('retorna [] para array vacío', () => {
    expect(parseAndValidateCategories('[]')).toEqual([]);
  });
});
