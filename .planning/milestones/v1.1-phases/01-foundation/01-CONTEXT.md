# Phase 1: Foundation — Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Establecer las primitivas cross-cutting que toda feature de bienestar v1.1 depende: un único helper `getLocalDayKey()` (más toda la familia de date helpers consolidada en `src/utils/date.ts`), un `<MoodPicker>` compartido extraído de `ReflectionModal` (con `src/config/mood.ts`), migración v2 atómica que crea `mood_log` + `text_library` + `weekly_reviews` + `drafts`, migra `mood_entries` → `mood_log` con `kind='reflection'` y dropea la tabla vieja, `BACKUP_VERSION = 2` con dispatcher v1→v2 graceful, y un `tone-of-voice.md` que aterrice principios de copy para las features downstream (Phase 2 y Phase 5).

Sin nuevas pantallas user-facing en este phase; el flow de reflection sigue idéntico para el usuario (FOUND-06). Sin nuevas dependencias (`expo-notifications` y `datetimepicker` llegan en Phase 5).

</domain>

<decisions>
## Implementation Decisions

### D-01 — Adopción de `getLocalDayKey()`: rename total + utils centralizada
- **Decisión:** Codemod completo `getTodayPrefix` → `getLocalDayKey` en todos los call sites en este phase. Un solo nombre canónico.
- **Decisión:** Mover **todos los date helpers** (`getLocalDayKey`, `isFutureDate`, `nextDay`, `formatDateStr`, `getTimestampForDate`, `getNowTimestamp`) desde `src/services/db.ts` a `src/utils/date.ts`. `db.ts` queda con bootstrap + migrations puros.
- **Rationale:** Enforces el invariante "una sola fuente de verdad para 'hoy'" desde el día 1 (qu5 precedent — Phase 4 v1.0 ya pagó este antipattern). Diff más grande, pero coherente; downstream phases consumen un módulo limpio sin ambigüedad de qué API usar.
- **Verificación:** Grep `toISOString().slice(0,10)` debe seguir devolviendo cero matches en `src/` (excluyendo tests con comentarios explicativos). Grep `getTodayPrefix` debe devolver cero. Test cross-midnight existente (`src/__tests__/db.test.ts`) se mueve y se mantiene verde.

### D-02 — `<MoodPicker>` API mínima + `src/config/mood.ts`
- **Decisión:** Componente con props mínimas: `value`, `onChange`, `disabled`. Sin `comment`, sin `sleep`. Escala / etiquetas / step / rango vienen de `src/config/mood.ts` (re-exporta lo que ya está en `config/constants.ts`, agrega labels discretas para la UI).
- **Ubicación:** `src/components/shared/MoodPicker.tsx` (+ `.styles.ts`).
- **Rationale:** Máxima reutilización; cada surface (morning, evening, note, reflection) compone su propio layout. Acopla menos y deja a Phase 2 libertad para diseñar cada modal.

### D-03 — Refactor de `ReflectionModal`: paridad + polish acotado
- **Decisión:** ReflectionModal usa el nuevo `<MoodPicker>`. Flow y comportamiento idénticos (FOUND-06). Permitir polish menor (spacing/alignment) si emerge para alinear con surfaces v1.1, **siempre que no cambie UX percibida**.
- **Verificación:** UAT manual: completar un hábito con reflection (mood + comentario), verificar mismos puntos, misma persistencia, misma vista en historial. Datos escriben a `mood_log` con `kind='reflection'` (no a `mood_entries`, que ya no existe post-migración).

