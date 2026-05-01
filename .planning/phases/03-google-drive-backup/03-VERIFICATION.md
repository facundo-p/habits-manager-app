---
phase: 03-google-drive-backup
verified: 2026-04-28T03:45:00Z
status: human_needed
score: 8/8 must-haves code-verified
requirements_met: 8/8
runtime_auth_blocked: true
review_findings_open:
  critical: 0
  warning: 4
  info: 7
divergences:
  - requirement: DRIVE-01
    literal: "expo-auth-session con scope drive.file"
    implemented: "@react-native-google-signin/google-signin@16.1.2 con scope drive.appdata"
    decision_ref: [D-01, D-02]
    rationale: "expo-auth-session no soporta drive.appdata (issue confirmado en GitHub). drive.appdata es hidden y no requiere security review de Google. La intención del feature (backup invisible) es preservada."
  - requirement: DRIVE-07
    literal: "sign out + revocar acceso"
    implemented: "GoogleSignin.signOut() local sin revokeAccess()"
    decision_ref: [D-10]
    rationale: "Sign-out solo limpia token local. Re-conexión es silenciosa para el usuario. Si el usuario quiere revocar permanentemente, debe ir a drive.google.com (camino fuera de la app)."
  - requirement: DRIVE-04 / DRIVE-05
    literal: "modal de confirmación que muestra fecha + warning"
    implemented: "Pantalla full-screen RestoreFromDriveScreen con FlatList + Alert.alert nativo destructivo (con fecha + 4 conteos por tabla + warning destructivo)"
    decision_ref: [D-13, D-17, D-18, UI-SPEC]
    rationale: "Pantalla completa elegida sobre modal por: (a) lista unbounded (retención hasta ~30+monthly+yearly), (b) preview interaction necesita espacio vertical, (c) AppScreenHeader provee back affordance familiar. Confirmación native Alert.alert con 4 conteos verbatim vs sólo 'fecha'."
human_verification:
  - test: "Real OAuth interactivo desde SettingsScreen 'Conectar con Google'"
    expected: "Sign-in nativo de Google completa, email aparece en Settings, persiste a través de reload"
    why_human: "Requiere EAS dev build + GCP Console OAuth clients configurados + cuenta Google real. Mocks cubren la lógica del SDK."
    blocker: "GCP Console setup pendiente (03-01-SUMMARY §Deferred / Pending User Setup)"
  - test: "Backup real visible en Drive web (drive.google.com → 'Hidden app data')"
    expected: "Archivo cozyhabits-YYYY-MM-DD.json aparece en appDataFolder; al hacer click muestra el JSON"
    why_human: "Requiere sistema externo (Google Drive). Mocks de fetch/multipart cubren request/response."
    blocker: "GCP Console setup + EAS build"
  - test: "Round-trip restore real: backup en device A → restore en device B (mismo Google account)"
    expected: "Datos del device A aparecen en device B tras restore. Habits / performed_habits / mood_entries / daily_assignments restaurados con conteos correctos."
    why_human: "End-to-end con real Drive + 2 devices + DB real. Tests cubren orden write→restore→cleanup y safety cache."
    blocker: "GCP Console setup + EAS build"
  - test: "Error sin red: avión mode + tap 'Backup ahora'"
    expected: "Alert con título 'Sin conexión' y mensaje 'No hay internet. Verificá tu red e intentá de nuevo.'"
    why_human: "Requiere manipulación de red en device físico."
    blocker: "GCP Console setup + EAS build"
  - test: "Pre-restore safety cache real persiste tras restore exitoso"
    expected: "Tras restore exitoso, comprobar via expo-file-system que los archivos cozyhabits-pre-restore-*.json se eliminaron del cacheDirectory (D-19 + warning #9)"
    why_human: "Requiere inspección filesystem en device físico. Tests unitarios cubren orden cleanup-only-on-success."
    blocker: "GCP Console setup + EAS build"
  - test: "Confirm Alert destructivo render real iOS + Android"
    expected: "Botón 'Restaurar' aparece en rojo en iOS (style: 'destructive') y bold en Android"
    why_human: "Estilo nativo del Alert.alert sólo verificable visualmente."
    blocker: "EAS build (puede testearse sin OAuth si se mockea el flow)"
