---
phase: 03-google-drive-backup
plan: 03
subsystem: restore-flow
tags: [google-drive, restore, react-navigation, expo-file-system, alert-dialog, tdd]

# Dependency graph
requires:
  - phase: 03-google-drive-backup
    plan: 02
    provides: "drive.listBackups + drive.downloadBackup + parseAndValidate/buildBackupData/restoreData re-exports + RestoreFromDriveScreen scaffold + LoadingOverlay + utils/dateFormat"
provides:
  - "src/services/driveBackupService.ts +prepareRestore (download+parse+counts) +applyRestore (cache+mutate+cleanup) +RestorePayload +RestoreCounts"
  - "src/screens/RestoreFromDriveScreen.tsx — body completo con loaded/error states, FlatList con BackupRow, preview vía prepareRestore, confirm Alert destructivo, applyRestore + refresh stores post-success"
  - "src/__tests__/driveBackupService.restore.test.ts — 6 tests del split prepareRestore/applyRestore"
affects: []

# Tech tracking
tech-stack:
  added:
    - "ninguna dependencia nueva — usa expo-file-system/legacy + lucide-react-native + drive service ya existentes"
  patterns:
    - "API split single-download: prepareRestore (download + parse + counts, no DB) + applyRestore (cache + mutate + cleanup post-success). Evita doble download que tenía la API monolítica."
    - "Cleanup ordering enforcement: pre-restore-*.json cleanup SÓLO post-success de restoreData (warning #9) — si restoreData lanza, el cache previo + el recién escrito sobreviven."
    - "Best-effort pre-restore cache: writePreRestoreCache try/catch silencioso (D-19). Si falla, restore continúa."
    - "Sub-componentes locales en screen (BackupRow, Separator, ErrorState) ≤20 líneas cada uno — clonado del patrón HabitLibraryScreen."
    - "Mock defaults en beforeEach del test file (parseAndValidate passthrough + restoreData success + buildBackupData snapshot vacío + FS success) → tests específicos sólo overridean lo que necesitan con mockImplementationOnce/mockRejectedValueOnce."

key-files:
  created:
    - "src/__tests__/driveBackupService.restore.test.ts — 185 líneas, 6 tests, jest.doMock virtual + global fetch + FS mocks"
  modified:
    - "src/services/driveBackupService.ts — +106 líneas: import expo-file-system/legacy + restoreData/parseAndValidate al import existente + import type BackupData + 5 nuevos símbolos públicos (prepareRestore, applyRestore, RestorePayload, RestoreCounts, helpers privados writePreRestoreCache + cleanupOldPreRestoreCache)"
    - "src/screens/RestoreFromDriveScreen.tsx — +124/-14 líneas: imports ampliados (FlatList, Pressable, Alert, FileText, ChevronRight, WifiOff, LoadingOverlay, useHabitStore, formatDateEs, formatSize, ALERT_DRIVE_* x3); 3 sub-componentes locales (BackupRow, Separator, ErrorState); 4 handlers (loadList preexistente, showError, performRestore, previewAndConfirm); 4 estados (loading/empty/error/loaded) + LoadingOverlay condicional; placeholder del scaffold eliminado"

