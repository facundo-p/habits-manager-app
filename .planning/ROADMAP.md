# Roadmap: Cozy Habits — Bug Fixes, Tech Debt & Cloud Backup

## Overview

Este milestone parte de correctness: cuatro bugs en el sistema de daily assignments generan datos corruptos que serían preservados por cualquier backup. Una vez corregidos, se limpia el tech debt estructural (parsing y tipos) que haría más frágil el código nuevo. Finalmente, con datos confiables y base limpia, se construye Google Drive backup como capa de transporte sobre la lógica de backup existente.

## Phases

- [ ] **Phase 1: Bug Fixes** - Corregir los cuatro bugs de daily assignments que causan duplicación de datos y drift de timezone
- [ ] **Phase 2: Tech Debt** - Limpiar tipos y centralizar parsing antes de agregar nueva complejidad
- [ ] **Phase 3: Google Drive Backup** - Agregar backup/restore manual a Google Drive con autenticación OAuth
- [ ] **Phase 4: Habit Creation Audit & Duplicate Cleanup** - Auditar todos los flujos de creación automática de hábitos diarios, corregir las fuentes de duplicación y limpiar la DB existente

## Phase Details

### Phase 1: Bug Fixes
**Goal**: Los datos de daily assignments son correctos — sin duplicaciones por espontáneos, sin drift de timezone, sin categorías inválidas
**Depends on**: Nothing (first phase)
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04
**Success Criteria** (what must be TRUE):
  1. Un día que solo tiene habits espontáneos no recibe nuevas assignments al hacer backfill — el guard cuenta todas las rows, no solo las no-espontáneas
  2. La función `isFutureDate()` existe como utility compartida y ambos call sites (addAssignmentForHabit y ensureAssignmentsForDate) la invocan desde el mismo lugar
  3. La iteración de fechas en el backfill produce la misma fecha en cualquier timezone (UTC explícito en el constructor de Date)
  4. Insertar un habit espontáneo con categoría inválida falla con error descriptivo en vez de persistir un ID de área inexistente en la DB
**Plans**: 2 plans

Plans:
- [x] 01-01: Fix backfill spontaneous guard, extract isFutureDate utility, fix UTC date iteration
- [x] 01-02: Add category validation against VALID_AREA_IDS on spontaneous habit insert

### Phase 2: Tech Debt
**Goal**: El codebase tiene tipos explícitos y un único punto de parsing de categorías — sin `any`, sin `as` assertions, sin JSON.parse disperso
**Depends on**: Phase 1
**Requirements**: DEBT-01, DEBT-02, DEBT-03
**Success Criteria** (what must be TRUE):
  1. `useSpeechRecognition` tiene una interfaz `SpeechModuleInterface` tipada y no contiene ningún `any` explícito
  2. Todo JSON parsing de categorías pasa por `parseAndValidateCategories()` en `parsing.ts` — no hay llamadas directas a `JSON.parse` para arrays de categorías en otros archivos
  3. `sanitizeTable` retorna tipos explícitos por tabla (sin `[key: string]: any`) y el SQL concatenado está documentado o reemplazado por funciones específicas por tabla
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Wave 0 test stubs + parser central parseAndValidateCategories + write-time category validation in habitService (D-15)
- [x] 02-02-PLAN.md — Migrate 4 call sites to parseAndValidateCategories + replace sanitizeTable with sanitizeHabitDefaultCategories and sanitizePerformedCategoriesUsed (static SQL, typed shapes)
- [x] 02-03-PLAN.md — Type useSpeechRecognition with SpeechModuleInterface (eliminate two any) + remove as Partial<BackupData> casts from backupService.parseAndValidate (D-04)

