# Phase 2: Tech Debt - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Tipos explícitos en useSpeechRecognition + un único punto de parsing de categorías + sanitizeTable seguro y tipado. Sin features nuevas, sin cambios de UI, sin perf optimizations. El alcance se expande a tipar también el `JSON.parse` de `backupService` para cerrar "sin JSON.parse disperso" completo antes de que Phase 3 monte Drive sobre ese servicio.

</domain>

<decisions>
## Implementation Decisions

### DEBT-02: Parser central de categorías
- **D-01:** `src/utils/parsing.ts` expone una sola función `parseAndValidateCategories(json: string): string[]`. Reemplaza completamente a `parseJsonArray`. La función parsea JSON, garantiza array, filtra contra `VALID_AREA_IDS`, y retorna solo IDs válidos.
- **D-02:** Los 4 call sites actuales migran al nuevo parser:
  - `src/screens/DailySheetScreen.tsx:102`
  - `src/screens/HabitLibraryScreen.tsx:202`
  - `src/components/modals/HabitFormModal.tsx:178`
  - `src/services/statsService.ts:124`
  Tras la migración, ninguno de estos archivos llama directamente a `JSON.parse` para categorías ni usa `parseJsonArray`.
- **D-03:** `sanitizeTable` (en `db.ts`) consume el parser central — `filterValidIds` desaparece. La sanitización serializa el resultado del parser con `JSON.stringify` antes del UPDATE.
- **D-04 (alcance ampliado):** `src/services/backupService.ts:81` (`JSON.parse(json) as Partial<BackupData>`) también se tipa explícitamente en esta fase. La cast `as` desaparece — se reemplaza por un parser tipado (validación de shape + retorno `BackupData | null`). Esto inversiona Phase 3, que va a montar Drive sobre `backupService`.

### DEBT-03: sanitizeTable refactor
- **D-05:** `sanitizeTable(db, table, column)` genérico se elimina por completo. Se reemplaza por dos funciones explícitas:
  - `sanitizeHabitDefaultCategories(db: SQLite.SQLiteDatabase): Promise<void>`
  - `sanitizePerformedCategoriesUsed(db: SQLite.SQLiteDatabase): Promise<void>`
- **D-06:** Cada una contiene su SQL fijo (sin template strings con table/column dinámicos) y usa el parser central para validar antes del UPDATE.
- **D-07:** El tipo `{ id: string; [key: string]: any }` desaparece. Cada función usa el shape exacto de su SELECT (`{ id: string; default_categories: string | null }` y `{ id: string; categories_used: string | null }`).
- **D-08:** Sin helper compartido entre las dos funciones — la duplicación es leve (≤14 líneas cada una, dentro de la regla del proyecto >20 líneas → refactor) y elimina cualquier parámetro dinámico.
- **D-09:** Reescritura con `json_extract` SQL queda **deferred** (idea PERF-V2-03 del REQUIREMENTS).

### DEBT-01: Type safety en useSpeechRecognition
- **D-10:** Definir interfaz `SpeechModuleInterface` **inline** en `src/hooks/useSpeechRecognition.ts`. No se extrae a `src/types/` porque solo se usa en este archivo (YAGNI).
- **D-11:** La interfaz tipa **solo la superficie que usa el hook**:
  - `addResultListener(cb: (event: SpeechRecognitionEvent) => void): { remove: () => void } | undefined`
  - `ExpoSpeechRecognitionModule: { start(opts: { lang: string }): Promise<void>; stop(): Promise<void> } | undefined`
  No se importan tipos reales del paquete `expo-speech-recognition` (puede no estar instalado en runtime; la importación de tipos acoplaría con la API completa).
- **D-12:** El `any` del callback (línea 41) se reemplaza por una interfaz local `SpeechRecognitionEvent` con `{ results?: Array<{ transcript: string }> }`. Ambos `any` (líneas 16 y 41) deben desaparecer — requisito explícito del success criterion.
- **D-13:** El loader actual (`require('expo-speech-recognition')` + try/catch) se mantiene. Es el patrón canónico para optional native modules en RN/Expo y funciona hoy. Solo se le agregan tipos arriba — sin migrar a `await import()` (Metro tiene gotchas con dynamic imports y cambiaría el patrón síncrono del archivo).

### Validación de IDs en lectura/escritura
- **D-14 (lectura):** `parseAndValidateCategories` filtra IDs inválidos silenciosamente Y emite `console.warn` con los IDs descartados. Defensivo (no rompe en datos legacy) + visibilidad para QA/dev.
- **D-15 (escritura — alcance ampliado):** Simetría con BUG-04. `addHabit`/`updateHabit` (`habitService` o `habitRepository`, según corresponda al patrón actual) validan categorías contra `VALID_AREA_IDS` antes del INSERT/UPDATE y throwean error descriptivo listando IDs inválidos. Cierra la última puerta abierta para que IDs inválidos lleguen a la DB. La validación de espontáneos (BUG-04) puede compartir el mismo helper.

### Claude's Discretion
- Forma exacta de la firma de `parseAndValidateCategories` (puede tener una variante que también devuelva metadata sobre IDs descartados si es útil para tests, o no — Claude decide).
- Estructura interna del parser tipado de `BackupData` en `backupService.ts` (validación shape-by-shape, type guards, o un helper genérico con `Object.hasOwn`).
- Estrategia de tests: tests unitarios para el parser central, tests de migración de call sites, tests para validación de escritura de habits (puede reutilizar el approach de los tests de Phase 1).
- Mensajes exactos de error para validación de escritura (formato del listado de IDs inválidos, idioma — pero seguir el estilo de BUG-04 que el usuario validó).
- Si el helper de validación de escritura es exportado como parte de `parsing.ts` o vive en `habitService` / un nuevo `validation.ts`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements y success criteria
- `.planning/ROADMAP.md` §"Phase 2: Tech Debt" — 3 success criteria que deben ser TRUE
- `.planning/REQUIREMENTS.md` §"Tech Debt" — DEBT-01, DEBT-02, DEBT-03

