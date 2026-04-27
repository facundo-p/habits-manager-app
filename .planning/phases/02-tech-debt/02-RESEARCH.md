# Phase 2: Tech Debt - Research

**Researched:** 2026-04-26
**Domain:** TypeScript type safety, JSON parsing centralization, SQLite query typing (React Native / Expo / SQLite)
**Confidence:** HIGH — all findings verified directly from source files in this session

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**DEBT-02: Parser central de categorías**
- D-01: `src/utils/parsing.ts` expone una sola función `parseAndValidateCategories(json: string): string[]`. Reemplaza completamente a `parseJsonArray`. Parsea JSON, garantiza array, filtra contra `VALID_AREA_IDS`, y retorna solo IDs válidos.
- D-02: Los 4 call sites migran al nuevo parser: `DailySheetScreen.tsx:102`, `HabitLibraryScreen.tsx:202`, `HabitFormModal.tsx:178`, `statsService.ts:124`. Ninguno de estos archivos llama directamente a `JSON.parse` para categorías ni usa `parseJsonArray` tras la migración.
- D-03: `sanitizeTable` en `db.ts` consume el parser central — `filterValidIds` desaparece. La sanitización serializa el resultado con `JSON.stringify` antes del UPDATE.
- D-04 (alcance ampliado): `src/services/backupService.ts:81` también se tipa explícitamente. La cast `as Partial<BackupData>` desaparece — se reemplaza por un parser tipado con validación de shape + retorno `BackupData | null`.

**DEBT-03: sanitizeTable refactor**
- D-05: `sanitizeTable(db, table, column)` genérico se elimina por completo. Se reemplaza por dos funciones explícitas: `sanitizeHabitDefaultCategories(db)` y `sanitizePerformedCategoriesUsed(db)`.
- D-06: Cada función contiene su SQL fijo (sin template strings dinámicos) y usa el parser central.
- D-07: El tipo `{ id: string; [key: string]: any }` desaparece. Cada función usa el shape exacto de su SELECT.
- D-08: Sin helper compartido entre las dos funciones (duplicación ≤14 líneas, dentro de la regla >20 líneas → refactor).
- D-09: Reescritura con `json_extract` SQL queda deferred (PERF-V2-03).

**DEBT-01: Type safety en useSpeechRecognition**
- D-10: `SpeechModuleInterface` inline en `src/hooks/useSpeechRecognition.ts`. No se extrae a `src/types/` (YAGNI).
- D-11: La interfaz tipa solo la superficie que usa el hook: `addResultListener` y `ExpoSpeechRecognitionModule`.
- D-12: El `any` del callback (línea 41) se reemplaza por `SpeechRecognitionEvent` local con `{ results?: Array<{ transcript: string }> }`. Ambos `any` (líneas 16 y 41) deben desaparecer.
- D-13: El loader `require('expo-speech-recognition')` + try/catch se mantiene. Sin migrar a `await import()`.

**Validación de IDs en lectura/escritura**
- D-14 (lectura): `parseAndValidateCategories` filtra IDs inválidos silenciosamente Y emite `console.warn` con los IDs descartados.
- D-15 (escritura — alcance ampliado): `addHabit`/`updateHabit` en `habitService` validan categorías contra `VALID_AREA_IDS` antes del INSERT/UPDATE y throwean error descriptivo listando IDs inválidos. Cierra la última puerta abierta.

### Claude's Discretion
- Forma exacta de la firma de `parseAndValidateCategories` (puede incluir metadata sobre IDs descartados si útil para tests).
- Estructura interna del parser tipado de `BackupData` (validación shape-by-shape, type guards, o helper genérico con `Object.hasOwn`).
- Estrategia de tests: tests unitarios para el parser central, tests de migración de call sites, tests para validación de escritura de habits.
- Mensajes exactos de error para validación de escritura (seguir el estilo de BUG-04 validado en Phase 1).
- Si el helper de validación de escritura es exportado como parte de `parsing.ts` o vive en `habitService` / un nuevo `validation.ts`.

