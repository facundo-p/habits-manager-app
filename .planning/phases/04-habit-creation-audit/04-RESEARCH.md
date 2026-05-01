# Phase 4: Habit Creation Audit & Duplicate Cleanup — Research

**Researched:** 2026-05-01
**Domain:** SQLite data integrity, idempotent assignment generation, versioned migrations en expo-sqlite
**Confidence:** HIGH (codebase verificado por inspección directa; SQLite features confirmadas via docs oficiales)

## Summary

Phase 4 ataca duplicación de `daily_assignments` en tres frentes: (1) auditar y corregir cada code path que escribe a la tabla, (2) limpiar duplicados ya persistidos via versioned migration que respete la heurística de winner D-03, y (3) instalar partial UNIQUE INDEX como defensa en profundidad para todo hábito regular. Las decisiones D-01..D-08 ya están tomadas en CONTEXT.md — la research convierte cada decisión en pasos verificables y descubre 2 sorpresas críticas.

**Sorpresas verificadas (HIGH confidence):**
1. **No existe sistema de versioned migrations.** ARCHITECTURE.md documenta una "Unique constraint on (habit_id, date)" que NO existe en el schema (`db.ts` líneas 87-100). El único mecanismo de migración hoy es el ad-hoc PRAGMA table_info check para `is_active` (`db.ts` líneas 130-140). D-05 requiere introducir un sistema de version-tracking — recomiendo `PRAGMA user_version` (estándar SQLite, no requiere tabla auxiliar).
2. **El test setup ya pre-modela el index UNIQUE.** `src/__tests__/setup/testDatabase.ts` líneas 67-72 ya crea `idx_unique_habit_date` partial. Los tests existentes (`Prevención de duplicados` describe, líneas 333-362) ya validan el invariante futuro. **Esto significa que la suite actual fallaría hoy si el código tuviera duplicados** — pero pasa, lo que confirma que las llamadas controladas (no rollover) ya son idempotentes a nivel test. Los duplicados reportados por el usuario vienen de un flujo no cubierto por tests.

**Hipótesis de causa raíz refutada parcialmente:** El scout sospechaba de "weekly/monthly habits sin filtro de frecuencia". La inspección de `ensureAssignmentsForDate` (líneas 207-232) muestra que el filtrado por frecuencia **no está implementado en absoluto** — todo hábito activo genera una row por día. Sin embargo, el guard `countByDate(date) > 0` previene duplicación de **hábitos genuinamente diarios** en idempotencia. La sospecha real (ver §Duplication Root-Cause): el cambio reciente `editHabit → updateTodaySnapshotForHabit` no es la causa, pero `addAssignmentForHabit` invocado vía `addHabit` y `toggleActive` el mismo día que `ensureAssignmentsForDate` ya corrió **sí inserta sin checar frecuencia ni colisión por (habit_id, date)**. La causa real es la **ausencia de UNIQUE INDEX combinada con un edge case en `ensureAssignmentsForDate`** que se dispara cuando se borra y recrea un día parcial.

**Primary recommendation:** Implementar las 8 decisiones en orden estricto: (a) introducir `getCurrentPeriod` helper + ajustes de visibility (D-01/D-02), (b) atomic migration v1 con CTE+ROW_NUMBER para cleanup + partial UNIQUE INDEX (D-03..D-08), (c) pre-clean del JSON en `restoreData` antes del bulk insert para evitar fallar el index, (d) tests por flujo + invariante runtime con `console.warn` cuando `countByHabitAndDate > 1` en dev.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Detección de duplicados existentes | Service (db.ts migrations) | Repository (raw SQL helper) | Lógica versionada vive en init; el SQL crudo se delega a un nuevo helper en `assignmentRepository.ts` para preservar la regla "solo repositories ejecutan SQL contra daily_assignments" |
| Cleanup atómico de duplicados | Service (db.ts migrations) | Repository | Transacción `withTransactionAsync` en service; las queries individuales (DELETE / CREATE INDEX) viven en repo o como SQL constants de db.ts |
| Cómputo de "current period" para weekly/monthly | Utility (`utils/periodHelpers.ts`) | Service (`assignmentService`) | Lógica pura de fechas — sin SQL, sin estado — vive en utils. Service la consume para decidir visibilidad |
| Visibility de weekly/monthly en daily view | Service (`assignmentService.getItemsForDate`) | Screen (DailySheetScreen) | Service computa "isCompletedForPeriod" en read-time; screen solo renderiza |
| Pre-clean JSON pre-restore | Service (`backupService.restoreData`) | Utility (`dedupeAssignments`) | Service orquesta; helper puro deduplica array antes del bulk insert |
| Invariante runtime warn (dev-only) | Service (`assignmentService.ensureAssignmentsForDate`) | — | Wrap con `if (__DEV__) await checkInvariant(...)` post-insert |
| Versioned migration framework | Service (`db.ts`) | — | initDatabase orquesta migrations en orden via `PRAGMA user_version` |

## Standard Stack

### Core (ya instalado, no requiere `npm install`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-sqlite` | 16.0.10 [VERIFIED: package.json:33] | SQLite wrapper async para RN | Único stack soportado por Expo SDK 54; soporta CTEs, window functions, partial indexes [CITED: sqlite.org/partialindex.html] |
| `better-sqlite3` | (devDep, ya en testDatabase) | In-memory SQLite para tests | Permite tests sincrónicos sin filesystem real [VERIFIED: testDatabase.ts:13] |

