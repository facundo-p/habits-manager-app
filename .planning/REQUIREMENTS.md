# Requirements: Cozy Habits — Bug Fixes, Tech Debt & Cloud Backup

**Defined:** 2026-03-17
**Core Value:** Los datos del usuario deben ser confiables (sin duplicaciones ni pérdida) y estar protegidos con backup en la nube.

## v1 Requirements

### Bug Fixes

- [ ] **BUG-01**: Backfill logic debe contar espontáneos al evaluar si una fecha ya tiene assignments, evitando duplicación de habits regulares
- [ ] **BUG-02**: Future-date guard extraído a utility `isFutureDate()` usado desde ambos call sites (addAssignmentForHabit y ensureAssignmentsForDate)
- [ ] **BUG-03**: Backfill date iteration usa UTC explícito para evitar drift de ±1 día por timezone
- [ ] **BUG-04**: Categorías de espontáneos validadas contra VALID_AREA_IDS antes de insertar en DB

### Tech Debt

- [ ] **DEBT-01**: useSpeechRecognition tiene interfaz tipada para SpeechModule (eliminar `any`)
- [ ] **DEBT-02**: Todo JSON parsing de categorías centralizado en `parsing.ts` con validación contra VALID_AREA_IDS
- [ ] **DEBT-03**: sanitizeTable tiene tipos explícitos por tabla y SQL concatenado documentado o refactoreado a funciones específicas

### Google Drive Backup

- [ ] **DRIVE-01**: Usuario puede autenticarse con Google usando expo-auth-session con scope drive.file
- [x] **DRIVE-02**: Usuario puede subir backup completo a Google Drive con un botón manual
- [x] **DRIVE-03**: Archivos de backup nombrados con fecha (cozyhabits-YYYY-MM-DD.json)
- [ ] **DRIVE-04**: Usuario puede ver lista de backups en Drive y seleccionar uno para restaurar
- [ ] **DRIVE-05**: Usuario puede restaurar datos desde un backup de Google Drive (reemplaza datos locales con confirmación)
- [x] **DRIVE-06**: Usuario ve timestamp del último backup exitoso en la pantalla de settings
- [x] **DRIVE-07**: Usuario puede desconectar su cuenta de Google (sign out + revocar acceso)
- [x] **DRIVE-08**: Errores de Drive (quota, auth, red) se muestran al usuario con mensaje accionable

### Habit Creation Audit & Duplicate Cleanup (Phase 4)

- [ ] **REQ-04-01**: `ensureAssignmentsForDate` no duplica al re-correr; el guard `countByDate > 0` se mantiene y la propagación de visibilidad weekly/monthly no introduce nuevas inserciones
- [ ] **REQ-04-02**: `addAssignmentForHabit` es idempotente; el partial UNIQUE INDEX (REQ-04-05) actúa como defensa en profundidad si el guard falla
- [x] **REQ-04-03**: `restoreData` (backupService) deduplica el array de `daily_assignments` con la misma heurística D-03 (completed > has_performed > original-position) antes del bulk insert para evitar fallar el UNIQUE INDEX (driveBackupService.applyRestore reusa este path)
- [x] **REQ-04-04**: Migration v1 borra rows duplicadas respetando heurística D-03 (is_completed DESC → has performed_habit DESC → rowid ASC) en una sola sentencia DELETE con CTE+ROW_NUMBER
- [x] **REQ-04-05**: Migration v1 crea partial UNIQUE INDEX `idx_unique_habit_date` ON `daily_assignments(habit_id, date) WHERE habit_id IS NOT NULL`
- [x] **REQ-04-06**: Migration v1 es idempotente (corre 2x sin error gracias a `PRAGMA user_version`); orden atómico (D-08) detect → DELETE losers → CREATE INDEX → set user_version, todo en una transacción
- [x] **REQ-04-07**: Migration v1 falla silenciosamente con `console.error('[migration v1] ...')` y NO bloquea el boot (D-06); rollback automático preserva la DB en estado pre-migración
- [x] **REQ-04-08**: UNIQUE INDEX excluye `habit_id IS NULL` permitiendo múltiples spontaneous el mismo día (test ya existe en `dailyAssignments.test.ts:343-352`)
- [x] **REQ-04-09**: UNIQUE INDEX rechaza duplicados de hábitos regulares post-migración (defensa en profundidad — test ya existe en `dailyAssignments.test.ts:334-341`)
- [ ] **REQ-04-10**: Hábitos weekly visibles todos los días de la semana ISO actual; completion 1x por período (D-01 Opción B: una row por día, completion propaga a todas las rows del período actual)
- [ ] **REQ-04-11**: Hábitos monthly visibles todos los días del mes calendario actual; completion 1x por período (D-01/D-02 Opción B)
- [x] **REQ-04-12**: `getPeriodKey(datePrefix, frequency)` retorna keys correctas en cruces de año (W53/W01), de mes (último día → primero del siguiente) y semana ISO (domingo → lunes); algoritmo Thursday-anchor para ISO 8601

