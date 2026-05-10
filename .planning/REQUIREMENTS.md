# Requirements — v1.1 Bienestar emocional

**Goal:** Convertir Cozy Habits en herramienta de bienestar integral — capturar señal emocional más allá de los hábitos, visibilizarla en stats y timeline, y habilitar reflexión guiada semanal.

**Linked GitHub issues:** #7 (MORN), #8 (NOTE), #20 (PHRA)

**Defined:** 2026-05-07

---

## v1.1 Requirements

### FOUNDATION — prerequisitos cross-cutting

- [ ] **FOUND-01**: La app expone un único helper `getLocalDayKey()` que calcula "hoy" en local timezone, usado por todas las features de bienestar (sin `toISOString().slice(0,10)` disperso)
- [ ] **FOUND-02**: Existe un componente `<MoodPicker>` compartido entre habit completions y todas las features de v1.1 (escala única en un solo lugar)
- [ ] **FOUND-03**: La DB migra a v2 atómicamente: agrega tablas `mood_log` (kind=morning|evening|note, partial UNIQUE INDEX(kind, date_key) para kinds 1-por-día), `text_library` (kind=quote|future), `weekly_reviews`, `drafts`, índices, y columna `mood_scale_version` en `mood_entries`
- [ ] **FOUND-04**: El backup eleva a `BACKUP_VERSION = 2`, serializa las 4 nuevas tablas (`mood_log`, `text_library`, `weekly_reviews`; `drafts` queda excluida por transitoria), y restaura backups v1 tratando arrays nuevos como `[]` (graceful dispatcher)
- [ ] **FOUND-05**: La tabla `drafts` permite autosave de check-ins/notas/review en progreso, con recuperación al reabrir el flow

### MORN — Check-in matutino (Issue #7)

- [ ] **MORN-01**: User registra un check-in matutino con mood (requerido) + horas de sueño (0–14, step 0.25, opcional) + comentario libre (opcional)
- [ ] **MORN-02**: Solo existe un check-in matutino por día — submits posteriores actualizan el existente (UPSERT por `date`)
- [ ] **MORN-03**: User edita el check-in matutino del día actual desde el mismo flow de creación
- [ ] **MORN-04**: User elimina el check-in matutino del día con confirmación
- [ ] **MORN-05**: Si User cierra la app antes de submit, el contenido parcial se preserva como draft y se restaura al reabrir el flow

### EVEN — Check-in nocturno

- [ ] **EVEN-01**: User registra un check-in nocturno con mood (requerido) + comentario libre (opcional) — espejo simétrico de MORN
- [ ] **EVEN-02**: Solo existe un check-in nocturno por día — submits posteriores actualizan el existente
- [ ] **EVEN-03**: User edita el check-in nocturno del día actual
- [ ] **EVEN-04**: User elimina el check-in nocturno del día con confirmación

### NOTE — Notas sueltas con mood (Issue #8)

- [ ] **NOTE-01**: User crea notas con texto libre + mood + timestamp automático, N por día (sin límite)
- [ ] **NOTE-02**: User edita texto y mood de una nota existente
- [ ] **NOTE-03**: User elimina una nota con confirmación
- [ ] **NOTE-04**: User accede al flow de creación de nota desde un FAB visible en Home
- [ ] **NOTE-05**: El texto de notas se cap a 4000 caracteres con feedback antes del submit

### PHRA — Mis frases de cabecera (Issue #20)

- [ ] **PHRA-01**: User crea una frase con texto (requerido) + autor opcional
- [ ] **PHRA-02**: User ve el listado completo de frases ordenado por fecha de creación (más reciente arriba)
- [ ] **PHRA-03**: User edita texto y autor de una frase existente
- [ ] **PHRA-04**: User elimina una frase con confirmación
- [ ] **PHRA-05**: La API expone un selector que devuelve una frase random — schema y service preparados para ser consumidos por un widget futuro sin refactor

### TIME — Timeline emocional

