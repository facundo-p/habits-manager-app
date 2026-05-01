---
phase: 02-tech-debt
reviewed: 2026-04-27T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/__tests__/habitService.test.ts
  - src/__tests__/parsing.test.ts
  - src/__tests__/sanitize.test.ts
  - src/__tests__/speechRecognition.test.ts
  - src/components/modals/HabitFormModal.tsx
  - src/hooks/useSpeechRecognition.ts
  - src/screens/DailySheetScreen.tsx
  - src/screens/HabitLibraryScreen.tsx
  - src/services/backupService.ts
  - src/services/db.ts
  - src/services/habitService.ts
  - src/services/statsService.ts
  - src/utils/parsing.ts
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-27
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

La fase 02 (DEBT-01/02/03) cumple bien sus objetivos: centraliza el parser de categorías en `parseAndValidateCategories`, valida en escritura en `habitService` (siguiendo el patrón BUG-04), elimina los `as any` del backup y tipa la superficie de `useSpeechRecognition`. El pipeline de tests (Jest in-memory + mock de `expo-sqlite`) cubre los casos relevantes.

Hallazgos:
- 4 advertencias relacionadas a (a) closures de `useCallback` con dependencias faltantes en el hook de voz, (b) timezone UTC silencioso en cómputos de fecha (ya presentes en el código pero relevantes ahora que `getWeekBounds` se usa más), (c) promesas sin `.catch` en handlers del screen `Hoy`, y (d) shadowing del parámetro `id` en `updateHabit`.
- 6 ítems Info de calidad menor (mocks redundantes en tests, un test que no testea, sin renderHook, etc.).

No hay issues críticos. Las advertencias son corregibles con cambios localizados.

## Warnings

### WR-01: `useCallback` con dependencias faltantes en `useSpeechRecognition`

**File:** `src/hooks/useSpeechRecognition.ts:75`
**Issue:** `start` se memoiza con deps `[]`, pero el cuerpo lee `locale` (línea 71). Si el usuario cambia el idioma en `useSettingsStore`, el `start` memoizado captura el `locale` viejo; al ejecutarse llamará `start({ lang: <stale> })`. Mismo riesgo en `stop` (deps `[]`, no usa estado externo, OK) y `toggle` (deps correctas). El issue concreto es solo `start`.
**Fix:**
```typescript
const start = useCallback(async () => {
  if (!SpeechModule) {
    Alert.alert(ALERT_VOICE_UNAVAILABLE.title, ALERT_VOICE_UNAVAILABLE.message);
    return;
  }
  try {
    setIsListening(true);
    await SpeechModule.ExpoSpeechRecognitionModule?.start?.({ lang: locale });
  } catch {
    setIsListening(false);
  }
}, [locale]);
```
Alternativa: usar `useRef` para el locale si se quiere evitar recrear `start` con cada cambio de idioma.

---

### WR-02: Timezone UTC en helpers de fecha (consistencia, no rotura — pero el bug latente sigue)

**File:** `src/services/db.ts:30-46` y `src/services/statsService.ts:24-41`
**Issue:** `getTodayPrefix()`, `getNowTimestamp()`, `getTimestampForDate()` y `formatDateOnly()` usan `new Date().toISOString()`, que produce UTC. Para usuarios en `es-AR` (UTC-3), entre 21:00-23:59 local el "día" calculado pertenece al día siguiente UTC, lo que rompe el agrupamiento por fecha en `daily_assignments` y `taskRepo.findByDate`. La fase 02 no introdujo el bug, pero `getWeekBounds` (statsService línea 28-41) ahora lo amplifica: `monday.setDate(...)` opera en local, pero el resultado se serializa con `toISOString()`. La inconsistencia entre cálculo local + serialización UTC puede dar lunes "off-by-one".
**Fix:** Centralizar un único helper `formatLocalDate(date: Date): YYYY-MM-DD` que use `getFullYear()/getMonth()/getDate()` en local. Sustituir todas las llamadas a `toISOString().slice(0,10)`. Ejemplo:
```typescript
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```
Nota: Si esta corrección está fuera de alcance de DEBT-02/03, dejar TODO explícito en el archivo y documentar en `lessons.md` que las dos rutas (`getTodayPrefix` y `formatDateOnly`) deben moverse en un mismo refactor.

---

### WR-03: Promesas sin `.catch` en handlers de `DailySheetScreen`

**File:** `src/screens/DailySheetScreen.tsx:260` y `src/screens/DailySheetScreen.tsx:297-300`
**Issue:** Dos sitios encadenan `.then(...)` sin `.catch(...)`:
```typescript
toggleItem(item).then(() => triggerSuccess());                 // línea 260
addSpontaneous(name, categories).then(() => { ... });          // líneas 297-300
```
Si `toggleItem` o `addSpontaneous` rechazan (por ejemplo, `addSpontaneous` ahora puede tirar el error de validación de BUG-04 / D-15), la rejección queda como unhandled promise. En React Native esto genera un yellow-box en dev y silencia el error en prod.
**Fix:** Convertir a `async`/`await` con try/catch que muestre `Alert` o usar `.catch`:
```typescript
const handleSaveSpontaneous = useCallback(
  async (name: string, categories: string[]) => {
    try {
      await addSpontaneous(name, categories);
      triggerSuccess();
      setSpontaneousVisible(false);
    } catch (e) {
      Alert.alert('Error', String(e instanceof Error ? e.message : e));
    }
  },
  [addSpontaneous, triggerSuccess],
);
```
Aplicar el mismo patrón a `handlePress` (línea 260).

