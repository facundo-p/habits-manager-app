# Phase 1: Foundation — Research

**Researched:** 2026-05-12
**Domain:** React Native / Expo brownfield — cross-cutting primitives para v1.1 (date helpers consolidation, MoodPicker extraction, migración v2 atómica, backup v1→v2, drafts, error screen + pre-v2 snapshot, tone-of-voice doc)
**Confidence:** HIGH (todo grounded en código real + precedente Phase 4 v1.0; cero dependencias nuevas; cero APIs externas a verificar)

---

## Summary

Esta phase no agrega features de usuario — establece las primitivas que toda feature v1.1 consume. Todo el alcance es **refactor + migración + extensión backup + drafts + error UX + doc de copy**, sin pantallas nuevas, sin dependencias nuevas, y con paridad estricta en el flow de habit reflection.

El terreno es 100% conocido: el patrón `migrationV1.ts` + `runMigrations` dispatcher + `withTransactionAsync` + `PRAGMA user_version` ya está probado en producción (Phase 4 v1.0, shipped 2026-05-05). El cambio sustantivo vs. v1.0 es la política de **failure UX**: D-05 invierte la política de Phase 4 (silent log + continuar) por una **pantalla bloqueante con restore**, porque la migration v2 es schema-breaking (no data-cleanup). D-06 agrega un **pre-v2 snapshot local** como red de seguridad determinística.

**Primary recommendation:** Ejecutar el codemod `getTodayPrefix → getLocalDayKey` **primero** (single PR / wave, blast radius ~10 archivos) antes de tocar nada más; luego migration v2 + backup v2 en una sola wave atómica (en un solo commit lógico); el `<MoodPicker>` y refactor de `ReflectionModal` van en una wave independiente que solo depende de `src/config/mood.ts`. Drafts y error-screen son orthogonales y pueden paralelizarse.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `getLocalDayKey()` + family | Utils (`src/utils/date.ts`) | — | Pure function, no I/O; consumida por services |
| `<MoodPicker>` | Presentation (`src/components/shared/`) | — | UI puro, controlled component |
| `src/config/mood.ts` | Config | — | Constants + labels, pure module |
| Migración v2 (CREATE + INSERT...SELECT + DROP) | Services/migrations | Repositories | SQL ejecutado por `migrationV2.ts`; repos nuevos consumen las tablas post-migration |
| Backup v1→v2 dispatcher | Services (`backupService.ts`) | Repositories (`backupRepository.ts`) | Service owns version dispatch; repo owns CRUD on tables |
| Drafts repo + autosave hook | Repositories + hook | Services | New `draftsRepository.ts` + a draft-aware hook for surfaces (planner aterriza) |
| Pre-v2 snapshot generation | Services (`backupService.buildBackupData()`) | I/O (`expo-file-system/legacy`) | Reusa builder existente; escribe a `FileSystem.documentDirectory` |
| Migration error screen | Presentation (App.tsx + new component) | State (local React state in App.tsx) | Bloquea navigator render hasta resolver |
| `tone-of-voice.md` | Docs (`.planning/docs/`) | — | Documento, no código |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | Único `getLocalDayKey()` helper, sin `toISOString().slice(0,10)` disperso | §2 (Date helpers extraction) — inventario completo de call sites; codemod definido. CONTEXT D-01 |
| FOUND-02 | `<MoodPicker>` compartido, escala única | §3 (MoodPicker extraction) — surface exacta del `MoodSection`; props mínimas; `src/config/mood.ts` plan. CONTEXT D-02 |
| FOUND-03 | DB en `user_version = 2` con `mood_log` + `text_library` + `weekly_reviews` + `drafts`; `mood_entries` migrado a `mood_log` kind='reflection' y dropped; todo atómico | §1 (Migration v2 patterns) — pattern de `migrationV1.ts` extendido al surface mayor de v2; SQL completo en research/ARCHITECTURE.md §2 |
| FOUND-04 | `BACKUP_VERSION = 2`, dispatcher v1→v2, mapeo `mood_entries[]` → `mood_log kind='reflection'` | §4 (Backup dispatcher) — insertion points exactos en `parseAndValidate` y `restoreData`; mapeo SQL paralelo al INSERT...SELECT de la migration |
| FOUND-05 | Tabla `drafts` con autosave + recovery al reabrir | §7 (Drafts table semantics) — shape SQL, draft key strategy, debounce 500ms, purge >7d. CONTEXT D-04 |
| FOUND-06 | Habit reflection flow funciona idéntico para el usuario; data en `mood_log` kind='reflection' | §3 (MoodPicker extraction) — paridad estrategia; §1 — INSERT...SELECT preserva semántica; §8 — UAT script de paridad |
</phase_requirements>

---

## 1. Migration v2 Patterns

### Pattern de `migrationV1.ts` (template directo)

Archivo: `src/services/migrations/migrationV1.ts` (80 líneas, leído íntegro). Estructura:

1. **`TARGET_VERSION` const** al tope (= 1).
2. **`runMigrations(db)` dispatcher** — lee `PRAGMA user_version`, ramifica con `if (current < N) await migrationVN_*(db)`. CONTEXT D-01 ya marca: cuando agregue v2, sumar `if (current < 2) await migrationV2_addWellbeingTables(db)`.
3. **Función de migración interna** envuelta en `try { withTransactionAsync(...) } catch { console.error }`. Pattern:
   ```ts
   await db.withTransactionAsync(async () => {
     await db.execAsync(SQL_STEP_1);
     await assertInvariant(db);             // ej. assertNoDuplicatesRemain
     await db.execAsync(SQL_STEP_2);
     await db.execAsync(`PRAGMA user_version = ${TARGET_VERSION}`);
   });
   ```
4. **`PRAGMA user_version` bump al final, dentro de la transaction** — atómico con todo lo anterior.

### Deviaciones necesarias para v2

| Aspecto | v1 | v2 (este phase) |
|---------|----|------------------|
| Surface | 1 DELETE + 1 CREATE INDEX | 4 CREATE TABLE + 4+ CREATE INDEX + 1 INSERT...SELECT + 1 DROP |
| Failure policy | Silent log + continuar boot (D-06 de Phase 4) | **Bloquear con error screen** (D-05 v1.1). El `try { } catch { console.error }` actual NO sirve — debe **re-lanzar** o setear un flag observable por App.tsx |
| Pre-step requerido | Ninguno | **Pre-v2 snapshot** (D-06) — generar JSON v1 ANTES del transaction; si falla, decisión planner: ¿bloquear migration o continuar? Recomendación: bloquear (D-06 explícita: "red de seguridad determinística"). |
| Idempotencia post-DROP | Trivial (CREATE INDEX IF NOT EXISTS) | `DROP TABLE mood_entries` no es idempotente si la segunda corrida la encuentra ausente — pero el `user_version = 2` ya gateó la entrada, no llegamos al DROP en re-run. Verificar con test "idempotencia 2x runMigrations" (precedente Phase 4 test `REQ-04-06 idempotency`). |
| Cantidad de operaciones | 1 invariant check (`assertNoDuplicatesRemain`) | Considerar 1 assert post-INSERT...SELECT: `SELECT COUNT(*) FROM mood_log WHERE kind='reflection'` == `SELECT COUNT(*) FROM mood_entries` (pre-migration). Si el INSERT...SELECT perdió filas (timestamp malformado), abort. |

### Punto crítico: contradicción entre D-05 y el pattern actual

`migrationV1.ts` línea 62: `catch (err) { console.error(...) }` — **se traga el error**. Para D-05 (pantalla bloqueante en fallo), la dispatcher `runMigrations` debe **propagar** el throw a `App.tsx` (vía rethrow, o un return value tipado `{ ok: true } | { ok: false; error }`, o un signal observable). Decisión de planner. Recomendación: **rethrow + try/catch en `initDatabase()`** que setea un `migrationError` state, observable por App.tsx. Esto NO rompe Phase 4 v1 (la dispatcher dispatcha v1 primero — si v1 ya está aplicada en prod, `if (current < 1)` no entra).

### Sub-rationale (preserva atomicidad)

El `INSERT...SELECT FROM mood_entries` + `DROP TABLE mood_entries` deben ir **dentro del mismo `withTransactionAsync`** que los CREATE TABLE. Si el INSERT falla parsing un `timestamp` malformado, rollback completo deja `mood_entries` intacto y `user_version` en 1. Esto matchea exactamente el spec de research/ARCHITECTURE.md §2 ("atómico en `withTransactionAsync`").

### Pitfalls cruzadas

- **Pitfall #2 (Idempotency race)** PITFALLS.md: la migración v2 propia es idempotente por `user_version`, pero **los upserts post-migration en `mood_log` (Phase 2)** dependen del partial UNIQUE INDEX `idx_mood_log_one_per_day`. Si el CREATE INDEX falla por datos inconsistentes (no debería — la tabla está vacía al crearse), rollback. Verificar con test post-migration: insertar dos rows kind='morning' con mismo date_key → debe throw UNIQUE constraint.
- **Pitfall #3 (Mood scale shape change)** PITFALLS.md: el `mood_scale_version='v1'` literal en el INSERT...SELECT está alineado con research/SUMMARY.md y CONTEXT specifics. Sin re-escritura.
- **Pitfall #4 (Backup version skew)** PITFALLS.md: backup v2 bump debe ir en el **mismo commit** que la migration v2 (cross-ref §4 abajo). El planner debe agrupar estas tasks en la misma wave.

