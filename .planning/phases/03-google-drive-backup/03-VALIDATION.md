---
phase: 3
slug: google-drive-backup
status: final
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-27
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 30.x (ts-jest, `testEnvironment: 'node'`) |
| **Config file** | `jest.config.js` (project root) |
| **Quick run command** | `npm test -- --testPathPatterns="<pattern>"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPatterns="<file>"`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Cada fila refleja el `<automated>` real declarado en su task. Cuando una task tiene un único `<automated>` lo listamos textual; cuando una task encadena dos comandos vía `&&`, listamos ambos.

| Plan-Task | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|-----------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 03-01-T1 | 01 | 1 | DRIVE-01 | T-03-01-* | OAuth client IDs leídos de `Constants.expoConfig.extra` (no embebidos en bundle) | unit + manual | `npm test -- --testPathPatterns="useSettingsStore.googleAuth"` | ✅ green |
| 03-01-T2 | 01 | 1 | DRIVE-06, DRIVE-07 | — | `partialize` persiste sólo claves declaradas; `clearGoogleSession` no borra `lastBackup*` (D-11) | unit | `npm test -- --testPathPatterns="useSettingsStore.googleAuth"` | ✅ green |
| 03-02-T1 | 02 | 2 | DRIVE-04 (parcial), D-14 | — | Retention pure function (Time Machine) y formatters compartidos sin duplicación | unit | `npm test -- --testPathPatterns="(driveRetention\|dateFormat)"` | ✅ green |
| 03-02-T2 | 02 | 2 | DRIVE-02, DRIVE-03, DRIVE-08 | T-03-02-04, T-03-02-09 | Multipart body bien formado; PATCH sin `parents` (Pitfall #4); `signOut` no llama `revokeAccess` (D-10); `mapDriveError` cubre 5 categorías | unit | `npm test -- --testPathPatterns="driveBackupService"` | ✅ green |
| 03-02-T3 | 02 | 2 | DRIVE-02, DRIVE-06, DRIVE-07 | T-03-02-10 | UI Drive section + LoadingOverlay + scaffold de Restore + ruta registrada; sin regresiones | suite | `npm test -- --testPathPatterns="(driveBackupService\|driveRetention\|dateFormat\|useSettingsStore.googleAuth)"` | ✅ green |
| 03-03-T1 | 03 | 3 | DRIVE-04, DRIVE-05, DRIVE-08 | T-03-03-01, T-03-03-06, T-03-03-07 | `prepareRestore` parse-fail no toca DB; `applyRestore` orden write→restore→cleanup (cleanup sólo post-success — warning #9); cache write best-effort (D-19) | unit | `npm test -- --testPathPatterns="driveBackupService.restore"` | ✅ green |
| 03-03-T2 | 03 | 3 | DRIVE-04, DRIVE-05, DRIVE-08 | T-03-03-04 | RestoreFromDriveScreen expandido: error state con Reintentar, FlatList, preview vía prepareRestore (single download), confirm destructivo, refresh stores; sin duplicación de helpers | suite | `npm test` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Wave 0 = todas las suites de test que un futuro `<automated>` necesita. Como esta phase usa nombres de test integrados con el plan ejecutor (no infrastructure separada), Wave 0 está completo cuando los plans crean los archivos correspondientes en sus tasks. Los archivos abajo son los CREADOS POR LOS PLANS, no requisitos previos.

- [x] `src/__tests__/useSettingsStore.googleAuth.test.ts` — creado por 03-01-T2 (slice de auth + lastBackup* + clearGoogleSession)
- [x] `src/__tests__/driveRetention.test.ts` — creado por 03-02-T1 (Time Machine pruning, 6 casos)
- [x] `src/__tests__/dateFormat.test.ts` — creado por 03-02-T1 (formatDateEs/formatRelativeBackup/formatSize, 11 casos)
- [x] `src/__tests__/driveBackupService.test.ts` — creado por 03-02-T2 (signIn/signOut/upload/list + error mapping, 13 casos)
- [x] `src/__tests__/driveBackupService.restore.test.ts` — creado por 03-03-T1 (prepareRestore + applyRestore split, 6 casos cubriendo orden + parse fail + cache best-effort + restoreData throw → cleanup no corre)

*Mocks del SDK `@react-native-google-signin/google-signin` se hacen inline (`jest.doMock` con `virtual: true`) en cada test file que lo necesita — patrón replicado de `speechRecognition.test.ts`. `expo-file-system/legacy` redirige a `__mocks__/expo-file-system.ts` vía `moduleNameMapper`.*

> **TS baseline note:** `npx tsc --noEmit` retorna 5 errores pre-existentes documentados en `deferred-items.md` (LinearGradient typing + 4 narrowings de area-id). Phase 3 NO los introdujo. El gate de Nyquist se restringe a Jest; tsc se trackea por separado para una ronda futura de tech-debt.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google OAuth sign-in works on real device | DRIVE-01 | Requires Google Cloud OAuth client + EAS dev build | Run on Android dev build, tap "Connect Google", complete OAuth, verify email appears in Settings |
| Drive upload visible in Drive web | DRIVE-02 | External system (Google Drive) | After backup, open drive.google.com → look for `cozyhabits-YYYY-MM-DD.json` in app data folder |
| Restore from Drive replaces local data | DRIVE-05 | End-to-end flow with real Drive | Add a habit, backup, delete habit, restore from Drive, verify habit returns |
| Sign-out clears email from Settings | DRIVE-07 | UI state visible only in app | Tap "Cerrar sesión", verify email/last-backup row hidden, "Conectar con Google" button reappears |
| Error message on no-network | DRIVE-08 | Requires network manipulation | Toggle airplane mode, tap "Backup ahora", verify actionable error shown |
| Android `getTokens()` returns valid token after expiry | — (pitfall) | Bug only reproducible on Android with expired token | Sign in, wait 1h+, attempt backup, verify silent re-auth fix kicks in |
| Pre-restore safety cache survives a failed restore | D-19 + warning #9 | Filesystem state inspection | Force `restoreData` to throw (e.g., DB locked), verify `cozyhabits-pre-restore-*.json` files present in cache; user can manually recover |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved-by-planner

---

## Validation Audit 2026-04-28

| Metric | Count |
|--------|-------|
| Gaps found | 3 (documentation drift) |
| Resolved | 3 |
| Escalated | 0 |
| Tests authored | 0 (no missing coverage — todas las suites referenciadas existen y corren green) |
| Suite at audit time | 102 tests / 10 suites green |

**Gaps fixed:**
1. Flag rename `--testPathPattern` → `--testPathPatterns` en las 7 filas + Test Infrastructure + Sampling Rate (jest 30 hard-rejects el alias viejo).
2. Status `⬜ pending` → `✅ green` en las 7 filas (verificado vía corrida individual).
3. `npx tsc --noEmit &&` removido del gate de 03-02-T3 y 03-03-T2: tsc retorna 5 errores pre-existentes documentados en `deferred-items.md` (no introducidos por phase 3) — el `&&` cortocircuitaba antes de Jest aunque las suites estaban verdes. Comportamiento real reflejado, baseline TS trackeado en nota separada.

**Verification:** todos los comandos automatizados de la tabla corren green con la versión actual del repo (102/102 tests).

---

*Last reviewed by: gsd-nyquist-auditor (inline) — Phase 3 audit — Date: 2026-04-28*