key-decisions:
  - "API split en lugar de restoreFromBackup monolítica: prepareRestore (preview) + applyRestore (commit). Justificación: la pantalla necesita conteos para el confirm Alert antes de mutar, y mostrar conteos requiere parsear, y parsear requiere descargar. Hacer ambas cosas en una sola función causa doble download cuando el usuario confirma. El split asegura UN SOLO download por restore (test 1 verifica con global.fetch toHaveBeenCalledTimes(1))."
  - "Cleanup post-success únicamente (warning #9 enforced por test 5): si restoreData lanza, cleanupOldPreRestoreCache NO se ejecuta — el cache previo + el recién escrito sobreviven, dando al usuario una vía de recuperación manual. La trade-off es que en caso de éxito acumulamos máximo 1 archivo redundante por restore exitoso, que el siguiente restore exitoso barre."
  - "writePreRestoreCache best-effort (D-19): si writeAsStringAsync falla (disk full, FS readonly), log warn y CONTINUAR con restoreData. Justificación: el cache es red de seguridad, no un bloqueador. La verdadera atomicidad la garantiza restoreData via withTransactionAsync (Phase 2)."
  - "RestorePayload pasa data + counts + exportedAt al callback de confirm — la pantalla NO re-descarga ni re-parsea entre preview y apply."
  - "Confirm Alert message construido inline en el screen (no constante): el plan especifica el formato exacto con interpolación de fecha + 4 conteos. Crear una constante template + helper sería overkill — el mensaje es one-shot."
  - "previewAndConfirm + performRestore como useCallback separados: separar la preview (que abre Alert con onPress callback) del commit (que el callback dispara) mantiene cada handler ≤25 líneas y cumple CLAUDE.md Regla 3."

patterns-established:
  - "Pattern: API service split download/parse/preview vs mutate — cualquier flow destructivo que requiera preview en UI debería seguir este split, evitando re-trabajo y dando al caller una transacción ergonómica (preview → confirm → commit)."
  - "Pattern: Pre-mutation safety cache + post-success cleanup — usable en cualquier operación destructiva con rollback manual (e.g., wipe de datos antes de migración)."
  - "Pattern: Mock defaults en beforeEach + mockImplementationOnce/mockRejectedValueOnce en tests específicos — evita boilerplate por test y deja a los tests de error path autoexplicativos."

requirements-completed: [DRIVE-04, DRIVE-05, DRIVE-08]

# Metrics
duration: ~6 min (exec window)
completed: 2026-04-28
runtime_auth_blocked: true
runtime_auth_blocker: "Heredado de 03-01 — los OAuth clients de GCP Console aún no existen. Toda la lógica de este plan está cubierta por mocks (95/95 tests). La verificación runtime real (sign-in + listBackups con backups reales en Drive + descargar + restaurar) requiere completar el checklist de '03-01-SUMMARY §Deferred / Pending User Setup'."
---

# Phase 03 Plan 03: Restore Flow Summary

**Cierre del phase Drive Backup: API split prepareRestore/applyRestore (single download, cleanup post-success only) + RestoreFromDriveScreen completo (4 estados + preview destructivo + refresh de stores) — 95/95 tests verdes, 6 tests TDD-driven cubriendo orden estricto, parse fail, cache best-effort y restoreData throw → cleanup-skip.**

## Performance

- **Duration:** ~6 min (exec window)
- **Started:** 2026-04-28 (post 03-02 close)
- **Completed:** 2026-04-28
- **Tasks:** 2 of 2 completed
- **Files modified:** 3 (1 nuevo + 2 modificados)
- **Commits:** 3 (1x test-RED + 2x feat-GREEN)

## Accomplishments

