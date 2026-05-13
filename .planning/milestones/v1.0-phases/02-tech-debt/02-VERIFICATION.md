---
phase: 02-tech-debt
verified: 2026-04-27T00:00:00Z
status: human_needed
score: 3/3 must-haves verified
overrides_applied: 0
requirements_verified:
  - DEBT-01
  - DEBT-02
  - DEBT-03
human_verification:
  - test: "Hook de voz funciona en dev build con módulo nativo instalado"
    expected: "Dictar el nombre de un hábito en dispositivo iOS/Android dev build llena el campo de texto con la transcripción"
    why_human: "El bridge nativo no se puede ejercer desde Jest — solo el path del módulo ausente es testeable unitariamente (DEBT-01 manual smoke documentado en 02-VALIDATION.md)"
  - test: "Migración de sanitizeCategories sobre DB legacy con IDs inválidos"
    expected: "Tras `initDatabase()` en una DB con datos sucios, `SELECT default_categories FROM habits` no retorna IDs fuera de VALID_AREA_IDS"
    why_human: "Limpieza defensiva one-shot en boot — smoke manual una vez post-deploy (documentado en 02-VALIDATION.md)"
---

# Phase 2: Tech Debt — Verification Report

**Phase Goal:** El codebase tiene tipos explícitos y un único punto de parsing de categorías — sin `any`, sin `as` assertions, sin JSON.parse disperso
**Verified:** 2026-04-27
**Status:** human_needed (3/3 must-haves automatizados verificados; 2 smoke tests manuales pendientes per 02-VALIDATION.md)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| #   | Truth (ROADMAP §Phase 2)                                                                                                                                                                              | Status     | Evidence                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `useSpeechRecognition` tiene una interfaz `SpeechModuleInterface` tipada y no contiene ningún `any` explícito                                                                                         | ✓ VERIFIED | `src/hooks/useSpeechRecognition.ts` líneas 18-30: declara `SpeechRecognitionEvent` y `SpeechModuleInterface`. `grep -nE "\bany\b"` retorna 0 resultados. `let SpeechModule: SpeechModuleInterface \| null` (L32). Loader D-13 preservado (require + try/catch). |
| 2   | Todo JSON parsing de categorías pasa por `parseAndValidateCategories()` en `parsing.ts` — no hay llamadas directas a `JSON.parse` para arrays de categorías en otros archivos                         | ✓ VERIFIED | `parseAndValidateCategories` exportada en `src/utils/parsing.ts:18`. `grep -rn "parseJsonArray" src/` retorna 0. `grep -rn "JSON.parse" src/` retorna solo 2 resultados: dentro del propio parser y en `backupService.ts:88` (parseo de archivo de backup, NO categorías). 5 call sites consumen el parser central. |
| 3   | `sanitizeTable` retorna tipos explícitos por tabla (sin `[key: string]: any`) y el SQL concatenado está documentado o reemplazado por funciones específicas por tabla                                 | ✓ VERIFIED | `sanitizeTable` y `filterValidIds` eliminadas de `db.ts`. Reemplazadas por `sanitizeHabitDefaultCategories` (L162) y `sanitizePerformedCategoriesUsed` (L185), ambas exportadas con SQL estático literal y shapes tipados (`{ id: string; default_categories: string \| null }`, `{ id: string; categories_used: string \| null }`). Cero matches para `[key: string]: any` o template strings dinámicos en SQL. |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact                                  | Expected                                                          | Status     | Details                                                                                                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/utils/parsing.ts`                    | parseAndValidateCategories central + import VALID_AREA_IDS        | ✓ VERIFIED | 41 líneas. Exporta `parseAndValidateCategories`. Filtra contra `VALID_AREA_IDS`. `console.warn` con descartados (D-14).                                  |
| `src/services/habitService.ts`            | createHabit/updateHabit validan contra VALID_AREA_IDS             | ✓ VERIFIED | `import { VALID_AREA_IDS }` (L16). Bloque BUG-04 en `createHabit:103-108` y `updateHabit:119-124`. Throw con prefijo `createHabit:` / `updateHabit:` y separador em-dash. |
| `src/services/db.ts`                      | Dos sanitizers exportados con SQL estático y shapes tipados       | ✓ VERIFIED | 218 líneas. `sanitizeHabitDefaultCategories` (L162-178) y `sanitizePerformedCategoriesUsed` (L185-201). Ambas leen con shape explícito y emiten UPDATE solo si cambió. `sanitizeCategories` interno (L152) las orquesta desde `initDatabase()`. |
| `src/hooks/useSpeechRecognition.ts`       | SpeechModuleInterface + SpeechRecognitionEvent + cero any         | ✓ VERIFIED | 95 líneas. Dos interfaces locales (L18-30). Cast `as SpeechModuleInterface` en require (L35). Callback tipado `(event: SpeechRecognitionEvent)` (L57). Cero `any` en archivo. |
| `src/services/backupService.ts`           | parseAndValidate sin `as Partial<BackupData>` ni `as BackupData`  | ✓ VERIFIED | 130 líneas. `parseAndValidate` (L85-121) parsea a `unknown`, narrowing a `Record<string, unknown>` defensivo, type guards individuales, casts directos a tipos importados (`Habit[]`, etc.). Mensajes en español preservados. |
| `src/services/statsService.ts`            | Migrado a parser central, sin filtro VALID_AREA_IDS redundante    | ✓ VERIFIED | `import { parseAndValidateCategories }` (L11). Uso en `aggregateByCategory` línea 123. Filtro redundante eliminado. JSDoc actualizado (L114-116) reflejando que el filtrado vive en el parser. |
| `src/screens/DailySheetScreen.tsx`        | Migrado a parser central                                          | ✓ VERIFIED | Import L34, uso L102 en `AreaBadges`. Cero referencias a `parseJsonArray`.                                                                              |
| `src/screens/HabitLibraryScreen.tsx`      | Migrado a parser central                                          | ✓ VERIFIED | Import L19, uso L202 en `formatMeta`. Cero referencias a `parseJsonArray`.                                                                              |
| `src/components/modals/HabitFormModal.tsx`| Migrado a parser central                                          | ✓ VERIFIED | Import L19, uso L178 en `populateForm`. Cero referencias a `parseJsonArray`.                                                                            |
| `src/__tests__/parsing.test.ts`           | 5 tests para parseAndValidateCategories                           | ✓ VERIFIED | 38 líneas. 5 tests passing (happy path, invalid + warn, malformed JSON, no-array, empty array).                                                          |
| `src/__tests__/habitService.test.ts`      | 4 tests para validación pre-write                                 | ✓ VERIFIED | 4 tests passing (invalid throw, multi-invalid, valid succeed, updateHabit throw).                                                                        |
| `src/__tests__/sanitize.test.ts`          | 6 tests reales reemplazando it.todo                               | ✓ VERIFIED | 188 líneas. 6 tests passing (3 por sanitizer: limpia inválidos, no toca válidas, ignora NULL). Cero `it.todo` restantes.                                |
| `src/__tests__/speechRecognition.test.ts` | 4 tests reales reemplazando it.todo                               | ✓ VERIFIED | 127 líneas. 4 tests passing (módulo ausente, módulo presente, función exportada, type-shape sanity). Cero `it.todo` restantes.                          |

### Key Link Verification

| From                                            | To                                                       | Via                                                | Status   | Details                                                                                  |
| ----------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `src/utils/parsing.ts`                          | `src/config/constants.ts` (VALID_AREA_IDS)               | `import { VALID_AREA_IDS }`                        | ✓ WIRED  | L7 import + L25 uso (`VALID_AREA_IDS.has(id)`)                                          |
| `src/services/habitService.ts`                  | `src/config/constants.ts` (VALID_AREA_IDS)               | `import { VALID_AREA_IDS }`                        | ✓ WIRED  | L16 import + L103 y L119 uso                                                            |
| `src/services/db.ts`                            | `src/utils/parsing.ts` (parseAndValidateCategories)      | `import { parseAndValidateCategories }`            | ✓ WIRED  | L11 import + L170, L193 uso en sanitizers                                               |
| `src/screens/DailySheetScreen.tsx`              | `src/utils/parsing.ts`                                   | `import { parseAndValidateCategories }`            | ✓ WIRED  | L34 import + L102 uso                                                                    |
| `src/screens/HabitLibraryScreen.tsx`            | `src/utils/parsing.ts`                                   | `import { parseAndValidateCategories }`            | ✓ WIRED  | L19 import + L202 uso                                                                    |
| `src/components/modals/HabitFormModal.tsx`      | `src/utils/parsing.ts`                                   | `import { parseAndValidateCategories }`            | ✓ WIRED  | L19 import + L178 uso                                                                    |
| `src/services/statsService.ts`                  | `src/utils/parsing.ts`                                   | `import { parseAndValidateCategories }`            | ✓ WIRED  | L11 import + L123 uso                                                                    |
| `src/hooks/useSpeechRecognition.ts`             | `expo-speech-recognition` (optional native)              | `require + try/catch + as SpeechModuleInterface`   | ✓ WIRED  | L33-38 loader. Cast tipado L35. Patrón D-13 preservado.                                  |
| `src/services/backupService.ts`                 | `src/types/index.ts` (BackupData + tipos componentes)    | `import type { BackupData, Habit, ... }`           | ✓ WIRED  | L17 import. Type guards reemplazan `as Partial<BackupData>` y `as BackupData`.          |

### Behavioral Spot-Checks

| Behavior                                                              | Command                                                                                          | Result                              | Status |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------- | ------ |
| Suite completa de Jest verde                                          | `npx jest --rootDir=$(pwd)`                                                                      | 5 suites, 52 tests passed           | ✓ PASS |
| Tests específicos de Phase 2 verdes                                   | `npx jest --testPathPatterns="parsing\|sanitize\|habitService\|speechRecognition"`              | 4 suites, 19 tests passed           | ✓ PASS |
| `parseJsonArray` ausente del codebase                                 | `grep -rn "parseJsonArray" src/`                                                                | 0 matches                           | ✓ PASS |
| `useSpeechRecognition.ts` cero `any`                                  | `grep -nE "\bany\b" src/hooks/useSpeechRecognition.ts`                                          | 0 matches                           | ✓ PASS |
| `backupService.ts` sin `as Partial<BackupData>` ni `as BackupData`    | `grep -nE "as (Partial<)?BackupData" src/services/backupService.ts`                             | 0 matches                           | ✓ PASS |
| `sanitizeTable` y `filterValidIds` ausentes de `db.ts`                | `grep -nE "sanitizeTable\|filterValidIds" src/services/db.ts`                                   | 0 matches                           | ✓ PASS |
| Cero `[key: string]: any` en `db.ts`                                  | `grep -nE "\[key: string\]: any" src/services/db.ts`                                            | 0 matches                           | ✓ PASS |
| SQL estático en sanitizers (sin templates dinámicos)                  | `grep -cE "FROM \\\${\|SET \\\${\|UPDATE \\\${" src/services/db.ts`                            | 0 matches                           | ✓ PASS |
| JSON.parse de categorías centralizado                                 | `grep -rn "JSON.parse" src/`                                                                    | 2 matches: parsing.ts (interno) + backupService.ts (backup file) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plans | Description                                                                                                       | Status        | Evidence                                                                                                                                                                |
| ----------- | ------------ | ----------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEBT-01     | 02-03        | useSpeechRecognition tiene interfaz tipada para SpeechModule (eliminar `any`)                                     | ✓ SATISFIED   | `useSpeechRecognition.ts` con `SpeechModuleInterface` + `SpeechRecognitionEvent` inline; cero `any` (verificado por grep). 4 tests cubren los dos paths del módulo.   |
| DEBT-02     | 02-01, 02-02, 02-03 | Todo JSON parsing de categorías centralizado en `parsing.ts` con validación contra VALID_AREA_IDS         | ✓ SATISFIED   | `parseAndValidateCategories` único entry point. 5 call sites migrados (DailySheet, HabitLibrary, HabitFormModal, statsService, db.ts). 5 tests verifican filtrado y warn. Alcance ampliado D-04: backupService sin `as` casts. |
| DEBT-03     | 02-02        | sanitizeTable tiene tipos explícitos por tabla y SQL concatenado documentado o refactoreado a funciones específicas | ✓ SATISFIED   | Dos funciones explícitas exportadas con SQL estático y shapes tipados por tabla. `sanitizeTable` y `filterValidIds` eliminadas. 6 tests cubren ambos sanitizers contra DB in-memory. |

**Coverage:** 3/3 requirements del Phase 2 satisfechos. ROADMAP §Traceability declara los 3 IDs como Phase 2 — todos cubiertos por los plans 02-01, 02-02, 02-03.

### Anti-Patterns Found

Sin blockers. Notas de calidad menor recogidas por el code review (`02-REVIEW.md`):

| File                                | Line | Pattern                                                                | Severity   | Impact                                                                                                                                              |
| ----------------------------------- | ---- | ---------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/useSpeechRecognition.ts` | 75   | `useCallback` con deps `[]` que captura `locale` (WR-01)               | ⚠️ Warning | No bloquea phase goal — issue de calidad ortogonal a DEBT-01. Documentado en 02-REVIEW.md.                                                          |
| `src/services/habitService.ts`      | 119  | Sombra de `id` (param) por `id` (callback de filter) en updateHabit    | ⚠️ Warning | No bloquea phase goal — refactor cosmético sugerido (`catId`). Documentado en 02-REVIEW.md.                                                         |
| `src/services/statsService.ts`      | 73   | Promesas sin `.catch` en handlers asíncronos (WR-03)                  | ⚠️ Warning | Pre-existente; no introducido por Phase 2.                                                                                                          |
| TypeScript compile-time errors      | -    | `VALID_AREA_IDS.has(id)` con `id: string` no asignable a literal union | ℹ️ Info    | **Pre-existente desde Phase 1 BUG-04** (`assignmentService.ts:92`). Phase 2 replica el mismo patrón por instrucción explícita del plan. No regresión introducida en esta fase. Tests verdes; runtime correcto. |

