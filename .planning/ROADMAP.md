# Roadmap: Cozy Habits — Bug Fixes, Tech Debt & Cloud Backup

## Overview

Este milestone parte de correctness: cuatro bugs en el sistema de daily assignments generan datos corruptos que serían preservados por cualquier backup. Una vez corregidos, se limpia el tech debt estructural (parsing y tipos) que haría más frágil el código nuevo. Finalmente, con datos confiables y base limpia, se construye Google Drive backup como capa de transporte sobre la lógica de backup existente.

## Phases

- [ ] **Phase 1: Bug Fixes** - Corregir los cuatro bugs de daily assignments que causan duplicación de datos y drift de timezone
- [ ] **Phase 2: Tech Debt** - Limpiar tipos y centralizar parsing antes de agregar nueva complejidad
- [ ] **Phase 3: Google Drive Backup** - Agregar backup/restore manual a Google Drive con autenticación OAuth

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
- [ ] 01-01: Fix backfill spontaneous guard, extract isFutureDate utility, fix UTC date iteration
- [ ] 01-02: Add category validation against VALID_AREA_IDS on spontaneous habit insert

### Phase 2: Tech Debt
**Goal**: El codebase tiene tipos explícitos y un único punto de parsing de categorías — sin `any`, sin `as` assertions, sin JSON.parse disperso
**Depends on**: Phase 1
**Requirements**: DEBT-01, DEBT-02, DEBT-03
**Success Criteria** (what must be TRUE):
  1. `useSpeechRecognition` tiene una interfaz `SpeechModuleInterface` tipada y no contiene ningún `any` explícito
  2. Todo JSON parsing de categorías pasa por `parseAndValidateCategories()` en `parsing.ts` — no hay llamadas directas a `JSON.parse` para arrays de categorías en otros archivos
  3. `sanitizeTable` retorna tipos explícitos por tabla (sin `[key: string]: any`) y el SQL concatenado está documentado o reemplazado por funciones específicas por tabla
**Plans**: TBD

Plans:
- [ ] 02-01: Type useSpeechRecognition, centralize category JSON parsing, type sanitizeTable results

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
**Plans**: TBD

Plans:
- [ ] 03-01: Google OAuth setup — dependency install, app.json config plugin, Google Cloud Console client ID, useSettingsStore auth fields
- [ ] 03-02: Drive service and backup upload — driveBackupService.ts, promote buildBackupData/parseAndValidate to exports, upload flow, last backup timestamp
- [ ] 03-03: Restore flow and Settings UI — backup list, restore with confirmation modal, sign-out, error handling, Settings screen Drive section

## Progress

**Execution Order:**
Phases execute in order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Bug Fixes | 0/2 | Not started | - |
| 2. Tech Debt | 0/1 | Not started | - |
| 3. Google Drive Backup | 0/3 | Not started | - |