### Codebase intel relevante
- `.planning/codebase/CONCERNS.md` §"Tech Debt" — descripción de los 3 issues con files/lines
- `.planning/codebase/CONVENTIONS.md` — naming, layer separation (Repo CRUD / Service business logic), JSDoc patterns en español
- `.planning/codebase/STRUCTURE.md` — layout del proyecto
- `.planning/phases/01-bug-fixes/01-CONTEXT.md` — referencias a `VALID_AREA_IDS`, `filterValidIds`, patrones de Phase 1

### Archivos a modificar
- `src/utils/parsing.ts` — reemplazar `parseJsonArray` por `parseAndValidateCategories`
- `src/services/db.ts` — eliminar `sanitizeTable`/`filterValidIds`, agregar `sanitizeHabitDefaultCategories` + `sanitizePerformedCategoriesUsed`
- `src/services/backupService.ts:81` — tipar `JSON.parse` de backup, eliminar `as Partial<BackupData>`
- `src/hooks/useSpeechRecognition.ts` — `SpeechModuleInterface` + `SpeechRecognitionEvent` inline, eliminar 2 `any`
- `src/screens/DailySheetScreen.tsx:102`, `src/screens/HabitLibraryScreen.tsx:202` — migrar a parser central
- `src/components/modals/HabitFormModal.tsx:178` — migrar a parser central
- `src/services/statsService.ts:124` — migrar a parser central
- `src/services/habitService.ts` (o `src/repositories/habitRepository.ts`) — agregar validación de categorías en `addHabit`/`updateHabit`

### Constantes y utilidades existentes
- `src/config/constants.ts` — `VALID_AREA_IDS` (Set)
- `src/services/db.ts` — `getDatabase`, helpers de fecha (no tocar — Phase 1 ya los estabilizó)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `parseJsonArray` (parsing.ts): será **reemplazado** por `parseAndValidateCategories`. La estructura try/catch + `Array.isArray` es el patrón a mantener — solo se le agrega filter por `VALID_AREA_IDS`.
- `filterValidIds` (db.ts:172): la lógica de filtrado se mueve al parser central. La función desaparece; sus 2 callers (uno por tabla en `sanitizeCategories`) usan el nuevo parser.
- `VALID_AREA_IDS` (Set): el único validador. Phase 1 ya lo usa en BUG-04 para espontáneos. Se reutiliza acá para lectura y escritura de habits regulares.
- Tests existentes en `src/__tests__/` siguen el estilo verificado por Phase 1 (29 tests passing). Los nuevos tests siguen el mismo approach.

### Established Patterns
- **Layer separation**: validación va en service layer, no en repo. La validación de escritura en habits debe vivir en `habitService` (o helper compartido), nunca en `habitRepository` (CRUD puro).
- **Bug comments en español inline**: `// Bug 2: ignorar espontáneos`. Si se agregan comentarios sobre tech debt resuelto, seguir el mismo estilo (en español) o eliminar el comment original que apuntaba a la deuda.
- **JSDoc en español**: descripciones funcionales en español, parámetros en formato estándar. Mantener para nuevas funciones.
- **`{ id: string; [key: string]: any }`**: este patrón es **el** anti-patrón a eliminar. Cualquier query que vuelva a aparecer así durante implementación debe ser tipada explícitamente.

### Integration Points
- `sanitizeCategories` corre en `initDatabase()` — refactorizarla no afecta el flow de init siempre que ambas nuevas funciones se llamen secuencialmente.
- `parseAndValidateCategories` será leído desde 4 archivos UI/service. Un cambio en su firma rompe los 4 — coordinar la migración en el mismo plan.
- `backupService` exporta `buildBackupData` y `parseAndValidate` como **internal**; Phase 3 los va a promover a named exports. Tipar el parse acá facilita ese trabajo.

</code_context>

<specifics>
## Specific Ideas

- El usuario pidió ver el código propuesto antes de confirmar el refactor de `sanitizeTable`. Las dos funciones explícitas mostradas en discusión son la forma final aprobada — el planner debe reflejar exactamente ese shape (sin reintroducir helpers genéricos compartidos).
- Sobre el loader de `expo-speech-recognition`: el usuario eligió mantener `require()+try/catch` con cierta duda ("no estoy seguro"). El planner no debe tomar esto como invitación a explorar dynamic imports — la decisión está cerrada y modernizar el loader queda fuera de scope.

</specifics>

<deferred>
## Deferred Ideas

- **Reescribir `sanitizeCategories` con `json_extract` SQL**: marcado como PERF-V2-03 en REQUIREMENTS. Mejoraría la performance del init en datasets grandes pero no aporta a los success criteria de Phase 2 (tipos + parsing centralizado).
- **Extraer `SpeechModuleInterface` a `src/types/speech.ts`**: si en el futuro otros archivos necesitan el tipo, mover entonces. YAGNI por ahora.
- **Migrar el patrón `require()` a `await import()`**: Metro/RN tienen gotchas y obliga a un useEffect inicial async. Sin valor concreto en este momento.
- **Validación de `mood_entries` o cualquier otro campo JSON-shaped**: el alcance de DEBT-02 es categorías. Otros datos JSON quedan sin tocar salvo el parse de backup (D-04, alcance ampliado).

</deferred>

---

*Phase: 02-tech-debt*
*Context gathered: 2026-04-25*
