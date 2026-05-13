# Phase 1: Foundation — Discussion Log

**Date:** 2026-05-12
**Mode:** discuss (default)

Audit trail of the gray areas presented and decisions taken. Not consumed by downstream agents; CONTEXT.md is the canonical record.

---

## Areas Presented

Multi-select, 4 áreas ofrecidas:

1. ☑ Adopción de getLocalDayKey
2. ☑ API + refactor de MoodPicker / ReflectionModal
3. ☑ Lifecycle de drafts
4. ☑ Failure UX de migration v2 + tone-of-voice.md

Las 4 seleccionadas.

---

## Area 1 — Adopción de `getLocalDayKey()`

**Q1.** ¿Cómo introducimos getLocalDayKey()?
- Rename total (codemod) **← elegida**
- Nuevo helper + alias
- Nuevo helper sin tocar el viejo

**Q2.** ¿Dónde vive el helper?
- src/utils/date.ts (research) **← elegida**
- Seguir en src/services/db.ts

**Q3.** Scope del codemod
- Solo getLocalDayKey
- Todos los date helpers **← elegida**
- getLocalDayKey + isFutureDate

→ **D-01** en CONTEXT.

---

## Area 2 — `<MoodPicker>` + refactor `ReflectionModal`

**Q1.** API de `<MoodPicker>`
- Solo mood (mínimo) **← elegida**
- Mood + comentario opcional
- Mood + comentario + sleep

**Q2.** Scope refactor ReflectionModal
- Paridad visual exacta
- Paridad + polish acotado **← elegida**

→ **D-02 / D-03** en CONTEXT.

---

## Area 3 — Lifecycle de drafts

**Q1.** ¿Cuándo se borra una fila de drafts?
- Solo en submit OK **← elegida**
- Submit OK o cancel explícito
- Submit OK o cualquier close

**Q2.** Frecuencia del autosave
- Debounce ~500ms **← elegida**
- Debounce ~1500ms
- On blur / on background

**Q3.** TTL drafts viejos
- Purge >7 días al boot **← elegida**
- Purge >30 días al boot
- Sin purge automático
- Purge cuando cambia el día

→ **D-04** en CONTEXT.

---

## Area 4 — Migration v2 failure UX + tone-of-voice.md

**Q1.** Si migration v2 falla
- Pantalla bloqueante + restore **← elegida**
- Banner + arranque degradado
- Pantalla bloqueante sin restore

**Q2.** ¿Backup local automático pre-migración?
- Sí, snapshot automático **← elegida**
- No, confiar en rollback atómico

**Q3.** ¿Cuándo escribimos tone-of-voice.md?
- Ahora en Phase 1 **← elegida**
- Deferir a Phase 2
- Deferir a Phase 5

→ **D-05 / D-06 / D-07** en CONTEXT.

---

## Scope Creep Redirected

Ninguno — el usuario se mantuvo en el dominio Foundation.

## Notes

- Patrón heredado de Phase 4 v1.0 (D-05/D-06/D-08) reusado como ancla para D-05/D-06 acá; explícitamente más estricto (pantalla bloqueante) porque el cambio es schema-breaking, no data cleanup.
- Snapshot pre-v2 (D-06) introduce una capa nueva sobre el patrón existente; documentado como entregable de Phase 1.

---

*Discussion completed: 2026-05-12*