### Phase 3: Google Drive Backup
**Goal**: El usuario puede hacer backup de sus datos a Google Drive y restaurarlos desde cualquier dispositivo, con control explícito y mensajes de error accionables
**Depends on**: Phase 2
**Requirements**: DRIVE-01, DRIVE-02, DRIVE-03, DRIVE-04, DRIVE-05, DRIVE-06, DRIVE-07, DRIVE-08
**Success Criteria** (what must be TRUE):
  1. El usuario puede autenticarse con su cuenta Google desde Settings y ver su email confirmando que está conectado
  2. El usuario puede presionar "Backup to Drive" y sus datos se suben a Google Drive con nombre `cozyhabits-YYYY-MM-DD.json`; la pantalla de Settings muestra el timestamp del último backup exitoso
  3. El usuario puede ver la lista de backups disponibles en su Drive y seleccionar uno para restaurar, con modal de confirmación que muestra la fecha del backup y advertencia de que reemplazará los datos actuales
  4. El usuario puede desconectar su cuenta Google (sign out) desde Settings
  5. Cuando falla una operación de Drive (sin red, token expirado, quota excedida), el usuario ve un mensaje con la causa del error y una acción sugerida — no un crash silencioso
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Google OAuth bootstrap: install @react-native-google-signin/google-signin@16.1.2, app.json plugin + ios.bundleIdentifier, ALERT_DRIVE_* constants, useSettingsStore auth fields, googleAuth.ts service, App.tsx silent sign-in startup hook _(code-complete 2026-04-28; runtime auth bloqueado hasta GCP Console setup — ver 03-01-SUMMARY.md)_
- [x] 03-02-PLAN.md — Drive transport + Settings UI: promote backupService internals to named exports, driveRetention.ts pure function (Time Machine policy), driveBackupService.ts (signIn/signOut/upload/list/error mapping with mocked tests), LoadingOverlay component, SettingsScreen "Backup en la nube" section (Connect + Backup ahora + Sign-out + last-backup caption)
- [x] 03-03-PLAN.md — Restore flow + navigation: driveBackupService.restoreFromBackup with pre-restore safety cache (D-19), RestoreFromDriveScreen (loading/empty/error/loaded + preview + confirm), wire RestoreFromDrive route in App.tsx, replace SettingsScreen placeholder

## Progress

**Execution Order:**
Phases execute in order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Bug Fixes | 2/2 | Complete | - |
| 2. Tech Debt | 3/3 | Complete | - |
| 3. Google Drive Backup | 1/3 | In progress | - |
| 4. Habit Creation Audit & Duplicate Cleanup | 0/4 | Planned | - |

### Phase 4: Habit Creation Audit & Duplicate Cleanup

**Goal:** Auditar exhaustivamente todos los flujos de creación automática de daily assignments — rollover diario, inicio de semana, inicio de mes, creación manual de hábito en biblioteca, restauración de backups — identificar dónde se generan duplicados, corregir el código en cada flujo y diseñar una migración de DB que limpie los duplicados ya persistidos en bases existentes para dejarlas consistentes.
**Requirements**: REQ-04-01, REQ-04-02, REQ-04-03, REQ-04-04, REQ-04-05, REQ-04-06, REQ-04-07, REQ-04-08, REQ-04-09, REQ-04-10, REQ-04-11, REQ-04-12
**Depends on:** Phase 3
**Plans:** 4 plans

Plans:
- [ ] 04-01-PLAN.md — periodHelpers (REQ-04-12) + dedupeAssignmentsArray (REQ-04-03 utility) + Wave 0 test infrastructure (createPreMigrationTestDatabase, seedDuplicates, insertTestPerformed)
- [ ] 04-02-PLAN.md — Migration v1 versionada via PRAGMA user_version: dedupe via CTE+ROW_NUMBER (REQ-04-04) + partial UNIQUE INDEX (REQ-04-05/08/09) + atomicity/idempotency/silent failure (REQ-04-06/07) + integración en initDatabase y verificación de boot order
- [ ] 04-03-PLAN.md — Visibility-aware reads (REQ-04-10/11): DailyItem.isCompletedForPeriod via single aggregated query + completion propagation a período (D-01 Opción B) + dev invariant warn (REQ-04-01) + idempotency confirmation (REQ-04-02)
- [ ] 04-04-PLAN.md — Restore pre-clean en backupService (REQ-04-03 integration) + ARCHITECTURE.md doc-fix (Regla 3.4 CLAUDE.md) + 04-VALIDATION.md per-task map filled (nyquist_compliant: true)