### Deferred Ideas (OUT OF SCOPE)
- Reescribir `sanitizeCategories` con `json_extract` SQL (PERF-V2-03).
- Extraer `SpeechModuleInterface` a `src/types/speech.ts`.
- Migrar el patrón `require()` a `await import()`.
- Validación de `mood_entries` u otros campos JSON distintos a categorías y backup.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-01 | `useSpeechRecognition` tiene interfaz tipada para SpeechModule (eliminar `any`) | Hook verificado: 2 `any` en líneas 16 y 41. Interfaz local suficiente — ver sección DEBT-01. |
| DEBT-02 | Todo JSON parsing de categorías centralizado en `parsing.ts` con validación contra `VALID_AREA_IDS` | 4 call sites de `parseJsonArray` verificados. `VALID_AREA_IDS` ya existe. Ver sección DEBT-02. |
| DEBT-03 | `sanitizeTable` tiene tipos explícitos por tabla y SQL concatenado documentado o refactoreado a funciones específicas | `sanitizeTable` verificada: 1 `any` indexado, template strings dinámicos. Ver sección DEBT-03. |
</phase_requirements>

---

## Summary

Phase 2 es una fase de refactor puro: cero features nuevas, cero cambios de UI. El objetivo es eliminar todos los `any` explícitos del codebase, centralizar el parsing de categorías, y hacer que el SQL de sanitización sea estático y tipado. Las tres áreas de deuda están perfectamente delimitadas y los archivos a modificar son exactamente los referenciados en CONTEXT.md — no hay sorpresas.

La investigación del codebase real confirma que el scope definido en CONTEXT.md es correcto y completo. Los únicos `any` del proyecto son los 3 identificados: `useSpeechRecognition.ts:16`, `useSpeechRecognition.ts:41`, y `db.ts:157`. Los únicos `JSON.parse` de categorías son los que pasan por `parseJsonArray` (4 call sites) y `filterValidIds` en `db.ts` (que se elimina). El único `as` assertion problemático es `backupService.ts:81`.

**Primary recommendation:** Implementar en un solo plan (02-01) que cubra las 3 deudas en orden: (1) parser central + call sites, (2) sanitizeTable refactor, (3) tipos en useSpeechRecognition + backup parser. Este orden minimiza dependencias — el parser central es el bloque base que DEBT-03 consume, por lo que debe crearse primero.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Parsing de JSON de categorías | Utils (parsing.ts) | Services (consumidores) | Función pura sin efectos, sin acceso a DB — correcto en `utils/` |
| Validación de IDs de categorías en escritura | Service (habitService) | — | Validación de negocio va en service layer, nunca en repository (CRUD puro) |
| Sanitización de DB en init | Service (db.ts) | — | db.ts es el punto único de inicialización del schema; las dos funciones explícitas viven ahí |
| Tipos del módulo de speech | Hook (useSpeechRecognition.ts) | — | Interfaz solo usada en este archivo — inline por YAGNI |
| Parser tipado de BackupData | Service (backupService.ts) | — | La función `parseAndValidate` ya vive ahí; solo se le quita el `as` |

---

## Standard Stack

No se agregan dependencias externas en esta fase. Todo el refactor usa herramientas ya presentes.

### Core (ya en el proyecto)
| Elemento | Versión | Uso en esta fase |
|----------|---------|-----------------|
| TypeScript strict mode | tsconfig.json | Garantiza que los `any` eliminados no vuelvan a compilar |
| `VALID_AREA_IDS` (Set) | constants.ts | El único validador para IDs de área — usado en parser central y validación de escritura |
| `expo-sqlite` | ~16.0.10 | `getAllAsync<T>` con tipo explícito en las dos funciones de sanitización |
| Jest + ts-jest | jest.config.js | Tests unitarios del parser central y validación de escritura |

### No instalar
No se agregan librerías. Zod u otras librerías de validación quedan fuera de scope — la validación por `VALID_AREA_IDS.has()` es suficiente y ya existe en el proyecto.

---

## Architecture Patterns

### Data Flow: Category Parsing (estado actual → estado objetivo)

**Actual:**
```
DB (JSON string) ─→ [4 call sites] ─→ parseJsonArray() ─→ string[]
                                                           (sin filtro VALID_AREA_IDS)

DB (JSON string) ─→ filterValidIds() ─→ JSON.stringify ─→ DB UPDATE
                    (en db.ts, duplica lógica de parsing)
```

