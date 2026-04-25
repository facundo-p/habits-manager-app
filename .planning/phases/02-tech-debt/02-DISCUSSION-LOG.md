# Phase 2: Tech Debt - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 02-tech-debt
**Areas discussed:** Alcance de parsing, Enfoque sanitizeTable, Comportamiento ante IDs inválidos, Tipado SpeechModule

---

## Selección inicial de áreas

| Opción | Descripción | Selected |
|--------|-------------|----------|
| Alcance de 'único punto de parsing' | DEBT-02 scope | ✓ |
| Enfoque de sanitizeTable | DEBT-03 approach | ✓ |
| Comportamiento ante IDs inválidos | filtrar / warn / throw | ✓ |
| Tipado de SpeechModule | DEBT-01 approach | ✓ |

**User's choice:** Las 4 áreas.

---

## Área 1: Alcance de "único punto de parsing"

### ¿Qué estructura toma `parseJsonArray` en el nuevo diseño?

| Option | Description | Selected |
|--------|-------------|----------|
| Reemplazar por parseAndValidateCategories | Una sola función que parsea + valida. parseJsonArray genérico desaparece. | ✓ |
| Convivencia: agregar parseAndValidateCategories, mantener parseJsonArray | Dos funciones | |
| Renombrar parseJsonArray a parseAndValidateCategories | Validación by default, mismo nombre | |

**User's choice:** Reemplazar por `parseAndValidateCategories`.

### ¿Los 4 call sites migran al parser con validación?

| Option | Description | Selected |
|--------|-------------|----------|
| Sí, todos migran | Consistencia total | ✓ |
| Solo services, dejar UI con parseJsonArray | Menos riesgo, menos consistencia | |

**User's choice:** Todos migran.

### ¿`filterValidIds` de db.ts usa el parser central?

| Option | Description | Selected |
|--------|-------------|----------|
| Sí, sanitizeTable consume la función central | Elimina duplicación | ✓ |
| Mantener filterValidIds local | Pragmático pero deja 2 puntos con JSON.parse | |

**User's choice:** sanitizeTable consume la función central.

### ¿`backupService.JSON.parse` entra en el alcance?

| Option | Description | Selected |
|--------|-------------|----------|
| Fuera de alcance — no es categorías | Queda para Phase 3 | |
| Dentro de alcance — todo JSON.parse tipado | Phase 2 cierra completo | ✓ |

**User's choice:** Dentro de alcance — alcance ampliado de Phase 2.

**Notes:** Decisión que expande el scope. Justificada porque Phase 3 (Drive Backup) va a montar sobre `backupService` y conviene tener el parse tipado antes.

---

## Área 2: Enfoque para sanitizeTable

### ¿Cómo abordamos `sanitizeTable` (SQL concat + 'any')?

| Option | Description | Selected |
|--------|-------------|----------|
| Refactor a funciones explícitas por tabla | Elimina SQL concat + any, +duplicación leve | ✓ (tras ver código) |
| Mantener genérico con tipos unión + comentario | Menos código, mismo efecto | |
| Reescribir con SQL json_extract | Out of scope (PERF-V2) | |

**User's choice:** Pidió ver el código propuesto para Opción 1 antes de decidir. Tras ver el diff, confirmó Opción 1 sin helper compartido.

**Notes:** El usuario pidió "Mostrame los cambios propuestos en el código para la opción 1". Se mostró el antes/después con `sanitizeHabitDefaultCategories` y `sanitizePerformedCategoriesUsed`. Luego confirmó.

### ¿La función por tabla llama al parser central?

| Option | Description | Selected |
|--------|-------------|----------|
| Sí, llama al parser central | Consistente con Área 1 | ✓ |
| Filtrado inline | Duplica lógica | |

**User's choice:** Llama al parser central.

---

## Área 3: Comportamiento ante IDs inválidos

### ¿Qué hace `parseAndValidateCategories` al leer datos con IDs inválidos?

| Option | Description | Selected |
|--------|-------------|----------|
| Filtrar silencioso | Comportamiento actual de filterValidIds | |
| Filtrar + console.warn | Defensivo + visibilidad | ✓ |
| Throw — falla explícita | Inconsistente con lógica defensiva | |

**User's choice:** Filtrar + console.warn.

### ¿`addHabit`/`updateHabit` también validan en esta fase?

| Option | Description | Selected |
|--------|-------------|----------|
| Sí, simetría total con BUG-04 | Cierra puerta abierta | ✓ |
| Solo lectura, escritura queda como está | Scope contenido | |
| Solo logueo en escritura, sin throw | Inconsistente con BUG-04 | |

**User's choice:** Simetría total con BUG-04 — alcance ampliado para validar también escritura de habits regulares.

---

## Área 4: Tipado de SpeechModule

### ¿Dónde vive la interfaz `SpeechModuleInterface`?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline en useSpeechRecognition.ts | YAGNI | ✓ |
| Extraer a src/types/speech.ts | Reutilizable | |

**User's choice:** Inline en el hook.

### ¿Qué forma toma la interfaz?

| Option | Description | Selected |
|--------|-------------|----------|
| Solo lo que el hook usa | Mínimo necesario | ✓ |
| Importar tipos reales de expo-speech-recognition | Acoplado a API completa | |

**User's choice:** Solo la superficie usada.

### ¿Mantenemos `require()+try/catch`?

| Option | Description | Selected |
|--------|-------------|----------|
| Mantener require()+try/catch | Patrón canónico actual | ✓ (con duda) |
| Modernizar a dynamic import async | RN/Metro gotchas | |
| Reemplazar el any del event listener también | (mal formada — esto es requirement, no alternativa) | |

**User's choice:** Opción 1 ("No estoy seguro, pero vamos con la 1").

**Notes:** El usuario expresó incertidumbre pero tomó la decisión. La pregunta tenía una opción mal formada (la 3 era un requirement adicional, no una alternativa al loader). El typing del event `any` se hace independientemente — está cubierto por el success criterion "no any explícito" y se ejecuta sí o sí.

---

## Claude's Discretion

- Forma exacta de la firma de `parseAndValidateCategories` (con/sin metadata de IDs descartados).
- Estructura interna del parser tipado de `BackupData` en `backupService.ts`.
- Estrategia y ubicación de tests para parser central, migración de call sites, y validación de escritura.
- Mensajes exactos de error de validación de escritura (siguiendo el estilo de BUG-04).
- Si el helper de validación de escritura vive en `parsing.ts`, en `habitService`, o en un nuevo `validation.ts`.

## Deferred Ideas

- Reescritura de `sanitizeCategories` con `json_extract` SQL (PERF-V2-03).
- Extracción de `SpeechModuleInterface` a `src/types/speech.ts` (futuro si hay >1 consumer).
- Migración de `require()` a `await import()` (sin valor inmediato).
- Validación de campos JSON no-categoría más allá del backup (fuera de scope).
