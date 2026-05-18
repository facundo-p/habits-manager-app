# Plan 06 — Summary (Wave 5)

**Phase:** 01-foundation · **Wave:** 5 · **Plan:** 06 — MigrationErrorScreen + bootSequence
**Status:** ✅ executed (manual smoke deferred per user authorization) · **Date:** 2026-05-18 · **Branch:** `feat/v1.1-phase-1-foundation`
**Requirements:** FOUND-03 · **Decisions:** D-05
**Depends on:** Plan 04 (migration v2 + throw propagation)

---

## Files created

| File | Purpose |
|---|---|
| `src/services/bootSequence.ts` | Orchestrator testeable extraído de App.tsx. Exporta `bootSequence({ initDatabase, checkAndBackfillHistory })` y el discriminated-union `MigrationState`. Política: init falla → `'failed'`; backfill falla → `'ok'` + warn (non-blocking). |
| `src/components/screens/MigrationErrorScreen.tsx` | Pantalla bloqueante con copy empático, dos botones (Retry primario, Restore secundario), y dev-only error.message en la base. |
| `src/components/screens/MigrationErrorScreen.styles.ts` | StyleSheet nativo (NO NativeWind — el screen tiene que renderizar incluso si NativeWind/fonts no están listos). Colores desde theme existente. |
| `src/__tests__/bootSequence.test.ts` | 4 tests: happy path · init reject → failed · backfill reject → ok + warn · PII-leak guard (T-04-01/T-06-01). |

## Files modified

| File | Change |
|---|---|
| `App.tsx` | Reemplaza el doble useEffect de init+backfill por `useCallback runBoot()` que invoca `bootSequence`. State `migrationState`. Conditional render: `pending` → spinner; `failed` → `MigrationErrorScreen`; `ok` → NavigationContainer. Restore handler muestra Alert con instrucciones accionables (Phase 1 minimal). |
| `src/services/migrations/migrationV2.ts` | + `__DEV_FORCE_MIGRATION_FAIL: { value: false }` exportado. Dentro del transaction, `if (__DEV__ && __DEV_FORCE_MIGRATION_FAIL.value) throw ...` permite el UAT (T-06-02 mitigated por el guard `__DEV__`). |
| `src/screens/SettingsScreen.tsx` | Nuevo `ToggleRow` "Forzar fallo de migration v2 (UAT)" en la sección Dev tools (existente, gateada por `__DEV__`). |
| `jest.config.js` | + `globals: { __DEV__: false }`. React Native injecta `__DEV__` en runtime; jest no, por lo que los guards `if (__DEV__ && ...)` en código compartido (migrationV2) lo necesitan definido para no throw `ReferenceError` durante tests. |

## Architecture decisions surfaced during execution

### Restore desde MigrationErrorScreen — diferido a iteración futura

El plan propuso una `RestoreOptionsScreen` que listara (a) snapshot pre-v2 local y (b) Drive restore. Al implementar surgió la complejidad:

1. El NavigationContainer está bloqueado mientras `migrationState === 'failed'` (por D-05).
2. `RestoreFromDriveScreen` y `SettingsScreen` dependen del NavigationContainer.
3. Restore desde Drive además necesita: el snapshot CREATE de tablas v2 ANTES del insert (porque la migration v2 rolled back y mood_log no existe).

**Decisión Phase 1:** el botón "Restaurar desde backup" muestra un Alert con guidance accionable (cerrar pantalla → reintentar → usar Ajustes → Importar respaldo). El snapshot pre-v2 local sigue accesible vía file manager (`pre-v2-snapshot-*.json`). Suficiente para que el usuario tenga camino de recuperación.

**Phase 2+:** implementar un flow embebido (mini NavigationContainer scope al error state) que (a) liste snapshots locales con tap-to-restore y (b) ofrezca Drive con auth. Requiere también ensure-v2-schema antes de restore para que `restoreAllData` no crashee.

UAT Scenario 2 (Wave 7) sigue verificable: la assertion clave es que el botón **existe** y el flow Retry funciona end-to-end. El Restore se reduce a "ve el alert con guidance".

### `__DEV_FORCE_MIGRATION_FAIL` ubicado en migrationV2.ts

Exportado como objeto mutable `{ value: boolean }` (no `let` exportado, que no se puede reasignar across modules). Settings importa la ref y muta `.value`. El guard `if (__DEV__ && __DEV_FORCE_MIGRATION_FAIL.value)` lo hace no-op en production builds (Metro tree-shake elimina la rama).

### `bootSequence` deps inyectables

Anti-patrón evitado: el módulo NO importa `initDatabase` ni `checkAndBackfillHistory` directos. Las acepta como parámetros. Tests mockean sin tener que mockear los módulos enteros (no más `jest.mock('../services/db')`).

## Verification log

- ✅ `npm test -- --testPathPatterns=bootSequence` → 4/4 passing.
- ✅ `npm test` (full suite) → 20 suites passed, 192 tests, 0 failures, 0 todos.
- ✅ `npx tsc --noEmit` → 2 errores TS pre-existentes inalterados (LinearGradient, parsing.ts).
- ⏸️ **Manual smoke test deferred** — usuario autorizó saltar el UAT manual con APK (`build-apk-local`) por confianza en los unit tests. UAT Scenario 2 queda para Wave 7 (Plan 08).

## Threat dispositions

| Threat | Disposition |
|---|---|
| T-06-01 (`error.message` mostrado puede incluir schema details) | mitigated — solo `error.message` (no raw `error`), texto chico, gated por `__DEV__`. En production builds no se muestra. |
| T-06-02 (`__DEV_FORCE_MIGRATION_FAIL` accesible en prod → DoS) | mitigated — toda lectura del flag está bajo `if (__DEV__)`. La constante existe pero su efecto es no-op en prod. |

## Build & UAT notes

**Entry point del dev fail flag:**

Ajustes → "Dev tools" (visible solo en builds dev) → toggle "Forzar fallo de migration v2 (UAT)".

**UAT Scenario 2 path (cuando se ejecute en Wave 7):**

1. APK dev instalado, app abierta hasta Home.
2. Ajustes → Dev tools → activar toggle.
3. Force-kill app + reabrir.
4. Verificar: MigrationErrorScreen visible con headline empático, dos botones, dev-only error.message.
5. Tap "Reintentar migración" → vuelve a fallar (flag sigue ON in-memory, pero después del force-kill la migration ya está en v2... requiere ajustar UAT: el flag se resetea por el kill, así que el retry SUCCEEDS y vuelve al Home. Para forzar más fallos se necesita togglear desde el dev menu antes de cada kill).
6. Tap "Restaurar desde backup" → Alert con instrucciones (Phase 1 minimal — documented).

**Caveat operacional UAT:** el flag in-memory se pierde con force-kill. Para validar el flow Retry-Fail-Retry se necesita un mecanismo persistente (e.g. AsyncStorage). **Diferido a Phase 2** si se considera necesario; Phase 1 valida el render del error screen + el retry exitoso.

## Downstream contracts

- **Plan 08 / Wave 7** ejecuta UAT Scenario 2 contra este screen.
- **`build-apk-local` skill** se usa para producir el APK del UAT.
- Esta wave **desbloquea el ship de v1.1**: sin Plan 06, una migration v2 fallida crashea la app (warning del PR #29 ahora resuelto).
