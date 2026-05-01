---
phase: 03-google-drive-backup
plan: 01
subsystem: auth
tags: [google-drive, oauth, google-signin, zustand, expo, react-native]

# Dependency graph
requires:
  - phase: 02-tech-debt
    provides: parseAndValidateCategories central + typed sanitize helpers (clean store base for new fields)
provides:
  - "@react-native-google-signin/google-signin@16.1.2 instalado + plugin nativo en app.json + ios.bundleIdentifier"
  - "13 constantes nuevas: BACKUP_FILE_PREFIX, BACKUP_FILE_EXTENSION, RETENTION_RECENT_DAYS, DRIVE_SCOPE + 11 ALERT_DRIVE_* (D-26 + D-13)"
  - "useSettingsStore extendido con googleEmail/lastBackupAt/lastBackupFileId + setGoogleEmail/setLastBackup/clearGoogleSession (D-09 + D-11)"
  - "src/services/googleAuth.ts con configureGoogleSignin() + silentSignInIfPossible() (idempotente, fail-soft)"
  - "App.tsx con startup hook async no-await que propaga el email al store sin bloquear render (D-08)"
affects: [03-02-drive-transport, 03-03-restore-flow]

# Tech tracking
tech-stack:
  added:
    - "@react-native-google-signin/google-signin@16.1.2"
  patterns:
    - "Service module idempotente (configureGoogleSignin) con flag de cierre `let configured = false`"
    - "Fire-and-forget useEffect en App.tsx (no-await, .then/.catch) — patrón D-08 + Pitfall #5"
    - "useSettingsStore.getState() (no hook) para mutar store desde root sin re-render — mismo patrón que useHabitStore"
    - "Try/catch silencioso en silent sign-in: nunca throw, retorna null para que el caller decida"
    - "Constantes de alert con shape { title, message, retry?, actionLabel? } — extiende patrón existente de ALERT_IMPORT*"

key-files:
  created:
    - "src/services/googleAuth.ts — 41 líneas, 2 named exports"
    - "src/__tests__/useSettingsStore.googleAuth.test.ts — 5 unit tests del slice"
  modified:
    - "package.json + package-lock.json — google-signin@16.1.2 declarado"
    - "app.json — ios.bundleIdentifier=com.facupich.cozyhabit + plugin tuple con iosUrlScheme PLACEHOLDER"
    - "src/config/constants.ts — bloque Drive Backup + Drive Alerts (11 ALERT_DRIVE_* + 4 escalares)"
    - "src/store/useSettingsStore.ts — 3 fields + 3 setters + partialize extendido"
    - "App.tsx — segundo useEffect con configure + silent sign-in"

key-decisions:
  - "OAuth GCP-Console setup deferred a un próximo paso de usuario — el código está completo y typed-checked, pero los Client IDs reales todavía no existen, por lo que el silent sign-in fallará en runtime hasta que el usuario complete el checklist de user_setup."
  - "iosUrlScheme en app.json mantiene el literal `com.googleusercontent.apps.PLACEHOLDER_REVERSED_IOS_CLIENT_ID` — NO se commiteó ningún client ID real (T-03-01-08)."
  - "WebClientId leído por env (`process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`) con warn silencioso si está ausente — la app no crashea, simplemente queda con Drive deshabilitado hasta que el env esté seteado."
  - "Setter `clearGoogleSession()` limpia solo `googleEmail` y preserva `lastBackupAt`/`lastBackupFileId` (D-11) — un sign-out no debe perder el historial de backups visibles."

patterns-established:
  - "Pattern: Auth service idempotente — `let configured = false` guard interno; safe llamarlo múltiples veces."
  - "Pattern: Fail-soft auth — silent sign-in retorna null en cualquier error; nunca throw hacia el render."
  - "Pattern: Env-gated SDK config — si falta env var, log warn y return temprano. La app sigue funcionando."
  - "Pattern: Voseo argentino en alerts — 'Verificá', 'Volvé', 'Podés' (literal de UI-SPEC §Constants to Add)."

requirements-completed: [DRIVE-01, DRIVE-06, DRIVE-07]

# Metrics
duration: ~7 min (exec); plan close-out 2026-04-28
completed: 2026-04-28
runtime_auth_blocked: true
runtime_auth_blocker: "GCP Console setup pendiente — silent sign-in y todas las operaciones de Drive fallarán hasta que el usuario complete el checklist en 'Deferred / Pending User Setup'."
---

# Phase 03 Plan 01: Google OAuth Bootstrap Summary

**Bootstrap de Google Sign-In: SDK @react-native-google-signin/google-signin@16.1.2 instalado, useSettingsStore extendido con 3 fields persistidos para auth/backup, googleAuth.ts service idempotente, y hook de startup non-blocking en App.tsx — código y tests verdes; activación runtime queda detrás del checklist de GCP Console.**