known_caveats:
  - id: "WR-02"
    severity: "warning"
    description: "El Alert de éxito post-restore promete 'Tus datos previos quedaron respaldados en el dispositivo' pero cleanupOldPreRestoreCache borra TODOS los archivos cozyhabits-pre-restore-*.json (incluido el recién escrito). El cache solo sobrevive si restoreData throws. Texto UI contradice realidad del filesystem."
    fix_options:
      - "A. Modificar cleanupOldPreRestoreCache para conservar el más nuevo (sort por timestamp, slice(0, -1))"
      - "B. Eliminar la frase 'respaldados en el dispositivo' del Alert de éxito"
    user_decision_needed: true
    location: "src/services/driveBackupService.ts:399-412 + src/screens/RestoreFromDriveScreen.tsx:108-112"
  - id: "WR-01"
    severity: "warning"
    description: "Errores del Auth SDK (signInSilently/getTokens reject por revoked grant, refresh expirado, SIGN_IN_REQUIRED) se propagan como Error plano y NO se envuelven en DriveError. La UI cae a ALERT_DRIVE_GENERIC ('Algo salió mal') cuando debería mostrar ALERT_DRIVE_AUTH_EXPIRED ('Volvé a conectar tu cuenta')."
    fix: "Envolver getDriveAccessToken() con try/catch que mapee a DriveError(ALERT_DRIVE_AUTH_EXPIRED) o DriveError(ALERT_DRIVE_NO_NETWORK) según el error."
    user_decision_needed: true
    location: "src/services/driveBackupService.ts:101-106"
  - id: "WR-03"
    severity: "warning"
    description: "setState async tras unmount en RestoreFromDriveScreen.loadList y SettingsScreen handlers (handleConnect, handleBackupNow). Mitigado parcialmente por LoadingOverlay (bloquea back-press). loadList es el más expuesto."
    fix: "Agregar mountedRef.current guard antes de setState post-await en loadList."
    user_decision_needed: true
    location: "src/screens/RestoreFromDriveScreen.tsx:83-92, src/screens/SettingsScreen.tsx:134-202"
  - id: "WR-04"
    severity: "warning"
    description: "previewAndConfirm permite descarga concurrente si el Modal animation aún no se montó cuando el usuario tap-en-rápido. Single-download invariant parcialmente garantizado por Modal."
    fix: "Agregar isPreparing state guard al inicio de previewAndConfirm o disabled={overlayMsg !== null} a BackupRow."
    user_decision_needed: true
    location: "src/screens/RestoreFromDriveScreen.tsx:121-148"
  - id: "RUNTIME_AUTH_BLOCKED"
    severity: "blocker (deferred user-action)"
    description: "El código de auth + transport + restore está code-complete y type-checked, pero los OAuth clients en GCP Console NO existen. La primera vez que la app intente conectar con Drive en runtime, fallará. Esto NO es una falla de verificación — es una decisión consciente del usuario de diferir el setup de GCP."
    blocker_action_owner: "user (facundo.pichinini@gmail.com)"
    blocker_steps: "Ver 03-01-SUMMARY.md §'Deferred / Pending User Setup' (6 pasos: OAuth consent screen, 3 OAuth clients [Web/iOS/Android], envs, iosUrlScheme replacement, EAS dev build, smoke test)."
---

# Phase 03: Google Drive Backup — Verification Report

**Phase Goal (ROADMAP):** El usuario puede hacer backup de sus datos a Google Drive y restaurarlos desde cualquier dispositivo, con control explícito y mensajes de error accionables.

**Verified:** 2026-04-28T03:45:00Z
**Status:** human_needed (8/8 requirements code-verified; runtime auth + UAT manual deferidos por decisión del usuario)
**Re-verification:** No — verificación inicial.

---

