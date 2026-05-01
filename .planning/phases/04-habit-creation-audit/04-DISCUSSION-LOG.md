# Phase 4: Habit Creation Audit & Duplicate Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 04-habit-creation-audit
**Areas discussed:** Lifecycle weekly/monthly, Política de dedup en DB existente, Trigger del cleanup migration, Schema constraint preventivo

---

## Lifecycle weekly/monthly

### Visibility model

| Option | Description | Selected |
|--------|-------------|----------|
| Una sola vez por período (Recommended) | Weekly aparece 1 vez/semana, monthly 1 vez/mes. Modelo clásico anti-duplicación. | |
| Todos los días (visible) pero cuenta 1 vez por período | Aparece todos los días como recordatorio; puntos solo 1 vez/período. Requiere flag visual + lógica "completado por período". | ✓ |
| Todos los días como un hábito daily normal | frequency solo afecta stats, no assignments. Es lo que hace HOY (sin querer). | |

**User's choice:** "Todos los días (visible) pero cuenta 1 vez por período"
**Notes:** El usuario prefirió el modelo de "recordatorio constante con accrual periódico" en vez del clásico "1 vez/período". Implica mantener 1 row por día en daily_assignments para weekly/monthly, pero la UI muestra "ya completado este período" si alguna row del período tiene is_completed=1.

### Period start

| Option | Description | Selected |
|--------|-------------|----------|
| Día fijo: lunes (semana) / día 1 (mes) (Recommended) | ISO 8601 standard. Predecible y testeable. | ✓ |
| Flexible: visible desde día 1 hasta completarlo | Aparece desde lunes y queda visible hasta marcarlo, después desaparece. Requiere persistir estado. | |
| Día configurado por el usuario al crear el hábito | Usuario elige día en HabitFormModal. Requiere campo nuevo en habits + UI. | |

**User's choice:** "Día fijo: lunes (semana) / día 1 (mes)"
**Notes:** Elección consistente con el modelo elegido — el "período" reset es el lunes/día 1.

---

## Política de dedup en DB existente

### Dedup pick

| Option | Description | Selected |
|--------|-------------|----------|
| Prioridad: completed > performed_habit linked > más antigua (Recommended) | Preserva agresivamente el progreso del usuario. | ✓ |
| Más antigua siempre (FIFO) | Simple pero puede borrar la versión completed. | |
| Más reciente siempre (LIFO) | Refleja estado actual pero puede borrar performed_habit linked. | |

**User's choice:** "Prioridad: completed > performed_habit linked > más antigua"
**Notes:** —

### Loser rows

| Option | Description | Selected |
|--------|-------------|----------|
| DELETE (hard delete) (Recommended) | Limpio, simple, irreversible. Backup JSON como red de seguridad. | ✓ |
| Soft delete: agregar flag deleted_at | Recuperable pero alto blast radius (todas las queries deben filtrar). | |
| Mover a tabla audit_dedup_log | Más defensivo pero overhead que probablemente nunca se usa. | |

**User's choice:** "DELETE (hard delete)"
**Notes:** El usuario confirmó haber hecho backup JSON antes — eso reduce el riesgo de hard delete.

---

## Trigger del cleanup migration

### Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Auto al abrir la app (versioned migration) (Recommended) | Patrón consistente con migrations existentes en initDatabase(). | ✓ |
| Botón manual en Settings con confirmación | Más control pero quien no entra a Settings nunca lo corre. | |
| Híbrido: auto + UI en Settings post-cleanup | Defensivo pero más código. | |

**User's choice:** "Auto al abrir la app (versioned migration)"
**Notes:** —

### Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Silencioso (Recommended) | Migration transparente. Loggea console.error si falla. | ✓ |
| Loading splash mientras corre | Bloquea UI; asusta si la migración es rápida. | |
| Toast post-migration con resumen | Transparencia pero requiere componente Toast. | |

**User's choice:** "Silencioso"
**Notes:** —

---

## Schema constraint preventivo

### Index

| Option | Description | Selected |
|--------|-------------|----------|
| Sí: partial UNIQUE en (habit_id, date) WHERE habit_id IS NOT NULL (Recommended) | Garantiza unicidad para regulares sin restringir spontaneous. | ✓ |
| Sí: UNIQUE total en (habit_id, date) | Más simple pero NULLs no se consideran duplicados en SQLite — efecto similar al partial. | |
| No: solo guards en código (status quo) | Menos defensivo; si algún path se saltea check, vuelve la duplicación. | |

**User's choice:** "Sí: partial UNIQUE en (habit_id, date) WHERE habit_id IS NOT NULL"
**Notes:** —

### Order

| Option | Description | Selected |
|--------|-------------|----------|
| Después del cleanup, en la misma migración (Recommended) | Atómico. Si algo falla, rollback completo. | ✓ |
| Antes del cleanup (CREATE INDEX + ON CONFLICT IGNORE) | Pierde control sobre cuál row se preserva (primero gana, no completed). | |
| En migraciones separadas | Más incremental pero más puntos de falla. | |

**User's choice:** "Después del cleanup, en la misma migración"
**Notes:** —

---

## Wrap-up

### Done

| Option | Description | Selected |
|--------|-------------|----------|
| Listo, escribir CONTEXT.md (Recommended) | 8 decisiones cubiertas. Research confirma causales, plan descompone tasks. | ✓ |
| Discutir estrategia de tests / regresión | Cómo prevenir reincidencia. | |
| Discutir alcance de la auditoría | Otros flujos no listados (timezone change, reinstal, edición masiva). | |
| Discutir handling de spontaneous post-fix | Reglas adicionales para habit_id NULL. | |

**User's choice:** "Listo, escribir CONTEXT.md"
**Notes:** Las 3 áreas no discutidas quedan registradas en CONTEXT.md §Deferred Ideas — Claude tiene discretion para proponerlas en plan stage si emergen.

---

## Claude's Discretion

- Estructura exacta de la función de migración (un solo SQL DELETE con CTE vs múltiples queries en JS)
- Cómo se computa "current period" en la lógica de visualización
- Manejo del caso `performed_habit` huérfano si aparece durante el cleanup
- Estrategia de testing del cleanup migration
- Qué hacer si el index falla porque el cleanup no eliminó todos los duplicados

## Deferred Ideas

- Estrategia de tests / regresión — Claude propone en plan stage
- Auditoría de flujos no listados (timezone, reinstal, edición masiva)
- Handling de spontaneous post-fix
- Migración del backup JSON pre-migration durante restore

---

*Phase: 04-habit-creation-audit*
*Discussion: 2026-05-01*