**Objetivo tras Phase 2:**
```
DB (JSON string) ─→ parseAndValidateCategories() ─→ string[] (solo IDs válidos)
                    (único punto, en parsing.ts)
                         ↑ consumido por:
                         ├── DailySheetScreen.tsx (display de badges)
                         ├── HabitLibraryScreen.tsx (display de meta)
                         ├── HabitFormModal.tsx (populate form)
                         ├── statsService.ts (aggregateByCategory)
                         ├── sanitizeHabitDefaultCategories() (db.ts)
                         └── sanitizePerformedCategoriesUsed() (db.ts)
```

### Recommended Project Structure (sin cambios de estructura de directorios)

La fase no agrega ni mueve archivos. Modifica los existentes:

```
src/
├── utils/
│   └── parsing.ts           # REPLACE parseJsonArray → parseAndValidateCategories
├── services/
│   ├── db.ts                # REPLACE sanitizeTable/filterValidIds → 2 funciones explícitas
│   ├── habitService.ts      # ADD validación de escritura en createHabit/updateHabit
│   └── backupService.ts     # FIX parseAndValidate: quitar 'as Partial<BackupData>'
├── hooks/
│   └── useSpeechRecognition.ts  # ADD SpeechModuleInterface + SpeechRecognitionEvent, quitar 2 any
├── screens/
│   ├── DailySheetScreen.tsx     # MIGRATE parseJsonArray → parseAndValidateCategories
│   └── HabitLibraryScreen.tsx   # MIGRATE parseJsonArray → parseAndValidateCategories
└── components/
    └── modals/
        └── HabitFormModal.tsx   # MIGRATE parseJsonArray → parseAndValidateCategories
```

---

## DEBT-01: useSpeechRecognition — Estado actual y solución

### Estado actual (verificado)

**Archivo:** `src/hooks/useSpeechRecognition.ts`

```typescript
// Línea 16 — PROBLEMA: tipo any para módulo opcional
let SpeechModule: any = null;
try {
  SpeechModule = require('expo-speech-recognition');
} catch { /* Módulo no disponible */ }

// Línea 41 — PROBLEMA: event tipado como any
const sub = SpeechModule.addResultListener?.((event: any) => {
  const transcript = event?.results?.[0]?.transcript ?? '';
  ...
});
```

La API que usa el hook (superficie mínima verificada en el código):
- `SpeechModule.addResultListener(cb)` → retorna `{ remove(): void } | undefined`
- `SpeechModule.ExpoSpeechRecognitionModule.start({ lang: string })` → `Promise<void>`
- `SpeechModule.ExpoSpeechRecognitionModule.stop()` → `Promise<void>`
- `event.results[0].transcript` → `string`

### Solución (D-10, D-11, D-12, D-13)

```typescript
// [VERIFIED: archivo fuente líneas 16-55]

// Interfaces locales — no importar del paquete (puede no estar instalado)
interface SpeechRecognitionEvent {
  results?: Array<{ transcript: string }>;
}

interface SpeechModuleInterface {
  addResultListener(
    cb: (event: SpeechRecognitionEvent) => void,
  ): { remove(): void } | undefined;
  ExpoSpeechRecognitionModule?: {
    start(opts: { lang: string }): Promise<void>;
    stop(): Promise<void>;
  };
}

// Módulo tipado — mantener require() + try/catch (D-13)
let SpeechModule: SpeechModuleInterface | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SpeechModule = require('expo-speech-recognition') as SpeechModuleInterface;
} catch {
  // Módulo no disponible (Expo Go)
}
```

El callback de `addResultListener` usa la interfaz local `SpeechRecognitionEvent`:
```typescript
const sub = SpeechModule.addResultListener?.((event: SpeechRecognitionEvent) => {
  const transcript = event?.results?.[0]?.transcript ?? '';
  if (transcript) callbackRef.current(transcript);
});
```

### Verificación de éxito
- `grep -n "any" src/hooks/useSpeechRecognition.ts` → 0 resultados
- TypeScript compila sin errores

---

## DEBT-02: Parser central de categorías — Estado actual y solución

### Estado actual (verificado)

**`src/utils/parsing.ts` — función actual:**
```typescript
export function parseJsonArray(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
```

**4 call sites de `parseJsonArray` verificados:**