- [ ] **TIME-01**: User ve un timeline cronológico del día actual con todos los puntos de mood (matutino + notas + habit completions con mood + nocturno)
- [ ] **TIME-02**: User navega a días previos desde el timeline (sin estética de error en días vacíos)
- [ ] **TIME-03**: User cambia entre vista día y vista semana (puntos agrupados por día)
- [ ] **TIME-04**: Cada punto del timeline muestra mood, hora y enlace a su detalle (comentario completo si aplica)

### STAT — Stats de bienestar

- [ ] **STAT-01**: User ve el mood promedio diario sobre la última semana/mes en una línea de tiempo
- [ ] **STAT-02**: User ve la distribución de moods en el período seleccionado (cuántas veces se sintió cada nivel)
- [ ] **STAT-03**: User ve el promedio de horas de sueño en el período (excluye días sin dato)
- [ ] **STAT-04**: User ve la correlación sueño↔mood como bucketed bar chart, **sólo cuando hay ≥14 días** de datos pareados
- [ ] **STAT-05**: User ve los top hábitos asociados con días de mood alto, **sólo cuando hay ≥14 días** de datos
- [ ] **STAT-06**: Cuando N<14, las correlaciones se ocultan con copy explicativo (no se muestran números engañosos)

### JOUR — Journaling notebook

- [ ] **JOUR-01**: User abre la vista de journaling y ve un día con todas las notas escritas (comentario matutino + notas sueltas + comentario nocturno) en orden cronológico
- [ ] **JOUR-02**: User navega día a día (anterior/siguiente) con la estética cuaderno de la app
- [ ] **JOUR-03**: Días sin entradas se muestran con una indicación clara y empática (no error, no shame)
- [ ] **JOUR-04**: User abre una entry directamente desde journal o timeline y la edita en su flow original

### REVI — Weekly review

- [ ] **REVI-01**: User accede al weekly review desde Home cuando la semana está cerrando (auto-prompt configurable) o desde un acceso manual
- [ ] **REVI-02**: El review muestra automáticamente el resumen de la semana: mood promedio, top hábitos completados, sueño promedio
- [ ] **REVI-03**: User responde 2–3 preguntas guiadas de bienestar (cada una skippable individualmente)
- [ ] **REVI-04**: Solo existe un review por semana — submits posteriores actualizan el existente (UPSERT por `week_key` ISO)
- [ ] **REVI-05**: User edita un weekly review existente desde el mismo flow
- [ ] **REVI-06**: User configura `weekStartsOn` en Settings (Lunes / Domingo) y el `week_key` lo respeta

### NOTIF — Push notifications

- [ ] **NOTIF-01**: User activa/desactiva la notificación matutina y configura su horario en Settings
- [ ] **NOTIF-02**: User activa/desactiva la notificación nocturna y configura su horario en Settings
- [ ] **NOTIF-03**: User activa/desactiva la notificación de weekly review y configura día + horario
- [ ] **NOTIF-04**: Si User niega permisos del SO, la app muestra un banner explicativo no intrusivo (sin re-prompt agresivo)
- [ ] **NOTIF-05**: Al volver a foreground la app reconcilia notificaciones programadas (cleanup de orphans, ajuste por cambio de TZ, re-schedule si días pasan)
- [ ] **NOTIF-06**: La copia de notificaciones es empática y no manipuladora (sin "te extrañamos", sin streaks, sin urgencia falsa)

---

## Future Requirements (deferred)