---

### WR-04: Shadowing del parámetro `id` en `updateHabit`

**File:** `src/services/habitService.ts:119`
**Issue:** En `updateHabit(id, name, ...)`, el callback de `categories.filter((id) => !VALID_AREA_IDS.has(id))` usa `id` como variable de iteración, sombreando el parámetro `id` (UUID del habit). Si en el futuro alguien edita el bloque para incluir `id` en el mensaje de error, podrá referenciar accidentalmente el `id` interno (string de categoría) en lugar del habit ID. El mismo patrón aparece en `createHabit:103`, pero ahí no hay parámetro `id` y el riesgo es nulo.
**Fix:** Renombrar la variable interna:
```typescript
const invalidIds = categories.filter((catId) => !VALID_AREA_IDS.has(catId));
if (invalidIds.length > 0) {
  throw new Error(
    `updateHabit: categorias invalidas — ${invalidIds.join(', ')}`,
  );
}
```
Aplicar también en `createHabit` por consistencia, aunque ahí no haya bug latente.

---

## Info

### IN-01: `console.warn` masivo durante `sanitizeCategories` en migraciones legacy

**File:** `src/services/db.ts:152-201`
**Issue:** `sanitizeHabitDefaultCategories` y `sanitizePerformedCategoriesUsed` llaman a `parseAndValidateCategories` por fila; cada fila con IDs inválidos emite un `console.warn` desde el parser (parsing.ts:32). En una migración con N filas legacy contaminadas, se emiten N warnings, lo que satura la consola en startup.
**Fix:** Considerar un parámetro opcional `silent?: boolean` en `parseAndValidateCategories`, o agrupar el log en `sanitizeXxx` (un solo warn con el conteo total de filas y de IDs descartados). Bajo impacto, pero útil para QA.

---

### IN-02: `viewDate!` non-null assertion en `DailySheetScreen`

**File:** `src/screens/DailySheetScreen.tsx:329`
**Issue:** `isHistoric` se calcula como `isValidDateString(viewDate)` y luego se usa `viewDate!` para forzar non-null. La invariante es correcta (si `isHistoric` es `true`, `viewDate` no es null), pero el `!` rompe la garantía de TS.
**Fix:** Estrechar el tipo con un type guard explícito o `if (!isHistoric || !viewDate) return ...`:
```typescript
{isHistoric && viewDate ? (
  <AppScreenHeader title="Editando" subtitle={formatHistoricDate(viewDate)} />
) : (
  <AppScreenHeader title="Hoy" subtitle={formatTodayDate()} />
)}
```

---

### IN-03: Test "type-shape" no ejerce código real

**File:** `src/__tests__/speechRecognition.test.ts:119-125`
**Issue:** El test `SpeechRecognitionEvent type-shape: results opcional, transcript string` solo declara dos objetos locales y los compara — no exporta nada del módulo bajo test. Es una aserción estática que TypeScript ya garantiza en compilación. Como test runtime no agrega cobertura.
**Fix:** Eliminar el test, o reemplazarlo por una verificación de que `useSpeechRecognition` retorna `{ isListening, isAvailable, toggle }` cuando se carga el módulo (smoke test funcional).

---

### IN-04: Doble `jest.mock`/`jest.doMock` redundante en `speechRecognition.test.ts`

**File:** `src/__tests__/speechRecognition.test.ts:18-44` y `49-70`
**Issue:** Los `jest.mock` a nivel module (líneas 18-44) y los `jest.doMock` dentro de `beforeEach` (líneas 49-70) declaran el mismo shape para `react`, `react-native`, `../config/constants` y `../store/useSettingsStore`. Tras `jest.resetModules()` solo los `doMock` son efectivos, así que los `jest.mock` superiores son ruido (aunque sirven antes del primer `resetModules`). Mantener ambos invita a que diverjan.
**Fix:** Quedarse solo con `jest.doMock` dentro del `beforeEach`, o solo con `jest.mock` y eliminar `jest.resetModules()`. Documentar en un comentario por qué se eligió el patrón.

---

### IN-05: `migrateSchema` solo migra `is_active`, no es extensible

**File:** `src/services/db.ts:130-140`
**Issue:** La función está hardcoded a un solo `ALTER TABLE` para una sola columna. La próxima migración requerirá copy-paste del check + `ALTER`. No es bug, pero es deuda técnica inminente.
**Fix:** Sugerir (en una próxima fase) tabla `_migrations` o array de migraciones con `version`. No bloquea fase 02.

---

### IN-06: `parseAndValidate` en backup acepta `daily_assignments` faltante pero no lo señala

**File:** `src/services/backupService.ts:117-119`
**Issue:** Si `daily_assignments` falta en el JSON, se asigna `[]` silenciosamente. Para backups de versiones previas a la introducción de la tabla, esto es intencional. Pero un backup corrupto que perdió la sección no se distingue de uno legacy.
**Fix:** Si `version >= N` (donde N = la versión que introdujo daily_assignments), validar que la propiedad exista. Sino, mantener fallback a `[]` con un `console.warn`. El comentario actual ("validación profunda fuera de scope") cubre la decisión, pero conviene documentarlo en el README de backup.

---

_Reviewed: 2026-04-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