| Archivo | Línea | Contexto |
|---------|-------|----------|
| `src/screens/DailySheetScreen.tsx` | 102 | `const ids = parseJsonArray(categories)` — render de AreaBadges |
| `src/screens/HabitLibraryScreen.tsx` | 202 | `const cats = parseJsonArray(habit.default_categories)` — formatMeta |
| `src/components/modals/HabitFormModal.tsx` | 178 | `setCats(parseJsonArray(habit.default_categories))` — populateForm |
| `src/services/statsService.ts` | 124 | `const rawCats = parseJsonArray(row.categories_used)` — aggregateByCategory |

**Nota sobre `statsService.ts`:** La línea 125 ya filtra manualmente con `VALID_AREA_IDS`:
```typescript
const cats = [...new Set(rawCats)].filter((id) => VALID_AREA_IDS.has(id as never));
```
Tras la migración, ese filtro explícito desaparece — lo hace el parser central.

**`src/services/db.ts` — función a eliminar:**
```typescript
function filterValidIds(json: string): string {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return '[]';
    const filtered = arr.filter((id: string) => VALID_AREA_IDS.has(id));
    return JSON.stringify(filtered);
  } catch {
    return '[]';
  }
}
```

### Solución (D-01, D-14)

```typescript
// [VERIFIED: basado en parseJsonArray existente + VALID_AREA_IDS existente]
// src/utils/parsing.ts — reemplaza parseJsonArray completamente

import { VALID_AREA_IDS } from '../config/constants';

/**
 * Parsea un JSON de array de categorías de forma segura.
 * Filtra IDs inválidos silenciosamente y emite console.warn con los descartados.
 * Retorna [] ante cualquier error de parsing.
 */
export function parseAndValidateCategories(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const id of arr) {
      if (typeof id === 'string' && VALID_AREA_IDS.has(id)) {
        valid.push(id);
      } else {
        invalid.push(String(id));
      }
    }
    if (invalid.length > 0) {
      console.warn('[parseAndValidateCategories] IDs de área inválidos descartados:', invalid);
    }
    return valid;
  } catch {
    return [];
  }
}
```

**Migración de call sites** — cambio de import y función en cada archivo:
```typescript
// ANTES:
import { parseJsonArray } from '../utils/parsing';
// ... uso:
parseJsonArray(categories)

// DESPUÉS:
import { parseAndValidateCategories } from '../utils/parsing';
// ... uso:
parseAndValidateCategories(categories)
```

**Nota para `statsService.ts`:** Eliminar también el filtro redundante post-parse:
```typescript
// ANTES (líneas 124-125):
const rawCats = parseJsonArray(row.categories_used);
const cats = [...new Set(rawCats)].filter((id) => VALID_AREA_IDS.has(id as never));

// DESPUÉS:
const cats = [...new Set(parseAndValidateCategories(row.categories_used))];
// El filtro VALID_AREA_IDS lo hace el parser — no duplicar
```

### Validación de escritura (D-15)

En `habitService.ts`, `createHabit` y `updateHabit` actualmente hacen:
```typescript
return habitRepo.insert(name, frequency, basePoints, JSON.stringify(categories));
```

Agregar validación antes del stringify:
```typescript
// En createHabit y updateHabit — antes del habitRepo.insert/update
const invalidIds = categories.filter((id) => !VALID_AREA_IDS.has(id));
if (invalidIds.length > 0) {
  throw new Error(
    `Categorías inválidas: ${invalidIds.join(', ')}. ` +
    `Valores aceptados: ${[...VALID_AREA_IDS].join(', ')}`
  );
}
```

Claude tiene discreción sobre si este helper se extrae a `parsing.ts` o vive inline en `habitService`.

---

## DEBT-03: sanitizeTable — Estado actual y solución

### Estado actual (verificado)

**`src/services/db.ts` — función completa:**

```typescript
// Línea 147: caller
async function sanitizeCategories(db: SQLite.SQLiteDatabase): Promise<void> {
  await sanitizeTable(db, 'habits', 'default_categories');
  await sanitizeTable(db, 'performed_habits', 'categories_used');
}

// Líneas 152-170: función genérica con any + SQL dinámico
async function sanitizeTable(
  db: SQLite.SQLiteDatabase,
  table: string,    // dinámico — SQL injection risk (aunque solo se llama con constantes)
  column: string,   // dinámico — mismo riesgo
): Promise<void> {
  const rows = await db.getAllAsync<{ id: string; [key: string]: any }>(  // ← any problemático
    `SELECT id, ${column} FROM ${table} WHERE ${column} IS NOT NULL`,     // ← SQL concatenado
  );

  for (const row of rows) {
    const cleaned = filterValidIds(row[column]);  // ← filterValidIds desaparece
    if (cleaned !== row[column]) {
      await db.runAsync(
        `UPDATE ${table} SET ${column} = ? WHERE id = ?`,  // ← SQL concatenado
        [cleaned, row.id],
      );
    }
  }
}
```