### Open question for planner

- ¿La aserción "INSERT...SELECT count match" se hace dentro de la transaction (y throws aborta + rollback) o como warning post-commit? **Recomendación:** dentro de la transaction, throws aborta. Consistente con el patrón `assertNoDuplicatesRemain` de v1.

---

## 2. Date Helpers Extraction (D-01)

### Inventario completo de call sites (grep `getTodayPrefix\|isFutureDate\|nextDay\|getNowTimestamp\|getTimestampForDate` en `src/`)

**Helpers definidos hoy:**
| Helper | Ubicación actual | Líneas |
|--------|------------------|--------|
| `getTodayPrefix()` | `src/services/db.ts:31-37` | 7 |
| `isFutureDate(prefix)` | `src/services/db.ts:39-41` | 3 |
| `getNowTimestamp()` | `src/services/db.ts:43-45` | 3 |
| `getTimestampForDate(prefix)` | `src/services/db.ts:48-51` | 4 |
| `nextDay(dateStr)` | **`src/services/assignmentService.ts:374-378`** (export para tests) | 5 |
| `formatDateStr` (alias funcional `dateToPrefix(d)`) | **`src/utils/dateHelpers.ts:27-29`** | 3 |

Nota: CONTEXT D-01 menciona `formatDateStr` pero el codebase no tiene ese símbolo literal; lo más cercano es `dateToPrefix(d: Date): string` en `dateHelpers.ts`. **El planner debe confirmar la nomenclatura final** — recomendado: renombrar `dateToPrefix` → `formatDateStr` o mantener `dateToPrefix` y ajustar D-01 wording. Es decisión de naming, no funcional.

**Call sites importantes (de prod):**

| Archivo | Línea | Símbolo | Notas |
|---------|-------|---------|-------|
| `src/screens/SettingsScreen.tsx` | 31, 117 | `getTodayPrefix` | UI consumer |
| `src/screens/RestoreFromDriveScreen.tsx` | 22, 127 | `getTodayPrefix` | UI consumer |
| `src/hooks/useDriveActions.ts` | 11, 83 | `getTodayPrefix` | Hook consumer |
| `src/services/driveBackupService.ts` | 31, 188 | `getTodayPrefix` | Service consumer; **importa de `./db`** |
| `src/services/assignmentService.ts` | 10, 26, 83, 101, 113, 128, 151, 176, 177, 200, 210, 239, 270 | `getTodayPrefix`, `getTimestampForDate`, `getNowTimestamp`, `isFutureDate` | **Service core; alto número de call sites** |
| `src/services/moodService.ts` | 10, 20, 29, 38 | `getTodayPrefix`, `getNowTimestamp`, `getTimestampForDate` | Service consumer |
| `src/utils/dateHelpers.ts` | 28 | `dateToPrefix` (definición) | Usa `toISOString().slice(0,10)` — **bandera roja**, ver abajo |

**Call sites en tests (deben actualizarse o consolidarse):**

| Archivo | Símbolo | Acción |
|---------|---------|--------|
| `src/__tests__/db.test.ts` | `getTodayPrefix` | Mover a `dateUtils.test.ts` post-migración; renombrar describe |
| `src/__tests__/dailyAssignments.test.ts` | `getTodayPrefix`, `getNowTimestamp`, `getTimestampForDate`, `isFutureDate`, `nextDay` | Actualizar `jest.mock('../services/db', ...)` → mockear `../utils/date` |
| `src/__tests__/habitService.test.ts` | `getTodayPrefix`, `getNowTimestamp`, `getTimestampForDate` | Mismo mock target update |
| `src/__tests__/sanitize.test.ts` | (comentario solo) | Actualizar comentario que referencia `getTodayPrefix` |

### Estado especial de `dateToPrefix` (línea 28 de `dateHelpers.ts`)

```ts
export function dateToPrefix(d: Date): string {
  return d.toISOString().slice(0, 10);
}
```

Este helper **usa `toISOString().slice(0,10)`** — lo que CONTEXT D-01 quiere prohibir vía grep. Pero su semántica es deliberada: opera sobre un Date construido en UTC (ej. `new Date('2026-03-10T00:00:00Z')` en `nextDay`), y el resultado es estable bajo arithmetic de día. No es el bug de qu5 (que era `new Date().toISOString().slice(0,10)` para "hoy local").

**Recomendación para planner:** El verify grep debe ser **selectivo** — no prohibir `toISOString().slice(0,10)` en general, sino prohibir el patrón `new Date().toISOString().slice(0,10)` (Date sin argumento = ahora, en UTC). Alternativas:
1. Allowlist de archivos: `src/utils/date.ts` (donde vive `dateToPrefix`) exento del grep ban.
2. Reescribir `dateToPrefix` para no usar `toISOString` (usar `getUTCFullYear/getUTCMonth/getUTCDate`).
3. Test linter custom: AST check que rechaza `new Date().toISOString().slice(0,10)` sin variable.

**Recomendación primaria:** Opción 2 — reescribir `dateToPrefix` con getters UTC explícitos para ser consistente con el patrón de `getLocalDayKey` (getters local). Costo: 3 líneas. Beneficio: regla grep simple y absoluta.

### Codemod blast radius

- **Archivos a tocar:** ~10 (4 services + 2 screens + 1 hook + 4 tests).
- **Símbolos a renombrar:** 1 (`getTodayPrefix` → `getLocalDayKey`).
- **Imports a actualizar:** ~10 (cambiar `from '../services/db'` o `from './db'` → `from '../utils/date'`).
- **Risk:** BAJO — symbolic rename, no semantic change. La función `getTodayPrefix` ya está implementada correctamente (qu5 fix, ver `db.ts:31-37`). El test cross-midnight existente (`db.test.ts`) ya cubre la invariante; migrar el test a `dateUtils.test.ts` preserva coverage.

### Estrategia de codemod (Claude's Discretion per CONTEXT)

**Recomendación:** Find-replace manual con verify por archivo + `npm test` al final. No vale armar un script ts-node para 10 archivos.

Orden estricto:
1. Crear `src/utils/date.ts` con las 6 funciones movidas + `getLocalDayKey` como nombre canónico (`export { getLocalDayKey } ` + opcionalmente `export const getTodayPrefix = getLocalDayKey` como alias temporal para reducir blast radius — pero CONTEXT D-01 quiere "rename total", así que sin alias).
2. En `db.ts`, borrar las 4 funciones, dejar solo bootstrap + migrations.
3. Reescribir `dateToPrefix` en `dateHelpers.ts` o moverlo a `date.ts` (decisión de planner — recomendación: mover todo a `date.ts` y deprecar `dateHelpers.ts` o renombrarlo).
4. Find-replace en cada archivo consumer.
5. Find-replace en tests; ajustar `jest.mock` targets.
6. Mover `nextDay` desde `assignmentService.ts:374` a `date.ts`.
7. `npm test` — todos verdes.
8. Grep verify: `grep -rn "getTodayPrefix" src/` → 0 matches; `grep -rn "new Date().toISOString().slice(0,10)" src/` → 0 matches.

### Pitfalls cruzadas

- **Pitfall #1 (Inconsistent today)** PITFALLS.md: este phase **es** la mitigación.
- **qu5 precedent (already paid)**: la implementación interna de `getTodayPrefix` ya es correcta. NO re-implementar.

---

## 3. MoodPicker Extraction (D-02 + D-03)

### Anatomía actual de `MoodSection` (líneas 66-91 de `ReflectionModal.tsx`)

```tsx
function MoodSection({ value, onValueChange }: { value: number; onValueChange: (v: number) => void; }) {
  return (
    <>
      <Text className={styles.label}>¿Cómo te sientes?</Text>
      <Text className={styles.moodValue}>{value.toFixed(1)}</Text>
      <View className={styles.sliderWrapper}>
        <Slider
          style={nativeStyles.slider}
          minimumValue={MOOD_MIN} maximumValue={MOOD_MAX} step={MOOD_STEP}
          value={value} onValueChange={onValueChange}
          minimumTrackTintColor={sliderColors.minimumTrack}
          maximumTrackTintColor={sliderColors.maximumTrack}
          thumbTintColor={sliderColors.thumb}
        />
      </View>
      <View className={styles.sectionGap} />
    </>
  );
}
```

Imports requeridos: `Slider` from `@react-native-community/slider`, `MOOD_MIN/MAX/STEP` de `../../config/constants`, `styles/nativeStyles/sliderColors` de `./ReflectionModal.styles`.

### Surface del `<MoodPicker>` (D-02)

Per CONTEXT D-02: props mínimas `value, onChange, disabled`. Sin `comment`, sin `sleep`, sin `size` (research/ARCHITECTURE.md §3 sugería `size?: 'compact' | 'full'` pero CONTEXT lo descartó — cada surface compone su propio layout).

```ts
interface MoodPickerProps {
  value: number;        // [MOOD_MIN, MOOD_MAX], step MOOD_STEP
  onChange: (v: number) => void;
  disabled?: boolean;
}
```

**Qué vive en `<MoodPicker>`:**
- Label "¿Cómo te sientes?"
- Visualización numérica `value.toFixed(1)`
- `<Slider>` con bounds + step + colors

**Qué queda en `ReflectionModal`:**
- `ModalHeader` (título + nombre de hábito)
- `DescriptionWithMic` (TextInput + MicButton)
- `ModalActions` (Guardar / Omitir)
- Composición del modal con `<BottomSheet>`

### `src/config/mood.ts` (NEW)

