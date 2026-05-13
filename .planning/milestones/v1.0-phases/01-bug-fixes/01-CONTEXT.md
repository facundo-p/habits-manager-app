# Phase 1: Bug Fixes - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Corregir los 4 bugs de daily assignments que causan duplicación de datos y drift de timezone. Sin cambios de UI, sin nuevas features — solo correctness del sistema de assignments.

</domain>

<decisions>
## Implementation Decisions

### BUG-01: Backfill spontaneous guard
- `ensureAssignmentsForDate` debe contar TODAS las assignments (incluyendo espontáneas) para decidir si una fecha ya fue procesada
- Cambiar de `countHabitAssignmentsByDate` a `countByDate` (que ya existe en el repo)
- Un día que solo tiene espontáneos no debe recibir nuevas assignments al hacer backfill

### BUG-02: Future-date guard deduplication
- Extraer `isFutureDate()` como utility compartida
- Ambos call sites (`addAssignmentForHabit` y `ensureAssignmentsForDate`) deben usar la misma función
- Eliminar las comparaciones inline `day > getTodayPrefix()`

### BUG-03: UTC date iteration
- El backfill en `checkAndBackfillHistory` debe usar UTC explícito en el constructor de Date
- Cambiar `new Date("...T00:00:00")` a `new Date("...T00:00:00Z")` o usar métodos UTC
- `formatDateStr` y `nextDay` deben producir la misma fecha en cualquier timezone

### BUG-04: Category validation on spontaneous insert
- Validar categorías contra `VALID_AREA_IDS` antes de insertar espontáneo
- Falla con error descriptivo si algún ID es inválido — no persistir datos corruptos
- `VALID_AREA_IDS` ya existe en `config/constants.ts`

### Claude's Discretion
- Estrategia de cleanup de datos existentes corruptos (si aplica)
- Error handling específico para BUG-04 (throw vs strip invalid + warn)
- Estructura exacta del utility `isFutureDate()`
- Approach de testing para cada fix

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bug definitions and success criteria
- `.planning/ROADMAP.md` — Phase 1 success criteria (4 conditions that must be TRUE)
- `.planning/REQUIREMENTS.md` — BUG-01 through BUG-04 requirement definitions

### Core files to modify
- `src/services/assignmentService.ts` — Contains all 4 bugs (lines 116, 182-189, 200-201, 84-95)
- `src/repositories/assignmentRepository.ts` — `countByDate` and `countHabitAssignmentsByDate` queries
- `src/services/db.ts` — `VALID_AREA_IDS` import, date helpers

### Existing test coverage
- `src/__tests__/` — Existing assignment tests to extend

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `assignmentRepo.countByDate()`: Already counts ALL assignments — can replace `countHabitAssignmentsByDate` for BUG-01
- `VALID_AREA_IDS` (Set): Already exists in `config/constants.ts` — use for BUG-04 validation
- `filterValidIds()` in `db.ts`: Existing pattern for category validation (sanitize flow)
- `getTodayPrefix()`: Shared date utility — `isFutureDate` can live alongside it

### Established Patterns
- Repository layer is "dumb CRUD" — no business logic, only SQL
- Service layer owns all business rules — validation belongs in `assignmentService.ts`
- Date format is `YYYY-MM-DD` string throughout (datePrefix pattern)
- Bug comments in Spanish inline ("Bug 2", "Bug 3") mark affected lines

### Integration Points
- `ensureAssignmentsForDate()` is called from `getItemsForDate` and `getPointsForDate` — any change propagates automatically
- `addAssignmentForHabit()` is called from store when creating/reactivating habits
- `addSpontaneous()` is the single entry point for spontaneous habit creation

</code_context>

<specifics>
## Specific Ideas

No specific requirements — user chose to skip discussion. All 4 bugs have clear success criteria in ROADMAP.md. Claude has discretion on implementation details.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-bug-fixes*
*Context gathered: 2026-03-17*