## Resumen ejecutivo

Phase 3 entrega TODO el código necesario para los 8 requirements DRIVE-01..DRIVE-08. La suite de 95 tests pasa verde. Las divergencias respecto del texto literal de REQUIREMENTS.md están explícitamente decididas en CONTEXT.md (D-01, D-02, D-10) y son mejoras técnicas, no recortes de funcionalidad. La pantalla RestoreFromDriveScreen está completamente cableada (FlatList + preview + confirm + apply + refresh stores). El service driveBackupService.ts (412 líneas) cubre auth/upload/list/download/restore/delete con mapping de errores HTTP a 5 categorías + 1 genérica.

**El verdadero blocker NO es código, es runtime activation:** los OAuth clients en GCP Console no existen aún. El usuario diferió este setup conscientemente. Hasta que se complete el checklist de 03-01-SUMMARY, ninguna operación real contra Drive funcionará en device — solo los flows mockeados en tests.

Adicionalmente, el código review de Phase 3 (03-REVIEW.md) reportó 4 warnings (0 críticos, 7 info). El más relevante para verificación es **WR-02**: el Alert de éxito post-restore promete que el cache previo "queda respaldado en el dispositivo" pero el cleanup actual lo borra (excepto si restoreData falla). Esto es una contradicción UX/correctness real, no un crash. Documentado como caveat para que el usuario decida si lo cierra ahora o en una phase futura.

---

## Verificación por requirement

### DRIVE-01: Usuario puede autenticarse con Google

**Verdict:** ✓ VERIFIED (con divergencia documentada)

**Texto literal:** "Usuario puede autenticarse con Google usando expo-auth-session con scope drive.file"

**Implementación real:** `@react-native-google-signin/google-signin@16.1.2` con scope `drive.appdata`. Decisiones D-01 + D-02 (CONTEXT.md) reemplazan la redacción literal por razones técnicas (expo-auth-session no soporta drive.appdata; appdata evita Google security review).

**Evidencia código:**
- `src/services/googleAuth.ts:13-22` — `configureGoogleSignin()` configura el SDK con `webClientId` (env var) + `scopes: [DRIVE_SCOPE]` donde `DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'` (constants.ts:252).
- `src/services/googleAuth.ts:25-36` — `silentSignInIfPossible()` para restore en startup (D-08).
- `src/services/driveBackupService.ts:79-94` — `signIn()` interactivo, maneja `SIGN_IN_CANCELLED` retornando `null`.
- `src/screens/SettingsScreen.tsx:134-147` — `handleConnect()` invoca `drive.signIn()`, propaga email a store.
- `App.tsx:109-118` — useEffect non-blocking dispara `configureGoogleSignin()` + `silentSignInIfPossible()` al startup.

**Tests:** 5 unit tests del slice de auth (`useSettingsStore.googleAuth.test.ts`) + 3 tests del flow signIn (success / user-cancel / error→DriveError) en `driveBackupService.test.ts`.

**Caveat runtime:** sin OAuth clients en GCP Console, el SDK fallará al ejecutar `signIn()` en device. Esto es esperado y documentado (`runtime_auth_blocked: true`).

---

### DRIVE-02: Backup manual a Drive

**Verdict:** ✓ VERIFIED

**Texto literal:** "Usuario puede subir backup completo a Google Drive con un botón manual"