- Widget de Home consumiendo PHRA-05 random selector (Issue #20 — scope futuro)
- Voice-to-text en notas (A.2)
- Notification snooze
- Journal export a PDF/share
- FTS5 search en journal
- Soft-delete con undo (decisión: hard-delete con confirmación en v1.1)
- Pattern hints ("tus mejores días tienen X hs de sueño promedio") — explicitado out de v1.1, futuro
- Daily prompts rotativos — explicitado out de v1.1, futuro

## Out of Scope

- **IA / NLP analysis de notas** — privacidad + complejidad desproporcionada al valor
- **Push proactivas según mood** — surveillance feel, antipattern de wellbeing
- **Journal export / share** — no es valor v1.1, requiere decisión de privacidad
- **Tracking colaborativo / partner mode / compartir con terapeuta** — fuera del alcance de la app
- **Streaks / badges / social comparison** — antipattern explícito en wellbeing
- **Multi-dimensional mood (energy + valence)** — escala unificada simple es decisión deliberada
- **Feeling tags / categorización emocional** — premature complexity, sin señal de demanda
- **Multi-cloud backup (Dropbox, iCloud)** — heredado out de v1.0, sigue
- **Sync bidireccional real-time** — heredado out de v1.0, sigue
- **Migración de chart library** — chart-kit cubre los nuevos viz needs

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 — Foundation | Pending |
| FOUND-02 | Phase 1 — Foundation | Pending |
| FOUND-03 | Phase 1 — Foundation | Pending |
| FOUND-04 | Phase 1 — Foundation | Pending |
| FOUND-05 | Phase 1 — Foundation | Pending |
| MORN-01 | Phase 2 — Capture | Pending |
| MORN-02 | Phase 2 — Capture | Pending |
| MORN-03 | Phase 2 — Capture | Pending |
| MORN-04 | Phase 2 — Capture | Pending |
| MORN-05 | Phase 2 — Capture | Pending |
| EVEN-01 | Phase 2 — Capture | Pending |
| EVEN-02 | Phase 2 — Capture | Pending |
| EVEN-03 | Phase 2 — Capture | Pending |
| EVEN-04 | Phase 2 — Capture | Pending |
| NOTE-01 | Phase 2 — Capture | Pending |
| NOTE-02 | Phase 2 — Capture | Pending |
| NOTE-03 | Phase 2 — Capture | Pending |
| NOTE-04 | Phase 2 — Capture | Pending |
| NOTE-05 | Phase 2 — Capture | Pending |
| PHRA-01 | Phase 2 — Capture | Pending |
| PHRA-02 | Phase 2 — Capture | Pending |
| PHRA-03 | Phase 2 — Capture | Pending |
| PHRA-04 | Phase 2 — Capture | Pending |
| PHRA-05 | Phase 2 — Capture | Pending |
| TIME-01 | Phase 3 — Visualization | Pending |
| TIME-02 | Phase 3 — Visualization | Pending |
| TIME-03 | Phase 3 — Visualization | Pending |
| TIME-04 | Phase 3 — Visualization | Pending |
| STAT-01 | Phase 3 — Visualization | Pending |
| STAT-02 | Phase 3 — Visualization | Pending |
| STAT-03 | Phase 3 — Visualization | Pending |
| STAT-04 | Phase 3 — Visualization | Pending |
| STAT-05 | Phase 3 — Visualization | Pending |
| STAT-06 | Phase 3 — Visualization | Pending |
| JOUR-01 | Phase 3 — Visualization | Pending |
| JOUR-02 | Phase 3 — Visualization | Pending |
| JOUR-03 | Phase 3 — Visualization | Pending |
| JOUR-04 | Phase 3 — Visualization | Pending |
| REVI-01 | Phase 4 — Reflection | Pending |
| REVI-02 | Phase 4 — Reflection | Pending |
| REVI-03 | Phase 4 — Reflection | Pending |
| REVI-04 | Phase 4 — Reflection | Pending |
| REVI-05 | Phase 4 — Reflection | Pending |
| REVI-06 | Phase 4 — Reflection | Pending |
| NOTIF-01 | Phase 5 — Notifications | Pending |
| NOTIF-02 | Phase 5 — Notifications | Pending |
| NOTIF-03 | Phase 5 — Notifications | Pending |
| NOTIF-04 | Phase 5 — Notifications | Pending |
| NOTIF-05 | Phase 5 — Notifications | Pending |
| NOTIF-06 | Phase 5 — Notifications | Pending |

**Coverage:** 50/50 requirements mapped (100%) · 0 orphans · 0 duplicates

---
*Last updated: 2026-05-07 — Traceability filled in by roadmap. 50 reqs across 5 phases for v1.1 Bienestar emocional milestone.*