- **API split eliminó el doble-download de la API monolítica.** `prepareRestore(fileId)` baja+parsea+devuelve counts una sola vez; `applyRestore(payload)` recibe el payload listo y NO re-descarga. Test 1 lo verifica con `global.fetch.toHaveBeenCalledTimes(1)`.
- **Cleanup post-success únicamente.** `cleanupOldPreRestoreCache()` corre solo después de `restoreData()` exitoso (warning #9). Si restoreData lanza, el cache previo y el recién escrito sobreviven — Test 5 verifica que `readDirectoryAsync` y `deleteAsync` NO se llaman tras restoreData throw.
- **Pre-restore safety cache D-19 honrado.** `writePreRestoreCache()` baja un snapshot fresco de la DB antes de mutar. Si falla (disk full), log warn y continuar — Test 4 verifica que restore sigue funcionando.
- **RestoreFromDriveScreen completo.** Loaded state con FlatList real (BackupRow + ChevronRight + Separator), error state (WifiOff + Reintentar), preview con LoadingOverlay "Leyendo backup...", confirm Alert destructivo con 4 conteos verbatim del UI-SPEC, applyRestore con LoadingOverlay "Restaurando datos...", success Alert + Promise.all([fetchHabitsForDate, fetchLibrary]) sin navegación (D-20).
- **Cero duplicación de utilidades.** `formatDateEs` y `formatSize` IMPORTADAS de `../utils/dateFormat` — el screen no redeclara ningún helper de formato (CLAUDE.md Regla 3).
- **Sin tocar archivos fuera de scope.** App.tsx (route ya registrada en 03-02) y SettingsScreen.tsx (botón ya navega) NO modificados — verificado con `git diff --name-only`.
- **Suite completa: 95/95 tests pasando** (89 previos + 6 nuevos restore).

## Task Commits

Cada tarea se commiteó atomicamente con flujo TDD donde aplica:

1. **Task 1 RED — restore tests:** `b61e0e1` (test) — 6 tests fallando porque prepareRestore/applyRestore no existen.
2. **Task 1 GREEN — prepareRestore + applyRestore impl:** `24efffe` (feat) — funciones públicas + helpers privados + tipos. 6/6 tests verdes.
3. **Task 2 — RestoreFromDriveScreen body completo:** `ccda842` (feat) — loaded/error states, sub-componentes, handlers, preview + confirm + apply flow. 95/95 tests verdes.

_Nota: Task 2 no tuvo gate RED separado porque es UI integration consumiendo un service ya verde por TDD. La verificación es estructural (grep de strings + tipos) + suite completa sin regresión + tsc sin errores nuevos._

## Files Created/Modified

### Created (1)

- `src/__tests__/driveBackupService.restore.test.ts` (185 líneas) — 6 tests con jest.doMock virtual + FS mocks + global fetch. Mock defaults en beforeEach (parseAndValidate passthrough JSON.parse, restoreData success, buildBackupData snapshot vacío, FS success). Tests específicos overridean con mockImplementationOnce/mockRejectedValueOnce.

### Modified (2)

- `src/services/driveBackupService.ts` (412 líneas — antes 308; +106) — import `expo-file-system/legacy`, agregado `parseAndValidate, restoreData` al import existente de `./backupService`, import type `BackupData` de `../types`. Bloque nuevo `// ─── Restore (DRIVE-04 + DRIVE-05 + D-19) ───` con 5 símbolos:
  - `interface RestoreCounts` (4 fields numéricos por tabla)
  - `interface RestorePayload { data, counts, exportedAt }` (export)
  - `prepareRestore(fileId): Promise<RestorePayload>` (export, ~16 líneas)
  - `applyRestore(payload: RestorePayload): Promise<void>` (export, ~10 líneas)
  - `writePreRestoreCache()` (helper privado, ~9 líneas)
  - `cleanupOldPreRestoreCache()` (helper privado, ~12 líneas)

- `src/screens/RestoreFromDriveScreen.tsx` (182 líneas — antes 72; +124/-14) — imports ampliados (FlatList, Pressable, Alert, FileText, ChevronRight, WifiOff, LoadingOverlay, useHabitStore, formatDateEs, formatSize, ALERT_DRIVE_RESTORE_CONFIRM/SUCCESS/GENERIC). 3 sub-componentes locales (BackupRow ≤18 líneas, Separator ≤2 líneas, ErrorState ≤16 líneas). 4 handlers en el componente principal: `loadList` (preexistente, ≤12 líneas), `showError` (≤4 líneas), `performRestore` (≤18 líneas), `previewAndConfirm` (≤24 líneas). Estado nuevo `overlayMsg: OverlayMsg`. JSX renderiza 4 estados condicionalmente + LoadingOverlay siempre montado. Placeholder del scaffold eliminado.

### NOT Modified (verificación de scope)

- `src/screens/RestoreFromDriveScreen.styles.ts` — todas las keys requeridas (itemRow, itemPrimary, itemCaption, separator, errorContainer, errorHeading, errorBody, errorRetryButton, errorRetryButtonText) ya existían post 03-02; nada que agregar.
- `App.tsx` — route registrada en 03-02; sin cambios.
- `src/screens/SettingsScreen.tsx` — botón "Restaurar desde Drive" ya navega a la ruta desde 03-02; sin cambios.

## API Public Diff

```typescript
// src/services/driveBackupService.ts (post 03-03)
+ export interface RestoreCounts {
+   habits: number;
+   performed_habits: number;
+   mood_entries: number;
+   daily_assignments: number;
+ }
+ export interface RestorePayload {
+   data: BackupData;
+   counts: RestoreCounts;
+   exportedAt: string;
+ }
+ export async function prepareRestore(fileId: string): Promise<RestorePayload>;
+ export async function applyRestore(payload: RestorePayload): Promise<void>;
```

Sin `restoreFromBackup` monolítica (planeado en ROADMAP, evolucionado a split en este plan — ver Decisions).

## Tests Added

| Suite | Tests | Coverage |
|-------|-------|----------|
| `driveBackupService.restore.test.ts` | 6 | prepareRestore single-download + counts derivados (1) / parseAndValidate fail → DriveError + DB intacta (1) / applyRestore orden estricto build→write→restore→cleanup (1) / cleanup target glob (sólo cozyhabits-pre-restore-*.json, no toca unrelated.json) (1) / cache write best-effort (D-19) (1) / restoreData throws → cleanup NO corre + DriveError + cache previo conservado (warning #9) (1) |
| **Total nuevos** | **6** | — |
| **Suite completa post-phase-3** | **95/95** | 75 base + 14 driveBackupService + 6 driveRetention + 12 dateFormat + 6 restore + 5 useSettingsStore.googleAuth (en 10 suites) |

### Final test counts across the phase (acumulado)

| Suite | Tests |
|-------|-------|
| useSettingsStore.googleAuth | 5 |
| driveRetention | 6 |
| dateFormat | 12 |
| driveBackupService (transport + auth) | 14 |
| driveBackupService.restore | 6 |
| **Sub-total Phase 3** | **43** |
| Pre-existing (Phase 1+2) | 52 |
| **Total** | **95/95** |

## DRIVE-XX Requirement Coverage

| ID | Where satisfied | Plan |
|----|-----------------|------|
| DRIVE-01 | `googleAuth.ts` (configureGoogleSignin + silentSignInIfPossible), App.tsx startup hook, SettingsScreen "Conectar con Google" + "Conectado como X" | 03-01 + 03-02 |
| DRIVE-02 | `driveBackupService.uploadBackup` (multipart manual + PATCH si overwrite), SettingsScreen "Backup ahora" handler con D-13 confirmación | 03-02 |
| DRIVE-03 | `useSettingsStore.lastBackupAt/lastBackupFileId` persistido vía partialize, SettingsScreen muestra `formatRelativeBackup(lastBackupAt)` | 03-01 + 03-02 |
| DRIVE-04 | `RestoreFromDriveScreen` (loaded state con FlatList ordenada desc por createdTime via service, BackupRow con formatDateEs + formatSize) | **03-03** |
| DRIVE-05 | `prepareRestore` + `applyRestore` split, confirm Alert destructivo con 4 conteos por tabla + warning "no se puede deshacer", refresh stores post-success | **03-03** |
| DRIVE-06 | `signOut` (`driveBackupService.signOut` + `useSettingsStore.clearGoogleSession`) preserva lastBackup* (D-11), SettingsScreen handler con confirm | 03-01 + 03-02 |
| DRIVE-07 | `silentSignInIfPossible` en App.tsx propaga email al store sin bloquear render (D-08), SettingsScreen lee googleEmail del store | 03-01 |
| DRIVE-08 | `mapDriveError` mapea HTTP 401/403/network/quota/permission/genérico a constantes ALERT_DRIVE_*; el screen catch invoca `Alert.alert(alert.title, alert.message)`. Cubierto en list, preview (download+parse), restore (cache+restore+cleanup) | 03-02 + **03-03** |

## Decisions Made

- **prepareRestore/applyRestore en lugar de restoreFromBackup monolítica.** El plan original ROADMAP decía `restoreFromBackup`. Evolucionó a split por requerimiento UX: mostrar conteos en el confirm Alert exige parsear antes de mutar, y volver a descargar+parsear en el confirm sería 2x el tráfico. El split garantiza single-download (test 1) y separa preview de mutación (Risk Note #4).
- **Cleanup estrictamente post-success (warning #9).** El UI-SPEC dejaba abierto si cleanup va antes o después; elegimos después porque si restoreData falla, el cache previo es la única vía de recuperación. Test 5 enforce.
- **writePreRestoreCache best-effort (D-19).** Si el FS falla, log + continuar. Justificación: el cache es opt-in safety; bloquear restore por una falla de FS sería una regresión UX peor que perder el cache.
- **Pasa `payload` al onPress del Alert destructivo.** Cierra sobre `payload` ya parseado. Alternativa rechazada: re-llamar prepareRestore en performRestore — duplicaría download + parse innecesariamente.
- **Mock defaults en beforeEach.** Reduce boilerplate por test y deja los tests de error path autoexplicativos (cada uno solo overridea con mockImplementationOnce/mockRejectedValueOnce lo que necesita romper).
- **`overlayMsg: OverlayMsg` en lugar de boolean + string separados.** Un solo state con tipo unión `null | 'Leyendo backup...' | 'Restaurando datos...'` evita la combinación inválida `(visible=true, message='')` y rinde un solo path en el JSX (`<LoadingOverlay visible={overlayMsg !== null} message={overlayMsg ?? ''} />`).

## Deviations from Plan

None — plan ejecutado exactamente como fue escrito. Las 2 tareas siguieron sus `<action>` y `<acceptance_criteria>` literalmente. El test file fue creado con el contenido textual del plan; las funciones del service también; el screen igual.

**Total deviations:** 0
**Rule 1/2/3 auto-fixes:** 0
**Rule 4 architectural questions:** 0

## Issues Encountered

- **Pre-existing TypeScript errors** detectados en `npx tsc --noEmit`. Los **mismos 5 errores** documentados en `deferred-items.md` desde Phase 2:
  - `NotebookPaper.tsx:81` (LinearGradient typing — string[] no asignable a readonly tuple)
  - `assignmentService.ts:92`, `habitService.ts:103,119`, `parsing.ts:25` (area-id narrowing)
  - **NO bloquean este plan**, no se introdujeron errores nuevos. Confirmado con `git stash` baseline en 03-01.
- **Jest worker exit warning.** "A worker process has failed to exit gracefully" persiste — investigado en 03-02; causado por timers `setTimeout` en SettingsScreen (handler `handleConnect` Pitfall #3). No afecta resultados (95/95 pasan).

## Pending UAT (manual-only verifications)

Estos items requieren completar el GCP-Console setup de 03-01 (consent + 3 OAuth clients + envs + iOS scheme + EAS dev build), por lo que quedan **deferred** para una sesión post-unblock:

| # | UAT item | Mock-coverage | Real-coverage |
|---|----------|---------------|---------------|
| U-01 | Real OAuth interactivo desde SettingsScreen "Conectar con Google" | Test 1 driveBackupService.test.ts (success path con SDK mockeado) | ❌ pendiente — requiere EAS build + OAuth client configurado |
| U-02 | Backup real visible en Drive web (drive.google.com → "Hidden app data") | Test multipart POST + PATCH (driveBackupService.test.ts) | ❌ pendiente |
| U-03 | Round-trip restore real: backup en device A → restore en device B (mismo Google account) | applyRestore unit tests cubren orden y safety cache | ❌ pendiente |
| U-04 | Error sin red: avión mode + tap "Backup ahora" muestra ALERT_DRIVE_NO_NETWORK con "Reintentar" | mapDriveError cubre TypeError network (driveBackupService.test.ts) | ❌ pendiente |
| U-05 | Pre-restore cache real persiste tras restore exitoso (`expo-file-system` `cacheDirectory` listing) | applyRestore tests cubren cleanup post-success (deja 0 archivos pre-restore tras éxito) | ❌ pendiente |
| U-06 | Confirm Alert destructivo render real en iOS + Android (style: 'destructive' = rojo en iOS, default-bold en Android) | Test no aplica (UI nativa); plan-level grep verifica strings verbatim | ❌ pendiente |

Estos UATs están listados en `.planning/phases/03-google-drive-backup/03-VALIDATION.md` (sección "Manual UAT post-unblock") y deben ejecutarse antes de cerrar el milestone.

## Note on DRIVE-01 + DRIVE-07 divergence vs REQUIREMENTS.md literal

El texto literal de DRIVE-01 / DRIVE-07 en REQUIREMENTS.md fue refinado durante el phase via decisiones D-01, D-02 y D-10 (CONTEXT.md). Las divergencias documentadas:

- **DRIVE-01 ("Sign-in interactivo")** → satisfecho via `signIn()` que delega en SDK + setState `googleEmail` post-success. La diferencia es que el plan inicial preveía un módulo monolítico `googleAuth` con UI inline; D-02 separó SDK setup (`googleAuth.ts`) de transport (`driveBackupService.ts`).
- **DRIVE-07 ("silent sign-in al startup")** → satisfecho via `silentSignInIfPossible()` invocado desde App.tsx en useEffect non-blocking (D-08 + Pitfall #5). El requirement no especificaba blocking-vs-non-blocking; la decisión de no bloquear render quedó D-08.
- **DRIVE-10 (no listado en REQUIREMENTS.md)** → "signOut local sin revoke" cubre solo el local sign-out + clearGoogleSession; la revocación global (drive.google.com → revocar acceso) queda manual al usuario. Decisión D-10.

Recomendación para VERIFICATION.md (próxima fase): que el verifier confirme estas divergencias contra el código y firme que el behavior real cumple el espíritu de DRIVE-01/06/07 aunque el texto literal sea más laxo.

## Self-Check

Verificación de claims antes de cerrar:

- [x] Commits existen en git log: `b61e0e1`, `24efffe`, `ccda842`.
- [x] `src/__tests__/driveBackupService.restore.test.ts` existe (185 líneas, 6 tests).
- [x] `src/services/driveBackupService.ts` tiene `export async function prepareRestore` (line 344).
- [x] `src/services/driveBackupService.ts` tiene `export async function applyRestore` (line 375).
- [x] `src/services/driveBackupService.ts` tiene `export interface RestorePayload` (line 329).
- [x] `src/services/driveBackupService.ts` NO tiene `restoreFromBackup` (verificado, count=0).
- [x] `src/services/driveBackupService.ts` tiene `cozyhabits-pre-restore-` (D-19 file naming).
- [x] `applyRestore` muestra `cleanupOldPreRestoreCache` AFTER `restoreData(` (warning #9).
- [x] `src/services/driveBackupService.ts` importa `parseAndValidate, restoreData` desde `./backupService` (line 30).
- [x] `src/screens/RestoreFromDriveScreen.tsx` llama `drive.prepareRestore` (preview) + `drive.applyRestore` (commit).
- [x] `src/screens/RestoreFromDriveScreen.tsx` NO llama `drive.downloadBackup` ni `parseAndValidate` directamente (delegado al service).
- [x] `src/screens/RestoreFromDriveScreen.tsx` importa `formatDateEs, formatSize` desde `../utils/dateFormat` (sin redeclaración).
- [x] `src/screens/RestoreFromDriveScreen.tsx` tiene `<FlatList`, `WifiOff`, `<LoadingOverlay`.
- [x] UI-SPEC strings verbatim: "No se pudo cargar la lista", "Verificá tu conexión e intentá de nuevo.", "Reintentar", "Leyendo backup...", "Restaurando datos...", "Vas a restaurar el backup del", "Tus datos previos quedaron respaldados en el dispositivo".
- [x] Placeholder del scaffold ELIMINADO ("la lista detallada se habilita..." count=0).
- [x] Cero `style={{` en RestoreFromDriveScreen.tsx.
- [x] Cero ` any ` en driveBackupService.ts y RestoreFromDriveScreen.tsx y test file.
- [x] App.tsx + SettingsScreen.tsx NO modificados (`git diff --name-only HEAD` no los incluye).
- [x] `npm test` → 95/95 verde, 10 suites verdes.
- [x] `npx tsc --noEmit` → solo errores pre-existentes documentados (5 errores intactos desde Phase 2).
- [ ] **Runtime auth flow** — BLOCKED hasta que el usuario complete el checklist de 03-01-SUMMARY §"Deferred / Pending User Setup". Esperado y heredado.

## Self-Check: PASSED (code-complete; runtime auth deferred per user decision)

## Threat Flags

Ningún threat surface nuevo fuera del registro `<threat_model>` del PLAN. Las 8 threats T-03-03-01 a T-03-03-08 están todas mitigadas o accept-justified:

- **T-03-03-01** (tampering JSON malicioso) — `parseAndValidate` valida shape; failure path en `prepareRestore` → DriveError(GENERIC) sin invocar applyRestore. Test 2 verifica.
- **T-03-03-04** (restore sin confirm) — Alert con `style: 'destructive'` + copy "Esta acción no se puede deshacer". Solo el botón destructivo dispara performRestore. Verificado verbatim por grep + test del service no UI.
- **T-03-03-06** (DB inconsistente + cleanup borra cache de seguridad) — Test 5 verifica que cleanup NO corre si restoreData throws. `restoreData` (Phase 2) usa `withTransactionAsync` (atómico).
- **T-03-03-07** (cache acumulado) — Cleanup post-success borra todos los `cozyhabits-pre-restore-*.json`. Tests 4 + 6 verifican.
- **T-03-03-08** (acceso directo al screen sin auth) — `listBackups` requiere token; sin token, `getDriveAccessToken` falla y se mapea a `ALERT_DRIVE_AUTH_EXPIRED`. Defensive but adequate.

T-03-03-02, T-03-03-03, T-03-03-05 marcados `accept` en threat model (cubiertos por límites de confianza más amplios o trade-offs explícitos).

## TDD Gate Compliance

- ✅ RED gate: `b61e0e1` (`test(03-03): add failing tests for prepareRestore + applyRestore`).
- ✅ GREEN gate: `24efffe` (`feat(03-03): add prepareRestore + applyRestore split...`) — posterior a RED.
- ⏭️ REFACTOR gate: omitido — el GREEN quedó limpio (functions ≤25 líneas, helpers privados extraídos, sin código duplicado).
- ❌ Task 2 sin TDD separado: integración UI consumiendo service ya verde por TDD. Verificación es estructural (grep de strings + tipos) + suite completa sin regresión + tsc sin errores nuevos.

## Phase 03 Closure Notes

**Phase goal — CLOSED:** "El usuario puede restaurar desde cualquier dispositivo". El backup + restore round-trip está disponible end-to-end en código:

- Backup: SettingsScreen "Backup ahora" → `drive.uploadBackup` → Drive appDataFolder.
- Restore: SettingsScreen "Restaurar desde Drive" → `RestoreFromDriveScreen` → `drive.listBackups` → tap row → `drive.prepareRestore` → confirm → `drive.applyRestore` → refresh stores.

**8/8 DRIVE-XX requirements code-complete** (DRIVE-01..08). Cierre del phase pendiente solo de:
1. Ejecutar VERIFICATION (`/gsd-verify-phase 03`) que el verifier confirme behavioral compliance.
2. UAT manual post-OAuth-unblock (6 items en sección anterior).

---

*Phase: 03-google-drive-backup*
*Plan: 03 — Restore flow + RestoreFromDriveScreen body*
*Closed: 2026-04-28 (code-complete; runtime auth + UAT diferidos por decisión del usuario)*
