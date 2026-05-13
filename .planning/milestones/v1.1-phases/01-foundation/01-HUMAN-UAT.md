# Phase 1 — Human UAT Scenarios

**Run:** at end of Wave 7 (before /gsd-verify-work).
**Build flavor:** `eas build --local` (Android APK) — per MEMORY/`build-apk-local` skill. NO usar Expo Go para D-05 (force-kill test requiere standalone build).

---

## Scenario 1 — FOUND-06: Habit reflection paridad (per D-03)

**Goal:** El flow de habit completion + reflection sigue idéntico desde la perspectiva del usuario.

**Pre-conditions:**
- App en versión post-Wave-5 (migration v2 aplicada).
- Al menos 1 hábito activo en Home.

**Steps:**
1. Tap un hábito desde Home → ReflectionModal abre.
2. Mover slider de mood a 7.5 — verificar que el número muestra "7.5" arriba del slider (mismo visual que pre-refactor).
3. Escribir comentario "Test paridad post-MoodPicker" en el TextInput.
4. Tap "Guardar reflexión".
5. Verificar: toast/feedback de éxito + puntos del hábito sumados al total visible en Home.

**Assertions:**
- [ ] Visual del modal idéntico a pre-refactor (label "¿Cómo te sientes?", value, slider, comentario, Guardar/Omitir).
- [ ] Points awarded === base_points del hábito (no cambia).
- [ ] Abrir DB (via dev tool o backup export JSON) → existe row en `mood_log` con kind='reflection', habit_id=<id>, mood_value=7.5, comment="Test paridad...", mood_scale_version='v1'.
- [ ] La row NO existe en `mood_entries` (tabla droppeada).

---

## Scenario 2 — D-05: Migration error screen + Restore + Retry

**Goal:** Si la migration v2 falla, la app muestra MigrationErrorScreen bloqueante con Restore + Retry funcionales.

**Pre-conditions:**
- Build standalone (APK) con dev flag `__DEV_FORCE_MIGRATION_FAIL` expuesto (Wave 5 lo agrega).
- App fresh install (sin migration v2 aplicada) — o resetear `user_version` a 1 via dev hook.

**Steps:**
1. Habilitar flag dev → cerrar app.
2. Abrir app → migration v2 dispara, `__DEV_FORCE_MIGRATION_FAIL` throws desde dentro del transaction.
3. Verificar: en lugar del Home, aparece MigrationErrorScreen con texto "No se pudo actualizar la base de datos.".
4. Verificar: botones "Restaurar desde backup" y "Reintentar migración" visibles.
5. Tap "Reintentar migración" → flag dev sigue activo → vuelve a fallar → mismo screen.
6. Deshabilitar flag (dev override) → tap "Reintentar migración" otra vez → migration completa OK → Home renderiza.

**Assertions:**
- [ ] La pantalla bloquea acceso al NavigationContainer (no se puede swipe-back ni acceder a otros screens).
- [ ] Tap "Restaurar desde backup" abre el flow de restore (Drive o pre-v2 snapshot local, según Wave 5 UX).
- [ ] El snapshot pre-v2 está presente en `${FileSystem.documentDirectory}/pre-v2-snapshot-*.json` (verificable con dev file viewer).
- [ ] Retry funciona luego de remover la condición de fallo.

---

## Scenario 3 — FOUND-05: Draft survives app kill

**Goal:** Un draft autosaved sobrevive un force-kill del proceso de la app.

**Pre-conditions:**
- Build standalone (APK) — Wave 4 (Plan 05) entrega `DraftHarnessModal` dev-only (gateado por `__DEV__`, entry-point en Settings). Este scenario consume ese harness.

**Steps:**
1. Settings → "Dev — Draft harness" → abre el harness modal.
2. Escribir "Texto borrador no submiteado".
3. Esperar 600ms (>500ms debounce) — el draft se escribe a SQLite.
4. Force-kill app desde recent apps tray.
5. Reabrir app → Settings → "Dev — Draft harness" → debería mostrar el texto restaurado.

**Assertions:**
- [ ] El texto "Texto borrador no submiteado" aparece prepoblado en el TextInput.
- [ ] SQLite query `SELECT * FROM drafts WHERE kind='harness'` muestra 1 row con payload_json conteniendo el texto.

**Defer condition:** Ninguna — el dev harness es mandatorio en Plan 05 Task 3. Si por algún blocker técnico el harness no puede entregarse en Phase 1, escalar al usuario antes de cerrar Wave 4 (NO diferir silenciosamente).

---

## Sign-off

- [ ] Scenario 1 ✓
- [ ] Scenario 2 ✓
- [ ] Scenario 3 ✓ (mandatorio en Phase 1)

**Tester:** ________  **Date:** ________  **APK build SHA:** ________