Per CONTEXT D-02: re-exporta `MOOD_MIN/MAX/STEP/MOOD_DEFAULT_VALUE` de `constants.ts` y agrega **labels discretas** para la UI. El planner aterriza el set exacto; sugerencia inicial (alineada con research/ARCHITECTURE.md §3):

```ts
// src/config/mood.ts
export { MOOD_MIN, MOOD_MAX, MOOD_STEP, MOOD_DEFAULT_VALUE } from './constants';

export const MOOD_LABELS = ['muyMal', 'mal', 'neutral', 'bien', 'muyBien'] as const;
export type MoodLabel = (typeof MOOD_LABELS)[number];

/** Pure helper: maps numeric [1,10] → discrete label. Pure function — testable. */
export function moodLabelFor(value: number): MoodLabel { /* impl */ }

export const MOOD_SCALE_VERSION = 'v1' as const;  // consumed by migration v2 + new repos
```

**Open question for planner:** ¿`MOOD_LABELS` se usan en Phase 1 (solo para tests del helper) o solo se persisten para futuras phases? CONTEXT dice "labels discretas para la UI" — sugiere que sí se usan visualmente en alguna surface v1.1, pero la `<MoodPicker>` actual no las muestra. Recomendación: definir el helper en Phase 1, no obligar uso visual en Phase 1.

### Paridad estrategia (D-03)

**Verificación FOUND-06:** El refactor de `ReflectionModal` mantiene UX idéntica. Criterios verificables:

1. **Visual:** los estilos (`styles.label`, `styles.moodValue`, `styles.sliderWrapper`, `sliderColors`, `nativeStyles.slider`) se mueven al `<MoodPicker>` y a un nuevo `MoodPicker.styles.ts`, con valores iguales. Sin cambios visuales perceptibles.
2. **Funcional:** completar reflection → mood se persiste con mismo valor numérico. Cambio interno: target table es `mood_log` con `kind='reflection'` en vez de `mood_entries`.
3. **Polish acotado permitido (D-03):** spacing/alignment menor SI emerge inconsistencia con otras surfaces v1.1 — pero esas surfaces no existen aún en Phase 1, así que en la práctica **cero polish visual** en este phase. Planner puede confirmar.

### MoodPicker file structure

| File | Purpose |
|------|---------|
| `src/components/shared/MoodPicker.tsx` (NEW) | Componente puro |
| `src/components/shared/MoodPicker.styles.ts` (NEW) | Styles extraídos de `ReflectionModal.styles.ts` |
| `src/config/mood.ts` (NEW) | SoT de la escala |
| `src/components/modals/ReflectionModal.tsx` (MODIFIED) | Reemplaza `MoodSection` inline por `<MoodPicker value=... onChange=... />` |
| `src/components/modals/ReflectionModal.styles.ts` (MODIFIED) | Eliminar `moodValue`, `sliderWrapper`, `sliderColors`, `nativeStyles.slider` |

### Pitfalls cruzadas

- **Pitfall #3 (mood scale shape change)** PITFALLS.md: `MOOD_SCALE_VERSION = 'v1'` exportado desde `config/mood.ts` es la SoT que la migration v2 lee para el INSERT...SELECT.
- **Anti-Pattern 4 (Inline mood UI per screen)** ARCHITECTURE.md §13: este phase **es** la mitigación.

### Open question for planner

- ¿`MoodPicker` exporta también `MoodPickerStyles` o el caller siempre usa los estilos defaults? Recomendación: defaults solo, sin parametrizar. Si Phase 2 necesita variante visual, agregar prop ahí — YAGNI.

---

## 4. Backup Dispatcher v1→v2 (D-FOUND-04)

### Estado actual

`src/services/backupService.ts` (155 líneas, leído íntegro):

- `BACKUP_VERSION = 1` en `src/config/constants.ts:223` → bump a `2`.
- `BackupData` interface en `src/types/index.ts:153-158` con campo `mood_entries: MoodEntry[]`.
- `buildBackupData()` (líneas 66-82): paraleliza 4 reads (`readAllHabits`, `readAllPerformed`, `readAllMoods`, `readAllAssignments`) → retorna shape con `mood_entries`.
- `parseAndValidate(json)` (líneas 89-131): valida `version > BACKUP_VERSION` rechazo + valida arrays presentes. Línea 115 `if (!Array.isArray(data.mood_entries)) throw` — rompe forward-compat si un futuro backup v3 omite `mood_entries`.
- `restoreData(data)` (líneas 143-154): aplica dedupe + delega a `backupRepo.restoreAllData(habits, performed, moods, assignments)`.

`src/repositories/backupRepository.ts` (105 líneas, leído íntegro):

- `restoreAllData(habits, performed, moods, assignments)` (líneas 63-104): clear all + insert all, todo en `withTransactionAsync`. Atómico. SQL constants al tope.

### Insertion point exacto para v1→v2 dispatcher

#### Bump version + extend types

- `src/config/constants.ts:223` — `export const BACKUP_VERSION = 2;`
- `src/types/index.ts:153-158` — extender `BackupData`:
  ```ts
  export interface BackupData {
    version: number;
    exportedAt: string;
    habits: Habit[];
    performed_habits: PerformedHabit[];
    daily_assignments: DailyAssignment[];
    mood_log: MoodLogEntry[];            // NEW v2 (replaces mood_entries)
    text_library: TextLibraryItem[];     // NEW v2
    weekly_reviews: WeeklyReview[];      // NEW v2
    // v1 backups carry: mood_entries: MoodEntry[]; v2 parseAndValidate maps it → mood_log
    mood_entries?: MoodEntry[];          // optional in v2 (only present in v1 backups)
  }
  ```
- `MoodLogEntry`, `TextLibraryItem`, `WeeklyReview` types per research/ARCHITECTURE.md §5 (discriminated unions ya specced ahí).

#### Modificar `buildBackupData()`

```ts
export async function buildBackupData(): Promise<BackupData> {
  const [habits, performed_habits, daily_assignments, mood_log, text_library, weekly_reviews] = await Promise.all([
    backupRepo.readAllHabits(),
    backupRepo.readAllPerformed(),
    backupRepo.readAllAssignments(),
    backupRepo.readAllMoodLog(),         // NEW
    backupRepo.readAllTextLibrary(),     // NEW
    backupRepo.readAllWeeklyReviews(),   // NEW
  ]);
  return {
    version: BACKUP_VERSION,             // = 2
    exportedAt: new Date().toISOString(),
    habits, performed_habits, daily_assignments,
    mood_log, text_library, weekly_reviews,
    // NOTE: drafts excluded (transient autosave, FOUND-04 explicit)
  };
}
```

#### Modificar `parseAndValidate()` — el dispatcher v1→v2

Punto exacto: **línea 115**. Cambiar:

```ts
// ANTES (v1 only)
if (!Array.isArray(data.mood_entries)) {
  throw new Error('Falta mood_entries en el respaldo');
}
```

```ts
// DESPUÉS (v1→v2 graceful dispatcher)
const isV1 = data.version === 1;
const isV2 = data.version === 2;

if (isV1) {
  if (!Array.isArray(data.mood_entries)) {
    throw new Error('Falta mood_entries en el respaldo v1');
  }
  // mood_entries[] se mapea a mood_log[] en restoreData (v1→v2 upgrade)
} else if (isV2) {
  if (!Array.isArray(data.mood_log)) {
    throw new Error('Falta mood_log en el respaldo v2');
  }
  // text_library + weekly_reviews son nullable-tolerant (default [])
} else {
  throw new Error(`Versión no soportada: ${data.version}`);
}

// Build canonical return
return {
  version: data.version,
  exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
  habits: data.habits as Habit[],
  performed_habits: data.performed_habits as PerformedHabit[],
  daily_assignments: Array.isArray(data.daily_assignments) ? data.daily_assignments as DailyAssignment[] : [],
  mood_entries: isV1 ? (data.mood_entries as MoodEntry[]) : undefined,
  mood_log: isV2 ? (data.mood_log as MoodLogEntry[]) : [],
  text_library: isV2 && Array.isArray(data.text_library) ? data.text_library as TextLibraryItem[] : [],
  weekly_reviews: isV2 && Array.isArray(data.weekly_reviews) ? data.weekly_reviews as WeeklyReview[] : [],
};
```

#### Modificar `restoreData()` — el mapeo v1 mood_entries → v2 mood_log

```ts
export async function restoreData(data: BackupData): Promise<void> {
  const dedupedAssignments = dedupeAssignmentsArray(data.daily_assignments, data.performed_habits);

  // v1→v2 mapping: si el backup es v1, sintetizamos mood_log a partir de mood_entries
  let moodLog: MoodLogEntry[] = data.mood_log ?? [];
  if (data.version === 1 && data.mood_entries) {
    moodLog = data.mood_entries.map((e) => ({
      id: e.id,
      kind: 'reflection' as const,
      date_key: e.timestamp.slice(0, 10),                    // 'YYYY-MM-DD'
      occurred_at: e.timestamp,
      mood_value: e.value,
      mood_scale_version: 'v1' as const,
      sleep_hours: null,
      comment: e.description ?? null,
      habit_id: e.habit_id ?? null,
      created_at: e.timestamp,
      updated_at: e.timestamp,
    }));
  }

  await backupRepo.restoreAllData(
    data.habits, data.performed_habits, dedupedAssignments,
    moodLog, data.text_library, data.weekly_reviews,
  );
}
```

