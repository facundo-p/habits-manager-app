# Phase 4: Habit Creation Audit & Duplicate Cleanup - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Auditar todos los flujos que crean rows en `daily_assignments` (rollover diario, inicio de semana, inicio de mes, creación manual desde Biblioteca, restore desde backup), identificar las fuentes de duplicación, corregir cada flujo, y diseñar una migración de DB que limpie la data ya duplicada en bases existentes para dejarlas consistentes. Sin nuevas features de UI; cambios de UI sólo si son consecuencia directa del nuevo lifecycle de weekly/monthly habits (ver D-01/D-02).

</domain>

<decisions>
## Implementation Decisions

### Lifecycle de hábitos weekly y monthly
- **D-01:** Visibility model — los hábitos weekly y monthly son visibles en la vista diaria **todos los días**, pero la "completion" cuenta **una sola vez por período**. Si el usuario marca como completado el miércoles, el resto de la semana muestra el hábito como "completado para este período" (no acumula puntos extra).
- **D-02:** Period boundaries fijos — semana = lunes a domingo (ISO 8601); mes = día 1 al último día del mes calendario. La columna `frequency` ya existe en daily_assignments; el cálculo del período se hace contra `date_prefix`.

### Política de deduplicación de DB existente
- **D-03:** Heurística de "qué row preservar" cuando hay duplicados en `(habit_id, date_prefix)`:
  1. Si alguna row tiene `is_completed = 1` → esa gana
  2. Si ninguna está completada, la que tenga un `performed_habit` linked (taskRepo) → esa gana
  3. Si nada de eso, la **más antigua** por timestamp/ID
- **D-04:** Hard delete de rows perdedoras (`DELETE FROM daily_assignments WHERE id IN (...)`). El export JSON pre-migración del usuario actúa como red de seguridad; no se agrega tabla de audit ni soft-delete.

### Trigger del cleanup migration
- **D-05:** La migración corre **automáticamente al abrir la app por primera vez post-update**, integrada como una versioned migration en la secuencia de `initDatabase()` en `src/services/db.ts`. Patrón consistente con migraciones existentes — mismo mecanismo (`schema_version` o equivalente actual).
- **D-06:** Sin feedback visible al usuario durante la migración (silenciosa). Si la migración falla, log a `console.error` y continuar arranque normal — no bloquear app start. Esta política es consistente con el patrón actual de migraciones del proyecto.

### Schema constraint preventivo
- **D-07:** Crear partial UNIQUE INDEX en `daily_assignments(habit_id, date_prefix) WHERE habit_id IS NOT NULL`. Esto garantiza unicidad para hábitos regulares sin restringir spontaneous (que tienen `habit_id = NULL` y SQLite trata NULLs como distintos por defecto). Defensa en profundidad: si un futuro bug intenta insertar un duplicado, la DB lo rechaza en lugar de aceptarlo silenciosamente.
- **D-08:** El index se crea **dentro de la misma migración** que el cleanup, en este orden: (1) detectar duplicados, (2) borrar perdedores según D-03/D-04, (3) `CREATE UNIQUE INDEX`. Atómico — si falla algún paso, se rollback completo. Evita el patrón "ON CONFLICT IGNORE" porque pierde control sobre cuál row se preserva.

### Claude's Discretion

- Estructura exacta de la función de migración (un solo SQL `DELETE` con CTE vs múltiples queries en JS) — el research stage decidirá según costo de implementación.
- Cómo se computa "current period" en la lógica de visualización (helper `getCurrentPeriod(date, frequency)` vs cálculo inline) — decisión de planner.
- Manejo del caso `performed_habit` huérfano (existe sin `daily_assignment` correspondiente) si aparece durante el cleanup — research stage debe identificar si el caso es real.
- Estrategia de testing del cleanup migration (snapshot test con DB fixture vs property test con datos generados) — planner decide según herramientas existentes.
- Qué hacer si el index falla al crearse porque el cleanup no eliminó todos los duplicados (logging, retry, abort) — implementation detail.

### Folded Todos

[None — no hay todos backlog que se hayan plegado en este phase]

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decisiones y criterios del phase
- `.planning/ROADMAP.md` §"Phase 4: Habit Creation Audit & Duplicate Cleanup" — Goal y dependencias
- `.planning/REQUIREMENTS.md` — TBD (a definir en plan stage)
- Phase 1 CONTEXT (`.planning/phases/01-bug-fixes/01-CONTEXT.md`) — bugs ya resueltos en assignments; este phase NO los re-discute. BUG-01 (backfill spontaneous guard), BUG-02 (isFutureDate utility), BUG-03 (UTC iteration), BUG-04 (category validation) ya cerrados.

### Core files a auditar y modificar
- `src/services/assignmentService.ts` — Contiene los 4 entry points de creación de assignments:
  - `addSpontaneous()` (líneas 86-103) — flujo creación manual de spontaneous
  - `addAssignmentForHabit()` (líneas 119-135) — flujo creación al agregar hábito desde biblioteca
  - `ensureAssignmentsForDate()` (líneas 207-232) — flujo rollover diario / semana / mes
  - `checkAndBackfillHistory()` (líneas 178-198) — flujo de relleno histórico
