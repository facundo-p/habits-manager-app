# Cozy Habits

## What This Is

Cozy Habits es una app de tracking de hábitos para móvil (React Native/Expo) con datos locales en SQLite y backup a Google Drive. Soporta hábitos diarios, semanales y mensuales con propagación de completion al período, espontáneos, mood/reflection, stats (heatmap, categorías, comparación semanal) y restore desde Drive.

## Core Value

Los datos del usuario deben ser confiables (sin duplicaciones ni pérdida) y estar protegidos con backup en la nube.

## Current State

**Shipped:** v1.0 Bug Fixes, Tech Debt & Cloud Backup (2026-05-05)
**In progress:** v1.1 Bienestar emocional

Stack: Expo 54, React Native 0.81, TypeScript 5.9, Zustand 5, expo-sqlite. Architecture: Screen → Store → Service → Repository → SQLite, layered y testeada (95+ tests). Migraciones versionadas via `PRAGMA user_version` con rollback atómico. Google Drive auth code-complete (runtime requiere GCP Console setup).

## Current Milestone: v1.1 Bienestar emocional

**Goal:** Convertir Cozy Habits en herramienta de bienestar integral — capturar señal emocional más allá de los hábitos, visibilizarla en stats y timeline, y habilitar reflexión guiada semanal.

**Target features:**

*Captura:*
- Check-in matutino: mood + horas de sueño + comentario (Issue #7)
- Notas sueltas con mood, N por día (Issue #8)
- Check-in nocturno: mood + comentario de cierre
- Mis frases de cabecera: texto + autor opcional, consultable (Issue #20)

*Visualización:*
- Timeline emocional cronológico día/semana
- Stats de bienestar: mood promedio, distribución, sueño, correlación sueño↔mood, hábitos asociados a días "buenos"
- Journaling cuaderno: vista navegable día por día con todas las notas

*Reflexión:*
- Weekly review: cierre de semana con resumen + preguntas de bienestar

**Key context:**
- Escala de mood unificada entre todas las fuentes (componente compartido)
- Push notifications con horario configurable para check-ins y weekly review
- Prioridad de corte: si aprieta, sale Reflexión (Eje C) primero. Captura es base
- Issues linkeados: #7, #8, #20

## Requirements

### Validated

- ✓ Habit CRUD (crear, editar, eliminar hábitos) — pre-v1.0
- ✓ Daily assignments con snapshots inmutables — pre-v1.0
- ✓ Completion toggle con mood/reflection — pre-v1.0
- ✓ Spontaneous habits — pre-v1.0
- ✓ Stats (heatmap, categorías, comparación semanal) — pre-v1.0
- ✓ Backup/restore local (export/import JSON) — pre-v1.0
- ✓ Multi-frequency habits (daily, weekly, monthly) — pre-v1.0
- ✓ Category/area system con filtering — pre-v1.0
- ✓ Settings (nombre, notificaciones, theme) — pre-v1.0
- ✓ Backfill logic considera espontáneos al contar assignments — v1.0 (Phase 1)
- ✓ `isFutureDate()` utility compartida en ambos call sites — v1.0 (Phase 1)
- ✓ Backfill date iteration UTC-safe (sin drift de timezone) — v1.0 (Phase 1)
- ✓ Categorías de espontáneos validadas contra VALID_AREA_IDS — v1.0 (Phase 1)
- ✓ `useSpeechRecognition` tipado con `SpeechModuleInterface` (cero `any`) — v1.0 (Phase 2)
- ✓ Centralizar JSON parsing de categorías en `parseAndValidateCategories` — v1.0 (Phase 2)
- ✓ `sanitizeTable` reemplazado por sanitizers tipados con SQL estático — v1.0 (Phase 2)
- ✓ Cloud backup: upload manual a Google Drive con nombre fechado — v1.0 (Phase 3)
- ✓ Cloud restore: lista de backups + preview + confirm + safety cache — v1.0 (Phase 3)
- ✓ Google Sign-in / Sign-out + error mapping accionable — v1.0 (Phase 3) _(runtime pending GCP Console)_
- ✓ Migración v1: dedupe + partial UNIQUE INDEX `idx_unique_habit_date` — v1.0 (Phase 4)
- ✓ Visibility-aware reads (D-01 Opción B): completion propaga al período — v1.0 (Phase 4)
- ✓ `restoreData` deduplica array antes de bulk insert — v1.0 (Phase 4)

### Active

_Requirements de v1.1 Bienestar emocional se definen en `.planning/REQUIREMENTS.md` durante este milestone._

### Out of Scope

- Sync bidireccional en tiempo real — complejidad desproporcionada para el valor actual
- Migración de chart library — funciona, no es crítico
- Performance optimization (memoización, cache de stats) — mejoras futuras
- Test coverage gaps — milestone futuro dedicado a testing
- Backup encryption — se evaluará después de validar cloud backup en runtime
- Data import desde otras apps — schemas heterogéneos, ROI bajo
- Multi-cloud (Dropbox, iCloud) — cada provider tiene SDK distinto
- Merge on restore — full replace es predecible, conflict resolution complejo

## Context

- App brownfield con arquitectura layered (Screen → Store → Service → Repository → SQLite).
- Codebase mapping disponible en `.planning/codebase/` (7 documentos).
- Tests cubren daily assignments, parsing, drive transport, restore flow y migration v1.
- 7 deferred items reconocidos al cerrar v1.0 (UAT/verification gaps de fases 02-04, debug session abandonada, quick task `qu5` sin estado final). Ver STATE.md "Deferred Items".

## Constraints

- **Tech stack**: Expo managed workflow — cualquier dependencia debe ser compatible con Expo.
- **Storage**: SQLite local como source of truth, Google Drive solo como backup.
- **Backward compatibility**: No romper datos existentes (migraciones versionadas con rollback).
- **Google Drive**: REST/SDK compatible con Expo (no native modules que requieran eject). Scope `drive.appdata` (hidden, no security review).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Google Drive para backup cloud | Nativo en Android, familiar para usuarios | ✓ v1.0 — implementado, runtime pending GCP setup |
| `@react-native-google-signin/google-signin` (no expo-auth-session) | expo-auth-session no soporta `drive.appdata` scope | ✓ v1.0 — confirmed |
| Scope `drive.appdata` (no `drive.file`) | Hidden, no requiere security review de Google | ✓ v1.0 |
| Migraciones versionadas via `PRAGMA user_version` | Built-in atómico, evita schema_version bespoke | ✓ v1.0 — Phase 4 |
| Visibility D-01 Opción B (una row/día + propagación al período) | Simple read-time, no rompe historial | ✓ v1.0 — Phase 4 |
| API split `prepareRestore`/`applyRestore` (single download) | Evita doble download en confirm; cleanup post-success | ✓ v1.0 — Phase 3 |
| Excluir sync real-time | Complejidad desproporcionada para el valor actual | ✓ Confirmado — sigue out of scope |
| Excluir performance optimizations | Funcional en devices actuales, priorizar correctness | ✓ Confirmado |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-06 — v1.1 Bienestar emocional started via `/gsd-new-milestone`. Goal: capturar/visibilizar/reflexionar señal emocional. Issues linkeados: #7, #8, #20.*