## v2 Requirements

### Cloud Backup Improvements

- **DRIVE-V2-01**: Backup automático periódico (diario o al cerrar app)
- **DRIVE-V2-02**: Mostrar tamaño del backup en Drive
- **DRIVE-V2-03**: Backup encryption antes de subir a Drive

### Testing

- **TEST-V2-01**: Tests para spontaneous habit handling completo
- **TEST-V2-02**: Tests para mood/reflection lifecycle
- **TEST-V2-03**: Tests para historical date editing

### Performance

- **PERF-V2-01**: Memoización de groupByFrequency en DailySheetScreen
- **PERF-V2-02**: Cache de stats entre cambios de mes
- **PERF-V2-03**: Sanitización de categorías via SQL en vez de JavaScript

## Out of Scope

| Feature | Reason |
|---------|--------|
| Sync bidireccional real-time | Complejidad desproporcionada — requiere conflict resolution, server infra |
| Multi-cloud (Dropbox, iCloud) | Cada provider tiene SDK y auth diferente, bajo ROI en v1 |
| Import desde otras apps | Schemas diferentes, mapping frágil |
| Import desde CSV | Ambigüedad de parsing (formatos de fecha, categorías) |
| Merge on restore | Conflict resolution complejo; full replace es explícito y predecible |
| Migración de chart library | Funciona, no es crítico |
| Backup encryption | Se evalúa después de cloud backup funcional |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 | Phase 1 | Pending |
| BUG-02 | Phase 1 | Pending |
| BUG-03 | Phase 1 | Pending |
| BUG-04 | Phase 1 | Pending |
| DEBT-01 | Phase 2 | Pending |
| DEBT-02 | Phase 2 | Pending |
| DEBT-03 | Phase 2 | Pending |
| DRIVE-01 | Phase 3 | Pending |
| DRIVE-02 | Phase 3 | Complete |
| DRIVE-03 | Phase 3 | Complete |
| DRIVE-04 | Phase 3 | Pending |
| DRIVE-05 | Phase 3 | Pending |
| DRIVE-06 | Phase 3 | Complete |
| DRIVE-07 | Phase 3 | Complete |
| DRIVE-08 | Phase 3 | Complete |
| REQ-04-01 | Phase 4 | Pending |
| REQ-04-02 | Phase 4 | Pending |
| REQ-04-03 | Phase 4 | Complete |
| REQ-04-04 | Phase 4 | Complete |
| REQ-04-05 | Phase 4 | Complete |
| REQ-04-06 | Phase 4 | Complete |
| REQ-04-07 | Phase 4 | Complete |
| REQ-04-08 | Phase 4 | Complete |
| REQ-04-09 | Phase 4 | Complete |
| REQ-04-10 | Phase 4 | Pending |
| REQ-04-11 | Phase 4 | Pending |
| REQ-04-12 | Phase 4 | Complete |

**Coverage:**
- v1 requirements: 27 total (15 originales + 12 Phase 4)
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-05-01 — added REQ-04-01..REQ-04-12 for Phase 4*