- `src/repositories/assignmentRepository.ts` — todas las queries de inserción / búsqueda / count. Es la única capa que ejecuta SQL contra `daily_assignments`.
- `src/services/db.ts` — `initDatabase()` y la secuencia de migraciones existentes (D-05 agrega una nueva versioned migration acá). También vive `getTodayPrefix`, `isFutureDate`, etc.
- `src/services/backupService.ts` y `src/services/driveBackupService.ts` — flujo de restore. La restauración hace bulk insert (`backupRepository.insertFullDump`) y puede reintroducir duplicados si el JSON ya los tiene.
- `src/store/useHabitStore.ts` — `addHabit`, `editHabit`, `archiveHabit`, `fetchHabitsForDate` orquestan llamadas a assignmentService. `editHabit` ya invoca `updateTodaySnapshotForHabit` (cambio reciente, pre-sesión, todavía sin commitear).
- `App.tsx` — punto de arranque. Trigger del rollover via `checkAndBackfillHistory`/`fetchHabitsForDate` debe inspeccionarse acá.

### Tests existentes a extender
- `src/__tests__/dailyAssignments.test.ts` — coverage actual de assignment logic; el plan stage debe agregar regression tests para cada flujo identificado.
- `src/__tests__/setup/testDatabase.ts` — DB de test reusable para fixtures de la migración de cleanup.

### Codebase maps
- `.planning/codebase/STRUCTURE.md` — convención de capas (services orchestrate, repositories CRUD)
- `.planning/codebase/CONVENTIONS.md` — naming y patterns
- `.planning/codebase/ARCHITECTURE.md` — flujos de datos

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `assignmentRepo.countByDate(date)` y `assignmentRepo.findByHabitAndDate(habitId, date)` — utilities ya existentes para detectar duplicados durante la migración
- `isFutureDate()` (extraído en Phase 1) — guard ya compartido entre `addAssignmentForHabit` y `ensureAssignmentsForDate`
- `VALID_AREA_IDS` y `filterValidIds()` (Phase 1 / 2) — patrón de validación que se puede replicar para invariantes nuevos
- `nextDay(dateStr)` y `formatDateStr(d)` (assignmentService.ts:255-263) — date helpers UTC-safe
- Patrón de migration secuencial en `db.ts initDatabase()` — D-05 sigue este patrón exacto

### Established Patterns
- Service layer orchestrates, repository layer SQL-only (no business logic) — el cleanup vive en una **service nueva o ampliación de assignmentService**, no en repository
- Date format `YYYY-MM-DD` string en toda la base — el index lo respeta (string comparison)
- Bug comments en español inline (`// Bug 2: ...`) — convención existente, mantener para nuevos invariantes
- Repository functions thin wrappers sobre SQL parametrizado — el cleanup puede agregar un raw SQL helper específico (`deleteDuplicatesPriorityCompleted`) sin romper convención

### Integration Points
- `ensureAssignmentsForDate()` es invocada desde `getItemsForDate` y `getPointsForDate`, llamadas de cada render de DailySheet — cualquier cambio acá impacta hot path. Optimizar para no agregar latencia perceptible.
- `addAssignmentForHabit()` se invoca desde el store al crear/reactivar hábito — el cambio del lifecycle weekly/monthly (D-01) puede requerir que esta función NO inserte para weekly/monthly fuera del primer día del período, o sí pero con flag.
- `checkAndBackfillHistory()` corre al arrancar la app post-rollover — combinarlo con la nueva versioned migration o mantenerlos separados es decisión del planner.
- Restore desde Drive (driveBackupService.applyRestore) hace bulk replace — el index UNIQUE va a fallar si el backup tiene duplicados pre-existentes; necesita pre-clean del JSON antes del insert.

</code_context>

<specifics>
## Specific Ideas

- El usuario reportó duplicación visualmente en "habitos diarios" pero no especificó cuáles ni con qué frecuencia exacta. Hipótesis principal del scout: weekly/monthly habits materializados como rows diarias por `ensureAssignmentsForDate` sin filtro de frecuencia. La research stage debe **confirmar** la hipótesis con una query exploratoria sobre la DB del usuario antes de codificar fixes.
- El usuario hizo backup JSON antes de empezar este phase y ya tomó la decisión de aceptar pérdida de data si la migración corre mal. Eso reduce el costo de aceptar hard delete (D-04).
- El usuario está en branch `fix/habit-creation-audit` — todo el trabajo de phase 4 va acá. Hay 3 archivos modificados sin commitear (`metro.config.js` workaround local, `app.json` pre-sesión, `src/store/useHabitStore.ts` con `updateTodaySnapshotForHabit`). El último merece atención especial — la function ya existe y se llama desde `editHabit`, pero la unión entre updateTodaySnapshotForHabit y el lifecycle weekly/monthly post-D-01 puede crear redundancia o faltantes.

</specifics>

<deferred>
## Deferred Ideas

- **Estrategia de tests / regresión** — No se discutió en profundidad. Claude tiene discretion para proponer durante el plan stage: tests unitarios por flujo + invariant runtime warn en dev si `countByHabitAndDate(habit, date) > 1` + el index hace que la DB falle ruidosamente en prod. Si el usuario quiere otro nivel, lo plantea en plan stage.
- **Auditoría de flujos no listados** — Cambio de timezone del dispositivo, reinstal de app, edición masiva. El research stage debe escanear sistemáticamente todos los `assignmentRepo.insert` callers y reportar; si emerge un flujo nuevo con riesgo, se vuelve a discuss.
- **Handling de spontaneous post-fix** — Spontaneous (habit_id NULL) no entran al index UNIQUE. Hoy se permite múltiples por día (esa es la feature). Si en el futuro se detecta abuso, se discute regla por (name, date, time) — out of scope ahora.
- **Migración del backup JSON pre-migration** — Si el usuario restaura un backup creado ANTES de este phase, el JSON puede tener duplicados; al restaurar fallaría el index. El plan stage debe decidir si la lógica de restore corre el cleanup también después del bulk insert (probablemente sí — agregarlo al plan).

</deferred>

---

*Phase: 04-habit-creation-audit*
*Context gathered: 2026-05-01*
