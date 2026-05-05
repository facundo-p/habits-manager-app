---
phase: 03
slug: google-drive-backup
status: verified
threats_total: 26
threats_closed: 26
threats_open: 0
accepted_risks: 8
asvs_level: 1
created: 2026-04-27
runtime_auth_blocked: true
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Cubre los tres planes (03-01 OAuth bootstrap, 03-02 Drive transport + Settings UI + Restore scaffold, 03-03 Restore flow). Verificación de mitigaciones a nivel código; el path de runtime de auth queda bloqueado hasta que el usuario complete el setup de GCP Console (heredado de 03-01).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| App ↔ Google Sign-In SDK (native) | Token exchange en código nativo. SDK persiste access/refresh tokens en iOS Keychain / Android AccountManager. La capa JS NUNCA persiste tokens. | OAuth tokens (no llegan a JS, salvo accessToken JIT vía `getTokens()` consumido en memoria) |
| App ↔ `useSettingsStore` (fileStorage) | Persiste `googleEmail` (PII low) + `lastBackupAt` / `lastBackupFileId` (punteros no secretos). NO tokens. Archivo `settings.json` en filesystem privado de app. | Email del usuario; pointers de Drive |
| App ↔ Google Cloud Console (build-time) | Client IDs embebidos en env vars `EXPO_PUBLIC_*`. Públicos por diseño OAuth — no son secretos. | Client IDs, SHA-1 |
| App ↔ Drive REST API v3 | HTTPS only. Todas las requests llevan `Authorization: Bearer <token>`. Nunca se embebe token en URL. | Backup JSON (habit data, mood, assignments) |
| App ↔ Multipart body construction | Concatenación de strings con boundary `cozy_boundary_${Date.now()}` — no controlable por usuario. Filename usa constantes app-controlled (`BACKUP_FILE_PREFIX + ISO + EXTENSION`). | Backup JSON serializado |
| App ↔ Drive download endpoint | HTTPS GET con `Authorization: Bearer`. Body es JSON crudo del backup — atacante con cuenta-tomada podría haber subido un JSON corrupto/malicioso. | Backup JSON entrante (no confiable hasta `parseAndValidate`) |
| Backup JSON ↔ DB | `parseAndValidate` (Phase 2 D-04) valida shape, tipos, IDs de áreas. Si parse falla en `prepareRestore`, NO se invoca `applyRestore` → DB intacta. | Datos validados (filtrado de IDs inválidos) |
| Pre-restore cache file | App-private filesystem (`FileSystem.cacheDirectory`). Persistido sin encriptación — mismo límite de confianza que SQLite local. | Snapshot de datos previo al restore |
| Stores tras restore | `fetchHabitsForDate` + `fetchLibrary` re-leen de SQLite (fuente de verdad post-restore). | Estado UI re-cargado |
| Test boundary | Tests mockean SDK + fetch — no hay llamadas reales a Drive. | Datos sintéticos en memoria |

---

## Threat Register