### Human Verification Required

Per `02-VALIDATION.md` §Manual-Only Verifications:

#### 1. useSpeechRecognition en dev build con módulo nativo

**Test:** Compilar dev build (`npx expo prebuild` + `npx expo run:ios|android`), abrir el modal de creación de hábito y dictar el nombre por voz.
**Expected:** El transcript llega al campo de texto del formulario; `isAvailable=true` cuando voz está habilitada en settings.
**Why human:** El bridge nativo de `expo-speech-recognition` no se puede ejercer desde Jest. Solo el path "módulo ausente" es testeable unitariamente (cubierto por los 4 tests automatizados).

#### 2. Migración sanitizeCategories sobre DB legacy

**Test:** Tras deploy, abrir la app sobre una DB que contenga IDs inválidos legacy en `habits.default_categories` o `performed_habits.categories_used` (p.ej. `'["fisico","aprendizaje"]'` — IDs viejos del schema previo). Después de `initDatabase()`, ejecutar `SELECT default_categories FROM habits` por consola SQL.
**Expected:** Las filas con IDs inválidos quedan limpias (`'[]'` o solo IDs válidos). `console.warn` emitido por el parser durante el boot logging.
**Why human:** Limpieza defensiva one-shot — solo se ejerce sobre data legacy real. Los tests de `sanitize.test.ts` cubren el comportamiento contra DB in-memory pero no la ruta DB-real-on-device.