**Tablas implicadas y sus shapes exactos:**

| Tabla | Columna | Shape del SELECT |
|-------|---------|-----------------|
| `habits` | `default_categories` | `{ id: string; default_categories: string \| null }` |
| `performed_habits` | `categories_used` | `{ id: string; categories_used: string \| null }` |

### Solución (D-05, D-06, D-07, D-08)

```typescript
// [VERIFIED: basado en db.ts líneas 147-180, shapes confirmados por schema SQL]

/**
 * Limpia habits.default_categories eliminando IDs de área inválidos.
 * Corre en initDatabase() — defensivo, no rompe en datos legacy.
 */
async function sanitizeHabitDefaultCategories(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  const rows = await db.getAllAsync<{ id: string; default_categories: string | null }>(
    'SELECT id, default_categories FROM habits WHERE default_categories IS NOT NULL',
  );
  for (const row of rows) {
    if (row.default_categories == null) continue;
    const cleaned = JSON.stringify(parseAndValidateCategories(row.default_categories));
    if (cleaned !== row.default_categories) {
      await db.runAsync(
        'UPDATE habits SET default_categories = ? WHERE id = ?',
        [cleaned, row.id],
      );
    }
  }
}

/**
 * Limpia performed_habits.categories_used eliminando IDs de área inválidos.
 * Corre en initDatabase() — defensivo, no rompe en datos legacy.
 */
async function sanitizePerformedCategoriesUsed(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  const rows = await db.getAllAsync<{ id: string; categories_used: string | null }>(
    'SELECT id, categories_used FROM performed_habits WHERE categories_used IS NOT NULL',
  );
  for (const row of rows) {
    if (row.categories_used == null) continue;
    const cleaned = JSON.stringify(parseAndValidateCategories(row.categories_used));
    if (cleaned !== row.categories_used) {
      await db.runAsync(
        'UPDATE performed_habits SET categories_used = ? WHERE id = ?',
        [cleaned, row.id],
      );
    }
  }
}
```

**Caller actualizado:**
```typescript
async function sanitizeCategories(db: SQLite.SQLiteDatabase): Promise<void> {
  await sanitizeHabitDefaultCategories(db);
  await sanitizePerformedCategoriesUsed(db);
}
```

**Funciones eliminadas:** `sanitizeTable` y `filterValidIds` — ambas desaparecen del archivo.

**Nota de tamaño:** Cada función tiene ~14 líneas de implementación — dentro del límite de 20 líneas del proyecto (D-08, sin refactor necesario).

---

## DEBT-04 (alcance ampliado): backupService parseAndValidate

### Estado actual (verificado)

**`src/services/backupService.ts` líneas 80-99:**

```typescript
function parseAndValidate(json: string): BackupData {
  const data = JSON.parse(json) as Partial<BackupData>;  // ← as assertion problemática

  if (!data.version || !Array.isArray(data.habits)) {
    throw new Error('Formato de respaldo inválido');
  }
  if (!Array.isArray(data.performed_habits)) {
    throw new Error('Falta performed_habits en el respaldo');
  }
  if (!Array.isArray(data.mood_entries)) {
    throw new Error('Falta mood_entries en el respaldo');
  }
  return {
    ...data,
    daily_assignments: Array.isArray(data.daily_assignments) ? data.daily_assignments : [],
  } as BackupData;  // ← segundo as assertion
}
```

**Tipo `BackupData` verificado en `src/types/index.ts`:**
```typescript
export interface BackupData {
  version: number;
  exportedAt: string;
  habits: Habit[];
  performed_habits: PerformedHabit[];
  mood_entries: MoodEntry[];
  daily_assignments: DailyAssignment[];
}
```

### Solución

El patrón correcto es parsear a `unknown`, validar el shape con guards, y retornar el tipo correcto sin `as`:

```typescript
// [VERIFIED: basado en BackupData interface en types/index.ts]
function parseAndValidate(json: string): BackupData {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Formato de respaldo inválido: JSON malformado');
  }

  if (
    raw == null ||
    typeof raw !== 'object' ||
    !('version' in raw) ||
    typeof (raw as Record<string, unknown>).version !== 'number'
  ) {
    throw new Error('Formato de respaldo inválido');
  }

  const data = raw as Record<string, unknown>;

  if (!Array.isArray(data.habits)) {
    throw new Error('Formato de respaldo inválido');
  }
  if (!Array.isArray(data.performed_habits)) {
    throw new Error('Falta performed_habits en el respaldo');
  }
  if (!Array.isArray(data.mood_entries)) {
    throw new Error('Falta mood_entries en el respaldo');
  }

  return {
    version: data.version as number,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    habits: data.habits as Habit[],
    performed_habits: data.performed_habits as PerformedHabit[],
    mood_entries: data.mood_entries as MoodEntry[],
    daily_assignments: Array.isArray(data.daily_assignments)
      ? (data.daily_assignments as DailyAssignment[])
      : [],
  };
}
```

Claude tiene discreción sobre si usar type guards inline o un helper `isRecord(v): v is Record<string, unknown>`. Ambos eliminan el `as Partial<BackupData>` y el segundo `as BackupData`.

---

## Don't Hand-Roll

| Problema | No construir | Usar en cambio | Por qué |
|----------|-------------|----------------|---------|
| Validación de tipos en runtime | Schema validator custom | `VALID_AREA_IDS.has()` (ya existe) | El set es la fuente de verdad; no agregar dependencias para lo que ya funciona |
| Typing de módulos opcionales de RN | Importar tipos del paquete real | Interfaz local inline | El paquete puede no estar instalado en runtime; la importación acoplaría innecesariamente |
| SQL dinámico "seguro" | Template strings parametrizados | Funciones explícitas por tabla | El SQL dinámico no puede validarse en compile time |

---

## Common Pitfalls

### Pitfall 1: `getAllAsync<T>` no garantiza el shape en runtime
**What goes wrong:** `expo-sqlite`'s `getAllAsync<T>` acepta un generic para autocompletar, pero no valida que la DB devuelva exactamente esos campos en runtime. El tipo es conveniente pero no defensivo.
**Why it happens:** SQLite no tiene typed columns — siempre retorna `any` internamente.
**How to avoid:** Para las dos funciones de sanitización, el shape explícito (`{ id: string; default_categories: string | null }`) es suficiente — las columnas existen en el schema. No es necesario validar el shape de cada row.
**Warning signs:** Si se cambia el schema de la tabla sin actualizar la función, TypeScript no avisa.

### Pitfall 2: Comparación de strings serializada en sanitizeTable
**What goes wrong:** La lógica de `if (cleaned !== row[column])` compara strings JSON. Si el parser reordena el array (`["a","b"]` vs `["b","a"]`), el UPDATE corre aunque los valores sean equivalentes.
**Why it happens:** `JSON.stringify` preserva el orden del array filtrado — el orden de VALID_AREA_IDS.has() es determinista si el array original no tiene duplicados.
**How to avoid:** `parseAndValidateCategories` preserva el orden del array de entrada, solo filtra. La comparación string-a-string es correcta.
**Warning signs:** Updates innecesarios en cada init si los datos tienen duplicados en el array original.

### Pitfall 3: Eliminar `parseJsonArray` rompe los imports
**What goes wrong:** Si se elimina `parseJsonArray` de `parsing.ts` antes de migrar todos los call sites, el proyecto no compila.
**Why it happens:** 4 archivos importan `parseJsonArray` por nombre.
**How to avoid:** Migrar todos los call sites en la misma tarea antes de eliminar la función vieja, o mantenerla como alias temporal durante la migración.

### Pitfall 4: `statsService.ts` tiene filtro duplicado que debe eliminarse
**What goes wrong:** Si se migra `parseJsonArray` → `parseAndValidateCategories` pero se deja el filtro `VALID_AREA_IDS.has()` en línea 125, la validación se aplica dos veces (inofensivo pero confuso).
**How to avoid:** Al migrar `statsService.ts`, eliminar también el `filter((id) => VALID_AREA_IDS.has(id as never))` de línea 125.

