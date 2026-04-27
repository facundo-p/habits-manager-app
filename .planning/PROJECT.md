# Cozy Habits — Bug Fixes, Tech Debt & Cloud Backup

## What This Is

Cozy Habits es una app de tracking de hábitos para móvil (React Native/Expo) con datos locales en SQLite. Este milestone se enfoca en corregir bugs conocidos, limpiar tech debt detectado en el codebase mapping, y agregar backup a Google Drive para proteger datos entre dispositivos.

## Core Value

Los datos del usuario deben ser confiables (sin duplicaciones ni pérdida) y estar protegidos con backup en la nube.

## Requirements

### Validated

- ✓ Habit CRUD (crear, editar, eliminar hábitos) — existing
- ✓ Daily assignments con snapshots inmutables — existing
- ✓ Completion toggle con mood/reflection — existing
- ✓ Spontaneous habits — existing
- ✓ Stats (heatmap, categorías, comparación semanal) — existing
- ✓ Backup/restore local (export/import JSON) — existing
- ✓ Multi-frequency habits (daily, weekly, monthly) — existing
- ✓ Category/area system con filtering — existing
- ✓ Settings (nombre, notificaciones, theme) — existing

### Active

- ✓ Fix: backfill logic debe considerar espontáneos al contar assignments por fecha — Validated in Phase 1: Bug Fixes
- ✓ Fix: eliminar duplicación de check de fecha futura en assignmentService — Validated in Phase 1: Bug Fixes
- ✓ Fix: validar categorías contra VALID_AREA_IDS antes de insertar espontáneos — Validated in Phase 1: Bug Fixes
- ✓ Fix: timezone — usar UTC explícito en backfill date calculation — Validated in Phase 1: Bug Fixes
- ✓ Tech debt: type safety en useSpeechRecognition (eliminar `any`) — Validated in Phase 2: Tech Debt
- ✓ Tech debt: centralizar JSON parsing de categorías en un solo punto — Validated in Phase 2: Tech Debt
- ✓ Tech debt: tipar resultados de sanitizeTable (eliminar `[key: string]: any`) — Validated in Phase 2: Tech Debt
- ✓ Tech debt: documentar seguridad de SQL concatenado en sanitizeTable o refactorear a funciones explícitas — Validated in Phase 2: Tech Debt (refactor a funciones explícitas con SQL estático)
- [ ] Cloud backup: export/import de datos a Google Drive

### Out of Scope

- Sync bidireccional en tiempo real — complejidad excesiva para este milestone
- Migración de chart library — funciona, no es crítico
- Performance optimization (memoización, cache de stats) — mejoras futuras
- Test coverage gaps — milestone futuro dedicado a testing
- Backup encryption — se evaluará después de cloud backup
- Data import desde otras apps — feature futura

## Context

- App brownfield con arquitectura layered limpia (Screen → Store → Service → Repository → SQLite)
- Codebase mapping completado con 7 documentos en `.planning/codebase/`
- Bugs documentados con inline comments en español ("Bug 2", "Bug 3")
- Tests existentes cubren daily assignments (357 líneas), pero no espontáneos ni mood
- Stack: Expo 54, React Native 0.81, TypeScript 5.9, Zustand 5, expo-sqlite

## Constraints

- **Tech stack**: Expo managed workflow — cualquier dependencia debe ser compatible con Expo
- **Storage**: SQLite local como source of truth, Google Drive solo como backup
- **Backward compatibility**: No romper datos existentes de usuarios (migraciones seguras)
- **Google Drive**: Usar API REST o librería compatible con Expo (no native modules que requieran eject)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Google Drive para backup cloud | Nativo en Android, familiar para usuarios, el usuario lo prefiere | — Pending |
| Excluir sync real-time | Complejidad desproporcionada para el valor actual | — Pending |
| Excluir performance optimizations | Funcional en devices actuales, priorizar correctness | — Pending |

---
*Last updated: 2026-04-27 after Phase 2: Tech Debt completion — codebase ahora con tipos explícitos (cero `any` y cero `as` casts en useSpeechRecognition/backupService) y un único punto de parsing+validación de categorías (`parseAndValidateCategories`). Próximo: Phase 3 Google Drive Backup.*