### D-04 — Drafts: clear solo en submit OK, debounce 500ms, purge >7 días al boot
- **Clear:** El draft se borra **únicamente** cuando el submit a la tabla final (mood_log / weekly_reviews) commitea OK. Cancel del modal, close, app kill: el draft sobrevive.
- **Autosave:** Debounce 500ms tras el último cambio del usuario en los inputs (mood, comment, sleep, answers).
- **Purge:** Al boot, eliminar drafts cuyo `updated_at` sea > 7 días. Tarea barata, una vez por arranque.
- **Rationale:** Máxima resiliencia para el usuario (lo que escribe nunca se pierde sin submit), pero la tabla no crece indefinidamente.
- **Edge case:** Drafts huérfanos cuyo `date_key`/`week_key` ya no es "hoy"/semana actual: NO se purgan automáticamente — el modal de cada surface debe decidir qué hacer cuando encuentra un draft con key vieja al abrir (research / planner aterrizan la regla por surface en Phase 2/4).

### D-05 — Migration v2 failure UX: pantalla bloqueante + restore
- **Decisión:** Si la migration v2 falla (rollback atómico ya garantizado por la transaction), la app **NO** arranca al home. Muestra una error screen dedicada con:
  - Mensaje claro: "No se pudo actualizar la base de datos."
  - Botón **Restore desde backup** (lleva al flow existente de Drive / local restore).
  - Botón **Reintentar migración**.
  - Link a soporte / Settings con info técnica del error (opcional, planner decide UX detallada).
- **Rationale:** Contrasta con la política Phase 4 v1.0 (log silencioso + continuar) porque allá la migración era data cleanup; acá es schema-breaking (cambia user_version 1 → 2 y crea las tablas que las features v1.1 esperan). Arrancar a un home roto es peor que un error screen accionable.

### D-06 — Backup local automático pre-migración v2
- **Decisión:** Antes de abrir el transaction de migration v2, generar un export JSON v1 a `${SQLite_app_dir}/pre-v2-snapshot-${timestamp}.json`. Usa `backupService.buildBackupData()` con la versión actual (v1).
- **Rationale:** Red de seguridad determinística incluso si el dispositivo del usuario no tiene backup Drive válido. La transaction ya es atómica, pero el snapshot pre-migration permite recovery manual ante corrupción de disco / cierre forzado mid-transaction / bugs no anticipados.
- **Cleanup:** El snapshot se conserva por 30 días post-migración exitosa y luego se borra en boot; si la migración falla, el archivo queda disponible para el flow de restore (D-05).

### D-07 — `tone-of-voice.md` se escribe en Phase 1
- **Decisión:** Entregable de Phase 1 (~1-2 páginas) en `.planning/docs/tone-of-voice.md`.
- **Contenido mínimo:**
  - Principios negativos: nada de "te extrañamos", sin streaks ni badges, sin shaming, sin urgencia falsa, sin "missed", sin comparaciones sociales.
  - Principios positivos: empático, sereno, segunda persona neutral (vos/tú según convención existente — verificar en Phase 1), accionable sin presión.
  - Reglas para empty states: nunca culposas; ofrecen una acción, no recriminan.
  - Glosario mínimo de términos consistentes (mood, ánimo, sueño, nota, frase, revisión semanal).
- **Rationale:** Lo consumen Phase 2 (copy de modals / FAB / empty states) y Phase 5 (copy de notificaciones — el antipattern más riesgoso). Escribirlo ahora evita rework de copy más adelante.

### Claude's Discretion

- Estrategia exacta del codemod (sed + ts-node script vs. find-replace manual con verify de tests) — planner decide.
- API interna de `backupService.buildBackupData()` para soportar version override en el snapshot pre-migración — implementation detail.
- Estructura de archivos de migration (`src/services/migrations/migrationV2.ts` siguiendo el patrón de `migrationV1.ts`) — research stage confirma vs. patrones existentes.
- UI exacta de la error screen de migration fail (D-05) — design pass mínimo en Phase 1; planner aterriza.
- Manejo de versionado del snapshot pre-v2 cuando ya existe uno (overwrite vs. timestamped) — Claude decide al implementar.
- Persistencia del flag "snapshot generado correctamente" para gatear el `BEGIN TRANSACTION` de la migration — detalle de planner.

### Folded Todos

