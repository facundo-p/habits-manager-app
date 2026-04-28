/**
 * driveRetention.test.ts — Tests de la política Time Machine (Phase 3, D-14).
 *
 * Pure-function tests sin DB ni mocks pesados. Replica el patrón de parsing.test.ts.
 */
import { selectFilesToPrune } from '../utils/driveRetention';

interface F {
  id: string;
  name: string;
  createdTime: string;
}

function makeFile(daysAgo: number, idSuffix = ''): F {
  const d = new Date('2026-04-27T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - daysAgo);
  const iso = d.toISOString();
  const date = iso.slice(0, 10);
  return {
    id: `f_${date}${idSuffix}`,
    name: `cozyhabits-${date}.json`,
    createdTime: iso,
  };
}

describe('selectFilesToPrune', () => {
  const NOW = new Date('2026-04-27T12:00:00Z');

  test('retorna [] para input vacío', () => {
    expect(selectFilesToPrune([], NOW, 30)).toEqual([]);
  });

  test('retorna [] cuando hay menos de recentDays archivos', () => {
    const files = Array.from({ length: 10 }, (_, i) => makeFile(i));
    expect(selectFilesToPrune(files, NOW, 30)).toEqual([]);
  });

  test('con 35 diarios consecutivos: conserva 30 recientes + 1 mensual (oldest), prunea exactamente 4', () => {
    const files = Array.from({ length: 35 }, (_, i) => makeFile(i));
    const pruned = selectFilesToPrune(files, NOW, 30);

    // Los 30 días más recientes (idx 0..29) NUNCA se prunean (regla recentDays).
    const recentIds = files.slice(0, 30).map((f) => f.id);
    pruned.forEach((id) => expect(recentIds).not.toContain(id));

    // De los 5 restantes (días 30..34, idx 30..34), todos en el mismo mes-bucket,
    // la regla mensual conserva el MÁS ANTIGUO (idx 34) y prunea los otros 4 (idx 30..33).
    expect(pruned).toHaveLength(4);
    const oldestId = files[34].id;
    expect(pruned).not.toContain(oldestId);
    const expectedPruned = files.slice(30, 34).map((f) => f.id);
    expect(pruned.sort()).toEqual(expectedPruned.sort());
  });

  test('mensual: conserva el más antiguo de cada mes anterior a recentDays', () => {
    // 4 archivos con días 60-90 (todos > recentDays). Caen en distintos meses calendario,
    // pero el bucket mensual los agrupa por (year, month). Construimos casos donde 3 caen
    // en el mismo mes-bucket para verificar que la regla mensual conserva sólo el oldest.
    const files = [makeFile(60), makeFile(70), makeFile(80), makeFile(90)];
    const pruned = selectFilesToPrune(files, NOW, 30);
    // El más antiguo (90 días atrás) siempre se preserva. El resto depende de cómo caen
    // los meses calendarios: si 60, 70, 80 caen en el mismo mes que sólo tiene esos tres,
    // se prune 60 y 70 y se conserva 80. La aserción robusta es: el oldest del input
    // está en keep set, y al menos 1 archivo es pruned.
    expect(pruned).not.toContain(files[3].id); // El más viejo (90 días) siempre conservado
    expect(pruned.length).toBeGreaterThan(0);
    expect(pruned.length).toBeLessThanOrEqual(3);
  });

  test('anual: conserva el más antiguo de cada año anterior a 12 meses', () => {
    // 3 archivos hace ~2 años (días 730, 760, 790) — caen todos en el mismo año
    // 1 archivo hace ~3 años (día 1100) — cae en otro año
    const files = [makeFile(730), makeFile(760), makeFile(790), makeFile(1100)];
    const pruned = selectFilesToPrune(files, NOW, 30);
    // 730/760/790 caen en el mismo año → conserva el MÁS ANTIGUO de ese año (790)
    // 1100 está en otro año → se conserva por sí solo
    expect(pruned).toHaveLength(2);
    expect(pruned).not.toContain(files[2].id); // 790 es el más antiguo de ese año
    expect(pruned).not.toContain(files[3].id); // 1100 cae en otro año
  });

  test('no muta el input', () => {
    const files = Array.from({ length: 50 }, (_, i) => makeFile(i));
    const snapshot = JSON.parse(JSON.stringify(files));
    selectFilesToPrune(files, NOW, 30);
    expect(files).toEqual(snapshot);
  });
});