**Evidencia código:**
- `src/services/driveBackupService.ts:148-164` — `uploadBackup()` con `buildBackupData() → JSON.stringify → multipart manual → POST/PATCH`.
- `src/services/driveBackupService.ts:166-220` — multipart helpers (`buildMultipartBody`, `postMultipart`, `patchMultipart`). PATCH NO incluye `parents` (Pitfall #4).
- `src/screens/SettingsScreen.tsx:149-166` — `performBackup()` llama `drive.uploadBackup()`, persiste timestamp + fileId, muestra Alert según `result.overwrote`.
- `src/screens/SettingsScreen.tsx:168-192` — `handleBackupNow()` consulta `listBackups()` primero, muestra `ALERT_DRIVE_OVERWRITE_TODAY` si ya hay backup del día (D-13).
- LoadingOverlay rendered fuera del ScrollView con `visible={isUploading}` y `message="Subiendo a Drive..."`.

**Tests:** 4 tests del flow upload (`driveBackupService.test.ts`): POST nuevo / PATCH overwrite / preflight token refresh / pruning post-backup no fail.

---

### DRIVE-03: Backup nombrado con fecha (cozyhabits-YYYY-MM-DD.json)

**Verdict:** ✓ VERIFIED

**Evidencia código:**
- `src/config/constants.ts:249-250` — `BACKUP_FILE_PREFIX = 'cozyhabits-'`, `BACKUP_FILE_EXTENSION = '.json'`.
- `src/services/driveBackupService.ts:152-153` — `const today = new Date().toISOString().slice(0, 10)` → `${BACKUP_FILE_PREFIX}${today}${BACKUP_FILE_EXTENSION}` produce literalmente `cozyhabits-2026-04-28.json`.

**Adicional:** `useSettingsStore.lastBackupAt` + `lastBackupFileId` se persisten tras upload exitoso. SettingsScreen muestra `formatRelativeBackup(lastBackupAt)` ("hace X horas" / "ayer" / "el 27 abr 2026").

---

### DRIVE-04: Lista de backups + selección

**Verdict:** ✓ VERIFIED

**Texto literal:** "Usuario puede ver lista de backups en Drive y seleccionar uno para restaurar"

**Evidencia código:**
- `src/services/driveBackupService.ts:111-125` — `listBackups()` con filtro `name contains 'cozyhabits-'` + extensión `.json`, ordenado `createdTime desc`, scope `appDataFolder`.
- `src/screens/RestoreFromDriveScreen.tsx:34-52` — sub-componente `BackupRow` con `formatDateEs(createdTime)` + `formatSize(size)`, ícono `FileText`, ChevronRight.
- `src/screens/RestoreFromDriveScreen.tsx:171-178` — FlatList renderea backups con Separator.
- `src/screens/RestoreFromDriveScreen.tsx:83-95` — `loadList()` con 4 estados: `loading`, `empty` (CloudOff + "No hay backups todavía"), `error` (WifiOff + "Reintentar"), `loaded`.
- `src/screens/SettingsScreen.tsx:211-213` — botón "Restaurar desde Drive" navega a `RestoreFromDrive`.
- `App.tsx:145-149` — ruta `RestoreFromDrive` registrada en stack navigator.

**Divergencia documentada:** El texto literal sugería "modal de confirmación". UI-SPEC eligió pantalla full-screen (RestoreFromDriveScreen) por las razones explicadas en `divergences[].rationale`. La confirmación destructiva sigue siendo Alert.alert nativo (D-21).

---

### DRIVE-05: Restore con confirmación

**Verdict:** ✓ VERIFIED

**Texto literal:** "Usuario puede restaurar datos desde un backup de Google Drive (reemplaza datos locales con confirmación)"

**Evidencia código:**
- `src/services/driveBackupService.ts:344-363` — `prepareRestore(fileId)` descarga + parseAndValidate + retorna `RestorePayload { data, counts, exportedAt }`. Si parse falla, lanza `DriveError(ALERT_DRIVE_GENERIC)` SIN tocar DB.
- `src/services/driveBackupService.ts:375-385` — `applyRestore(payload)` orden estricto: `writePreRestoreCache → restoreData → cleanupOldPreRestoreCache`. Cleanup SOLO post-success (warning #9).
- `src/screens/RestoreFromDriveScreen.tsx:121-148` — `previewAndConfirm()`: tap row → overlay "Leyendo backup..." → prepareRestore → Alert destructivo con fecha + 4 conteos verbatim:
  > "Vas a restaurar el backup del {fecha} ({N} hábitos, {M} completados, {K} moods, {J} assignments). Esto reemplazará todos tus datos actuales. Esta acción no se puede deshacer."
- `src/screens/RestoreFromDriveScreen.tsx:102-119` — `performRestore()`: applyRestore → refresh stores (`fetchHabitsForDate`, `fetchLibrary`) → success Alert (D-20).
- Confirm button con `style: 'destructive'`.

**Tests:** 6 tests del split prepareRestore/applyRestore (`driveBackupService.restore.test.ts`):
1. single-download (`fetch.toHaveBeenCalledTimes(1)`)
2. parse fail → DriveError + DB intacta
3. orden estricto build→write→restore→cleanup
4. cleanup target glob (sólo cozyhabits-pre-restore-*.json)
5. cache write best-effort (D-19): si writeAsStringAsync rechaza, restore continúa
6. restoreData throws → cleanup NO corre (warning #9)

**Caveat WR-02 (no auto-falla, requiere decisión del usuario):** El Alert de éxito promete "tus datos previos quedaron respaldados en el dispositivo", pero `cleanupOldPreRestoreCache()` (línea 399-412) borra TODOS los archivos `cozyhabits-pre-restore-*.json`, incluido el recién escrito. La promesa al usuario es engañosa. Ver `known_caveats.WR-02` para opciones de fix.

---

### DRIVE-06: Sign out

**Verdict:** ✓ VERIFIED (con divergencia documentada)

**Texto literal:** "Usuario puede desconectar su cuenta de Google (sign out + revocar acceso)"

**Implementación real:** Sign-out local sin `revokeAccess()`. Decisión D-10 explícita: re-conexión silenciosa para el usuario que vuelve. Si quiere revocación permanente debe ir a drive.google.com (camino fuera de la app, ya disponible para cualquier usuario de Google).

**Evidencia código:**
- `src/services/driveBackupService.ts:97-99` — `signOut()` llama solo `GoogleSignin.signOut()`, NO `revokeAccess()`.
- `src/store/useSettingsStore.ts:82` — `clearGoogleSession()` solo limpia `googleEmail`, preserva `lastBackupAt` + `lastBackupFileId` (D-11).
- `src/screens/SettingsScreen.tsx:194-209` — `handleSignOut` muestra Alert destructivo con `ALERT_DRIVE_SIGN_OUT`, en confirm llama `drive.signOut()` + `clearGoogleSession()`.

**Tests:** Test de signOut (driveBackupService.test.ts) + test del slice clearGoogleSession (useSettingsStore.googleAuth.test.ts) que verifica preservación de lastBackup*.

---

### DRIVE-07: Timestamp del último backup

**Verdict:** ✓ VERIFIED

**Texto literal:** "Usuario ve timestamp del último backup exitoso en la pantalla de settings"

**Nota:** Este texto en REQUIREMENTS.md aparece como DRIVE-06 en algunas tablas. La traceability table de REQUIREMENTS.md mapea correctamente: DRIVE-06 = timestamp visible. Se respeta el orden numérico de REQUIREMENTS.md sin re-mapear.

**Evidencia código:**
- `src/store/useSettingsStore.ts:28-29` — `lastBackupAt: string | null` (ISO timestamp), `lastBackupFileId: string | null`. Persistidos vía partialize.
- `src/store/useSettingsStore.ts:81` — `setLastBackup(at, fileId)` setter atómico.
- `src/screens/SettingsScreen.tsx:153` — tras upload exitoso: `setLastBackup(new Date().toISOString(), result.fileId)`.
- `src/screens/SettingsScreen.tsx:250` — `<Text className={styles.lastBackupCaption}>{formatRelativeBackup(lastBackupAt)}</Text>` muestra "Último backup: hace 2 h" / "ayer" / "el 27 abr 2026" / "Aún no hiciste un backup".
- `src/utils/dateFormat.ts:26-35` — `formatRelativeBackup(iso)` con 12 tests.

---

### DRIVE-08: Errores Drive con mensaje accionable

**Verdict:** ✓ VERIFIED

**Texto literal:** "Errores de Drive (quota, auth, red) se muestran al usuario con mensaje accionable"

**Evidencia código:**
- `src/services/driveBackupService.ts:275-295` — `mapDriveError(err, response)` con 5 categorías:
  - TypeError network → `ALERT_DRIVE_NO_NETWORK`
  - HTTP 401 → `ALERT_DRIVE_AUTH_EXPIRED`
  - HTTP 403 + body `quotaExceeded`/`storageQuotaExceeded` → `ALERT_DRIVE_QUOTA`
  - HTTP 403 + body `insufficientPermissions`/`permissionDenied` → `ALERT_DRIVE_PERMISSION`
  - resto → `ALERT_DRIVE_GENERIC`
- `src/services/driveBackupService.ts:50-57` — `DriveError extends Error` con `alert: DriveAlert` para que el caller dispare `Alert.alert(err.alert.title, err.alert.message)` sin re-mapear.
- `src/services/driveBackupService.ts:298-309` — `fetchOrFail` wrapper aplica el mapping automáticamente en `!ok`.
- `src/config/constants.ts:293-323` — 5 categorías + genérico con copy en voseo argentino. AUTH_EXPIRED + PERMISSION incluyen `actionLabel: 'Ir a Ajustes'`. NO_NETWORK + GENERIC incluyen `retry: true`.

**Tests:** 5 tests de mapDriveError (`driveBackupService.test.ts`): network / 401 / 403 quota / 403 permission / genérico.

**Caveat WR-01 (warning, no auto-falla):** Errores del Auth SDK (signInSilently/getTokens reject con SIGN_IN_REQUIRED) caen a `ALERT_DRIVE_GENERIC` cuando lo correcto sería `ALERT_DRIVE_AUTH_EXPIRED`. La cobertura de tests no exercita este path porque el SDK mock siempre resuelve con éxito. Decisión del usuario si cerrar ahora o en phase futura.

---

## Cumplimiento de Success Criteria del ROADMAP

ROADMAP §"Phase 3: Google Drive Backup" define 5 success criteria:

| # | Success Criterion | Status | Evidencia |
|---|-------------------|--------|-----------|
| 1 | Auth con Google + email visible en Settings | ✓ Code-verified | `App.tsx:109-118` startup hook + `SettingsScreen.tsx:242-249` muestra email post-connect |
| 2 | Backup manual + filename `cozyhabits-YYYY-MM-DD.json` + timestamp en Settings | ✓ Code-verified | `uploadBackup()` + `BACKUP_FILE_PREFIX/EXTENSION` + `formatRelativeBackup` |
| 3 | Lista de backups + modal/screen de confirm con fecha + warning destructivo | ✓ Code-verified (UI: pantalla en lugar de modal, ver divergence) | `RestoreFromDriveScreen.tsx` + Alert destructivo con 4 conteos |
| 4 | Sign out desde Settings | ✓ Code-verified (sin revoke, ver D-10) | `signOut()` + `clearGoogleSession()` |
| 5 | Errores Drive con causa + acción sugerida (no crash) | ✓ Code-verified | `mapDriveError()` + 5 categorías ALERT_DRIVE_* + DriveError class |

**Verdict ROADMAP:** 5/5 success criteria code-verified. Runtime activation pendiente de GCP Console setup.

---

## Tests

```bash
npm test
> Test Suites: 10 passed, 10 total
> Tests:       95 passed, 95 total
> Time:        20.111 s
```

**Phase 3 contribución:** 43 tests nuevos (de 95 totales).

| Suite | Tests | Cobertura |
|-------|-------|-----------|
| `useSettingsStore.googleAuth.test.ts` | 5 | initial state, set/clear email, setLastBackup atómico, clearGoogleSession preserva lastBackup* (D-11) |
| `driveRetention.test.ts` | 6 | empty / under-threshold / 35-files-monthly / monthly-bucket / yearly-bucket / no-mutate |
| `dateFormat.test.ts` | 12 | formatDateEs (3) + formatRelativeBackup (5) + formatSize (4) |
| `driveBackupService.test.ts` | 14 | signIn (3) + signOut (1) + uploadBackup (4) + listBackups (1) + mapDriveError (5) |
| `driveBackupService.restore.test.ts` | 6 | single-download / parse-fail / orden estricto / cleanup target glob / cache best-effort / restoreData-throw cleanup-skip |
| **Subtotal Phase 3** | **43** | |
| Phase 1+2 (regresión) | 52 | sin regresión introducida |
| **Total** | **95/95** | |

---

## Findings de Code Review (03-REVIEW.md)

| ID | Severity | Estado | Acción sugerida |
|----|----------|--------|-----------------|
| WR-01 | warning | open | Auth SDK errors → DriveError mapping. Decisión del usuario. |
| WR-02 | warning | open | UI promete cache preservado pero cleanup lo borra. Opción A (preservar más reciente) o B (eliminar frase). Decisión del usuario. |
| WR-03 | warning | open | setState tras unmount. mountedRef en loadList. Bajo impacto. |
| WR-04 | warning | open | Race condition en previewAndConfirm. Defensive guard. Bajo impacto. |
| IN-01..IN-07 | info | open | UI strings en constantes / token leak en console.warn / etc. Mejoras de calidad, ninguna bloquea v1. |

**Ninguno de los findings auto-falla la verification.** Todos son issues que el usuario puede:
- Aceptar (vivir con el comportamiento actual)
- Cerrar en una phase de gap-closure aparte
- Cerrar en V2 si el bug se manifesta en uso real

WR-02 es el más relevante de cara al usuario porque es una contradicción con un texto destructivo prometido. Recomiendo decidir entre Opción A (preservar el cache más reciente, alinear con el texto) o B (eliminar la frase, alinear el texto al cleanup actual).

---

## Pending UAT (manual-only verifications)

Los 6 items listados en `human_verification` arriba (frontmatter) corresponden a UAT manual que SOLO se puede ejecutar tras completar el GCP Console setup de 03-01-SUMMARY §"Deferred / Pending User Setup":

1. Real OAuth interactivo desde Settings.
2. Backup real visible en Drive web (Hidden app data).
3. Round-trip backup → restore entre 2 devices.
4. Error sin red → ALERT_DRIVE_NO_NETWORK.
5. Pre-restore cache estado en filesystem.
6. Confirm Alert destructivo render real iOS+Android.

Estos items NO bloquean code-completeness, pero deben ejecutarse antes de cerrar el milestone como definitive done.

---

## Recomendación final

**Status:** human_needed

**Razón:** El código entrega los 8 requirements (DRIVE-01..08), pero hay decisiones del usuario pendientes:

1. **Decidir si cerrar WR-02 ahora o aceptarlo como caveat documentado.** Esta es la única discrepancia comportamiento↔UI relevante para el end-user. Recomendación: cerrar con Opción A (preservar el más reciente del cache) en una mini gap-closure phase.

2. **Decidir si cerrar WR-01 / WR-03 / WR-04 ahora o aceptarlos como deferred.** Estos son robustez/edge-cases sin impacto crítico. Recomendación: deferir a V2 a menos que aparezcan en uso real.

3. **Completar el GCP Console setup** (decisión ya diferida explícitamente). Hasta ese momento, los 6 UAT manuales no se pueden ejecutar y el usuario no puede testear E2E.

**Próximo paso recomendado:**
- Si el usuario quiere cerrar WR-02 antes del milestone done: ejecutar `/gsd-plan-phase --gaps 03` con un solo gap (WR-02 fix Opción A) → ~5 líneas en cleanupOldPreRestoreCache + actualizar test.
- Si el usuario acepta WR-02 como caveat: marcar el phase como verified-with-caveats y avanzar al GCP Console setup.

**Phase es COMPLETE en términos de código y tests. Está READY-TO-SHIP pendiente de runtime activation y opcional cierre de WR-02.**

---

_Verified: 2026-04-28T03:45:00Z_
_Verifier: Claude (gsd-verify-phase)_
_Tests: 95/95 verde_
_Suite runtime: ~20s_