[Ninguno — STATE.md "Pending Todos" = None]

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decisiones y criterios del phase
- `.planning/ROADMAP.md` §"Phase 1: Foundation" — Goal, requirements, success criteria
- `.planning/REQUIREMENTS.md` §"FOUNDATION" — FOUND-01..06 detallados
- `.planning/research/SUMMARY.md` — Executive summary + Phase 1 deliverables + pitfalls
- `.planning/research/ARCHITECTURE.md` §2 (Schema decision) — Esquema final partial-unified con SQL completo
- `.planning/research/PITFALLS.md` — Pitfalls 1-4 (day-key drift, idempotency, scale version, backup skew)
- `.planning/milestones/v1.0-phases/04-habit-creation-audit/04-CONTEXT.md` — D-05/D-06/D-08 del patrón de versioned migrations atómicas (precedente directo)

### Core files a auditar y modificar
- `src/services/db.ts` — `initDatabase()`, secuencia de migrations existentes (migrationV1), `getTodayPrefix`, `isFutureDate`, `nextDay`, `formatDateStr`, `getTimestampForDate`, `getNowTimestamp`. D-01 vacía los helpers a `src/utils/date.ts`.
- `src/services/migrations/migrationV1.ts` — Patrón a replicar para `migrationV2.ts` (idempotente, atómico, withTransactionAsync).
- `src/components/modals/ReflectionModal.tsx` + `.styles.ts` — `MoodSection` se extrae a `<MoodPicker>`; el modal se refactoriza para consumirlo (D-02/D-03).
- `src/config/constants.ts` — Constantes existentes de escala de mood; se re-exportan desde nuevo `src/config/mood.ts`.
- `src/services/backupService.ts` — `BACKUP_VERSION`, `buildBackupData()`, `restoreData()`. Bump a 2; agregar dispatcher v1→v2 que mapea `mood_entries[]` → `mood_log` rows con `kind='reflection'`.
- `src/services/driveBackupService.ts` — Consumidor del backup; ajustar el round-trip si necesario.
- `src/repositories/` — Crear nuevos: `moodLogRepository.ts`, `textLibraryRepository.ts`, `weeklyReviewsRepository.ts`, `draftsRepository.ts` (un file por tabla, SQL constants al tope, convención existente).
- `src/__tests__/db.test.ts` — Test cross-midnight de `getTodayPrefix` se migra a `getLocalDayKey` y al nuevo módulo.
- `App.tsx` — Bootstrap; el snapshot pre-v2 (D-06) y la error screen de migration fail (D-05) se montan acá antes del render principal.

### Codebase maps
- `.planning/codebase/STRUCTURE.md` — convención de capas
- `.planning/codebase/CONVENTIONS.md` — naming, SQL constants al tope, sanitizers tipados
- `.planning/codebase/ARCHITECTURE.md` — flujo de datos Screen → Store → Service → Repository → SQLite
- `.planning/codebase/INTEGRATIONS.md` — backup / Drive transport
- `.planning/codebase/TESTING.md` — patrones de test fixtures (`testDatabase.ts`)

