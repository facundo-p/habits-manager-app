# Phase 1: Bug Fixes - Research

**Researched:** 2026-03-17
**Domain:** TypeScript service layer — SQLite assignment logic, date handling, input validation
**Confidence:** HIGH (all findings from direct codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### BUG-01: Backfill spontaneous guard
- `ensureAssignmentsForDate` debe contar TODAS las assignments (incluyendo espontáneas) para decidir si una fecha ya fue procesada
- Cambiar de `countHabitAssignmentsByDate` a `countByDate` (que ya existe en el repo)
- Un día que solo tiene espontáneos no debe recibir nuevas assignments al hacer backfill

#### BUG-02: Future-date guard deduplication
- Extraer `isFutureDate()` como utility compartida
- Ambos call sites (`addAssignmentForHabit` y `ensureAssignmentsForDate`) deben usar la misma función
- Eliminar las comparaciones inline `day > getTodayPrefix()`

#### BUG-03: UTC date iteration
- El backfill en `checkAndBackfillHistory` debe usar UTC explícito en el constructor de Date
- Cambiar `new Date("...T00:00:00")` a `new Date("...T00:00:00Z")` o usar métodos UTC
- `formatDateStr` y `nextDay` deben producir la misma fecha en cualquier timezone

#### BUG-04: Category validation on spontaneous insert
- Validar categorías contra `VALID_AREA_IDS` antes de insertar espontáneo
- Falla con error descriptivo si algún ID es inválido — no persistir datos corruptos
- `VALID_AREA_IDS` ya existe en `config/constants.ts`

### Claude's Discretion
- Estrategia de cleanup de datos existentes corruptos (si aplica)
- Error handling específico para BUG-04 (throw vs strip invalid + warn)
- Estructura exacta del utility `isFutureDate()`
- Approach de testing para cada fix

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUG-01 | Backfill logic debe contar espontáneos al evaluar si una fecha ya tiene assignments, evitando duplicación de habits regulares | `countByDate` ya existe en `assignmentRepository.ts` (line 63) — reemplaza `countHabitAssignmentsByDate` (line 70) en `ensureAssignmentsForDate` |
| BUG-02 | Future-date guard extraído a utility `isFutureDate()` usado desde ambos call sites | Dos call sites en `assignmentService.ts` (lines 116 y 200) usan comparación inline; `getTodayPrefix()` vive en `db.ts` — `isFutureDate` puede vivir junto a ella |
| BUG-03 | Backfill date iteration usa UTC explícito para evitar drift de ±1 día por timezone | `new Date("...T00:00:00")` sin Z en `checkAndBackfillHistory` (lines 182, 184) y en `nextDay` (line 248) — `formatDateStr` usa `.toISOString()` que es UTC, pero el constructor local causa drift |
| BUG-04 | Categorías de espontáneos validadas contra VALID_AREA_IDS antes de insertar en DB | `VALID_AREA_IDS` (Set) importado en `db.ts` — necesita re-exportarse o importarse directamente en `assignmentService.ts`; patrón de validación existe en `filterValidIds()` |
</phase_requirements>

---

## Summary

Phase 1 es un conjunto de 4 correcciones de bugs quirúrgicas en `assignmentService.ts`. Todos los assets necesarios ya existen en el codebase — no se requieren dependencias nuevas, cambios de schema, ni nuevas tablas. El trabajo consiste en conectar correctamente lo que ya existe.

El bug más crítico en producción es BUG-01: si un usuario agrega un espontáneo un día que luego necesita backfill, ese día recibe duplicación de todos sus hábitos regulares. BUG-03 es el más sutil: solo se manifiesta en timezones con offset negativo (UTC-X) o en horas específicas del día, por lo que puede pasar desapercibido en tests que siempre corren a UTC.

Los 4 bugs están contenidos en un solo archivo (`assignmentService.ts`) con excepción del import de `VALID_AREA_IDS` para BUG-04. La infraestructura de tests ya está completa (jest + better-sqlite3 in-memory + mocks de expo-sqlite) y los tests existentes pasan. Solo es necesario agregar tests para los 4 nuevos comportamientos.

**Primary recommendation:** Corregir los 4 bugs en `assignmentService.ts` + extraer `isFutureDate` a `db.ts`, usando los assets ya existentes. Agregar tests en `dailyAssignments.test.ts`.

---

## Standard Stack

### Core (ya instalado, no requiere cambios)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | — | Tipado estático | Lenguaje del proyecto |
| expo-sqlite | — | SQLite en dispositivo | Stack nativo del proyecto |
| better-sqlite3 | — | SQLite síncrono para tests | Ya configurado en __mocks__ |
| jest + ts-jest | — | Test runner | Ya configurado en jest.config.js |

### No se requiere nada nuevo

Todas las dependencias necesarias están presentes. No hay `npm install` requerido.

---

## Architecture Patterns

### Estructura relevante del proyecto

```
src/
├── config/
│   └── constants.ts        # VALID_AREA_IDS, HABIT_AREAS — fuente de verdad de categorías
├── services/
│   ├── db.ts               # getTodayPrefix(), helpers de fecha — isFutureDate() va aquí
│   └── assignmentService.ts # Los 4 bugs viven aquí
├── repositories/
│   └── assignmentRepository.ts  # countByDate() ya existe (BUG-01)
└── __tests__/
    ├── setup/testDatabase.ts   # Infraestructura de test (no modificar)
    └── dailyAssignments.test.ts # Agregar tests para los 4 bugs aquí
__mocks__/
└── expo-sqlite.ts          # Mock para tests (no modificar)
```

### Patrón 1: Utility de fecha en db.ts

`getTodayPrefix()` ya vive en `db.ts` y es importada en `assignmentService.ts`. `isFutureDate()` debe colocarse junto a ella para mantener cohesión y evitar un nuevo archivo de utilities.

```typescript
// En src/services/db.ts — agregar junto a getTodayPrefix()
export function isFutureDate(datePrefix: string): boolean {
  return datePrefix > getTodayPrefix();
}
```

Los dos call sites en `assignmentService.ts` ya importan desde `'./db'`, por lo que solo se agrega `isFutureDate` al import existente.

### Patrón 2: UTC explícito en constructores de Date

El problema de BUG-03: `new Date("2026-03-10T00:00:00")` es interpretado como hora LOCAL. En timezone UTC-3, a las 23:00 local, `new Date().toISOString()` produce un día diferente. La corrección es agregar la `Z` suffix o usar `Date.UTC`.

```typescript
// ANTES (buggy en timezones locales)
const end = new Date(`${today}T00:00:00`);
const current = new Date(`${start}T00:00:00`);

// DESPUES (UTC explícito — consistente en cualquier timezone)
const end = new Date(`${today}T00:00:00Z`);
const current = new Date(`${start}T00:00:00Z`);
```

Nota: `formatDateStr` usa `.toISOString().slice(0, 10)` que ya es UTC — correcto. El problema está solo en los constructores de entrada.

`nextDay` también tiene el mismo problema:

```typescript
// ANTES
function nextDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return formatDateStr(d);
}

// DESPUES
function nextDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return formatDateStr(d);
}
```

Usar `setUTCDate` + `getUTCDate` para que la aritmética de días también sea UTC-safe.

### Patrón 3: Validación de categorías en addSpontaneous

`VALID_AREA_IDS` es un `Set<string>` exportado de `constants.ts`. La validación debe ocurrir en el service layer antes de llamar al repo.

```typescript
// En assignmentService.ts — importar VALID_AREA_IDS
import { VALID_AREA_IDS } from '../config/constants';

export async function addSpontaneous(
  name: string,
  categories: string[],
  datePrefix?: string,
): Promise<void> {
  // BUG-04: validar categorías antes de insertar
  const invalidIds = categories.filter(id => !VALID_AREA_IDS.has(id));
  if (invalidIds.length > 0) {
    throw new Error(`Categorías inválidas: ${invalidIds.join(', ')}`);
  }
  // ... resto igual
}
```

La decisión de "throw vs strip" está en Claude's Discretion. La recomendación es **throw** (fail fast, error descriptivo) porque:
1. El caller (store o UI) puede manejar el error y mostrar feedback al usuario
2. Strip silencioso podría crear espontáneos con categorías vacías, que es igualmente confuso
3. El éxito criteria de BUG-04 dice explícitamente "falla con error descriptivo"

### Anti-Patterns a Evitar

- **No extraer isFutureDate a un tercer archivo**: Crea una dependencia innecesaria; `db.ts` ya es el hogar natural de date utilities
- **No importar VALID_AREA_IDS en db.ts para re-exportar**: Ya se importa en `db.ts` internamente — en `assignmentService.ts` importar directamente desde `../config/constants`
- **No cambiar el contrato de countByDate**: La función ya existe y funciona; BUG-01 es solo cambiar qué función se llama en `ensureAssignmentsForDate`

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Contar todas las assignments | Nueva query SQL | `assignmentRepo.countByDate()` ya existe | SQL idéntico, ya testeado |
| Validar IDs de área | Construir un array de válidos | `VALID_AREA_IDS` (Set) en constants.ts | Fuente de verdad única, O(1) lookup |
| Comparación de fechas ISO | Parsear con librerías de fecha | Comparación de strings `>` | YYYY-MM-DD es lexicográficamente ordenable — ya funciona en el código existente |
| UTC date string | Formatear manualmente | `.toISOString().slice(0, 10)` | Ya está en `formatDateStr` — solo arreglar constructores de entrada |

---

## Common Pitfalls

### Pitfall 1: setDate vs setUTCDate en aritmética de días

**What goes wrong:** Corregir el constructor con `T00:00:00Z` pero seguir usando `setDate` / `getDate`. Estos métodos operan en tiempo local. Si el offset local es -3h, `new Date("2026-03-10T00:00:00Z")` representa medianoche UTC pero 21:00 local del 9 de marzo — un `getDate()` devolvería 9, no 10.

**How to avoid:** Usar `setUTCDate` / `getUTCDate` junto con constructores UTC.

**Warning signs:** Tests que pasan con la corrección del constructor pero fallan en CI con timezone diferente.

### Pitfall 2: El test existente de "solo espontáneos no bloquea generación" ya existe pero verifica el comportamiento OPUESTO al bug

**What goes wrong:** El test en línea 105-122 de `dailyAssignments.test.ts` verifica que "el hábito real debe haberse creado a pesar del espontáneo" — pero con el bug actual (usando `countHabitAssignmentsByDate`), este test ya pasa porque `countHabitAssignmentsByDate` devuelve 0 cuando solo hay espontáneos, y then genera los hábitos regulares correctamente.

**El bug real:** El test correcto para BUG-01 sería el inverso: cuando ya hay hábitos regulares Y espontáneos, un segundo llamado a `ensureAssignmentsForDate` no debe duplicar los regulares. Esto ya está cubierto por el test de idempotencia (línea 124). El bug se manifiesta cuando: día D tiene solo espontáneos, luego `checkAndBackfillHistory` llama `ensureAssignmentsForDate(D)` y genera duplicados. El test nuevo debe simular exactamente este escenario.

**How to avoid:** Leer el test existente en línea 105 con cuidado — no confundir con el caso de BUG-01. El nuevo test debe verificar que `ensureAssignmentsForDate` NO crea assignments si el día ya tiene assignments (incluyendo espontáneas como único contenido).

### Pitfall 3: VALID_AREA_IDS ya se importa en db.ts pero desde adentro de la función

**What goes wrong:** Intentar re-exportar `VALID_AREA_IDS` desde `db.ts` pensando que ya está expuesta — pero `db.ts` la importa para uso interno solamente en `filterValidIds()`.

**How to avoid:** En `assignmentService.ts`, importar `VALID_AREA_IDS` directamente desde `'../config/constants'`. No modificar `db.ts` para este propósito.

### Pitfall 4: El guard de BUG-02 en addAssignmentForHabit usa el comentario "Bug 3"

**What goes wrong:** El comentario inline en `assignmentService.ts` línea 116 dice `// Bug 3: nunca asignar a fechas futuras` — confuso porque en CONTEXT.md este es BUG-02 (future-date guard deduplication) y BUG-03 es el timezone issue.

**How to avoid:** Los comentarios inline del código original usaban una numeración diferente a la del planning. Confiar en CONTEXT.md como fuente de verdad para la numeración de bugs, no en los comentarios inline.

---

## Code Examples

### BUG-01: Cambio de una línea en ensureAssignmentsForDate

```typescript
// ANTES (assignmentService.ts línea 201)
const existing = await assignmentRepo.countHabitAssignmentsByDate(datePrefix); // Bug 2: ignorar espontáneos

// DESPUES
const existing = await assignmentRepo.countByDate(datePrefix);
```

`countByDate` ya existe en `assignmentRepository.ts` línea 63. No requiere cambios en el repo.

### BUG-02: Extraer isFutureDate a db.ts y usar en ambos call sites

```typescript
// En db.ts — agregar después de getTodayPrefix()
export function isFutureDate(datePrefix: string): boolean {
  return datePrefix > getTodayPrefix();
}

// En assignmentService.ts — actualizar import
import { getTodayPrefix, getTimestampForDate, getNowTimestamp, isFutureDate } from './db';

// Call site 1 (línea 116) — en addAssignmentForHabit
if (isFutureDate(day)) return;

// Call site 2 (línea 200) — en ensureAssignmentsForDate
if (isFutureDate(datePrefix)) return;
```

### BUG-03: UTC explícito en checkAndBackfillHistory y nextDay

```typescript
// checkAndBackfillHistory — líneas 182-184
const end = new Date(`${today}T00:00:00Z`);
const current = new Date(`${start}T00:00:00Z`);

// nextDay — línea 248-250
function nextDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return formatDateStr(d);
}
```

### BUG-04: Validación en addSpontaneous

```typescript
// En assignmentService.ts — agregar import al inicio
import { VALID_AREA_IDS } from '../config/constants';

// En addSpontaneous — antes del insert
export async function addSpontaneous(
  name: string,
  categories: string[],
  datePrefix?: string,
): Promise<void> {
  const invalidIds = categories.filter((id) => !VALID_AREA_IDS.has(id));
  if (invalidIds.length > 0) {
    throw new Error(`addSpontaneous: categorías inválidas — ${invalidIds.join(', ')}`);
  }
  const day = datePrefix ?? getTodayPrefix();
  await assignmentRepo.insert(
    null, day, name, 0,
    JSON.stringify(categories), 'daily', 1, 1,
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `countHabitAssignmentsByDate` para guard de duplicación | `countByDate` (cuenta todo incluyendo espontáneos) | Previene duplicación en días con solo espontáneos |
| Inline `day > getTodayPrefix()` en 2 lugares | `isFutureDate()` utility compartida | Una sola fuente de verdad; cambios futuros en un lugar |
| `new Date("...T00:00:00")` local | `new Date("...T00:00:00Z")` UTC | Consistente en cualquier timezone del usuario |
| Insert espontáneo sin validar categorías | Validar contra `VALID_AREA_IDS` antes de insertar | Previene datos corruptos en DB |

---

## Open Questions

1. **Cleanup de datos existentes corruptos (BUG-04)**
   - What we know: La función `sanitizeCategories` en `db.ts` ya limpia `habits.default_categories` y `performed_habits.categories_used` al iniciar la app, pero no toca `daily_assignments.snapshot_categories`
   - What's unclear: ¿Hay assignments espontáneas existentes con categorías inválidas que deberían limpiarse?
   - Recommendation: Fuera del scope de los 4 bugs (BUG-04 solo previene nuevas inserciones inválidas). Si se desea cleanup, pertenece a DEBT-02 en Phase 2. No agregar al plan de Phase 1.

2. **¿Debe isFutureDate mantenerse en db.ts o moverse a un utils/ separado?**
   - What we know: No existe un directorio `utils/` para date helpers; `db.ts` ya es el hogar de `getTodayPrefix()` y otros helpers de fecha
   - Recommendation: Mantener en `db.ts` — consistente con el patrón existente, sin crear estructura nueva.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29 + ts-jest |
| Config file | `jest.config.js` (raíz del proyecto) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUG-01 | `ensureAssignmentsForDate` no genera hábitos regulares si la fecha solo tiene espontáneos | unit | `npm test -- --testNamePattern "BUG-01"` | ❌ Wave 0 |
| BUG-02 | `isFutureDate` existe como export de `db.ts` y ambos call sites la usan | unit | `npm test -- --testNamePattern "isFutureDate"` | ❌ Wave 0 |
| BUG-03 | `nextDay("2026-03-10")` devuelve `"2026-03-11"` independientemente del timezone del proceso | unit | `npm test -- --testNamePattern "BUG-03"` | ❌ Wave 0 |
| BUG-04 | `addSpontaneous` lanza error con mensaje descriptivo cuando categories contiene un ID inválido | unit | `npm test -- --testNamePattern "BUG-04"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm test` — todos los tests en verde antes de `/gsd:verify-work`

### Wave 0 Gaps

- [ ] Tests para BUG-01 en `src/__tests__/dailyAssignments.test.ts` — verifica que `ensureAssignmentsForDate` usa `countByDate` (cuenta espontáneos)
- [ ] Tests para BUG-02 en `src/__tests__/dailyAssignments.test.ts` — verifica que `isFutureDate` existe y es usada
- [ ] Tests para BUG-03 en `src/__tests__/dailyAssignments.test.ts` — verifica UTC-safe date iteration
- [ ] Tests para BUG-04 en `src/__tests__/dailyAssignments.test.ts` — verifica throw con categoría inválida

Nota: El archivo `dailyAssignments.test.ts` ya existe con 23 tests que pasan. Los tests nuevos se agregan como nuevos `describe` blocks o `test` cases en el mismo archivo. No se requieren cambios en `testDatabase.ts`, `expo-sqlite.ts` mock, ni `jest.config.js`.

---

## Sources

### Primary (HIGH confidence)

Todos los hallazgos son de inspección directa del codebase. Sin dependencias externas nuevas.

- `src/services/assignmentService.ts` — Ubicación exacta de los 4 bugs con números de línea verificados
- `src/repositories/assignmentRepository.ts` — `countByDate` (línea 63) verificado como reemplazo directo para BUG-01
- `src/services/db.ts` — `getTodayPrefix()` y estructura de date helpers verificados; hogar natural de `isFutureDate`
- `src/config/constants.ts` — `VALID_AREA_IDS` verificado como Set con 9 IDs válidos
- `src/__tests__/dailyAssignments.test.ts` — 23 tests existentes inspeccionados; test en línea 105 analizado para evitar confusión con BUG-01
- `jest.config.js` — Configuración verificada; `npm test` funciona (23 tests pasan)

### Secondary (MEDIUM confidence)

- MDN Date documentation (conocimiento del comportamiento de `new Date("string")` sin Z suffix siendo interpretado como local time) — verificado empíricamente con el patrón de código existente

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — inspección directa, sin dependencias nuevas
- Architecture: HIGH — todos los patrones derivados del código existente del proyecto
- Pitfalls: HIGH — pitfall 1 y 2 son trampas específicas identificadas en el código real; pitfall 3 y 4 son de lectura directa del código
- Test infrastructure: HIGH — `npm test` ejecutado y pasa; 23 tests existentes verificados

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (código es estable, no hay dependencias externas volátiles)