### Pitfall 5: `as SpeechModuleInterface` en el require es un cast no verificado
**What goes wrong:** `require('expo-speech-recognition') as SpeechModuleInterface` no verifica en runtime que el módulo tenga la forma esperada. Si la API del paquete cambia, TypeScript no avisa.
**Why it happens:** Es la limitación del patrón require() con optional native modules en RN.
**How to avoid:** El hook ya usa optional chaining (`?.`) defensivamente. La interfaz local es solo para el compilador. No se puede hacer mejor sin cambiar el loader (que está deferred).

---

## Runtime State Inventory

> Sección aplicable: esta fase hace cambios de código y schema tipado, no renombres de strings de producción ni cambios de datos persistidos.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `habits.default_categories` y `performed_habits.categories_used` contienen JSON strings de IDs de área | `sanitizeHabitDefaultCategories` y `sanitizePerformedCategoriesUsed` ya corren en `initDatabase()` — el refactor de DEBT-03 mantiene esa ejecución, solo cambia el código que la implementa |
| Live service config | Ninguno — app local sin servicios externos | None |
| OS-registered state | Ninguno | None |
| Secrets/env vars | Ninguno relacionado a esta fase | None |
| Build artifacts | Ninguno — pure TypeScript refactor, sin renombres de paquetes | None |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + ts-jest |
| Config file | `jest.config.js` (raíz) |
| Quick run command | `npx jest --testPathPattern="parsing"` |
| Full suite command | `npx jest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEBT-01 | `useSpeechRecognition` retorna `isAvailable=false` cuando módulo es null, sin errores de tipo | unit | `npx jest --testPathPattern="speechRecognition"` | ❌ Wave 0 |
| DEBT-02 | `parseAndValidateCategories` filtra IDs inválidos, emite warn, retorna solo válidos | unit | `npx jest --testPathPattern="parsing"` | ❌ Wave 0 |
| DEBT-02 | `parseAndValidateCategories` retorna `[]` ante JSON malformado | unit | `npx jest --testPathPattern="parsing"` | ❌ Wave 0 |
| DEBT-02 | `createHabit`/`updateHabit` throwean error con IDs inválidos | unit | `npx jest --testPathPattern="habitService"` | ❌ Wave 0 |
| DEBT-03 | `sanitizeHabitDefaultCategories` limpia IDs inválidos en habits | unit | `npx jest --testPathPattern="sanitize"` | ❌ Wave 0 |
| DEBT-03 | `sanitizePerformedCategoriesUsed` limpia IDs inválidos en performed_habits | unit | `npx jest --testPathPattern="sanitize"` | ❌ Wave 0 |

**Nota:** Los tests existentes en `dailyAssignments.test.ts` (29 tests) deben seguir pasando — son el regression gate de Phase 1.

### Sampling Rate
- **Per task commit:** `npx jest --testPathPattern="parsing|sanitize|speechRecognition|habitService"`
- **Per wave merge:** `npx jest` (suite completa)
- **Phase gate:** `npx jest` verde antes de `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/parsing.test.ts` — cubre DEBT-02: `parseAndValidateCategories` happy path, IDs inválidos, JSON malformado, array vacío
- [ ] `src/__tests__/sanitize.test.ts` — cubre DEBT-03: las dos funciones de sanitización con datos in-memory (mejor-sqlite3)
- [ ] `src/__tests__/habitService.test.ts` — cubre D-15: validación de escritura en createHabit/updateHabit
- [ ] `src/__tests__/speechRecognition.test.ts` — cubre DEBT-01: hook con módulo ausente y presente (mock del require)

**Pattern de test a seguir:** `dailyAssignments.test.ts` — usa `better-sqlite3` in-memory, jest.mock para dependencias de db, tipos explícitos TypeScript.

---

## Open Questions (RESOLVED)

1. **¿Dónde exportar el helper de validación de escritura?**
   - What we know: D-15 requiere validar `categories` en `createHabit`/`updateHabit`. La lógica es `filter(!VALID_AREA_IDS.has(id))`.
   - What's unclear: Si este helper debe ser un export de `parsing.ts` (para reutilización en BUG-04) o vivir inline en `habitService`.
   - Recommendation: **Claude's discretion** — si BUG-04 ya implementó validación similar en Phase 1, revisar `assignmentService.ts` para reutilizar el mismo patrón. Si BUG-04 tiene validación inline, mantener consistencia.
   - **RESOLVED (2026-04-26):** La validación vive inline en `habitService.createHabit`/`updateHabit` siguiendo el patrón de `assignmentService.ts:91-97` (BUG-04). No se exporta a `parsing.ts`. Implementado por 02-01 Task 3.

2. **¿`parseAndValidateCategories` debe manejar `null | undefined`?**
   - What we know: Los call sites actuales reciben `string` (Habit.default_categories es `string`, categories en DailyItem es `string`). `db.getAllAsync` puede retornar `null` para columnas nullable.
   - What's unclear: Si la firma debe ser `(json: string | null | undefined): string[]` para ser más defensiva en las funciones de sanitización.
   - Recommendation: Mantener `(json: string): string[]` para los 4 call sites de UI/service. Las funciones de sanitización hacen el null-check antes de llamar al parser (el `if (row.X == null) continue` en el código propuesto lo maneja).
   - **RESOLVED (2026-04-26):** La firma queda `(json: string): string[]`. Las funciones de sanitización en `db.ts` hacen `if (row.X == null) continue` antes de invocar al parser. Implementado por 02-01 Task 2 (firma) y 02-02 Task 2 (null-check en sanitizers).

---

## Environment Availability

> Esta fase es pure TypeScript refactor sin dependencias externas nuevas.

Step 2.6: SKIPPED — no se agregan herramientas, servicios, CLIs ni runtimes. Solo se modifican archivos TypeScript existentes.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | `VALID_AREA_IDS.has()` — whitelist de IDs válidos |
| V6 Cryptography | no | Sin crypto en esta fase |
| V2 Authentication | no | Sin auth en esta fase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via template strings | Tampering | D-05/D-06: eliminar template strings, SQL fijo por función |
| Datos inválidos persistidos en DB | Tampering | D-15: validación en service layer antes del INSERT/UPDATE |
| `as` assertions bypassing type system | Spoofing (tipo) | D-12, D-04: reemplazar con type guards verificados |

**Nota:** La eliminación de `sanitizeTable` con SQL dinámico (`\`SELECT id, ${column} FROM ${table}\``) cierra el riesgo documentado en `CONCERNS.md §Security` — aunque solo se llamaba con constantes internas, el SQL estático es verificable en compile time.