### Entregables nuevos de Phase 1
- `.planning/docs/tone-of-voice.md` — D-07 (Phase 1 deliverable, consumido por Phase 2 + Phase 5)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getTodayPrefix()` en `src/services/db.ts` — ya implementado correctamente post-qu5 (usa `getFullYear/getMonth/getDate`, no `toISOString().slice(0,10)`). El codemod D-01 lo renombra; no hay que re-implementar lógica.
- `MoodSection` dentro de `ReflectionModal.tsx` — base directa para extraer `<MoodPicker>`. Mantener visual exacto (D-03 paridad).
- Patrón `migrationV1.ts` — template directo para `migrationV2.ts` (idempotencia + `PRAGMA user_version` + `withTransactionAsync`).
- `backupService.buildBackupData()` y `restoreData()` — extender con dispatcher por `BACKUP_VERSION`. La forma "graceful v1 → v2" ya tiene precedente en cómo v1 incluyó nuevos campos sin romper v0.
- `src/__tests__/setup/testDatabase.ts` — DB fixture reusable para tests de migration v2 (forward, idempotency, rollback) y de backup v1↔v2 round-trip.

### Established Patterns
- Una repository file por tabla; SQL constants al tope; sin business logic.
- Migrations versionadas vía `PRAGMA user_version`; atómicas en `withTransactionAsync`; idempotentes al boot.
- Date format `YYYY-MM-DD` string en toda la base.
- Bugs/invariantes comentados en español inline cuando aplica.
- Stores nunca llaman repos; services componen repos.

### Integration Points
- `initDatabase()` en `db.ts` corre al boot desde `App.tsx`. La sequence post-Phase 1 será:
  1. Generar snapshot pre-v2 (D-06) **antes** del transaction.
  2. Abrir transaction → migration v2 → commit/rollback.
  3. Si falla → render error screen (D-05) en lugar del navigator principal.
  4. Si OK → drafts purge >7 días (D-04).
- `backupService.restoreData()` consume `BACKUP_VERSION` del JSON; el dispatcher v1→v2 se inserta acá. Restore de v1 backup sobre v2 install: el array `mood_entries` se mapea a `mood_log` con `kind='reflection'` (mismo mapping que la migración).
- `ReflectionModal` se invoca desde el flow de habit completion; el cambio NO toca callers, solo el contenido interno del modal.

</code_context>

<specifics>
## Specific Ideas

- El usuario es consciente de la cut-line (Phase 4 sale primero si el milestone aprieta). Foundation **NO** es cut-line — todo lo demás depende.
- Escala mood [1,10] step 0.5 ya está bien; `mood_scale_version` se persiste como `'v1'` en cada row creada por la migration v2 (incluido el INSERT...SELECT desde `mood_entries`). Sin re-escritura de valores históricos.
- El usuario tomó la decisión de partial-unified schema el 2026-05-10 (override del split-tables original). Confirma con research/ARCHITECTURE.md §2 antes de planificar el SQL.
- Snapshot pre-v2 (D-06) vive en el app sandbox (`FileSystem.documentDirectory`); NO se sube a Drive. Es safety net local; el usuario sigue siendo responsable de su Drive backup como capa extra.
- D-05 error screen + D-06 snapshot juntos forman un par: el botón "Restore" de la error screen puede ofrecer **primero** el snapshot local pre-v2 (one-tap recovery), y como fallback el flow de Drive restore.

</specifics>

<deferred>
## Deferred Ideas

- **Glosario completo de copy en español rioplatense** — el `tone-of-voice.md` arranca con lo mínimo; un glosario exhaustivo crece orgánicamente en Phases 2 y 5 cuando hay copy concreto.
- **Encriptación del snapshot pre-v2** — vive en sandbox, sin encriptar (consistente con la DB SQLite no encriptada). Si llega encryption de backup en milestone futuro, se aplica también al snapshot.
- **Cleanup de drafts con date_key/week_key huérfanos** — la regla por surface (qué hacer cuando el modal abre y encuentra un draft cuyo key ya no es "hoy") se aterriza en Phase 2 (capture surfaces) y Phase 4 (weekly review). Acá solo se garantiza la tabla y el TTL bruto.
- **Glob/lint rule que prohíba `toISOString().slice(0,10)` en CI** — research lo recomienda; planner puede agregar un test simple (`grep -r` en posttest) o un ESLint custom rule. Decision detail de Phase 1, no requiere discusión aparte.
- **UI fine-tuning de la error screen de migration fail** — design pass mínimo en Phase 1 (functional); polish visual puede revisitarse en milestone futuro de "fit & finish".

</deferred>

---

*Phase: 01-foundation (v1.1 Bienestar emocional)*
*Context gathered: 2026-05-12*