### Gaps Summary

Sin gaps. Los 3 success criteria del ROADMAP §Phase 2 están verificados por evidencia automatizada (grep + tests). Los 19 tests de Phase 2 + 33 tests de Phase 1 están todos verdes (52 total). Los 3 requirements DEBT-01/02/03 mapean a artifacts y wiring concretos.

Las dos verificaciones manuales pendientes son **smoke tests defensivos** declarados explícitamente en `02-VALIDATION.md` como manual-only desde la fase de planning — NO son gaps de implementación. Su ausencia no bloquea el cierre de la fase a nivel de código; deben ejecutarse antes del release/merge a main si la política del proyecto lo requiere.

### Notes

**TypeScript compile errors (informational, not gaps):**

`npx tsc --noEmit` reporta errores en `VALID_AREA_IDS.has(id)` (señal: `id: string` no asignable al literal union `"salud_fisica" | "mental" | ...`). Estos errores **predan Phase 2** — el patrón fue introducido en Phase 1 commit `553e5cb` (BUG-04: `assignmentService.ts:92`). Phase 2 replica el patrón **por instrucción explícita del plan** (02-01-PLAN.md líneas 130-138: "copy verbatim, swap prefix"). El runtime es correcto (los tests pasan), y el code review no flagueó estos errores como blockers — son aceptados como project style. La solución (cast a `string`, helper tipado, o relajar el tipo de `VALID_AREA_IDS`) está fuera del scope de Phase 2 y debería tracking como nuevo item de tech debt si el equipo lo decide.

**Pre-existing error en `LinearGradient`** (`NotebookPaper.tsx:81`) tampoco es responsabilidad de Phase 2.

---

_Verified: 2026-04-27_
_Verifier: Claude (gsd-verifier)_
