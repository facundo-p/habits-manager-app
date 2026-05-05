---
slug: dev-db-wiped-post-phase4
status: abandoned
trigger: "Post-deploy de phase 4: la app dev (Expo Go) abrió con DB vacía cuando esa tarde tenía datos."
created: 2026-05-01T22:00:00Z
updated: 2026-05-02T00:35:00Z
severity: critical
phase_context: post phase-04 deploy (commit 7f9f293)
resolution: workaround (user restored from local backup)
---

# Debug Session — Dev DB Wiped Post Phase 4 Deploy

## Outcome

Investigation **abandonada** sin causa raíz confirmada — el usuario restauró desde un backup JSON local y prefirió no seguir la investigación. La pérdida exacta del scope de Expo Go quedó sin reproducir/diseccionar.

## Hipótesis descartadas (con evidencia)

1. **Migración v1 borra rows válidas** — DESCARTADA por revisión de SQL en `assignmentRepository.ts::SQL_DEDUPE_VIA_CTE`. El `PARTITION BY (habit_id, date)` con `WHERE rn > 1` y `WHERE habit_id IS NOT NULL` garantiza que sobrevive ≥1 row por grupo y no toca spontaneous.
2. **Otro path destructivo en initDatabase** — DESCARTADA por revisión de `services/db.ts`. `executeSchema` usa `CREATE TABLE IF NOT EXISTS`, `migrateSchema` sólo `ALTER ADD COLUMN`, `sanitizeCategories` sólo `UPDATE`, `seedHabits` sólo `INSERT if count==0`. Sin DROP/DELETE-global.
3. **Colisión package id dev↔standalone** — DESCARTADA por `app.config.js` (sufijo `.std` sólo cuando `APP_VARIANT==='standalone'`) + `eas.json` (preview/production setean APP_VARIANT, development no). Sandboxes Android distintos por diseño.

## Hipótesis prevalente al cierre (sin confirmar)

**Cambio de scope de Expo Go por cambio de URL del experience.** Expo Go scopea el storage (incluyendo SQLite) por hash de la URL del proyecto (`exp://<host>:<port>`). Evidencia indirecta:

- `adb reverse --list` estaba VACÍO al investigar — el device no tenía port-forward activo, así que no podía alcanzar `localhost:8081`.
- Mac IP actual: `192.168.0.11`. Si esta tarde la URL era distinta (otra IP, tunnel, o `localhost` con adb reverse), el scope cambió y la SQLite con datos quedó en otra ruta dentro de `/data/data/host.exp.exponent/files/ExperienceData/<otro-hash>/SQLite/cozyhabit.db`.
- El bundle que Expo Go corrió esta sesión era **cacheado** (post-phase-4 pero pre-DB-DIAG) — Metro estaba ok (curl al `/node_modules/expo/AppEntry.bundle` devolvía 13MB con DB-DIAG presente), pero Expo Go no estaba conectado a Metro y caía a cache.
- No se pudo navegar al scope viejo en este debug porque el usuario no compartió la lista de "Recently visited" en Expo Go antes de cerrar la sesión.

## Acciones aplicadas durante el debug y revertidas

- Edit temporal en `src/services/db.ts` agregando un bloque `[DB-DIAG]` que imprime counts post-init. **Revertido** al cerrar la sesión — `git status` limpio.
- `adb -s R5CT90A9GEJ reverse tcp:8081 tcp:8081` — port-forward USB activo. Ya no aplica (device se desconectó / sesión cerrada).

## Recomendación preventiva (futuro)

Si vuelve a aparecer "datos perdidos en dev", chequear PRIMERO:

1. **¿`adb reverse --list` muestra `tcp:8081`?** Si no, correr `adb reverse tcp:8081 tcp:8081`.
2. **¿La URL del experience en Expo Go es la misma de la última sesión con datos?** Mirar "Recently visited" en Expo Go.
3. Como mejora del producto: el banner "primera vez? restaurá desde Drive" en variantes con DB vacía + backup disponible aplicaría también a Expo Go cuando cambia de scope.

## Resolution

**Workaround:** usuario restauró desde un backup JSON local exportado previamente con la feature de Ajustes → Export. Sin pérdida real de datos. Causa raíz exacta no confirmada.