#### Modificar `backupRepository.restoreAllData()`

Extender signature de 4 args a 6 args. Agregar SQL_CLEAR_* y SQL_INSERT_* para las 3 tablas nuevas. **NOTA crítica:** `mood_entries` ya no existe post-migration v2 (DROP TABLE en migrationV2). El `SQL_CLEAR_MOODS` actual (`DELETE FROM mood_entries`) **debe eliminarse** del repository — lo reemplaza `SQL_CLEAR_MOOD_LOG = 'DELETE FROM mood_log'`. Si alguna ruta de código sigue invocando `readAllMoods`/`SQL_INSERT_MOOD` post-Phase-1, falla en runtime.

**Recomendación planner:** Eliminar las 4 SQL constants legacy (`SQL_ALL_MOODS`, `SQL_CLEAR_MOODS`, `SQL_INSERT_MOOD`, y la firma vieja de `restoreAllData`) en el mismo commit que la migration v2. Cualquier consumer existente (`readAllMoods`) se sustituye por `readAllMoodLog` filtrando por `kind='reflection'` para preservar la API legacy del `moodService` (per research/ARCHITECTURE.md §2 "rewrite queries against mood_log WHERE kind = 'reflection' preserving same public API").

### Drive flow downstream impact

`src/services/driveBackupService.ts` (480 líneas, leído íntegro):
- `RestoreCounts` interface (línea 378-383) — extender con `mood_log: number` (en lugar de `mood_entries`), `text_library: number`, `weekly_reviews: number`. Quitar `mood_entries` o dejarlo como `number | undefined` para preservar la UI Alert que muestra counts.
- `prepareRestore` (línea 405-424) — actualizar el block `counts: { ... }` con los counts de las nuevas tablas. Si el backup descargado es v1, `mood_entries.length`; si es v2, `mood_log.length`. **Open question planner:** ¿la UI muestra ambos counts o el unificado? Recomendación: count unificado "Registros de ánimo: N" con N = len(mood_entries v1) o len(mood_log v2).
- `RestoreFromDriveScreen.tsx` — actualizar el Alert templated copy si menciona "mood_entries" literal (grep necesario; CONTEXT no lo lista).

### Pitfalls cruzadas

- **Pitfall #4 (Backup version skew)** PITFALLS.md: este phase **es** la mitigación. El bump + dispatcher van **en el mismo commit** que la migration v2.
- **PITFALLS.md "Looks Done But Isn't":** fixture test `backup-v1-on-v1.1.test.ts` requerido — ver §8 Validation.

### Open questions for planner

- ¿Forward-incompat policy (v3 backup en app v2)? `parseAndValidate` actual rechaza con error genérico. Recomendación: error explícito "Backup más nuevo que la app — actualizá la app para restaurar". Esto NO es phase 1 scope estricto pero es trivial agregar y previene Pitfall #4 reverso.
- ¿El bump de `BACKUP_VERSION = 2` rompe la UAT scenarios pendientes de Phase 02/03 v1.0 (registrados en STATE.md deferred items)? Probablemente no (las UATs eran sobre Drive flow, no version semantics), pero el planner debe verificar.

---

## 5. Pre-v2 Snapshot (D-06)

### API disponible

Precedente directo: `src/services/driveBackupService.ts:448-458` — `writePreRestoreCache()` ya hace exactamente esto para el flow de restore (D-19 de Phase 3 v1.0). Pattern:

```ts
async function writePreRestoreCache(): Promise<void> {
  try {
    const snapshot = await buildBackupData();
    const iso = new Date().toISOString().replace(/[:.]/g, '-');
    const path = `${FileSystem.cacheDirectory}cozyhabits-pre-restore-${iso}.json`;
    await FileSystem.writeAsStringAsync(path, JSON.stringify(snapshot), { encoding: 'utf8' });
  } catch (err) {
    console.warn('[writePreRestoreCache] no se pudo escribir cache de seguridad', err);
  }
}
```

Imports: `import * as FileSystem from 'expo-file-system/legacy';` — mismo legacy API que el resto del codebase (compatible con Expo Go SDK 54).

### Adaptación para pre-v2 snapshot (D-06)

Diferencias vs. el pre-restore cache existente:

| Aspecto | Pre-restore cache (Phase 3 v1.0) | Pre-v2 snapshot (Phase 1 v1.1) |
|---------|----------------------------------|--------------------------------|
| Directorio | `FileSystem.cacheDirectory` | **`FileSystem.documentDirectory`** (per CONTEXT specifics: "vive en app sandbox") |
| Prefix | `cozyhabits-pre-restore-` | **`pre-v2-snapshot-`** (per CONTEXT D-06) |
| Trigger | Antes de aplicar restore | Antes del transaction de migration v2 |
| Versión del data | Versión actual (en momento del restore, podía ser v1 o v2) | **Siempre v1** (es lo que vamos a migrar AWAY de) |
| Cleanup policy | "Más reciente sobrevive" (post-success cleanup) | **30 días post-migración exitosa** (D-06) |
| Pre-existencia | Múltiples archivos OK | **Decisión open** (D-CD: overwrite vs timestamped) |

### Issue clave: `buildBackupData()` retorna v2 post-bump

Una vez que `BACKUP_VERSION = 2` en `constants.ts`, `buildBackupData()` retorna `version: 2`. Pero la migration v2 aún no corrió, así que las tablas `mood_log`/`text_library`/`weekly_reviews` no existen — los `readAllMoodLog()` etc. fallarían.

**Workaround necesario (planner aterriza):** Generar el snapshot pre-v2 con un **builder dedicado** que produce shape v1 (lee `mood_entries` directo):

```ts
// En backupService.ts — NEW función
async function buildV1Snapshot(): Promise<BackupDataV1> {
  const [habits, performed, mood_entries, daily_assignments] = await Promise.all([
    backupRepo.readAllHabits(),
    backupRepo.readAllPerformed(),
    backupRepo.readAllMoods(),               // legacy SQL_ALL_MOODS contra mood_entries
    backupRepo.readAllAssignments(),
  ]);
  return { version: 1, exportedAt: new Date().toISOString(), habits, performed_habits: performed, mood_entries, daily_assignments };
}
```

Esto requiere **preservar las SQL constants legacy de moods en `backupRepository.ts` HASTA después del snapshot**, y eliminarlas DESPUÉS de migration v2 completar. Sequencing:

1. Boot.
2. Verificar `user_version < 2`.
3. Si sí: `buildV1Snapshot()` → write a `${documentDirectory}/pre-v2-snapshot-${ts}.json`.
4. Si write OK: abrir transaction → migration v2 (CREATE TABLES + INSERT...SELECT + DROP mood_entries + user_version=2).
5. Si write falla: D-06 dice "red de seguridad determinística" — recomendación de research: **bloquear** la migration. Planner aterriza (Claude's Discretion en CONTEXT enlista "persistencia del flag snapshot generado correctamente para gatear el BEGIN TRANSACTION").

### Alternative considerada (NO recomendada)

Generar el snapshot **leyendo directo de SQLite via `db.getAllAsync('SELECT * FROM mood_entries')` inline en `migrationV2.ts`** evitaría depender de `backupRepository`. Pero rompe layering (migration en services calling repos inline). Mejor: extender `backupService` con `buildV1Snapshot()` explícito, y `migrationV2.ts` lo invoca pre-transaction.

### Naming + collision policy (Claude's Discretion per CONTEXT)

CONTEXT D-06 sample: `pre-v2-snapshot-${timestamp}.json` con `timestamp` = ISO no-colon (mismo helper que `cozyhabits-pre-restore-`). En caso de re-run (migration falla, app reabre, intenta de nuevo): **recomendación de research:** **timestamped** (no overwrite) para preservar cada intento. Cleanup 30d post-éxito borra todos los que califiquen.

### Cleanup 30-day hook on boot (D-06)

Después de `if (user_version === 2)` (migration ya aplicada), en `initDatabase()`:

```ts
async function cleanupPreV2Snapshots(): Promise<void> {
  try {
    const dir = FileSystem.documentDirectory;
    if (!dir) return;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const entries = await FileSystem.readDirectoryAsync(dir);
    for (const name of entries) {
      if (!name.startsWith('pre-v2-snapshot-')) continue;
      const info = await FileSystem.getInfoAsync(`${dir}${name}`);
      // info.modificationTime es seconds desde epoch en legacy API
      const mtime = (info as { modificationTime?: number }).modificationTime;
      if (mtime != null && mtime * 1000 < cutoff) {
        await FileSystem.deleteAsync(`${dir}${name}`, { idempotent: true });
      }
    }
  } catch (err) {
    console.warn('[cleanupPreV2Snapshots] cleanup skipped', err);
  }
}
```

Llamado desde `initDatabase()` post-migration o desde un `useEffect` en `App.tsx` tras `initDatabase()`. Planner decide ubicación.

### Pitfalls cruzadas

- **Pitfall #4 (Backup version skew)** PITFALLS.md: el snapshot pre-v2 es shape v1, así que puede recuperarse via el dispatcher v1→v2 del propio restore (D-05 punto: el botón "Restore" de la error screen lo ofrece). Loop cerrado.
- **Privacy / security (PITFALLS.md "Security Mistakes")**: snapshot contiene mood/notes en plano. CONTEXT deferred items explícitamente difiere encryption. OK.

### Open questions for planner

- Si `${documentDirectory}` retorna `null` (edge case raro en Expo legacy), ¿bloquear migration o fallar gracioso (skip snapshot, continuar con migration confiando en atomic transaction)? Recomendación: blocking — D-06 marca el snapshot como **determinístico**.
- ¿El snapshot pre-v2 cuenta como "backup automático" para una UI futura que muestre "tu último backup fue X"? Out of Phase 1 scope.

---

## 6. Error Screen (D-05)

### Integration point en `App.tsx`

`App.tsx` actual (164 líneas, leído íntegro): la cadena de boot es:

```ts
useEffect(() => {
  initDatabase()
    .then(() => checkAndBackfillHistory())
    .then(() => __DEV__ && console.log('DB inicializada y backfill completado'))
    .catch((err) => console.error('Error inicializando DB:', err));
}, []);
```

Render condicional actual:
```ts
if (!fontsLoaded && !fontError) { return <LoadingScreen /> }
return (<SafeAreaProvider><NavigationContainer>...</NavigationContainer></SafeAreaProvider>);
```

### Cambio mínimo para D-05

Agregar un **state observable** que captura el resultado de la migration v2:

```ts
type MigrationState =
  | { status: 'pending' }
  | { status: 'ok' }
  | { status: 'failed'; error: unknown };

const [migrationState, setMigrationState] = useState<MigrationState>({ status: 'pending' });

useEffect(() => {
  initDatabase()
    .then(() => checkAndBackfillHistory())
    .then(() => setMigrationState({ status: 'ok' }))
    .catch((err) => {
      console.error('Error inicializando DB:', err);
      setMigrationState({ status: 'failed', error: err });
    });
}, []);

if (migrationState.status === 'pending' || (!fontsLoaded && !fontError)) {
  return <LoadingScreen />;
}
if (migrationState.status === 'failed') {
  return <MigrationErrorScreen error={migrationState.error} onRetry={() => { /* ... */ }} />;
}
// status === 'ok' → render navigator normal
```

### Cómo `initDatabase()` señaliza el fallo

Hoy `runMigrations` se traga el error (`console.error` y continúa). D-05 requiere que la migration v2 **propague** el throw. Recomendación research:

```ts
// migrationV2.ts
async function migrationV2_addWellbeingTables(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    await db.withTransactionAsync(async () => { /* ... */ });
  } catch (err) {
    console.error('[migration v2] schema migration falló — rollback aplicado', err);
    throw err;   // <— NUEVO vs. v1 pattern
  }
}
```

Y `initDatabase()` no captura el throw, lo deja propagar a `App.tsx`'s `.catch`.

**Compatibilidad con `migrationV1` (silent log):** `runMigrations` corre v1 primero. Si la DB ya tiene `user_version >= 1` (todos los usuarios de v1.0 shipped), v1 no entra en el branch. Si la DB es fresh (instalación nueva en v1.1), v1 corre y aplica — su silent-log behavior se preserva, pero un fallo silencioso de v1 ANTES de v2 dejaría la DB en estado inconsistente (CREATE INDEX falló pero seguimos a v2 → v2 falla con FK error → blocking screen). Recomendación: **revisar si v1 también debe propagar throw bajo el nuevo régimen v1.1.** Decisión de planner — más conservador es hacer `runMigrations` entera fail-fast en v1.1, pero eso cambia behavior post-ship de v1.0.

### `<MigrationErrorScreen>` shape mínima (D-05)

CONTEXT D-05 explicita los elementos. Planner aterriza UI exacta. Esqueleto:

```tsx
interface MigrationErrorScreenProps {
  error: unknown;
  onRetry: () => void;
}

function MigrationErrorScreen({ error, onRetry }: MigrationErrorScreenProps) {
  return (
    <View>
      <Text>No se pudo actualizar la base de datos.</Text>
      <Pressable onPress={() => /* navega a flow de restore (Drive o pre-v2 snapshot) */}>
        <Text>Restaurar desde backup</Text>
      </Pressable>
      <Pressable onPress={onRetry}>
        <Text>Reintentar migración</Text>
      </Pressable>
      {/* opcional: link a info técnica */}
    </View>
  );
}
```

CONTEXT specifics: "el botón 'Restore' de la error screen puede ofrecer **primero** el snapshot local pre-v2 (one-tap recovery), y como fallback el flow de Drive restore." Planner aterriza la UX de elección (auto-select pre-v2 si existe; mostrar opción Drive si no).

### Retry logic

El botón "Reintentar migración" debe:
1. Set `migrationState` a `{ status: 'pending' }`.
2. Re-ejecutar `initDatabase()`.

Como la migration v2 es idempotente vía `PRAGMA user_version` check, un retry post-fix (ej. usuario recuperó espacio en disco) corre la migration fresh sin re-aplicar nada que ya esté aplicado. **Pero:** si el throw original sucedió DESPUÉS de un partial commit (no debería — `withTransactionAsync` hace rollback), el state queda en `user_version < 2` y la migration reintenta limpia. La transaction garantiza no partial state.

### Pitfalls cruzadas

- **Pitfall #4 / #5 backup recovery loop**: el botón "Restore" lleva al flow del restore que usa el dispatcher v1→v2 — el dispatcher mismo NO requiere que la migration v2 haya corrido, porque el restore reescribe la DB y aplica el INSERT al `mood_log` directamente. **Open question planner:** ¿el restore desde la error screen primero debe ASEGURARSE de que las tablas existan? Si la migration v2 fallaba creando tablas, restoring necesita crearlas. Recomendación: el restore flow ejecuta su propio `CREATE TABLE IF NOT EXISTS` defensivo, O ejecuta `runMigrations` antes de aplicar. Decisión planner.

### Open questions for planner

- ¿La error screen es navegable (tipo NavigationContainer wrapping) o un componente plano fuera del navigator? Recomendación: plano. No requiere navegación. El restore flow puede ser un modal local en la error screen, no una pantalla del Stack navigator.
- ¿Telemetría del error (opcional info técnica)? CONTEXT lo lista como opcional. Recomendación: solo mostrar `error.message` si es Error; sino "Error desconocido". No exfiltrar PII (notes, mood values) — el error es de schema, no de data.

---

## 7. Drafts Table Semantics (D-04)

### SQL shape (de research/ARCHITECTURE.md §2)

```sql
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                      -- 'morning'|'evening'|'note'|'weekly_review'
  key TEXT NOT NULL,                       -- date_key, week_key, or note_id
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_drafts_kind_key ON drafts(kind, key);
```

Esta tabla se crea en migration v2 (FOUND-03). Solo la **tabla** + index existen en Phase 1; el consumo concreto desde modals viene en Phase 2/4.

### Draft key strategy (D-04)

CONTEXT D-04 distingue tres tipos de draft:

| Surface | Kind | Key |
|---------|------|-----|
| Morning check-in | `'morning'` | `date_key` (YYYY-MM-DD, hoy) |
| Evening check-in | `'evening'` | `date_key` |
| Mood note | `'note'` | `note_id` (UUID generado cuando se abre el modal de nueva nota) — porque hay N por día |
| Weekly review | `'weekly_review'` | `week_key` (ISO YYYY-Www) |

El `UNIQUE(kind, key)` garantiza máximo 1 draft por (kind, key). Repetidos updates al mismo draft = UPSERT (single statement).

### Repository (Phase 1 scope)

`src/repositories/draftsRepository.ts` (NEW). API mínima per CONTEXT (consumida solo en Phase 2/4):

```ts
export async function upsert(kind: string, key: string, payloadJson: string): Promise<void>;
export async function find(kind: string, key: string): Promise<{ payload_json: string; updated_at: string } | null>;
export async function deleteOne(kind: string, key: string): Promise<void>;
export async function purgeOlderThan(cutoffIso: string): Promise<void>;   // for boot purge
```

SQL constants al tope (convención CONVENTIONS.md). Sin business logic.

### Service (Phase 1 scope)

Recomendación: NO crear `draftsService.ts` en Phase 1. El service viene cuando hay surface que lo consume (Phase 2). En Phase 1 solo la tabla + repo + el **purge hook al boot**.

### Boot purge >7 días (D-04)

En `initDatabase()`, después de la migration v2 OK:

```ts
async function purgeStaleDrafts(): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await draftsRepo.purgeOlderThan(sevenDaysAgo);
}
```

`purgeOlderThan` ejecuta `DELETE FROM drafts WHERE updated_at < ?`. Una sola query, ~O(N) sobre la tabla (que es chica por design). Sin index sobre `updated_at` — overkill para una tabla que crece linealmente con drafts simultáneos.

### Debounce 500ms (D-04 + PITFALLS Pitfall #11)

Es un detalle de implementación del **hook consumer**, no de Phase 1 scope estricto. Recomendación: el planner crea un hook `useDraftAutosave(kind, key, payload)` en Phase 2 que internamente hace `setTimeout(() => repo.upsert(...), 500)` con cleanup. Phase 1 solo necesita la tabla.

**Pero CONTEXT pide que Phase 1 establezca las primitivas — el planner puede incluir el hook reusable como entregable de Phase 1 si quiere garantizar paridad.** Recomendación: incluir un `src/hooks/useDraftAutosave.ts` (NEW) en Phase 1 con la lógica genérica, sin uso aún. Tested con un fake repo en unit test.

### Edge case: drafts con date_key/week_key huérfanos (D-04)

CONTEXT D-04 explicita: "NO se purgan automáticamente — el modal de cada surface decide qué hacer". Phase 1 no resuelve este caso. **El planner debe asegurarse de que esto quede documentado en `tone-of-voice.md` o en un comentario inline del repo** para que Phase 2/4 no inventen comportamientos divergentes.

### Pitfalls cruzadas

- **Pitfall #11 (Mid-entry data loss)** PITFALLS.md: este phase **es** la mitigación (tabla + purge + autosave primitive). Concrete surfaces (Phase 2/4) cierran el loop.

### Open questions for planner

- ¿El `purge >7d` se ejecuta antes o después de cargar `useEmotionalStore` (Phase 2)? Antes — purge solo toca drafts, el store reads no dependen.
- ¿Falla del purge = silent log o block? Silent log. Es housekeeping, no crítico.

---

## 8. Test Strategy (Nyquist Dimension 8)

Mapeo requirement → validation. Framework: Jest 30.3.0 + better-sqlite3 in-memory (per `.planning/codebase/TESTING.md`). Test commands en `Validation Architecture` abajo.

| REQ-ID | Behavior | Test Type | Concrete validation | Existing file? |
|--------|----------|-----------|---------------------|----------------|
| FOUND-01 | `getLocalDayKey()` único helper | unit + grep | (a) Port `db.test.ts` → `dateUtils.test.ts` con todos los tests cross-midnight. (b) `npm test` post-codemod sin regresiones. (c) `grep -rn "getTodayPrefix" src/` = 0 matches. (d) `grep -rn "new Date().toISOString().slice(0,10)" src/` = 0 matches. | `db.test.ts` se reescribe; rest de tests existentes deben pasar con mock targets actualizados |
| FOUND-02 | `<MoodPicker>` shared component | unit (snapshot + interaction) | New `MoodPicker.test.tsx` — renderiza con value=5, on slider change calls onChange. Sin existing UI test infra (research/codebase/TESTING.md "E2E not implemented") — usar `@testing-library/react-native` si está disponible, sino test de la pure function `moodLabelFor` y dejar UI a UAT. | NEW file |
| FOUND-03 | DB en user_version=2 con 4 tablas; migration atómica | unit (forward + idempotency + rollback) | New `migrationV2.test.ts` siguiendo template `migrationV1.test.ts` exacto: (a) forward — pre: user_version=1, post: =2 y 4 tablas existen. (b) idempotency — 2x runMigrations no cambia estado. (c) rollback — forzar throw en INSERT...SELECT → user_version stays 1 y `mood_entries` preservada. (d) data integrity — count rows en `mood_entries` pre-migration == count rows con `kind='reflection'` en `mood_log` post. | NEW file. **Wave 0 gap:** extend `testDatabase.ts` con `createPreMigrationV2TestDatabase()` que crea el schema con user_version=1 + `mood_entries` populadas, **sin** las 4 tablas nuevas |
| FOUND-04 | BACKUP_VERSION=2 + v1→v2 dispatcher | unit (forward + reverse) | New `backupV1toV2.test.ts`: (a) v1 backup JSON fixture → `parseAndValidate` → `restoreData` → DB tiene `mood_log` con `kind='reflection'` y count == fixture `mood_entries.length`. (b) v2 backup round-trip — `buildBackupData` → JSON → `parseAndValidate` → identical shape. (c) v3 backup rejection — `parseAndValidate({version:3,...})` throws. | NEW file. Existing fixture pattern: `driveBackupService.restore.test.ts` (uses `SAMPLE_BACKUP` constant) |
| FOUND-05 | drafts table + autosave | unit | New `drafts.test.ts`: (a) upsert + find round-trip. (b) UNIQUE(kind, key) enforced — dos `upsert('morning','2026-05-12', ...)` resultan en una sola row con el último payload. (c) `purgeOlderThan` borra rows con updated_at < cutoff. (d) hook `useDraftAutosave` — debounce 500ms test con `jest.useFakeTimers()`. | NEW file |
| FOUND-06 | Reflection flow paridad UX | UAT (manual) | Sin test automatizado — la paridad UX es perceptual. UAT script en `01-HUMAN-UAT.md` (planner crea): completar 1 hábito con reflection (mood + comentario), verificar (a) mismo modal visual, (b) mismo points awarded, (c) historial muestra el registro, (d) DB has 1 row en `mood_log` con `kind='reflection'`, `habit_id` = el hábito, `mood_value` = lo que el slider mostraba | NEW UAT scenario |

### Additional cross-cutting tests

- **App.tsx boot sequence with migration failure** — Hard de testear (App.tsx mount integration). Recomendación: extract `bootSequence(initFn, onMigrationOk, onMigrationFail)` a un módulo testable; App.tsx solo orquesta. **Open for planner.**
- **Pre-v2 snapshot generation** — unit test que mockea `FileSystem.writeAsStringAsync` y verifica que el path matches `${documentDirectory}/pre-v2-snapshot-*.json` y que el JSON parseado es version=1 con `mood_entries` populadas.

### Wave 0 gaps (must land before test wave)

- [ ] `src/__tests__/setup/testDatabase.ts` — agregar `createPreMigrationV2TestDatabase()` (schema v1 + user_version=1 + sample mood_entries data).
- [ ] `src/__tests__/setup/testDatabase.ts` — agregar `createPostMigrationV2TestDatabase()` (schema v2 + user_version=2 + 4 tablas vacías).
- [ ] `src/__tests__/dateUtils.test.ts` (NEW file) — port de `db.test.ts`.
- [ ] `src/__tests__/migrationV2.test.ts` (NEW).
- [ ] `src/__tests__/backupV1toV2.test.ts` (NEW).
- [ ] `src/__tests__/drafts.test.ts` (NEW).
- [ ] `src/__tests__/MoodPicker.test.tsx` (NEW; opcional si UI test infra falta — degrade a UAT).

---

## 9. `tone-of-voice.md` Content Scaffold (D-07)

Ubicación: `.planning/docs/tone-of-voice.md` (NEW). Target length: 1-2 páginas. Consumido por Phase 2 + Phase 5.

### Scaffold propuesto (planner refina)

```markdown
# Tone of Voice — Cozy Habits v1.1

**Audience:** writers, designers, devs creating copy for v1.1 wellbeing features.
**Status:** living document. Evoluciona con cada surface implementada.

## 1. Principios negativos (NO hacer)

- No usar "te extrañamos", "volvé pronto", "no te olvides" — manipulación parasocial.
- No mostrar streaks ("12 días seguidos"), badges, ni achievements emocionales.
- No usar "missed" / "perdido" / "saltado" para días sin entrada — shaming.
- No comparar al usuario consigo mismo en sentido evaluativo ("tu mood bajó respecto a la semana pasada").
- No comparar al usuario con otros — wellbeing es individual.
- No urgencia falsa ("¡última oportunidad!", "antes de medianoche") — wellbeing no tiene deadlines.
- No frasear el mood en términos morales ("mood bajo" como problema, "mood alto" como éxito).
- No requerir un mood value para escribir una nota — a veces la persona solo quiere escribir.

## 2. Principios positivos (SÍ hacer)

- Voz: empática, serena, en segunda persona neutral. Convención existente del proyecto: **vos** (rioplatense, ver es-AR locale). Mantener.
- Lenguaje accionable sin presión: "Registrá tu mood" sí; "Tenés que registrar tu mood" no.
- Descriptivo, no diagnóstico: "Hoy registraste mood 7" sí; "Tuviste un buen día" no (la app no juzga).
- Validar al usuario sin elogiar la acción: el usuario decide qué significa lo que escribe.
- Si la app sugiere algo, sugerir como invitación, no como obligación.

## 3. Empty states

- Nunca culposas. Nunca recriminan ausencia.
- Ofrecen una acción concreta cuando aplica; sino, neutralidad.
- Ejemplos:
  - "Sin entrada para hoy" (✓) vs. "No registraste nada" (✗).
  - "Cuando registres mood, lo vas a ver acá" (✓) vs. "Te falta registrar mood" (✗).
- Días vacíos en timeline/journal: render neutral. Ningún ícono rojo ni alerta.

## 4. Glosario mínimo (v1.1)

| Término app | Significado | Notes |
|-------------|-------------|-------|
| ánimo / mood | el campo numérico de mood [1,10] | "mood" en código/DB; "ánimo" en UI cuando suena natural |
| nota | entrada libre con mood + texto | NOTE feature |
| frase de cabecera | quote en text_library | PHRA feature (Issue #20) |
| revisión semanal | weekly review | REVI feature |
| sueño | horas de sueño 0–14, step 0.25 | morning check-in |
| reflexión | comentario asociado a habit completion (legacy v1) | mood_log.kind='reflection' post-Phase-1 |

## 5. Notificaciones (Phase 5)

- Copy neutral, fáctico, en infinitivo o imperativo amable.
- Ejemplos OK: "Registrar mood matutino", "Tu revisión semanal está disponible".
- Ejemplos NO: "¡No te olvides de tu check-in!", "Cozy te extraña", "Llevás 3 días sin registrar".
- Notification body NUNCA incluye el contenido user-typed (privacy — PITFALLS Security).
```

### Open questions for planner

- ¿Glosario lifecycle? CONTEXT difiere "glosario completo" — el planner aterriza dónde vive el growing glosario (en el doc mismo o en un appendix separado).
- ¿El doc se traduce a otros idiomas en el futuro? Out of scope v1.1. Documentar como "currently es-AR only".

---

## 10. Validation Architecture (Nyquist Dim 8 — required per config.nyquist_validation=true)

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30.3.0 + ts-jest |
| Config file | `jest.config.js` |
| Quick run command | `npm test -- --testPathPattern='dateUtils\|migrationV2\|drafts\|MoodPicker\|backupV1toV2'` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| FOUND-01 | getLocalDayKey + family in utils/date.ts | unit + grep | `npm test -- --testPathPattern=dateUtils` + grep check post-codemod | ❌ Wave 0 |
| FOUND-02 | MoodPicker shared component | unit (or UAT) | `npm test -- --testPathPattern=MoodPicker` | ❌ Wave 0 |
| FOUND-03 forward | migration v2 forward path | unit | `npm test -- --testPathPattern=migrationV2 -t "forward"` | ❌ Wave 0 |
| FOUND-03 idempotency | 2x runMigrations no-op | unit | `npm test -- --testPathPattern=migrationV2 -t "idempotency"` | ❌ Wave 0 |
| FOUND-03 rollback | forced throw → user_version stays 1 | unit | `npm test -- --testPathPattern=migrationV2 -t "rollback"` | ❌ Wave 0 |
| FOUND-04 v1→v2 | v1 backup restores into mood_log kind=reflection | unit | `npm test -- --testPathPattern=backupV1toV2 -t "v1 forward"` | ❌ Wave 0 |
| FOUND-04 v2 roundtrip | v2 backup buildBackupData → parse → restore | unit | `npm test -- --testPathPattern=backupV1toV2 -t "round-trip"` | ❌ Wave 0 |
| FOUND-05 drafts CRUD | upsert + find + delete + purge | unit | `npm test -- --testPathPattern=drafts` | ❌ Wave 0 |
| FOUND-05 autosave debounce | hook debounces 500ms | unit (fake timers) | `npm test -- --testPathPattern=drafts -t "debounce"` | ❌ Wave 0 |
| FOUND-06 reflection parity | manual UAT | manual | `01-HUMAN-UAT.md` scenario | ❌ Wave 0 |
| D-05 error screen | App.tsx renders MigrationErrorScreen on throw | integration or UAT | Depends on bootSequence extractability — fallback UAT | ❌ Wave 0 |
| D-06 pre-v2 snapshot | snapshot file written pre-migration | unit (FileSystem mocked) | `npm test -- --testPathPattern=migrationV2 -t "pre-v2 snapshot"` | ❌ Wave 0 |
| D-06 cleanup 30d | stale snapshots purged on boot | unit | `npm test -- --testPathPattern=migrationV2 -t "cleanup 30"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- --testPathPattern='<changed_area>'` (quick subset).
- **Per wave merge:** `npm test` (full suite).
- **Phase gate:** full suite green + UAT FOUND-06 scenario passed before `/gsd-verify-work`.

### Wave 0 Gaps (must land before implementation waves)

- [ ] `src/__tests__/setup/testDatabase.ts` — agregar `createPreMigrationV2TestDatabase()` y `createPostMigrationV2TestDatabase()`.
- [ ] `src/__tests__/dateUtils.test.ts` — port de `db.test.ts` + cross-midnight cases.
- [ ] `src/__tests__/migrationV2.test.ts` — forward/idempotency/rollback/data-integrity/snapshot/cleanup.
- [ ] `src/__tests__/backupV1toV2.test.ts` — v1 forward + v2 roundtrip + v3 rejection.
- [ ] `src/__tests__/drafts.test.ts` — CRUD + purge + debounce.
- [ ] `src/__tests__/MoodPicker.test.tsx` (if UI test infra available) — value + onChange + disabled.
- [ ] `.planning/milestones/v1.1-phases/01-foundation/01-HUMAN-UAT.md` — FOUND-06 parity scenario + D-05 error screen scenario (forzar fallo manualmente).

---

## 11. Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | N/A — local-first app, no user accounts |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A — single user device |
| V5 Input Validation | yes | TypeScript types + runtime guards en `parseAndValidate` (existing pattern) |
| V6 Cryptography | no | Phase 1 sin secrets; encryption deferred (CONTEXT Deferred) |
| V7 Error Handling | yes | No exfiltrar PII (mood/notes) en `console.error`; mensajes de error de migration NO incluyen row contents (PITFALLS Security Mistakes) |
| V8 Data Protection | partial | Snapshot pre-v2 vive en app sandbox sin encryption (CONTEXT Deferred decision). Aceptado riesgo. |
| V9 Communication | no | Sin network en Phase 1 scope (Drive flow no se toca) |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Migration throws con row data en stack trace → logs leakean PII | Information Disclosure | `console.error` solo de IDs / counts / error message; nunca row payloads (PITFALLS Security Mistakes) |
| Pre-v2 snapshot file readable por otra app via root device | Information Disclosure | Deferred — encryption no es phase 1 scope; documentado en CONTEXT Deferred. |
| User restaura backup tampered (e.g., con malformed timestamps) → migration v2 falla | Tampering | `parseAndValidate` strict types + INSERT...SELECT data integrity assertion within transaction → rollback |
| FK constraint via habit_id en mood_log puede romper si user borra habit mid-migration | Tampering / Bug | FK definido como `ON DELETE SET NULL` (research/ARCHITECTURE.md §2 SQL); migration v2 NO toca habits |

---

## 12. Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `expo-sqlite` | Migration v2, drafts | ✓ | (existing in package.json) | — |
| `expo-file-system/legacy` | Pre-v2 snapshot, cleanup | ✓ | (existing — used by `backupService`) | — |
| `expo-crypto` | UUIDs | ✓ | (existing — `randomUUID` in `db.ts:9`) | — |
| `@react-native-community/slider` | MoodPicker | ✓ | (existing — used by `ReflectionModal`) | — |
| `better-sqlite3` | Tests | ✓ | (existing — `__mocks__/expo-sqlite.ts`) | — |
| Jest + ts-jest | Tests | ✓ | 30.3.0 | — |
| `@testing-library/react-native` | MoodPicker UI test | ❓ | Verify in `package.json` | Fallback: degrade FOUND-02 a UAT |

**Missing dependencies:** Ninguna confirmada. El planner verifica `@testing-library/react-native` antes de comprometerse al test de MoodPicker.

---

## 13. Project Constraints (from CLAUDE.md)

Directivas obligatorias del proyecto, extraídas de `./.claude/CLAUDE.md`:

- **Planning obligatorio antes de código** — tasks pequeñas, decisiones consultadas. (Trivial: este research alimenta el plan.)
- **Cada functionality define:** comportamiento, criterios de verificación, casos borde, implementar y validar tests. (Cubierto por §8 + §10.)
- **No duplicar código** — el codemod D-01 elimina drift, no introduce.
- **Refactor si función > 20 líneas** — `parseAndValidate` actual son ~40 líneas; el cambio para dispatcher v1→v2 lo crece. Recomendación planner: extraer `parseV1` / `parseV2` helpers.
- **Separar lógica y presentación** — `<MoodPicker>` (presentación) + `src/config/mood.ts` (lógica/SoT) — alineado.
- **Sin inline styling, CSS separado, parametrizar colores** — `MoodPicker.styles.ts` separado; colors heredados de `ui.styles` existing pattern.
- **Actualizar archivos .md desactualizados** — `STATE.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md` deben actualizarse post-phase para reflejar las nuevas tablas + utils/date.ts.
- **`build-apk-local` para cualquier APK build** — N/A en Phase 1 (sin device QA estricto, paridad UX se valida en emulator/Expo Go con Reflection flow).
- **Self-improvement loop con `tasks/lessons.md`** — N/A en research stage.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `formatDateStr` que CONTEXT D-01 menciona es el `dateToPrefix` actual de `dateHelpers.ts` (no existe símbolo literal `formatDateStr` en el codebase). | §2 | Naming inconsistency — planner resuelve renombrando o ajustando D-01 wording. |
| A2 | `MOOD_LABELS = ['muyMal', 'mal', 'neutral', 'bien', 'muyBien']` y rangos asociados son razonables. | §3 | El planner / discuss-phase puede decidir labels diferentes; impacto puramente cosmético. |
| A3 | El cleanup 30d del pre-v2 snapshot usa `modificationTime` del FileSystem legacy API. La propiedad existe en SDK 54 legacy. | §5 | Si no existe, fallback a parsear el timestamp del filename. Bajo riesgo. |
| A4 | `runMigrations` puede modificarse para propagar throw en v2 sin romper el shipped v1 behavior (v1 ya no entra en re-runs porque user_version >= 1 en todos los devices upgrading). | §1, §6 | Si hay un device con user_version=0 en producción (instalación fresca de v1.0 nunca abrió la app), v1 corre + v2 corre fresh. Si v1 falla en silent, v2 throws — error screen muestra. Recovery vía pre-v2 snapshot no aplica (no había mood_entries). El flujo Drive restore sigue siendo viable. Aceptable. |
| A5 | `@testing-library/react-native` está instalada. | §8, §10 | Si no, FOUND-02 degrada a UAT. Verificable en package.json. |
| A6 | El UAT FOUND-06 paridad puede ejecutarse contra emulator/Expo Go (sin requerir `build-apk-local`). | §8 | Si requiere device build, agregar 1 paso al UAT scenario. |
| A7 | El nombre canónico `getLocalDayKey` es preferido sobre alias temporal `getTodayPrefix`. CONTEXT D-01 dice "rename total" → asumimos sin alias. | §2 | Si el planner prefiere alias deprecation period, ajuste de codemod. |
| A8 | Bumping `BACKUP_VERSION` y la migration v2 en el mismo commit no rompe las UAT deferred pendientes de v1.0 Phases 02/03/04. | §4 | Verificación trivial — planner relee deferred UATs (STATE.md). |
| A9 | `MoodPicker` no requiere prop `size` ni `comment`. CONTEXT D-02 lo explicita. | §3 | Si Phase 2 necesita variante, agregar prop ahí. YAGNI. |

---

## Open Questions for Planner

1. **Codemod alias durante deprecation period (A7).** ¿`getTodayPrefix` se mantiene como alias deprecated o se rename total? CONTEXT D-01 dice rename total. Asumido sin alias.
2. **`parseAndValidate` v3+ forward incompat policy.** Hoy throw genérico. Recomendación: mensaje "Backup más nuevo que la app — actualizá la app". Trivial, agregar.
3. **Pre-v2 snapshot fallure policy.** Si `writeAsStringAsync` falla, ¿bloquear la migration o continuar confiando en atomic transaction? Recomendación: bloquear (D-06 marca el snapshot como determinístico).
4. **Re-run del snapshot (collision policy).** Overwrite vs timestamped. Recomendación: timestamped.
5. **`runMigrations` failure propagation post-v1.1.** ¿v1 también propaga throw o se queda en silent log? Recomendación: dejar v1 en silent log (preserva v1.0 behavior); solo v2 propaga.
6. **Restore desde error screen.** ¿El flow ofrece pre-v2 snapshot primero o el usuario elige? Recomendación: auto-select pre-v2 si existe; mostrar opción Drive si no.
7. **Error screen como Stack screen vs componente plano.** Recomendación: plano (no requiere navegación).
8. **Telemetría del error.** ¿Mostrar `error.message` o solo "Error técnico"? Recomendación: `error.message` si es `instanceof Error`; sino genérico.
9. **`MoodPicker` UI test infra.** Verificar `@testing-library/react-native` en `package.json`; si falta, degradar FOUND-02 a UAT.
10. **`useDraftAutosave` hook entregable en Phase 1 o Phase 2?** CONTEXT marca Phase 1 como "primitivas"; el hook califica. Recomendación: incluir en Phase 1 con unit test, sin uso aún.
11. **`backupRepository` legacy SQL_*_MOODS cleanup.** ¿Eliminar las constants `SQL_ALL_MOODS`/`SQL_CLEAR_MOODS`/`SQL_INSERT_MOOD` en el mismo commit que la migration v2 o en un follow-up? Recomendación: mismo commit. Cualquier consumer existente se migra a `readAllMoodLog` filtrando por `kind='reflection'`.
12. **`bootSequence` extractable testability.** ¿Refactorizar `App.tsx` useEffect a un módulo aparte `src/services/bootSequence.ts` para poder testear migration failure → error screen integración? Recomendación: sí, mejora testability + aisla la responsabilidad. Costo: 1 archivo nuevo.
13. **Cleanup `dateHelpers.ts`.** ¿Mover todo a `utils/date.ts` y eliminar `dateHelpers.ts`, o mantener `dateHelpers.ts` con los formatters de UI (`formatTodayDate`, `formatHistoricDate`)? Recomendación: mover `dateToPrefix` (rename a `formatDateStr` si CONTEXT D-01 lo prefiere) a `date.ts`; dejar UI formatters donde están.

---

## Sources

### Primary (HIGH confidence — direct file reads)
- `.planning/milestones/v1.1-phases/01-foundation/01-CONTEXT.md` — 7 locked decisions
- `.planning/research/SUMMARY.md`, `.planning/research/ARCHITECTURE.md` §2 §5 §6, `.planning/research/PITFALLS.md` Pitfalls #1-#4 #11
- `.planning/REQUIREMENTS.md` — FOUND-01..06
- `src/services/db.ts` (218 líneas, leído íntegro)
- `src/services/migrations/migrationV1.ts` (80 líneas, leído íntegro)
- `src/services/backupService.ts` (155 líneas, leído íntegro)
- `src/services/driveBackupService.ts` (480 líneas, leído íntegro)
- `src/components/modals/ReflectionModal.tsx` + `.styles.ts`
- `src/config/constants.ts`
- `src/repositories/moodRepository.ts`, `src/repositories/backupRepository.ts`
- `src/utils/dateHelpers.ts`
- `src/__tests__/setup/testDatabase.ts`, `src/__tests__/db.test.ts`, `src/__tests__/migrationV1.test.ts`
- `App.tsx`
- `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/TESTING.md`
- `.planning/milestones/v1.0-phases/04-habit-creation-audit/04-CONTEXT.md`

### Secondary (MEDIUM)
- Grep results across `src/` para call sites de date helpers
- `.planning/config.json` — `nyquist_validation: true`
- `.claude/CLAUDE.md` — project constraints

### Tertiary (LOW — assumed)
- `@testing-library/react-native` availability — NOT verified in package.json (A5)
- FileSystem legacy `modificationTime` shape (A3)

---

## Metadata

**Confidence breakdown:**
- Migration v2 pattern: HIGH — pattern v1 ya en producción, deviaciones son aditivas y bien comprendidas
- Date helpers extraction: HIGH — inventory exacto via grep
- MoodPicker extraction: HIGH — código fuente leído íntegro
- Backup dispatcher: HIGH — código fuente leído íntegro; insertion points marcados con número de línea
- Pre-v2 snapshot: MEDIUM-HIGH — precedente directo (`writePreRestoreCache`); pequeñas adaptaciones de directorio + naming
- Error screen: MEDIUM-HIGH — pattern de boot React standard; el cambio en `runMigrations` para propagar throw es la única dimensión sin precedente directo en el repo
- Drafts semantics: HIGH — SQL ya en `ARCHITECTURE.md` §2; D-04 deja sólo edges cases para Phase 2
- Test strategy: HIGH — framework ya establecido; precedente directo `migrationV1.test.ts`
- `tone-of-voice.md`: MEDIUM — scaffold; el contenido fino sale del judgment del writer

**Research date:** 2026-05-12
**Valid until:** 2026-06-11 (30 days — estable; no fast-moving deps)

---

## RESEARCH COMPLETE

**Phase:** 01 - Foundation (v1.1 Bienestar emocional)
**Confidence:** HIGH

### Key Findings
- Patrón `migrationV1.ts` se replica directo para v2 con dos cambios sustantivos: (a) throw propagation para D-05 error screen, (b) pre-step `buildV1Snapshot()` para D-06 antes del transaction.
- Date helpers codemod tiene blast radius bajo (~10 archivos), todos identificados con número de línea. Existe un edge case con `dateToPrefix` (usa `toISOString().slice(0,10)` legítimamente sobre UTC dates) — recomendación: reescribir con `getUTCFullYear/getUTCMonth/getUTCDate` para hacer el grep ban absoluto.
- Backup dispatcher v1→v2: insertion points exactos en `parseAndValidate` (línea 115) y `restoreData` (línea 143-154). El mapeo `mood_entries → mood_log kind='reflection'` es paralelo al INSERT...SELECT de migration v2 — mismo código mental, en JS.
- Pre-v2 snapshot reusa pattern de `writePreRestoreCache` (Phase 3 v1.0) con 4 diferencias: `documentDirectory` (no cache), `pre-v2-snapshot-` prefix, builder dedicado `buildV1Snapshot()` (porque `buildBackupData()` ya retorna v2 post-bump), cleanup 30d post-success.
- D-05 error screen requiere que `runMigrations` propague throw para v2 únicamente; el state observable se setea en `App.tsx` useEffect catch handler. Sin navegación, componente plano.
- Drafts en Phase 1 = tabla + index + repo + boot purge >7d + (opcional) hook `useDraftAutosave`. El consumo concreto viene en Phase 2/4.

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Cero deps nuevas; todo reuse |
| Architecture | HIGH | Precedente directo Phase 4 v1.0 |
| Pitfalls | HIGH | Documentados en research/PITFALLS.md + mitigaciones identificadas |
| Test strategy | HIGH | Framework establecido + precedente `migrationV1.test.ts` |
| Pre-v2 snapshot | MEDIUM-HIGH | Pattern preexistente, adaptaciones menores |
| Error screen integration | MEDIUM-HIGH | Pattern React estándar; throw propagation es el unknown menor |

### Open Questions (full list in §"Open Questions for Planner")
13 questions logged — todas resolvibles por el planner sin re-discusión con usuario (la mayoría son detalles de implementación; ninguna invalida los 7 locked decisions de CONTEXT).

### Ready for Planning
Research complete. Planner can now create PLAN.md files. Recomendación de wave structure:
- **Wave 0:** Test infrastructure (testDatabase extensions, new test file scaffolds).
- **Wave 1:** Date helpers codemod (D-01) — bloquea todo lo demás.
- **Wave 2:** `src/config/mood.ts` + `<MoodPicker>` + `ReflectionModal` refactor (D-02 + D-03).
- **Wave 3:** Migration v2 + pre-v2 snapshot + backup v1→v2 dispatcher (FOUND-03 + FOUND-04 + D-06) — atómico, mismo commit lógico.
- **Wave 4:** Drafts table + repo + hook + boot purge (FOUND-05 + D-04).
- **Wave 5:** Error screen + `bootSequence` extractión (D-05).
- **Wave 6:** `tone-of-voice.md` (D-07) — independiente, paralelizable con cualquier wave.
- **Wave 7:** Doc updates (STATE.md, codebase/ARCHITECTURE.md, codebase/STRUCTURE.md) + UAT scenarios.
