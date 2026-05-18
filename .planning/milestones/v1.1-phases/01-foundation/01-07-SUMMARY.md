# Plan 07 — Summary (Wave 6)

**Phase:** 01-foundation · **Wave:** 6 · **Plan:** 07 — tone-of-voice.md (D-07)
**Status:** ✅ executed · **Date:** 2026-05-18 · **Branch:** `feat/v1.1-phase-1-foundation`
**Requirements:** FOUND-06 · **Decisions:** D-07
**Depends on:** ninguna (paralelizable)

---

## Files created

| File | Size | Purpose |
|---|---|---|
| `.planning/docs/tone-of-voice.md` | 85 líneas / ~530 palabras | Living doc de copy guidelines para v1.1+ (es-AR, voseo). |

## Estructura del documento (7 secciones)

1. **Principios negativos (NO hacer)** — 9 antipatterns explícitos (parasocial language, streaks/badges, shaming, comparaciones evaluativas, urgencia falsa, lenguaje moral sobre mood, exposición de user-typed content en notifs).
2. **Principios positivos (SÍ hacer)** — 5 reglas accionables (voz empática serena, voseo, lenguaje accionable sin presión, descriptivo vs. diagnóstico, sugerencias como invitación).
3. **Empty states** — neutralidad, no culpa, ofrecer acción concreta. Ejemplos comparados (OK vs. NO).
4. **Glosario mínimo (v1.1)** — 8 términos del dominio (ánimo/mood, nota, frase de cabecera, revisión semanal, sueño, reflexión, check-in matutino/nocturno). Glosario completo diferido.
5. **Notificaciones (consumido en Phase 5)** — ejemplos OK vs. NO; **body NUNCA incluye contenido user-typed** (privacy); deep-link al primary action.
6. **Migration / error UX (Phase 1)** — strings exactos del `MigrationErrorScreen` (Wave 5) ya implementado.
7. **Lifecycle del documento** — es-AR only por ahora; updates por cada PR con copy nuevo; sign-off de strings finales en Phase 2/5.

## Verification log

- ✅ `test -f .planning/docs/tone-of-voice.md` → existe.
- ✅ `wc -l` → 85 líneas (target: >60).
- ✅ Las 5 secciones mínimas pedidas en CONTEXT D-07 están presentes (Principios negativos / positivos, Empty states, Glosario, Notificaciones) + 2 adicionales derivadas de las decisiones de Phase 1 (Migration UX, Lifecycle).
- ✅ **Sin emojis** (per `.claude/CLAUDE.md`). Los marcadores OK/NO reemplazan el shorthand visual del scaffold para cumplir estrictamente.
- ✅ **Voseo + es-AR** explicitado en sección 2 y en el header del doc.
- ✅ Sección 6 documenta los strings del MigrationErrorScreen como un caso ya implementado (cross-reference Wave 5).

## Threat mitigations applied

- **T-07-01** (Phase 2/5 ignoran el documento) — Mitigación a aplicar por future phases: sus PLAN.md deben incluir `@.planning/docs/tone-of-voice.md` en `<context>`. Plan 08 (Wave 7) verifica vía grep en SUMMARYs.

## Notes

- **Glosario completo diferido:** crece orgánicamente. Phase 2/5 agregan términos cuando hay copy concreto, no especulativamente.
- **Documento living:** sección 7 establece el contrato de updates. No es un snapshot inmutable.
