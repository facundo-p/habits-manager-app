---
phase: 2
slug: tech-debt
status: approved
shadcn_initialized: false
preset: none
created: 2026-04-25
---

# Phase 2 — UI Design Contract

> Esta fase es un refactor de deuda técnica puro. El dominio declarado en CONTEXT.md es
> explícito: "Sin features nuevas, sin cambios de UI, sin perf optimizations."
> No aplican contratos visuales (espaciado, tipografía, color, componentes).
> El único contrato relevante son los mensajes de error de escritura introducidos por D-15.

---

## Veredicto de UI

**NO se requieren contratos visuales para esta fase.**

Los 4 archivos UI modificados (`DailySheetScreen.tsx`, `HabitLibraryScreen.tsx`,
`HabitFormModal.tsx`, `statsService.ts`) solo migran su call-site a `parseAndValidateCategories`.
Ningún cambio visible para el usuario resulta de esa migración.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none |
| Icon library | not applicable |
| Font | not applicable |

No se inicializa shadcn. Esta fase no introduce componentes ni tokens nuevos.

---

## Spacing Scale

No aplicable — esta fase no agrega ni modifica ningún elemento de layout.

---

## Typography

No aplicable — esta fase no agrega ni modifica texto presentacional.

---

## Color

No aplicable — esta fase no agrega ni modifica elementos con color.

---

## Copywriting Contract

El único impacto user-facing de esta fase es el error de validación de escritura
introducido por D-15 en `habitService.ts` (o `habitRepository.ts`). Este error nunca
llega a la UI directamente — es un error de programación que la capa de servicio lanza
para que el caller lo maneje. No obstante se documenta la cadena exacta para consistencia
con BUG-04.

### Mensaje de error — validación de categorías en escritura (D-15)

| Contexto | Mensaje |
|----------|---------|
| `addHabit` / `updateHabit` recibe IDs de categoría inválidos | `"Categorías inválidas: [id1, id2]. Solo se permiten IDs de área definidos en VALID_AREA_IDS."` |

**Fuente:** "Claude's Discretion" en CONTEXT.md — "seguir el estilo de BUG-04 que el usuario validó".
**Estilo aplicado:** mensaje en español, lista los IDs inválidos, referencia explícita a la constante de validación.
**Canal:** `throw new Error(...)` — nunca se muestra directamente en la UI; la capa llamante decide el manejo.

Todos los demás contratos de copywriting (CTA, empty state, destructive confirmation) son
no aplicables porque esta fase no agrega interacciones nuevas.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |

No hay dependencias de registry. Esta fase solo modifica TypeScript interno.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS — único string de error documentado arriba
- [x] Dimension 2 Visuals: N/A — fase sin cambios visuales
- [x] Dimension 3 Color: N/A — fase sin cambios de color
- [x] Dimension 4 Typography: N/A — fase sin cambios tipográficos
- [x] Dimension 5 Spacing: N/A — fase sin cambios de layout
- [x] Dimension 6 Registry Safety: PASS — sin registries third-party

**Approval:** pending