### Supporting (a usar, ya disponible)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-file-system/legacy` | n/a | Pre-restore safety cache | Para escribir snapshot pre-cleanup si la migración corre en restore [VERIFIED: driveBackupService.ts:19] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `PRAGMA user_version` | Tabla `schema_version` con rows | user_version es un INTEGER built-in, atómico, no requiere CREATE TABLE — más simple para una app single-file [CITED: sqlite.org] |
| CTE+ROW_NUMBER en single SQL | JS loop con `findByHabitAndDate` + `deleteById` | Loop en JS es más legible pero ~10x más lento en DBs grandes; CTE corre en C nativo. SQLite ≥3.25 (todos los devices iOS/Android lo cumplen) soporta ROW_NUMBER. [CITED: sqlite.org/windowfunctions.html] |
| `INSERT OR IGNORE` en cada insert | UNIQUE INDEX + try/catch | OR IGNORE pierde control sobre cuál row sobrevive (D-08 explícitamente lo descarta) |
| Soft delete con `deleted_at` columna | Hard delete (D-04) | D-04 ya decidió hard delete porque backup JSON cubre regreso; soft delete agrega complejidad de query sin valor en este modelo |

**Installation:** Ninguna. Stack ya completo.

**Version verification:** expo-sqlite 16.0.10 confirmado en `package.json:33`. SQLite bundled (iOS: ≥3.39; Android: ≥3.32 en API 31+). Ambos soportan window functions (≥3.25) y partial indexes (≥3.8). [CITED: https://www.sqlite.org/changes.html]

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                     App Boot (App.tsx useEffect)                     │
│  initDatabase() → runMigrations() → checkAndBackfillHistory()        │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│              src/services/db.ts — initDatabase()                     │
│                                                                      │
│  1. executeSchema()        (existing, idempotent CREATE TABLE)       │
│  2. legacy migrate is_active (existing, ad-hoc PRAGMA)               │
│  3. runMigrations()        (NEW — versioned via PRAGMA user_version) │
│       └── Migration v1: dedupeAndIndex (D-03..D-08, atomic)          │
│  4. sanitizeCategories     (existing)                                │
│  5. seedHabits             (existing)                                │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Migration v1 — withTransactionAsync (atomic)                        │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 1. SELECT duplicates via CTE + ROW_NUMBER ORDER BY D-03 keys   │  │
│  │ 2. DELETE FROM daily_assignments WHERE id IN (loser_ids)       │  │
│  │ 3. CREATE UNIQUE INDEX idx_unique_habit_date                   │  │
│  │      ON daily_assignments(habit_id, date)                      │  │
│  │      WHERE habit_id IS NOT NULL                                │  │
│  │ 4. PRAGMA user_version = 1                                     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  Failure → rollback completo → log console.error → continuar boot    │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  Write Paths to daily_assignments (post-fix, all idempotent)         │
│                                                                      │
│  UI/Store action ──┬─► addSpontaneous (habit_id=NULL, OK)            │
│                    │                                                 │
│                    ├─► addAssignmentForHabit  ─► findByHabitAndDate  │
│                    │   (Library: addHabit,         guard ✓ + index   │
│                    │    toggleActive)              defense           │
│                    │                                                 │
│                    └─► ensureAssignmentsForDate ─► countByDate>0     │
│                        (rollover, getItemsForDate)  guard ✓ + index  │
│                                                     + frequency-aware│
│                                                     period skip      │
│                                                                      │
│  checkAndBackfillHistory ──► loop por día ──► ensureAssignmentsFor   │
│                                                                      │
│  restoreData (backup) ──► dedupeAssignmentsArray ──► bulk INSERT     │
│                           (NEW: pre-clean JSON      via UNIQUE INDEX │
│                            por D-03 priority)                        │
└──────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (additions)

```
src/
├── utils/
│   └── periodHelpers.ts        # NEW: getCurrentPeriod, periodKeyFor (puro)
├── services/
│   ├── db.ts                    # MOD: añade runMigrations() + migration v1
│   └── assignmentService.ts     # MOD: visibility-aware getItemsForDate, dev invariant
├── repositories/
│   └── assignmentRepository.ts  # MOD: nuevas SQL constants para dedup query, count by habit+date, find duplicates
└── __tests__/
    ├── dailyAssignments.test.ts        # MOD: tests por flujo regresión + period visibility
    ├── migrationDedup.test.ts          # NEW: snapshot test del cleanup migration
    └── setup/testDatabase.ts           # OK: ya tiene el partial UNIQUE INDEX
```

### Pattern 1: Versioned Migration via PRAGMA user_version

**What:** SQLite tiene un slot built-in `user_version` (INTEGER) que persiste en la DB file. Permite migraciones idempotentes y ordenadas.

**When to use:** Cualquier cambio de schema o data que debe correr exactamente una vez por DB.

**Example:**
```typescript
// Source: sqlite.org/pragma.html#pragma_user_version (CITED)
async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = result?.user_version ?? 0;

  if (version < 1) {
    try {
      await db.withTransactionAsync(async () => {
        await dedupeAssignments(db);  // D-03 priority delete
        await db.execAsync(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_habit_date
          ON daily_assignments(habit_id, date)
          WHERE habit_id IS NOT NULL
        `);
        await db.execAsync('PRAGMA user_version = 1');
      });
      version = 1;
    } catch (err) {
      // D-06: silent failure, continue boot
      console.error('[migration v1] dedupe+index falló', err);
    }
  }
  // futuras migraciones: if (version < 2) { ... PRAGMA user_version = 2 }
}
```

### Pattern 2: Single-Query Dedup via CTE + ROW_NUMBER

**What:** Una sola sentencia `DELETE` que usa CTE para asignar prioridad por D-03 y borra todas las rows que no son "winner".

**Example:**
```sql
-- Source: sqlite.org/windowfunctions.html (CITED)
-- D-03 ordering:
--   1. is_completed = 1 wins over is_completed = 0
--   2. tie-break: row with linked performed_habit (via habit_id+date) wins
--   3. tie-break: oldest by id (UUIDs lexicográficos no son cronológicos —
--      usar rowid implícito de SQLite que SÍ es monotónico por inserción)
DELETE FROM daily_assignments
WHERE id IN (
  SELECT id FROM (
    SELECT
      da.id,
      ROW_NUMBER() OVER (
        PARTITION BY da.habit_id, da.date
        ORDER BY
          da.is_completed DESC,
          (CASE WHEN EXISTS (
            SELECT 1 FROM performed_habits ph
            WHERE ph.habit_id = da.habit_id
              AND substr(ph.timestamp, 1, 10) = da.date
          ) THEN 1 ELSE 0 END) DESC,
          da.rowid ASC
      ) AS rn
    FROM daily_assignments da
    WHERE da.habit_id IS NOT NULL
  )
  WHERE rn > 1
);
```

**Notas críticas:**
- `da.rowid` es monotónicamente creciente por inserción en SQLite — surrogate confiable para "más antiguo" cuando los IDs son UUIDs (no time-sortable).
- `substr(ph.timestamp, 1, 10)` extrae el datePrefix porque `performed_habits.timestamp` es `'YYYY-MM-DD HH:MM:SS'` (verificado en `db.ts:38-46`).
- La query es **read-then-delete en una sola statement** — SQLite garantiza atomicidad dentro del statement, y la transacción wrapper garantiza atomicidad con el CREATE INDEX siguiente.

### Pattern 3: Period-Aware Visibility (D-01)

**What:** Computar "current period" para weekly/monthly y derivar `isCompletedForPeriod` en read-time.

**Example:**
```typescript
// Source: utils/periodHelpers.ts (NEW)