## Performance

- **Duration:** ~7 min (exec window)
- **Started:** 2026-04-27T23:14:53-03:00 (first task commit `6919af1`)
- **Completed (code):** 2026-04-27T23:21:16-03:00 (last task commit `7378b89`)
- **Closed (plan):** 2026-04-28
- **Tasks:** 4 of 4 completed (autonomous portion)
- **Files modified:** 7 (2 created + 5 modified)

## Accomplishments

- Surface pública de auth definida y disponible para 03-02 / 03-03 sin re-resolver nada (`configureGoogleSignin`, `silentSignInIfPossible`, `setGoogleEmail`, `setLastBackup`, `clearGoogleSession`).
- 13 constantes nuevas (4 escalares + 11 ALERT_DRIVE_*) con copy en voseo, retry flags y `actionLabel: 'Ir a Ajustes'` en los 2 casos que llevan al usuario a Settings (AUTH_EXPIRED, PERMISSION).
- 5 unit tests del slice de auth — todo el behavior block del PLAN cubierto (initial state, set, clear, partialize).
- Bundle identifier de iOS unificado con android.package (fix de RESEARCH §Pitfall #6 — `com.facupich.cozyhabit` consistente).
- Suite completa: **57/57 tests pasando** (sin regresiones).

## Task Commits

Cada tarea se commiteó atomicamente:

1. **Task 1 — Install SDK + native config (package.json + app.json):** `6919af1` (chore)
2. **Task 2 — Add Drive constants (D-26 + D-13 + UI-SPEC):** `2283f1c` (feat)
3. **Task 3 — Extend useSettingsStore with auth fields + tests (TDD):** `caf1c07` (test, RED) → `de5d328` (feat, GREEN)
4. **Task 4 — Create googleAuth.ts service + wire startup hook in App.tsx:** `7378b89` (feat)

**Plan tracking commit:** _(este commit, ver `git log -1` después de close-out)_

_Nota: Task 3 siguió flujo TDD (RED + GREEN). No hubo refactor commit porque el GREEN ya estaba limpio._

## Files Created/Modified

### Created

- `src/services/googleAuth.ts` (41 líneas) — `configureGoogleSignin()` idempotente + `silentSignInIfPossible()` fail-soft. Lee `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` con warn si falta. Hardcodea `scopes: [DRIVE_SCOPE]` y `offlineAccess: false` (T-03-01-07).
- `src/__tests__/useSettingsStore.googleAuth.test.ts` — 5 unit tests del slice (initial state, set/clear email, setLastBackup atómico, clearGoogleSession preserva lastBackup\* per D-11).

### Modified

- `package.json` + `package-lock.json` — `@react-native-google-signin/google-signin: 16.1.2` declarado.
- `app.json` — `expo.ios.bundleIdentifier = "com.facupich.cozyhabit"` + plugin tuple `["@react-native-google-signin/google-signin", { "iosUrlScheme": "com.googleusercontent.apps.PLACEHOLDER_REVERSED_IOS_CLIENT_ID" }]`. Plugins existentes (`expo-font`, `expo-sqlite`) intactos.
- `src/config/constants.ts` — 2 secciones nuevas al final: `Drive Backup` (4 escalares: `BACKUP_FILE_PREFIX`, `BACKUP_FILE_EXTENSION`, `RETENTION_RECENT_DAYS=30`, `DRIVE_SCOPE='https://www.googleapis.com/auth/drive.appdata'`) + `Drive Alerts` (11 `ALERT_DRIVE_*` con voseo y retry flags exactos según UI-SPEC). `ALERT_IMPORT*` y `BACKUP_FILENAME` intactos.
- `src/store/useSettingsStore.ts` — 3 fields nuevos (`googleEmail`, `lastBackupAt`, `lastBackupFileId`), 3 setters (`setGoogleEmail`, `setLastBackup`, `clearGoogleSession`), `partialize` extendido a 7 keys.
- `App.tsx` — 2 imports nuevos + segundo `useEffect` después del de `initDatabase`: `configureGoogleSignin()` + `silentSignInIfPossible()` con `.then(setGoogleEmail).catch(console.error)`. Render no bloqueado (D-08 + Pitfall #5).

## Decisions Made

- **OAuth setup diferido (decisión del usuario):** El código está code-complete y type-checked, pero la creación de los OAuth clients en GCP Console queda pendiente. El plan se cierra con `runtime_auth_blocked: true` para que herramientas downstream lo detecten. Ver sección "Deferred / Pending User Setup" abajo.
- **Idempotencia con flag local:** `let configured = false` dentro de `googleAuth.ts` — el SDK no expone un getter; este patrón es seguro (un único módulo, scope de módulo).
- **Env-gated en lugar de throw:** Si falta `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `configureGoogleSignin` hace `console.warn` y `return`; no crashea la app. Esto permite seguir desarrollando 03-02/03-03 incluso sin OAuth real configurado todavía.
- **`useSettingsStore.getState()` (no hook) en App.tsx:** No re-renderiza el root. Mismo patrón ya usado por `useHabitStore.getState().resetToToday()`.

## Deviations from Plan

None — plan ejecutado exactamente como fue escrito. Las 4 tareas siguieron sus `<action>` y `<acceptance_criteria>` literalmente.

**Total deviations:** 0
**Impact on plan:** Plan ejecutado limpio. La única salida del flujo autónomo fue el checkpoint final de `human-action` para OAuth (planificado en `user_setup`), que el usuario decidió diferir.

## Issues Encountered

- **Pre-existing TypeScript errors** detectados durante `npx tsc --noEmit` en Task 1 → confirmado que ya existían en el tree limpio (verificado con `git stash`). Documentados en `.planning/phases/03-google-drive-backup/deferred-items.md` y NO bloquean este plan.
  - `NotebookPaper.tsx:81` (LinearGradient typing)
  - `assignmentService.ts:92`, `habitService.ts:103,119`, `parsing.ts:25` (area-id narrowing)
  - Recommended para una ronda futura de tech-debt.

## Deferred / Pending User Setup

> **CRITICAL — runtime auth está bloqueado hasta completar todos estos pasos.**
> El código de este plan compila, los 57 tests pasan, y `silentSignInIfPossible` está cableado en App.tsx. Pero **la primera vez que la app intente conectar con Drive (plans 03-02/03-03), el SDK fallará** porque los OAuth clients aún no existen en GCP Console y el placeholder `iosUrlScheme` no es un client ID real.

### 1. OAuth Consent Screen

- [ ] Ir a Google Cloud Console → **OAuth consent screen** → completar app name, support email, developer contact.
- [ ] Agregar tu cuenta personal en **Test users** (mientras esté en estado `Testing`). Sin esto, el sign-in da `403 access_denied`.
- [ ] Confirmar que el scope `https://www.googleapis.com/auth/drive.appdata` está habilitado (no requiere security review — es un scope sensitive low-risk).

### 2. Crear los 3 OAuth Clients

| Tipo | Bundle / Origin | Por qué |
|------|-----------------|---------|
| **Web application** | (sin redirect URIs en mobile) | Necesario para el `webClientId` de `GoogleSignin.configure` (esto NO es opcional aunque la app sea iOS/Android — el SDK lo usa para validar el id_token). |
| **iOS** | Bundle ID = `com.facupich.cozyhabit` | Para que el silent sign-in funcione en iOS. Copiar también el "iOS URL scheme" (un string tipo `com.googleusercontent.apps.<numbers>`). |
| **Android** | Package = `com.facupich.cozyhabit` + SHA-1 fingerprint(s) | Una entrada por cada keystore (debug + EAS profiles). Sin SHA-1 correcto, sign-in falla en Android. |

#### Cómo obtener los SHA-1:

- **Local debug keystore:**
  ```bash
  keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
  ```
- **EAS-managed credentials:**
  ```bash
  npx eas credentials
  ```

### 3. Setear variables de entorno (3 envs)

Crear `.env.local` (NO commitear) con:

```bash
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<copiado del Web OAuth client>
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<copiado del iOS OAuth client>
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.<numbers>
```

`googleAuth.ts` lee `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` y mostrará warn en consola si falta.

### 4. Reemplazar el placeholder de `app.json`

- [ ] Editar `app.json` → `expo.plugins[2][1].iosUrlScheme` → reemplazar `com.googleusercontent.apps.PLACEHOLDER_REVERSED_IOS_CLIENT_ID` por el "iOS URL scheme" real obtenido en el paso 2.
- [ ] **NO commitear el client ID real** si tu repo es público; si es privado, está OK.

### 5. EAS Development Build

Expo Go **no soporta** módulos nativos como `@react-native-google-signin/google-signin` (D-04). Ejecutar:

```bash
npx expo prebuild --clean
npx eas build --profile development --platform ios   # o --platform android
```

Después instalar el `.ipa`/`.apk` resultante en el device físico (o usar internal distribution). El simulador funciona para Android pero no para iOS sign-in.

### 6. Verificar que funciona

Una vez completados los 5 pasos anteriores:

```bash
# 1. Iniciar la dev build (no Expo Go)
npx expo start --dev-client

# 2. En la app, abrir Settings (cuando 03-02 lo agregue) y tocar "Conectar Google"
# 3. En consola, deberías ver: ningún warn de [configureGoogleSignin] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID no definido
# 4. El email debe persistir en settings.json (verificable con expo-file-system o reabriendo la app)
```

**Hasta que estos 6 pasos estén hechos**, el plan 03-02 puede seguir desarrollándose con código mock-friendly (todos los `driveBackupService` tests usan mocks del SDK), pero **la app real no podrá conectarse a Drive**.

---

## Self-Check

Verificación de claims antes de cerrar:

- [x] `src/services/googleAuth.ts` existe (`ls` confirms 41 lines).
- [x] `src/__tests__/useSettingsStore.googleAuth.test.ts` existe (5 tests).
- [x] Commit `6919af1` (Task 1, chore) — FOUND.
- [x] Commit `2283f1c` (Task 2, feat) — FOUND.
- [x] Commit `caf1c07` (Task 3 RED, test) — FOUND.
- [x] Commit `de5d328` (Task 3 GREEN, feat) — FOUND.
- [x] Commit `7378b89` (Task 4, feat) — FOUND.
- [x] `npm test` → 57/57 passing, 6/6 suites passing (verificado 2026-04-28).
- [x] `package.json` declara `@react-native-google-signin/google-signin: "16.1.2"`.
- [x] `app.json` tiene `expo.ios.bundleIdentifier = "com.facupich.cozyhabit"` y plugin tuple correcto.
- [x] `grep -c "ALERT_DRIVE_" src/config/constants.ts` → 11.
- [ ] **Runtime auth flow** — BLOCKED hasta que el usuario complete el checklist de "Deferred / Pending User Setup" arriba. Esto es esperado y está documentado en frontmatter (`runtime_auth_blocked: true`).

## Self-Check: PASSED (code-complete; runtime auth deferred per user decision)

## Threat Flags

Ningún threat surface nuevo fuera del registro `<threat_model>` del PLAN. Las 8 threats T-03-01-01 a T-03-01-08 están todas mitigadas por el código entregado o aceptadas explícitamente:

- **T-03-01-03** (token leakage to logs) — `googleAuth.ts:console.warn('[silentSignInIfPossible]', err)` no interpola tokens. Solo loguea el error class.
- **T-03-01-06** (DoS via blocked render) — `useEffect` en App.tsx es `.then().catch()` sin `await`. Pitfall #5 honrado.
- **T-03-01-07** (over-broad scope) — `DRIVE_SCOPE` constante; `grep "scopes:" src/services/googleAuth.ts` muestra solo `[DRIVE_SCOPE]`.
- **T-03-01-08** (real client IDs in repo) — `app.json` usa el literal `PLACEHOLDER_REVERSED_IOS_CLIENT_ID`. WebClientId via env. Verified pre-commit.

## TDD Gate Compliance

- ✅ RED gate: `caf1c07` (`test(03-01): add failing tests...`)
- ✅ GREEN gate: `de5d328` (`feat(03-01): extend useSettingsStore...`) — posterior a RED.
- ⏭️ REFACTOR gate: omitido — el GREEN ya estaba limpio (3 setters de 1 línea c/u, partialize directa, sin código a refactorizar).

## Next Phase Readiness

**Listo para plan 03-02:**

- `useSettingsStore.setLastBackup(at, fileId)` disponible para que `driveBackupService.uploadBackup` lo invoque tras un upload exitoso.
- `useSettingsStore.googleEmail` disponible para que SettingsScreen muestre "Conectado como X".
- `useSettingsStore.clearGoogleSession()` listo para el botón Sign-Out (lo invocará el plan 03-03).
- Constantes `BACKUP_FILE_PREFIX`, `BACKUP_FILE_EXTENSION`, `RETENTION_RECENT_DAYS` listas para `driveRetention.ts` (Time Machine policy).
- Constantes `ALERT_DRIVE_*` listas para mapeo de errores en SettingsScreen + RestoreFromDriveScreen.
- `silentSignInIfPossible` ya populates `googleEmail` al startup → SettingsScreen puede leer del store sin worry de "esperar".

**Concerns / blockers para futuras plans:**

- **Runtime auth blocked** hasta GCP Console setup (ver sección dedicada arriba). 03-02 puede continuar con desarrollo + tests mockeados; 03-02 final verification (manual sign-in real, upload real) requiere unblock primero.
- Pre-existing TS errors (deferred-items.md) NO afectan ni 03-02 ni 03-03 — no tocar en este phase.

---

*Phase: 03-google-drive-backup*
*Plan: 01 — Google OAuth bootstrap*
*Closed: 2026-04-28 (code-complete; OAuth setup deferred to user)*
