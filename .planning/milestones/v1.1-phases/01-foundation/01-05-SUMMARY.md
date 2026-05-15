# Plan 05 — Summary (Wave 4)

**Phase:** 01-foundation · **Wave:** 4 · **Plan:** 05 — drafts repo + autosave hook + dev harness
**Status:** ✅ executed · **Date:** 2026-05-15 · **Branch:** `feat/v1.1-phase-1-foundation`
**Requirements:** FOUND-05 · **Decisions:** D-04 (debounce 500ms)
**Depends on:** Plan 01 (test infra), Plan 04 (drafts table)

---

## Files created

| File | Purpose |
|---|---|
| `src/repositories/draftsRepository.ts` | 4 funciones tontas: `upsert`, `find`, `deleteOne`, `purgeOlderThan`. SQL constants al tope; cada función ≤ 10 líneas. |
| `src/hooks/useDraftAutosave.ts` | Hook + `createDraftAutosaveScheduler` pura (Option B del plan): scheduler aislado en función testable con fake timers — el hook envuelve. |
| `src/components/dev/DraftHarnessModal.tsx` | Dev-only modal gateado por `__DEV__`, consume `useDraftAutosave` con un `TextInput` controlado. Botones "Limpiar draft" y "Cerrar". |
| `src/components/dev/DraftHarnessModal.styles.ts` | NativeWind classes parametrizadas desde theme (sin inline styles). |

## Files modified

| File | Change |
|---|---|
| `src/services/db.ts` | + `purgeStaleDrafts()` con cutoff 7d (silent failure). Llamado desde `initDatabase` post-`runMigrations`, post-`cleanupPreV2Snapshots`, pre-`sanitizeCategories`. |
| `src/screens/SettingsScreen.tsx` | + Sección "Dev tools" gateada por `__DEV__` con row "Dev — Draft harness" que abre el modal. |
| `src/__tests__/drafts.test.ts` | 7 todos → **9 real tests** (5 repo + 4 scheduler). |

## Hook usage snippet (Phase 2 / Phase 4)

```tsx
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import { getLocalDayKey } from '../utils/date';

function MorningCheckIn() {
  const [mood, setMood] = useState(MOOD_DEFAULT_VALUE);
  const [sleep, setSleep] = useState(7);
  const [comment, setComment] = useState('');

  useDraftAutosave('morning', getLocalDayKey(), { mood, sleep, comment });
  // → debounce 500ms; al desmontar, cleanup cancela timer pendiente.
  // → no upsert si payload no cambió (deep-equal vía JSON.stringify).
}
```

Custom debounce: `useDraftAutosave('weekly', weekKey, payload, { debounceMs: 1000 })`.

## Decisión: Option B (scheduler extraído)

`@testing-library/react-native` confirmado **no instalado** (research A5). Opción A (`renderHook`) requeriría agregar la dep. Opción B (extraer la lógica del debounce a una función pura `createDraftAutosaveScheduler` que el hook envuelve) cumple:

- D-CLAUDE "separar lógica y presentación".
- Tests con fake timers + upsertFn mockeado, sin renderizar componentes.
- Hook permanece minimalista (~20 líneas).

Trade-off aceptado: el cleanup en unmount no se prueba contra un componente real, sino contra `scheduler.cancel()`. Si surge un bug del lifecycle de React, se complementa en Phase 2 cuando un surface real consuma el hook.

## Tests populated

**`drafts.test.ts` — repo (5 tests):**

1. `upsert + find` round-trip preserva `payload_json` + `updated_at` ISO.
2. UNIQUE(kind, key): segundo upsert overwrites, 1 row total.
3. `deleteOne` remueve la row, siguiente `find` retorna `null`.
4. `purgeOlderThan(cutoff)`: el de 8d se borra, el de 2d sobrevive.
5. Boot integration: `initDatabase()` invoca `purgeOlderThan` con cutoff exacto = `now - 7d`.

**`drafts.test.ts` — scheduler (4 tests):**

6. Debounce 500ms: 3 `schedule` en ventana → 1 upsert con el último payload.
7. No-op si `payloadJson` no cambió (deep-equal vía JSON string).
8. `cancel()` cancela timer pendiente → 0 upserts.
9. Custom `debounceMs: 1000` → tras 500ms no escribe, tras 1000ms sí.

## Verification log

- ✅ `npm test -- --testPathPatterns=drafts` → 9/9 passing.
- ✅ `npm test` (full suite) → 19 suites passed, **188 tests (0 todos remaining)**. Plan 04 dejaba 7 todos en drafts.test.ts; ahora cerrados.
- ✅ `npx tsc --noEmit` → 2 errores TS pre-existentes inalterados (LinearGradient, parsing.ts).
- ✅ Harness gateado por `__DEV__` — production build no incluye el código del modal (verificable vía Metro bundler tree-shake, manual UAT en Wave 7).

## Threat dispositions

| Threat | Disposition |
|---|---|
| T-05-01 (drafts en plano sobreviven a uninstall via OS auto-backup) | accept — Android sandbox sin `allowBackup=true` explicit; documentar en Plan 08 si aplica. |
| T-05-02 (timer no se cancela en unmount → upsert post-unmount con state stale) | mitigated — Test 8 cubre `cancel()`; el hook llama `cancel` en cleanup. |
| T-05-03 (purge falla → tabla crece) | accept — natural cap (1 row por surface activa); purge silent fail solo loga warn. |

## Downstream contracts unlocked

- **Phase 2 surfaces** (morning, evening, note) consumen `useDraftAutosave` directo.
- **Phase 4 weekly review** idem con `weekly` kind + week_key.
- **UAT Scenario 3** (Wave 7): el dev harness es el surface mínimo para validar "draft sobrevive force-kill" en APK standalone.

## Build & UAT notes

- Build dev APK con la skill `build-apk-local` (`eas build --local`).
- Entry-point: Settings → bajo "Seguridad y Datos" aparece sección **"Dev tools"** (solo `__DEV__`) → row **"Dev — Draft harness"**.
- UAT Scenario 3 paso a paso ya documentado en `01-HUMAN-UAT.md`.