### Plan 03-01 — OAuth Bootstrap

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-03-01-01 | Spoofing | OAuth client ID misconfigurado (SHA-1 / package equivocado) | mitigate | Checklist de user-setup enumera SHA-1 (debug + EAS) y package `com.facupich.cozyhabit`. Sin config correcta, SDK rechaza sign-in (fail-closed). | closed | `app.json:17,20` (`bundleIdentifier` y `package` = `com.facupich.cozyhabit`); checklist en `03-01-SUMMARY.md §Deferred / Pending User Setup` |
| T-03-01-02 | Tampering | Atacante escribe `googleEmail` falso en `settings.json` para spoof estado conectado | accept | Filesystem app-private en iOS/Android requiere root/jailbreak. Sin token nativo válido (en OS keychain), ninguna llamada a Drive succeed. UI con email errado es cosmético. | closed | Aceptación documentada en Accepted Risks Log abajo |
| T-03-01-03 | Information Disclosure | Token leaked a logs | mitigate | `googleAuth.ts` no loguea tokens. `silentSignInIfPossible` solo loguea `code` + `message` sanitizados vía `sanitizeAuthError`. No hay `console.log(tokens)` en ningún archivo. | closed | `src/services/googleAuth.ts:38-44` (sanitizeAuthError extrae solo code+message); `src/services/googleAuth.ts:56` (`console.warn('[silentSignInIfPossible]', code, message)` — sin token); ningún `console.*` en `googleAuth.ts` o `driveBackupService.ts` interpola `accessToken` (verificado por grep) |
| T-03-01-04 | Information Disclosure | Email persistido en plaintext en `settings.json` | accept | Email es PII de baja sensibilidad. El filesystem privado del OS es el límite de confianza existente para `settings.json`. Encriptar el archivo es out-of-scope (ningún otro campo lo requiere). | closed | Aceptación documentada en Accepted Risks Log abajo; `src/store/useSettingsStore.ts:35` (path en `documentDirectory`) |
| T-03-01-05 | Repudiation | Usuario dice "nunca firmé" | accept | App single-user, sin audit trail (CLAUDE.md §Eficiencia + arquitectura). Sign-in es acción local con account-picker explícito. Threat no accionable. | closed | Aceptación documentada en Accepted Risks Log abajo |
| T-03-01-06 | Denial of Service | `signInSilently()` bloquea el render | mitigate | Pitfall #5 + D-08: useEffect async no-await. Render desbloqueado aún si SDK nunca resuelve. `try/catch` retorna null en cualquier error. | closed | `App.tsx:109-118` (useEffect llama `silentSignInIfPossible().then().catch()` — no `await`); `src/services/googleAuth.ts:47-59` (función nunca lanza, retorna null) |
| T-03-01-07 | Elevation of Privilege | App pide scope más amplio que `drive.appdata` | mitigate | Constante `DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'` hardcoded; pasada como `scopes: [DRIVE_SCOPE]` a `GoogleSignin.configure`. Únicas referencias a "drive" en código son `appDataFolder` (servicio) y la constante. | closed | `src/config/constants.ts:252` (DRIVE_SCOPE = drive.appdata); `src/services/googleAuth.ts:22` (`GoogleSignin.configure({ webClientId, scopes: [DRIVE_SCOPE], offlineAccess: false })`); `src/services/driveBackupService.ts:145,160` (`spaces: 'appDataFolder'`) |
| T-03-01-08 | Information Disclosure | Real client IDs commit-eados al repo | mitigate | `app.json` usa el literal `PLACEHOLDER_REVERSED_IOS_CLIENT_ID`. WebClientId vía `process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. `.env` y `.env.*` están en `.gitignore`. | closed | `app.json:35` (iosUrlScheme contiene `PLACEHOLDER_REVERSED_IOS_CLIENT_ID`); `src/services/googleAuth.ts:17` (`process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`); `.gitignore` incluye `.env` y `.env.*` |

### Plan 03-02 — Drive Transport + Settings UI + Restore Scaffold

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-03-02-01 | Spoofing | Atacante spoofea host de Drive API | mitigate | URLs hardcoded `https://www.googleapis.com/drive/v3` y `https://www.googleapis.com/upload/drive/v3`. Cert pinning out-of-scope (Expo managed; CA chain del OS). | closed | `src/services/driveBackupService.ts:69-70` (DRIVE_BASE y UPLOAD_BASE hardcoded HTTPS) |
| T-03-02-02 | Tampering | Payload de backup tampered en tránsito | mitigate | HTTPS provee integridad. `parseAndValidate` (Phase 2 D-04 hardened) valida JSON shape en download path. | closed | `src/services/driveBackupService.ts:69-70` (HTTPS); `src/services/driveBackupService.ts:399-407` (`prepareRestore` invoca `parseAndValidate` y wraps fail en `DriveError(GENERIC)`) |
| T-03-02-03 | Repudiation | Usuario dice "nunca subí ese backup" | accept | App single-user; sin audit trail. Drive provee versionado pero PATCH overwrite es trade-off explícito (D-12). | closed | Aceptación documentada en Accepted Risks Log abajo |
| T-03-02-04 | Information Disclosure | Token logueado en `console.error` | mitigate | Service usa patrón `console.warn/error('[fnName]', err)`; nunca interpola `accessToken`. Verificación por grep: las únicas referencias a `accessToken` en `driveBackupService.ts` son la asignación `const { accessToken }` y el header `Bearer ${token}` — no hay log de su valor. | closed | `src/services/driveBackupService.ts:126-128` (única extracción y validación); 6 `console.warn/error` calls en `driveBackupService.ts` líneas 311, 316, 405, 435, 450, 471 — ninguna interpola token |
| T-03-02-05 | Information Disclosure | Backup contiene habit names + dates (PII low) — leaked si atacante gana token de Drive | mitigate | Drive `appDataFolder` scope (D-02): solo esta app ve sus archivos. Token persistido en OS keychain (SDK). Encriptación at-rest deferida a V2 (DRIVE-V2-03). | closed | `src/services/driveBackupService.ts:145,160` (`spaces: 'appDataFolder'`); `src/services/driveBackupService.ts:235` (`parents: ['appDataFolder']` en POST metadata) |
| T-03-02-06 | Denial of Service | Falla de pruning cascadea a fallar el backup | mitigate | `pruneOldBackupsBestEffort` swallows todos los errores (Pitfall #8 + D-14). Test verifica. | closed | `src/services/driveBackupService.ts:193` (`void pruneOldBackupsBestEffort()` — fire-and-forget); `src/services/driveBackupService.ts:302-318` (envuelve loop de delete en try/catch outer; cada delete en try/catch interno; ambos solo `console.warn`) |
| T-03-02-07 | Denial of Service | Llamada lenta de Drive freezea UI | mitigate | UI muestra `LoadingOverlay` (D-23). Fetch async no-blocking en JS thread. RN mantiene UI responsiva. | closed | `src/screens/SettingsScreen.tsx:366` (`<LoadingOverlay visible={isUploading} ...>`); `src/screens/RestoreFromDriveScreen.tsx:213` (overlay en restore); operaciones `await drive.uploadBackup()` no bloquean main thread |
| T-03-02-08 | Elevation of Privilege | Token leakea a otras apps via app-extension | accept | iOS Keychain group + Android SharedPreferences son app-private por default. SDK no expone storage del token a otras apps. | closed | Aceptación documentada en Accepted Risks Log abajo |
| T-03-02-09 | Information Disclosure | Multipart body con user data + metadata en string concat — XSS-like injection? | mitigate | Filename usa `BACKUP_FILE_PREFIX + ISO_DATE + EXTENSION` — totalmente app-controlled, sin user-input interpolado. Body usa `JSON.stringify` (escape correcto). Sin vector de inyección. | closed | `src/services/driveBackupService.ts:182-183` (`filename = ${BACKUP_FILE_PREFIX}${today}${BACKUP_FILE_EXTENSION}`); `src/services/driveBackupService.ts:180` (`JSON.stringify(data)`); `src/services/driveBackupService.ts:217-227` (`buildMultipartBody` solo concat de constantes + JSON.stringify) |
| T-03-02-10 | Tampering | Pre-existing backup de hoy reemplazado sin awareness | mitigate | D-13 + UI: `handleBackupNow` checkea backup del día via `listBackups`, muestra `ALERT_DRIVE_OVERWRITE_TODAY` ANTES de proceder. PATCH no lleva `parents` (Pitfall #4). | closed | `src/screens/SettingsScreen.tsx:177-201` (`handleBackupNow` — list + check + Alert ANTES de upload); `src/services/driveBackupService.ts:258` (PATCH metadata sin `parents`) |

### Plan 03-03 — Restore Flow + RestoreFromDriveScreen Body

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-03-03-01 | Tampering | Backup JSON malicioso (atacante en cuenta del usuario) inyecta IDs inválidos / shapes corruptos | mitigate | `parseAndValidate` (Phase 2 D-04, hardened sin `as Partial`) valida cada array y filtra IDs inválidos. Shape incorrecto throws → `prepareRestore` envuelve en `DriveError(ALERT_DRIVE_GENERIC)` → `applyRestore` nunca se invoca → DB intacta. | closed | `src/services/driveBackupService.ts:399-407` (try/catch alrededor de `parseAndValidate`, throw en `DriveError(ALERT_DRIVE_GENERIC, err)` — Risk Note #4 + warning #9 honored) |
| T-03-03-02 | Information Disclosure | Pre-restore cache contiene PII y queda accesible si dispositivo está rooteado | accept | Filesystem app-private es el límite de confianza ya establecido para SQLite. Cache file usa la misma protección. Encriptación es V2 (DRIVE-V2-03). | closed | Aceptación documentada en Accepted Risks Log abajo |
| T-03-03-03 | Denial of Service | Backup gigante (>10MB) bloquea UI mientras descarga | accept | RESEARCH §Standard Stack confirma backups <1MB típicamente. UI muestra `LoadingOverlay` durante "Leyendo backup...". Caso anormal degrada UX sin crash. | closed | Aceptación documentada en Accepted Risks Log abajo |
| T-03-03-04 | Tampering | Restore aplica datos sin que el usuario confirme | mitigate | Restore confirm Alert es `style: 'destructive'` con copy explícita ("Esta acción no se puede deshacer"). Solo el botón destructivo dispara `performRestore`. | closed | `src/screens/RestoreFromDriveScreen.tsx:159` (`Esta acción no se puede deshacer`); `src/screens/RestoreFromDriveScreen.tsx:165` (`style: 'destructive', onPress: () => void performRestore(payload)`) |
| T-03-03-05 | Repudiation | Usuario dice "no autoricé el restore" | accept | Confirm Alert + pre-restore safety cache (D-19) cubren el caso. App single-user, sin audit log. | closed | Aceptación documentada en Accepted Risks Log abajo |
| T-03-03-06 | Denial of Service | restoreData parcial → DB inconsistente, cleanup borra el cache de seguridad | mitigate | `restoreData` (Phase 2) usa `withTransactionAsync` — atómico, rollback en error. Si lanza, `applyRestore` re-lanza vía `DriveError(GENERIC)` y NO ejecuta `cleanupOldPreRestoreCache` (warning #9): cache previo + el recién escrito sobreviven para recovery. | closed | `src/services/driveBackupService.ts:430-440` (`applyRestore`: cleanup SOLO se llama después de `restoreData` exitoso; el throw early-returns antes del cleanup) |
| T-03-03-07 | Information Disclosure | Pre-restore cache acumula indefinidamente y revela meses de actividad histórica | mitigate | Cleanup post-success borra todos los `cozyhabits-pre-restore-*.json` SOLO cuando `restoreData` tuvo éxito. WR-02: preserva el más reciente para honrar la promesa de la UI ("Tus datos previos quedaron respaldados en el dispositivo"). | closed | `src/services/driveBackupService.ts:439` (cleanup llamado post-`restoreData`); `src/services/driveBackupService.ts:459-473` (`cleanupOldPreRestoreCache` filtra por prefix, ordena, `slice(0, -1)` deja el más nuevo) |
| T-03-03-08 | Spoofing | Atacante navega directo a RestoreFromDriveScreen sin estar autenticado | mitigate | El botón "Restaurar desde Drive" en Settings solo aparece cuando `googleEmail !== null`. `listBackups` requiere token; sin token, `getDriveAccessToken` falla y mapea a `ALERT_DRIVE_AUTH_EXPIRED`. Defensive but adequate. | closed | `src/screens/SettingsScreen.tsx:255,278-286` (botón "Restaurar desde Drive" dentro del branch `googleEmail ? (...)`); `src/services/driveBackupService.ts:123-136` (`getDriveAccessToken` lanza `DriveError(ALERT_DRIVE_AUTH_EXPIRED)` si no hay token) |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-01-02 | Filesystem app-private en iOS/Android es el límite de confianza estándar para PII low-sensitivity. Tampering exigiría root/jailbreak, y aun así, sin token nativo válido (en OS keychain) no se puede ejecutar ninguna operación de Drive. UI cosmética con email incorrecto no afecta integridad. | Phase 03 plan author | 2026-04-28 |
| AR-03-02 | T-03-01-04 | Email es PII low-sensitivity. El filesystem privado del OS es el límite de confianza ya existente para `settings.json` (mismo nivel que SQLite). Encriptar el archivo añade complejidad sin beneficio dado que ningún otro campo lo requiere. | Phase 03 plan author | 2026-04-28 |
| AR-03-03 | T-03-01-05 | App single-user (CLAUDE.md §Eficiencia). Sign-in es acción explícita con Google account-picker; el usuario ve qué cuenta seleccionó. No hay multi-tenant ni shared device asumido. Implementar audit trail añade complejidad sin caso de uso. | Phase 03 plan author | 2026-04-28 |
| AR-03-04 | T-03-02-03 | App single-user; sin audit trail. Drive provee version history nativo (los usuarios pueden recuperar versiones desde Drive web). PATCH overwrite es trade-off explícito documentado en D-12. | Phase 03 plan author | 2026-04-28 |
| AR-03-05 | T-03-02-08 | iOS Keychain group + Android SharedPreferences son app-private por default. El SDK de @react-native-google-signin gestiona persistencia y NO expone token storage a otras apps. Defensa nativa adecuada. | Phase 03 plan author | 2026-04-28 |
| AR-03-06 | T-03-03-02 | Filesystem app-private (`FileSystem.cacheDirectory`) es el mismo límite de confianza que SQLite local. Atacante con device rooteado ya tiene acceso a la DB; el cache no añade superficie nueva. Encriptación at-rest planificada para V2 (DRIVE-V2-03). | Phase 03 plan author | 2026-04-28 |
| AR-03-07 | T-03-03-03 | Backups típicos <1MB (RESEARCH §Standard Stack). LoadingOverlay durante "Leyendo backup..." cubre el caso normal. Backups gigantescos son un escenario degenerado de UX (overlay sigue visible) sin crash. | Phase 03 plan author | 2026-04-28 |
| AR-03-08 | T-03-03-05 | App single-user. Confirm Alert destructivo ("Esta acción no se puede deshacer") + pre-restore safety cache (D-19) son defensas suficientes. Audit log explícito out-of-scope para single-user app. | Phase 03 plan author | 2026-04-28 |

*Accepted risks no resurgen en futuras audit runs.*

---

## Unregistered Threat Flags

Las tres SUMMARY.md (`03-01-SUMMARY.md` §Threat Flags, `03-02-SUMMARY.md` §Threat Flags, `03-03-SUMMARY.md` §Threat Flags) confirman explícitamente: "Ningún threat surface nuevo fuera del registro `<threat_model>` del PLAN". Cada threat flag listado mapea a un threat ID existente en el registro arriba. **No hay flags huérfanos.**

---

## Runtime Auth Defer Note

`runtime_auth_blocked: true` en frontmatter — heredado de Phase 03-01. Los OAuth client IDs de GCP Console son user-setup pendiente. **Esto NO afecta la verificación a nivel código** de los threats arriba: las mitigaciones declaradas (no log de tokens, scope mínimo, scope hardcoded, fail-closed en sign-in, etc.) están todas verificadas en el codebase. El path runtime no se ejecuta hasta que el usuario complete:
1. Crear OAuth client IDs (iOS + Android + Web) en GCP Console.
2. Setear `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` en `.env`.
3. Reemplazar `PLACEHOLDER_REVERSED_IOS_CLIENT_ID` en `app.json` con el reversed iOS client ID real.
4. Build EAS development con SHA-1 registrado.

UAT manual post-OAuth-unblock validará el behavior end-to-end.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-27 | 26 | 26 | 0 | gsd-secure-phase (Claude Opus 4.7 1M) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-27