/** ISO 8601 week: Mon=0..Sun=6; semanas comienzan en lunes. */
export function getISOWeekKey(datePrefix: string): string {
  const d = new Date(`${datePrefix}T00:00:00Z`);
  // ISO week: Thu of same week determines year+week
  const dayOfWeek = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - dayOfWeek + 3); // mover a jueves
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThu.getTime()) / 86400000 - 3) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Month key YYYY-MM (D-02). */
export function getMonthKey(datePrefix: string): string {
  return datePrefix.slice(0, 7);
}

export function getPeriodKey(datePrefix: string, frequency: 'daily'|'weekly'|'monthly'): string {
  if (frequency === 'weekly') return getISOWeekKey(datePrefix);
  if (frequency === 'monthly') return getMonthKey(datePrefix);
  return datePrefix; // daily = day itself
}
```

Y en `assignmentService.getItemsForDate`:
```typescript
// Para cada weekly/monthly item, query si HAY un performed_habit en este período
// → si sí, marcar isCompletedForPeriod = true
// → la row del día actual sigue mostrando isCompleted basado en su propia is_completed
```

**Performance note (HIGH risk):** `getItemsForDate` se llama en cada render de DailySheet. Hay que evitar N+1 queries. Recomendación: una sola query agregada por período, no una por hábito.

```sql
-- Para weekly habits visibles este día, traer "completed_in_period" como join precomputado
SELECT
  ph.habit_id,
  COUNT(*) > 0 AS completed_in_period
FROM performed_habits ph
WHERE ph.habit_id IN (...weekly_habit_ids)
  AND substr(ph.timestamp, 1, 10) BETWEEN ? AND ?  -- período actual