---

## Sources

### Primary (HIGH confidence)
- `src/hooks/useSpeechRecognition.ts` — código fuente verificado, 2 `any` en líneas 16 y 41
- `src/utils/parsing.ts` — función `parseJsonArray` verificada
- `src/services/db.ts` — `sanitizeTable` + `filterValidIds` verificadas, SQL dinámico confirmado
- `src/services/backupService.ts` — `parseAndValidate` + `as Partial<BackupData>` verificados en línea 81
- `src/services/habitService.ts` — `createHabit`/`updateHabit` verificados, sin validación de categorías
- `src/services/statsService.ts` — call site `parseJsonArray:124` + filtro redundante línea 125 verificados
- `src/screens/DailySheetScreen.tsx` — call site `parseJsonArray:102` verificado
- `src/screens/HabitLibraryScreen.tsx` — call site `parseJsonArray:202` verificado
- `src/components/modals/HabitFormModal.tsx` — call site `parseJsonArray:178` verificado
- `src/config/constants.ts` — `VALID_AREA_IDS` (Set de 9 IDs) verificado
- `src/types/index.ts` — `BackupData` interface verificada

### Secondary (MEDIUM confidence)
- `.planning/codebase/CONCERNS.md` — descripción original de los 3 issues con files/lines
- `.planning/codebase/CONVENTIONS.md` — reglas de layer separation y naming

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todo el stack está en el codebase, sin dependencias nuevas
- Architecture: HIGH — shapes de los tipos verificados en el código fuente real
- Pitfalls: HIGH — identificados directamente del código actual, no de suposiciones
- Tests: MEDIUM — el framework existe (Jest + ts-jest), los archivos de test nuevos están pendientes (Wave 0)

**Research date:** 2026-04-26
**Valid until:** 2026-06-01 (código fuente estable mientras Phase 2 no se ejecute)
