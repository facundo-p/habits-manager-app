/**
 * driveRetention.ts — Política de retención Time Machine para backups en Drive (D-14).
 *
 * Pura, determinística, sin IO. Calcula qué archivos eliminar dada una lista de
 * backups + fecha actual:
 *   - Conserva los últimos `recentDays` (default 30) backups diarios.
 *   - Para cada mes anterior a `recentDays` y dentro de los últimos 12 meses:
 *     conserva sólo el MÁS ANTIGUO de ese mes.
 *   - Para cada año anterior a 12 meses: conserva sólo el MÁS ANTIGUO de ese año.
 * Retorna los IDs de archivos a borrar (no muta el input).
 */

interface DriveBackupFileLite {
  id: string;
  name: string;
  createdTime: string; // ISO
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365 * ONE_DAY_MS;

/** Helper interno: agrupa el archivo por bucket clave conservando sólo el más antiguo. */
function keepOldestInBucket(
  bucket: Map<string, DriveBackupFileLite>,
  key: string,
  file: DriveBackupFileLite,
): void {
  const cur = bucket.get(key);
  const fileMs = new Date(file.createdTime).getTime();
  if (!cur || new Date(cur.createdTime).getTime() > fileMs) {
    bucket.set(key, file);
  }
}

/**
 * Calcula los IDs de archivos a podar según la política Time Machine.
 * Función pura — no toca Drive ni el filesystem.
 */
export function selectFilesToPrune(
  files: ReadonlyArray<DriveBackupFileLite>,
  now: Date = new Date(),
  recentDays: number = 30,
): string[] {
  if (files.length === 0) return [];

  const sorted = [...files].sort(
    (a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime(),
  );

  const nowMs = now.getTime();
  const recentMs = recentDays * ONE_DAY_MS;

  const keep = new Set<string>();
  const olderThanRecent: DriveBackupFileLite[] = [];

  for (const f of sorted) {
    const age = nowMs - new Date(f.createdTime).getTime();
    if (age <= recentMs) {
      keep.add(f.id);
    } else {
      olderThanRecent.push(f);
    }
  }

  const monthlyBuckets = new Map<string, DriveBackupFileLite>();
  const yearlyBuckets = new Map<string, DriveBackupFileLite>();

  for (const f of olderThanRecent) {
    const created = new Date(f.createdTime);
    const age = nowMs - created.getTime();
    const yearKey = String(created.getUTCFullYear());
    const monthKey = `${yearKey}-${String(created.getUTCMonth() + 1).padStart(2, '0')}`;

    if (age <= ONE_YEAR_MS) {
      keepOldestInBucket(monthlyBuckets, monthKey, f);
    } else {
      keepOldestInBucket(yearlyBuckets, yearKey, f);
    }
  }

  monthlyBuckets.forEach((f) => keep.add(f.id));
  yearlyBuckets.forEach((f) => keep.add(f.id));

  return sorted.filter((f) => !keep.has(f.id)).map((f) => f.id);
}