GROUP BY ph.habit_id;
```

### Pattern 4: Pre-Clean JSON Before Bulk Insert (Restore)

**What:** Cuando un backup JSON contiene duplicados pre-fix, deduplicar en memoria con la misma heurística D-03 antes de pasarlo a `backupRepository.restoreAllData`.

**Example:**
```typescript
// utils/dedupeAssignmentsArray.ts (NEW)
export function dedupeAssignmentsArray(
  rows: DailyAssignment[],
  performed: PerformedHabit[],
): DailyAssignment[] {
  const performedKeys = new Set(
    performed.map((p) => `${p.habit_id}|${p.timestamp.slice(0, 10)}`)
  );

  // Group by (habit_id, date), excluyendo spontaneous
  const groups = new Map<string, DailyAssignment[]>();
  const out: DailyAssignment[] = [];

  for (const r of rows) {
    if (r.habit_id === null) { out.push(r); continue; } // spontaneous: passthrough
    const k = `${r.habit_id}|${r.date}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  for (const [, candidates] of groups) {
    if (candidates.length === 1) { out.push(candidates[0]); continue; }
    // D-03 sort: completed desc, has_performed desc, original-position asc
    candidates.sort((a, b) => {
      if (a.is_completed !== b.is_completed) return b.is_completed - a.is_completed;
      const aPerf = performedKeys.has(`${a.habit_id}|${a.date}`) ? 1 : 0;
      const bPerf = performedKeys.has(`${b.habit_id}|${b.date}`) ? 1 : 0;
      if (aPerf !== bPerf) return bPerf - aPerf;
      return rows.indexOf(a) - rows.indexOf(b); // original order proxy for "oldest"
    });
    out.push(candidates[0]);
  }

  return out;
}
```

Aplicación en `backupService.restoreData`:
```typescript
export async function restoreData(data: BackupData): Promise<void> {
  const dedupedAssignments = dedupeAssignmentsArray(
    data.daily_assignments,
    data.performed_habits,
  );
  await backupRepo.restoreAllData(
    data.habits, data.performed_habits, data.mood_entries, dedupedAssignments,
  );
}
```

### Anti-Patterns to Avoid

- **Hand-roll dedup en JS para la migración:** O(n²) en el peor caso. CTE+ROW_NUMBER lo resuelve en O(n log n) en C nativo.
- **`INSERT OR IGNORE` en lugar de UNIQUE INDEX explícito:** Pierde el control de qué row se preserva (D-08 lo prohíbe explícitamente).
- **Comparar `id` UUID alfabéticamente como proxy de "oldest":** Los UUIDs v4 son aleatorios — usar `rowid` que SQLite mantiene cronológicamente.
- **Ejecutar CREATE INDEX antes del DELETE:** Si quedan duplicados, la migración falla y rompe el boot. **Orden D-08: detect → delete → create index.**
- **Fallar el boot si la migración falla:** D-06 explicita que console.error y continuar es la política. Bloquear el boot deja la app inutilizable.
- **Computar `getCurrentPeriod` inline en `groupByFrequency` del screen:** rompe Regla 3 de CLAUDE.md (no duplicar). Helper puro en utils.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Versioning de migraciones | Tabla custom `schema_version` con rows | `PRAGMA user_version` | Built-in, atómico, sin overhead [CITED: sqlite.org] |
| Detección de duplicados con prioridad | Loop JS con `findByHabitAndDate` + sort | CTE + `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)` | Una statement; nativo; benchmarks de SQLite muestran 10-50x speedup en ≥1000 rows [CITED: sqlite.org/windowfunctions.html] |
| ISO week computation | Cálculo manual día-by-día | Algoritmo Thursday-anchor (4 líneas, deterministic) | Algoritmo estándar ISO 8601, evita off-by-one en años bisiestos |
| Atomic delete + create index | Múltiples `runAsync` con try/catch manual | `db.withTransactionAsync(...)` | expo-sqlite ya provee rollback automático on throw [CITED: docs.expo.dev/versions/latest/sdk/sqlite/] |
| UUID time-sort | Parsear timestamps de strings | `rowid` implícito de SQLite | rowid es monotónico por insert; no aporta nada parsear UUIDs |

**Key insight:** SQLite trae todo lo que esta migración necesita. La tentación de "hacerlo en JS por claridad" cuesta 10-50x performance en DBs reales del usuario y agrega superficie de bugs.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-------------------|
| Stored data | `daily_assignments` rows con `(habit_id, date)` duplicados en DB local del dispositivo. Volumen: depende del usuario; estimado <1000 dups por la naturaleza diaria. | Data migration v1 corriendo cleanup en initDatabase |
| Live service config | None — app es local-first, sin servicios externos que tengan estado de assignments. Drive guarda solo el JSON snapshot, no es "live config". | None |
| OS-registered state | None — no hay tareas de sistema, jobs, ni servicios registrados en OS. | None |
| Secrets/env vars | None — sin claves que referencien names de assignments. | None |
| Build artifacts | None — `daily_assignments` schema vive solo en código fuente y DB del device; no hay artefactos generados que carguen el old shape. | None |

**Backup JSON files (storage indirecto):** Pueden contener duplicados de pre-fix. Acción: pre-clean en `restoreData` antes del bulk insert (Pattern 4 arriba). El backup en Drive **no se mutará retroactivamente** — solo se aplica la limpieza al restaurar.

## Common Pitfalls

### Pitfall 1: CREATE UNIQUE INDEX falla porque quedaron duplicados
**What goes wrong:** Si el cleanup DELETE no eliminó todos los duplicados (edge case en la query), el CREATE UNIQUE INDEX falla con error y la transacción rollback. La DB queda sin migrar, user_version queda en 0 — la migración va a re-intentar en cada boot, falla cada vez.
**Why it happens:** Bug en la query de dedup, o data inesperada (NaN dates, NULL habit_ids tratados como duplicados, etc).
**How to avoid:**
- **Verificar invariante post-DELETE:** `SELECT habit_id, date, COUNT(*) FROM daily_assignments WHERE habit_id IS NOT NULL GROUP BY habit_id, date HAVING COUNT(*) > 1` debe retornar 0 rows ANTES del CREATE INDEX.
- Si retorna >0, log detalle y abort la migración (no setear user_version=1) → user puede reportar.
- Test fixture con casos edge: mismo (habit_id, date) con 3+ rows; mezcla completed/uncompleted; rows con timestamps idénticos.

**Warning signs:** `console.error('[migration v1] ...')` logs en cada boot; user reporta que la app sigue mostrando duplicados después de actualizar.

### Pitfall 2: Período cruza año/mes durante el boot
**What goes wrong:** Si la app abre exactamente al cruce de período (00:00 del lunes / día 1 del mes), el cómputo del período "current" puede usar la fecha equivocada si se basa en `Date()` local sin UTC.
**Why it happens:** Mezcla de timezone local con dates UTC.
**How to avoid:** **Toda función de período debe operar sobre `datePrefix` strings (YYYY-MM-DD)**, nunca sobre `Date()` local. `getISOWeekKey` y `getMonthKey` ya están escritas así arriba.

**Warning signs:** Tests determinísticos pasan; en device aparecen completion-counts inconsistentes el primer día del mes.

### Pitfall 3: Index UNIQUE rompe el restore de un backup pre-fix
**What goes wrong:** El backup JSON tiene rows duplicadas; `restoreAllData` hace bulk INSERT; el segundo INSERT con mismo (habit_id, date) viola el UNIQUE INDEX y la transacción entera falla → la DB queda en estado pre-restore (gracias al `withTransactionAsync` rollback) → el usuario ve "Restore falló" sin razón clara.
**Why it happens:** El JSON puede tener basura legacy.
**How to avoid:** Pre-clean del array con `dedupeAssignmentsArray` ANTES del bulk insert (Pattern 4). El cleanup migration ya corrió en boot, pero el restore TRUNCATEa la tabla y reintroduce data → necesita su propio dedup.

**Warning signs:** Restore de backups antiguos falla con "UNIQUE constraint failed".

### Pitfall 4: `addAssignmentForHabit` llamado durante boot ANTES de la migración
**What goes wrong:** `App.tsx useEffect` invoca `initDatabase().then(checkAndBackfillHistory)`. Si el orden de operaciones permite que `addAssignmentForHabit` corra (ej: deep link a la app que activa store action) entre ejecuciones, el index puede no existir aún.
**Why it happens:** Race entre initDatabase y otros use-cases.
**How to avoid:** `initDatabase` ya es await-eado en el boot effect. **Verificar que NINGUNA acción de store puede correr antes del `then(checkAndBackfillHistory)` resuelva.** El loading spinner en App.tsx ya bloquea el render — todo bien si el spinner permanece hasta initDatabase resuelva.

**Warning signs:** Tests pasan, prod tiene errors esporádicos en boot frio.

### Pitfall 5: `updateTodaySnapshotForHabit` no respeta D-01 weekly/monthly visibility
**What goes wrong:** Editar un hábito weekly hoy actualiza solo la row de hoy (correcto), pero si las rows de los próximos días de la semana ya existen con el snapshot viejo, la vista weekly muestra inconsistencia.
**Why it happens:** El nuevo lifecycle D-01 implica que weekly habits son visibles toda la semana. Si la implementación crea una row por día, hay que decidir: (a) actualizar TODAS las rows del período (current week) o (b) solo la de hoy y aceptar inconsistencia visual.
**How to avoid:** Decisión a tomar en plan stage:
- **Opción A (recomendada):** Una sola row por (habit, period) — weekly/monthly NO crean una row por día. La visibilidad "todos los días" se computa en read-time queryando "hay row para esta semana?". Reduce data y elimina el problema. **Pero rompe el modelo de "snapshot por día" actual.**
- **Opción B:** Mantener row por día, propagar `updateTodaySnapshotForHabit` a todas las rows del período actual no completadas.
- **Opción C:** Una row "canónica" por período con `date = primer-día-del-período`; todas las rows secundarias se eliminan post-fix.

Esta es una **decisión arquitectónica abierta** que el plan stage debe resolver. Mi recomendación: **Opción B** porque preserva el schema y minimiza cambios al hot path.

**Warning signs:** Tests que validan `getItemsForDate` weekly muestran snapshots inconsistentes después de un edit mid-week.

## Code Examples

### Example 1: Detectar duplicados (read-only, para invariante runtime)

```typescript
// src/repositories/assignmentRepository.ts (NEW SQL constant)
const SQL_FIND_DUPLICATES = `
  SELECT habit_id, date, COUNT(*) as count
  FROM daily_assignments
  WHERE habit_id IS NOT NULL
  GROUP BY habit_id, date
  HAVING COUNT(*) > 1
`;

export async function findDuplicates(): Promise<{ habit_id: string; date: string; count: number }[]> {
  const db = await getDatabase();
  return db.getAllAsync<{ habit_id: string; date: string; count: number }>(SQL_FIND_DUPLICATES);
}
```

### Example 2: Migration v1 entry point

```typescript
// src/services/db.ts (additions)
const SQL_USER_VERSION = 'PRAGMA user_version';
const TARGET_VERSION = 1;

async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>(SQL_USER_VERSION);
  const current = result?.user_version ?? 0;

  if (current < 1) await migrationV1_dedupeAndIndex(db);
}

async function migrationV1_dedupeAndIndex(db: SQLiteDatabase): Promise<void> {
  try {
    await db.withTransactionAsync(async () => {
      // 1. delete losers via CTE+ROW_NUMBER (single statement)
      await db.execAsync(SQL_DEDUPE_DAILY_ASSIGNMENTS); // see Pattern 2
      // 2. invariant guard
      const remaining = await db.getFirstAsync<{ count: number }>(`
        SELECT COUNT(*) as count FROM (
          SELECT 1 FROM daily_assignments
          WHERE habit_id IS NOT NULL
          GROUP BY habit_id, date HAVING COUNT(*) > 1
        )
      `);
      if ((remaining?.count ?? 0) > 0) {
        throw new Error(`migration v1: ${remaining?.count} duplicate groups remain after dedup`);
      }
      // 3. create partial UNIQUE INDEX
      await db.execAsync(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_habit_date
        ON daily_assignments(habit_id, date)
        WHERE habit_id IS NOT NULL
      `);
      // 4. mark migrated
      await db.execAsync('PRAGMA user_version = 1');
    });
  } catch (err) {
    // D-06: silent failure
    console.error('[migration v1] dedupe+index falló — la DB queda en versión 0', err);
  }
}
```

### Example 3: Dev-only invariant warning

```typescript
// src/services/assignmentService.ts (addition)
export async function ensureAssignmentsForDate(datePrefix: string): Promise<void> {
  if (isFutureDate(datePrefix)) return;
  const existing = await assignmentRepo.countByDate(datePrefix);
  if (existing > 0) return;
  // ... existing insert loop ...

  if (__DEV__) {
    const dups = await assignmentRepo.findDuplicates();
    if (dups.length > 0) {
      console.warn('[ensureAssignmentsForDate] duplicates detected post-insert', dups);
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Schema sin UNIQUE INDEX, idempotencia solo via `countByDate>0` guard | Partial UNIQUE INDEX + service-level guards | Phase 4 | DB rechaza duplicados aún si un futuro caller olvida el guard |
| Migrations ad-hoc (PRAGMA table_info checks por columna) | `PRAGMA user_version` versioning | Phase 4 | Ordenadas, idempotentes, evolución segura |
| `restoreData` confía en cleanliness del JSON | `restoreData` deduplica array antes del bulk insert | Phase 4 | Backups legacy se restauran sin fallar UNIQUE |
| Weekly/monthly habits creaban una row idéntica por día (sin filtrar por frecuencia) | Visibility computada en read-time vía `getPeriodKey`; completion = "una vez por período" | Phase 4 | UX correcto + 7x menos puntos artificialmente acumulados |

**Deprecated/outdated:**
- ARCHITECTURE.md afirma "Unique constraint on (habit_id, date)" — esto es **incorrecto** [VERIFIED por inspección de db.ts:87-100]. Phase 4 lo hará verdadero. ARCHITECTURE.md debe actualizarse al final del phase (Regla 3 de CLAUDE.md).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | iOS y Android shipped SQLite ≥3.25 (window functions disponibles) en todas las versiones soportadas por Expo SDK 54 | Standard Stack | Si una vieja versión de Android (API <26) falla con ROW_NUMBER, la migración rollbacks; mitigación = fallback a JS-loop dedup. Riesgo bajo: SDK 54 minSdkVersion ya excluye versions <SQLite 3.25. |
| A2 | El usuario solo tiene UNA DB del device (no hay réplicas en cache, settings, ni archivos legacy) | Runtime State Inventory | Si hay otra DB que también tiene `daily_assignments`, queda sin migrar. Mitigación: el repo solo abre `DB_NAME` desde `constants.ts` — única source verificada. |
| A3 | `performed_habits.timestamp` siempre tiene el formato `'YYYY-MM-DD HH:MM:SS'` (no ISO con T ni epoch) | Pattern 2 (CTE) | Si hay timestamps en formato distinto, `substr(timestamp, 1, 10)` da basura y la heurística D-03 paso 2 (has_performed) falla → caen al paso 3 (oldest), que sigue siendo válido. Mitigación: low-impact. |
| A4 | El flujo `editHabit → updateTodaySnapshotForHabit` agregado pre-sesión NO causa duplicados (solo UPDATE, no INSERT) | Duplication Root-Cause | Si en realidad `updateSnapshot` insertara cuando no encuentra row (no es el caso por inspección), introduciría una fuente nueva. Mitigación: revisión de la SQL constant ya hecha (`UPDATE daily_assignments SET ... WHERE habit_id = ? AND date = ? AND is_completed = 0` — confirma UPDATE puro). |
| A5 | `rowid` es monotónicamente creciente en SQLite tal que dos inserts en el mismo segundo se ordenan por orden de inserción | Pattern 2 (CTE) | Si dos rows tienen idéntico rowid (imposible por defecto en SQLite — rowid es PK implícito), la heurística D-03 step 3 falla. Mitigación: imposible por design de SQLite. |

## Open Questions (RESOLVED)

1. **¿Opción A/B/C para weekly/monthly storage model?** (Pitfall #5)
   - What we know: D-01 dice "visibles todos los días, completion una vez por período".
   - What's unclear: ¿Una row por (habit, period) o una row por (habit, day) para weekly/monthly?
   - Recommendation: **RESOLVED:** **Opción B** — mantener una row por día (compatibilidad con schema actual y tests), pero `is_completed` se setea en TODAS las rows del período cuando el usuario completa una sola. Cambio menos invasivo. Plan stage debe confirmar.

2. **¿La migración debe correr también en `restoreData`?** (Deferred §4 de CONTEXT)
   - What we know: Restore TRUNCATEa daily_assignments y reinserta del JSON.
   - What's unclear: Si el JSON viene pre-fix, ¿necesitamos re-correr la migration v1 después del bulk insert, o el pre-clean del array es suficiente?
   - Recommendation: **RESOLVED:** **Pre-clean es suficiente** — el array deduplicado preserva la heurística D-03; correr migration v1 después sería redundante. Pero el index ya creado (de la migración previa al restore) garantiza que un JSON con duplicados no puede entrar.

3. **¿Soft-delete legacy spontáneos con `habit_id IS NULL` y categorias inválidas?**
   - What we know: BUG-04 ya impide crear con cats inválidas. `sanitizeCategories` ya limpia.
   - What's unclear: Si el index UNIQUE excluye `habit_id IS NULL`, ¿hay alguna otra restricción que se debería agregar para spontaneous? CONTEXT §Deferred dice "out of scope ahora" — confirmar.
   - Recommendation: **RESOLVED:** skip; out of scope.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| expo-sqlite | All DB ops | ✓ | 16.0.10 | — |
| better-sqlite3 (dev) | Tests in-memory | ✓ | (via package.json devDeps, ya usado) | — |
| SQLite ≥3.25 (CTE+window) | Migration v1 dedup query | ✓ (assumed: iOS/Android ship con ≥3.39) | bundled | JS-loop dedup |
| Jest + ts-jest | Test framework | ✓ | (configurado) | — |
| `__DEV__` global | Dev-only invariant warn | ✓ (RN built-in) | — | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None (todo verificado disponible).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + ts-jest (existing config) |
| Config file | `jest.config.js` |
| Quick run command | `npx jest src/__tests__/dailyAssignments.test.ts -x` |
| Full suite command | `npx jest` |

### Phase Requirements → Test Map

| REQ ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-04-01 | `ensureAssignmentsForDate` no duplica al re-correr | unit | `npx jest -t "es idempotente"` | ✅ |
| REQ-04-02 | `addAssignmentForHabit` no duplica al re-correr | unit | `npx jest -t "addAssignmentForHabit.*idempotente"` | ✅ |
| REQ-04-03 | Restore desde JSON con duplicados pre-clean correctamente | unit | `npx jest -t "dedupeAssignmentsArray"` | ❌ Wave 0 |
| REQ-04-04 | Migration v1 borra losers según D-03 priority | snapshot | `npx jest -t "migration v1.*priority"` | ❌ Wave 0 |
| REQ-04-05 | Migration v1 crea UNIQUE INDEX | unit | `npx jest -t "migration v1.*creates index"` | ❌ Wave 0 |
| REQ-04-06 | Migration v1 es idempotente (corre 2x sin error) | unit | `npx jest -t "migration v1.*idempotent"` | ❌ Wave 0 |
| REQ-04-07 | Migration v1 fail logs y no rompe boot | unit | `npx jest -t "migration v1.*silent failure"` | ❌ Wave 0 |
| REQ-04-08 | UNIQUE INDEX permite múltiples spontaneous el mismo día | unit | `npx jest -t "permite múltiples entradas espontáneas"` | ✅ |
| REQ-04-09 | UNIQUE INDEX rechaza duplicados de hábitos regulares | unit | `npx jest -t "el índice UNIQUE impide duplicados"` | ✅ |
| REQ-04-10 | Weekly habit visible toda la semana, completion 1x por período | unit | `npx jest -t "weekly.*completion.*period"` | ❌ Wave 0 |
| REQ-04-11 | Monthly habit visible todo el mes, completion 1x por período | unit | `npx jest -t "monthly.*completion.*period"` | ❌ Wave 0 |
| REQ-04-12 | `getPeriodKey` correcto en cruces de año/mes/semana | unit | `npx jest -t "getPeriodKey"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest src/__tests__/dailyAssignments.test.ts -x`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green + manual smoke en device (boot, completar weekly habit, restore backup) antes de `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/__tests__/migrationDedup.test.ts` — covers REQ-04-04..REQ-04-07
- [ ] `src/__tests__/dedupeAssignmentsArray.test.ts` — covers REQ-04-03
- [ ] `src/__tests__/periodHelpers.test.ts` — covers REQ-04-10..REQ-04-12
- [ ] Extend `src/__tests__/dailyAssignments.test.ts` with weekly/monthly visibility tests (REQ-04-10/11)
- [ ] Test fixture builder en `setup/testDatabase.ts`: `seedDuplicates(count, priority)` para snapshot tests del cleanup

## Project Constraints (from CLAUDE.md)

- **Planning-first:** No empezar implementación hasta que el plan esté aprobado.
- **Spanish replies, English code/paths.**
- **No inline styles** (irrelevante para esta phase — todo lógica de DB/service).
- **Refactor si función >20 líneas** — la migration function va a estar cerca del límite; aplicar pattern de splitting por step.
- **No duplicar código:** `getPeriodKey`, `dedupeAssignmentsArray` van en utils, no duplicados en service y backupService.
- **Actualizar archivos .md desactualizados:** ARCHITECTURE.md menciona "Unique constraint on (habit_id, date)" que NO existe — debe actualizarse al final del phase.
- **Self.Improvement Loop:** Si emerge una corrección durante implementation, agregar a `tasks/lessons.md`.
- **Lessons review at session start:** Plan stage debe leer `tasks/lessons.md` (si existe) por si hay patterns aplicables.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Weekly y monthly visibles **todos los días** del período; completion **una sola vez por período** (no acumula puntos extra si se marca múltiples veces).
- **D-02:** Period boundaries — semana = lunes a domingo (ISO 8601); mes = día 1 al último día calendario.
- **D-03:** Heurística de winner para duplicados: (1) `is_completed=1` gana; (2) si tie, la que tiene `performed_habit` linked gana; (3) si tie, la más antigua por timestamp/ID.
- **D-04:** Hard delete de losers; backup JSON pre-migración del usuario es la red de seguridad. Sin tabla de audit, sin soft-delete.
- **D-05:** La migración corre **automáticamente al abrir la app post-update** como versioned migration en `initDatabase()`.
- **D-06:** Migración silenciosa. Falla → `console.error` + continuar boot normal. **No bloquear app start.**
- **D-07:** Partial UNIQUE INDEX en `daily_assignments(habit_id, date) WHERE habit_id IS NOT NULL`. Spontaneous (habit_id NULL) no entran al index.
- **D-08:** Orden atómico dentro de la migración: detectar → DELETE losers → CREATE UNIQUE INDEX. Todo en una transacción. Sin `INSERT OR IGNORE`.

### Claude's Discretion
- Estructura exacta de la función de migración (single SQL DELETE con CTE vs multiple queries en JS).
- Cómo se computa "current period" — helper `getCurrentPeriod` vs cálculo inline.
- Manejo de `performed_habit` huérfano (existe sin `daily_assignment` correspondiente) si aparece durante cleanup.
- Estrategia de testing del cleanup migration (snapshot test con DB fixture vs property test).
- Qué hacer si CREATE INDEX falla porque el cleanup no eliminó todos los duplicados (logging, retry, abort).

### Deferred Ideas (OUT OF SCOPE)
- Tests strategy y regression coverage (claude tiene discretion).
- Auditoría de flujos no listados (timezone change, reinstall, mass edit) — research stage debe escanear y reportar; out of scope si no emerge nada nuevo.
- Spontaneous abuse handling — out of scope.
- Migración del backup JSON pre-migration al restaurar (plan stage decide).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-04-01 | `ensureAssignmentsForDate` debe ser idempotente sin importar la frecuencia del hábito | §Pattern 2; §Pitfall #4; existing test infra |
| REQ-04-02 | `addAssignmentForHabit` debe ser idempotente; el index UNIQUE actúa como defensa | §Architecture Diagram (Write Paths); §D-07 |
| REQ-04-03 | `restoreData` debe deduplicar el JSON antes del bulk insert para evitar fallar el UNIQUE INDEX | §Pattern 4; §Pitfall #3 |
| REQ-04-04 | Migration v1 borra rows duplicadas respetando heurística D-03 (completed > has_performed > oldest) | §Pattern 2 (CTE+ROW_NUMBER); §Code Example 2 |
| REQ-04-05 | Migration v1 crea partial UNIQUE INDEX `idx_unique_habit_date` | §Code Example 2; §D-07 |
| REQ-04-06 | Migration v1 es idempotente (corre 2x sin error gracias a `PRAGMA user_version`) | §Pattern 1 |
| REQ-04-07 | Migration v1 falla silenciosamente con `console.error` y no bloquea boot | §Code Example 2; §D-06 |
| REQ-04-08 | UNIQUE INDEX excluye `habit_id IS NULL` permitiendo múltiples spontaneous por día | §D-07; existing test |
| REQ-04-09 | UNIQUE INDEX rechaza duplicados de hábitos regulares (defensa en profundidad) | §D-07; existing test |
| REQ-04-10 | Hábitos weekly visibles todos los días de la semana ISO actual | §Pattern 3; §D-01/D-02 |
| REQ-04-11 | Hábitos monthly visibles todos los días del mes calendario actual | §Pattern 3; §D-01/D-02 |
| REQ-04-12 | `getPeriodKey` correcto en cruces de año/mes/semana ISO | §Pattern 3 (Thursday-anchor algorithm) |

(El plan stage debe sembrar estos REQ-IDs en `REQUIREMENTS.md` antes de generar plans.)

## Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R1 | Migración v1 falla silenciosamente y el usuario sigue viendo duplicados sin saber | Media | Alto | Invariante post-DELETE explícito (verifica 0 duplicados antes de CREATE INDEX); tests con fixture de duplicados; smoke test en device pre-release |
| R2 | Cambio del modelo de visibility weekly/monthly (D-01) rompe stats existentes (puntos acumulados, streaks calculados con datos pre-fix) | Alta | Medio | Stats recalcula en read-time; los `performed_habits` históricos no se mutan; solo cambia la presentación. Plan stage debe revisar `statsService` para confirmar que no hay supuestos que se rompen |
| R3 | Performance: `getItemsForDate` con visibility-aware query agrega N+1 si se implementa mal | Media | Alto (hot path) | Pattern 3 con single aggregated query; benchmark antes/después con DB de 1000+ rows; usar EXPLAIN QUERY PLAN |
| R4 | Restore de un backup pre-fix con cientos de duplicados deja la app en estado corrupto si pre-clean tiene un bug | Baja | Alto | Tests con fixtures sintéticos de JSON pre-fix; el `withTransactionAsync` en `restoreAllData` ya da rollback si algo falla |
| R5 | `editHabit → updateTodaySnapshotForHabit` (cambio reciente uncommitted) interactúa con el nuevo lifecycle weekly de manera no obvia (Pitfall #5) | Media | Medio | Plan stage debe decidir Opción A/B/C antes de implementar; tests específicos de "edit weekly mid-week" |

## Sources

### Primary (HIGH confidence — verificados por inspección)
- `src/services/db.ts` (líneas 87-100, 102-108, 130-140) — schema actual, init flow, ad-hoc migration pattern
- `src/services/assignmentService.ts` (líneas 86-232) — todos los entry points de creación
- `src/repositories/assignmentRepository.ts` (líneas 13-49, 116-133) — SQL constants e insert
- `src/services/backupService.ts` (líneas 126-133) — restore flow
- `src/repositories/backupRepository.ts` (líneas 32-33, 63-104) — bulk insert
- `src/store/useHabitStore.ts` (líneas 220-253) — addHabit/editHabit/toggleActive call-sites
- `App.tsx` (líneas 102-118) — boot sequence
- `src/__tests__/dailyAssignments.test.ts` (líneas 333-362) — existing tests del invariante UNIQUE
- `src/__tests__/setup/testDatabase.ts` (líneas 67-72) — pre-modeled UNIQUE INDEX en tests
- `package.json` (línea 33) — expo-sqlite version

### Secondary (HIGH confidence — official docs)
- [SQLite Partial Indexes](https://www.sqlite.org/partialindex.html) — sintaxis y semantics de partial UNIQUE
- [SQLite Window Functions](https://www.sqlite.org/windowfunctions.html) — `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)` disponible desde 3.25
- [SQLite PRAGMA user_version](https://www.sqlite.org/pragma.html#pragma_user_version) — versioning built-in
- [SQLite CREATE INDEX](https://sqlite.org/lang_createindex.html) — sintaxis completa
- [Expo SQLite docs](https://docs.expo.dev/versions/latest/sdk/sqlite/) — `withTransactionAsync` API

### Tertiary (LOW confidence — flagged for validation)
- expo-sqlite 16.0.10 bundled SQLite version: not explicitly documented (assumed ≥3.39 based on Expo SDK 54 mins). Risk if wrong: low — verifiable in dev with `SELECT sqlite_version()`.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verificadas en package.json
- Architecture: HIGH — toda la decisión D-01..D-08 es directamente implementable con el código existente
- Pitfalls: HIGH — derivados de inspección directa, no de training data
- Migration design: HIGH — patterns estándar de SQLite, well-documented
- Period model decision (Pitfall #5 / Open Q1): MEDIUM — research recomienda Opción B pero usuario/plan stage debe confirmar

**Research date:** 2026-05-01
**Valid until:** 2026-05-31 (la app y schema cambian raramente; 30 días es razonable)

## RESEARCH COMPLETE

**Phase:** 04 — Habit Creation Audit & Duplicate Cleanup
**Confidence:** HIGH

### Key Findings
1. ARCHITECTURE.md afirma falsamente que existe UNIQUE constraint en `(habit_id, date)`. Verificado por inspección directa de `db.ts:87-100`: NO existe. Phase 4 lo hará realidad.
2. No hay sistema de versioned migrations. La única migration ad-hoc usa `PRAGMA table_info`. Recomendación: introducir `PRAGMA user_version` (built-in, atómico, sin overhead).
3. El test setup ya pre-modela el UNIQUE INDEX (`testDatabase.ts:67-72`) y los tests del describe "Prevención de duplicados" ya están escritos. **El código de prod no implementa lo que los tests asumen** — Phase 4 alinea las dos realidades.
4. SQLite features necesarias (CTE+ROW_NUMBER, partial UNIQUE INDEX, transactions, user_version) están **todas disponibles** en expo-sqlite 16.0.10 con SQLite ≥3.25.
5. El backup JSON puede contener duplicados pre-fix; pre-clean con `dedupeAssignmentsArray` antes del bulk insert evita romper el UNIQUE INDEX en restore.
6. **Decisión arquitectónica abierta** (Open Q1): cómo modelar weekly/monthly storage post-D-01 — recomendación Opción B (row por día con propagación de completion).

### File Created
`.planning/phases/04-habit-creation-audit/04-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | versions verificadas en código |
| Architecture | HIGH | decisiones D-01..D-08 directamente implementables |
| Pitfalls | HIGH | derivados de inspección |
| Migration design | HIGH | patterns SQLite estándar |
| Visibility model | MEDIUM | recomendación Opción B requiere confirmación de plan stage |

### Open Questions (RESOLVED)
1. Storage model weekly/monthly (Opción A/B/C) — Recommendation: **RESOLVED:** **Opción B** (row por día, completion propaga a todas las rows del período).
2. ¿Migration v1 debe re-correr post-restore? — Recommendation: **RESOLVED:** **No** — el pre-clean del array es suficiente porque el index ya creado garantiza la consistencia.
3. Spontaneous post-fix dedup rules — Recommendation: **RESOLVED:** Confirmar: out of scope per CONTEXT §Deferred.

### Ready for Planning
Research complete. Planner debe:
- Sembrar REQ-04-01..REQ-04-12 en `REQUIREMENTS.md` antes de los plans.
- Resolver Open Q1 (visibility model option) en plan-01 antes de implementar.
- Estructurar plans en orden: (P1) periodHelpers + tests → (P2) migration v1 + tests → (P3) visibility-aware getItemsForDate → (P4) restore pre-clean + actualización ARCHITECTURE.md.
