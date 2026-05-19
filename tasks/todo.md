# Cozy Habits — Task Board

## En progreso

### REVIEW.md — Resolución de issues por severidad

**Reglas de trabajo:**
- Cada batch tiene su propia branch y PR
- Trabajar de forma autónoma hasta que el PR esté listo para Code Review
- Documentar asunciones en el cuerpo del PR
- Convención de branch: `fix/mr-N-<slug>` para Medium, `fix/lr-N-<slug>` para Low

**HIGH — completado (PRs mergeados):**
- [x] H-01 — `enrichAssignments` performedMap (CERRADO sin fix — mitigated)
- [x] H-02 — `useSpeechRecognition` stale closure → PR #4 mergeado
- [x] H-03 — Drive query injection → PR #5 mergeado
- [x] H-04 — Legacy dead code (markHabitDone, unmarkHabit, etc.) → PR #6 mergeado

**MEDIUM — pendiente (batches de 5):**

- [x] **MR-1** (branch: `fix/mr-1-dead-code-purge`) — M-01, M-02, M-03, M-04, M-05 → PR #13
  - M-01: Eliminar funciones repo legacy: `findDailyActive`, `sumDailyActivePoints`, `sumEarnedByDayInMonth`, `findHabitIdsOnDate`, `countByHabitAndDate` (habitRepository.ts, taskRepository.ts, assignmentRepository.ts), y `hasDailyAssignmentsTable` (db.ts)
  - M-02: Eliminar `progressFillWidth` de `DailySheetScreen.styles.ts:85`
  - M-03: Eliminar `triggerLight` de `useFeedback.ts:20-25`
  - M-04: Documentar `nextDay` en `assignmentService.ts:382` con `// exported for unit tests` o mover a `utils/dateHelpers.ts`
  - M-05: Resolver `void getPeriodKey` workaround en `assignmentService.ts:17-22` — opción (b): eliminar import + documentar dependencia conceptual en comentario inline

- [x] **MR-2** (branch: `fix/mr-2-duplication-refactor`) — M-06, M-07, M-08, M-09, M-10 → PR #14
  - M-06: Centralizar `new Date().toISOString().slice(0,10)` → importar `getTodayPrefix` en los 4 sites que lo reimplementan (SettingsScreen:119,181 / RestoreFromDriveScreen:126 / driveBackupService:182). Mover `formatDateStr` y `formatDateOnly` a `utils/dateHelpers.ts`.
  - M-07: Extraer `useIsMounted` hook en `src/hooks/useIsMounted.ts`, reemplazar en SettingsScreen y RestoreFromDriveScreen
  - M-08: Extraer el while-loop de `checkAndBackfillHistory` (~21 líneas) a helper `backfillRange(start, end)` para bajar la función a <20 líneas
  - M-09: Extraer handlers de DailySheetScreen a `useDailySheetHandlers` y/o subcomponentes a archivos dedicados; idem SettingsScreen con `useDriveActions`
  - M-10: Agregar validación de version en `backupService.ts:103` — rechazar si `data.version > BACKUP_VERSION`

- [x] **MR-3** (branch: `fix/mr-3-arch-design`) — M-11, M-12, M-13, M-14, M-15 → PR #15
  - M-11: Documentar `migrateSchema` como "legacy pre-versioning" en comentario inline en `db.ts:132-142`
  - M-12: Eliminar casts `as 'Hoy'` / `as 'Biblioteca'` en navigation — crear wrapper o tipar ROUTES correctamente
  - M-13: Documentar la excepción de capa en CONVENTIONS.md ("Drive ops son stateless — los screens los llaman directamente")
  - M-14: Extraer `assertValidCategories(categories, context)` a `utils/validation.ts` (o `utils/parsing.ts`) y reemplazar los 3 call sites en habitService y assignmentService
  - M-15: Reemplazar `Dimensions.get('window')` al import-time en `BottomSheet.styles.ts` por `useWindowDimensions()` dentro del componente

- [x] **MR-4** (branch: `fix/mr-4-stats-bug`) — M-16 → PR #16
  - M-16: Fix `goToPrev`/`goToNext` en StatsScreen — combinar setYear+setMonth en updater funcional para evitar race condition en double-tap

**LOW — pendiente (batches de 5):**

- [x] **LR-1** (branch: `fix/lr-1-debug-artifacts`) — L-01, L-02, L-03, L-04, L-05 → PR #17
  - L-01: Limpiar comentarios `BUG-04`/`D-03` etc. en assignmentService — mantener solo explicación funcional
  - L-02: Envolver `console.log('DB inicializada...')` en `App.tsx:112` con `if (__DEV__)`
  - L-03: Verificar que jest.setup.ts silencia console.warn de `assertNoDuplicatesIfDev`
  - L-04: Eliminar el único `console.log` informativo (el de App.tsx:112, ya cubierto por L-02)
  - L-05: Documentar `voiceDictationEnabled` con `// TODO: expose toggle in Settings (Phase 5)`

- [x] **LR-2** (branch: `fix/lr-2-constants-style`) — L-06, L-07, L-08, L-09, L-10 → PR #18
  - L-06: Documentar `setLanguage` con `// Settings UI pending (Phase 5)`
  - L-07: Ampliar `iconDefaults` en `ui.styles.ts` con tamaños semánticos (`small: 16, medium: 18, default: 22`) y reemplazar literales en los sites listados
  - L-08: Mover `MONTHS_ES` de `dateFormat.ts` a `constants.ts` como `MONTH_NAMES_SHORT`, actualizar import
  - L-09: Eliminar `nativeStyles` vacío de `SettingsScreen.styles.ts:66-70`
  - L-10: Dejar `formatMeta` como está (solo refactor si surge segundo caller)

- [ ] **LR-3** (branch: `fix/lr-3-robustness`) — L-11, L-12, L-13, L-14, L-15
  - L-11: Agregar guard defensivo en `app.config.js` para `android.package` / `ios.bundleIdentifier`
  - L-12: Mover `BACKGROUND_IMAGE_URI` a asset local en `assets/background.jpg`
  - L-13: Extraer `formatRestoreSuccessMessage` y `formatRestoreConfirmMessage` a `utils/` para los Alert.alert de RestoreFromDriveScreen
  - L-14: Documentar comportamiento de re-seed en `db.ts:207` con comentario (aceptar comportamiento — opción b)
  - L-15: Tipar `AREAS_MAP` como `Record<HabitAreaId, HabitArea>` en `constants.ts`

- [ ] **LR-4** (branch: `fix/lr-4-style-cleanup`) — L-16, L-17, L-18
  - L-16: Reemplazar `nativeStyles.archivedWrapper = { opacity: 0.5 }` por clase Tailwind `opacity-50` en HabitLibraryScreen
  - L-17: Mejorar documentación del `__DEV__ ?? true` pattern en assignmentService
  - L-18: Documentar convención `void` vs `.then()` en CONVENTIONS.md

## Pendiente (backlog original)

- [ ] Persistencia de settings con AsyncStorage (useSettingsStore)
- [ ] Agregar tests para servicios críticos (habitService, assignmentService, backupService)

## Phase 1 v1.1 — Review (closed 2026-05-18)

8 plans merged a main: PRs #25 (Plan 01), #27 (Plan 03), #28 (Plan 02), #29 (Plan 04), #30 (Plan 05), #32 (Plan 06), #33 (Plan 07). Plan 08 (este) cierra la wave docs.

### What worked
- **Codemod date helpers en una wave aislada (Plan 02)**: low blast radius; full suite verde al primer intento post-fix de un missed call site. La separación codemod-before-migration evitó mezclar concerns.
- **migrationV2 reusando template de migrationV1**: pattern probado, el atomic transaction + assertion pattern transfirió sin sorpresas.
- **Wave 0 de tests skeleton (Plan 01)** previno tasks RED-MISSING en waves siguientes (Nyquist compliance). Cada wave consumió todos `it.todo` predefinidos.
- **Option B scheduler extraído en useDraftAutosave (Plan 05)** permitió testear debounce con fake timers sin `@testing-library/react-native`. Pattern reusable en futuros hooks.
- **`bootSequence` deps inyectables (Plan 06)** simplifica los tests vs. mockear módulos enteros.

### What was bumpy
- **`@testing-library/react-native` no instalado** (research A5 confirmed missing): degradó FOUND-02 UI test a UAT; planner pivoteó al pure scheduler extraction como mitigación.
- **Pre-v2 snapshot + buildV1Snapshot** requirió preservar SQL legacy `readAllMoods` temporalmente con table-exists guard — tradeoff aceptado.
- **Plan 04 atomic commit boundary** + ~1500 LOC: excede 400-LOC cap, pre-autorizado por Pitfall #4. El PR necesitó documentación extra del waiver.
- **GitHub no auto-retargeteó PRs stacked** (incidentes #26 → #27, #31 → #32): perdimos tiempo abriendo PR de reemplazo. Patrón a evitar: cuando el PR base mergea casi al mismo tiempo que el head, retarget puede fallar. Workaround documentado: separate-branch off main para Plan paralelizables (e.g., Plan 07).

### Deferred
- **UAT manual con APK real** (Scenarios 1/2/3 del `01-HUMAN-UAT.md`) — usuario autorizó saltar para Plan 06 y Plan 08; confiamos en unit tests para shipping. Pendiente ejecutar antes del primer release v1.1 a usuarios.
- **Full embedded restore flow desde MigrationErrorScreen** — Phase 1 minimal entrega Alert con guidance; embedded restore (snapshot pre-v2 + Drive desde error state) queda para Phase 2+.
- **`__DEV_FORCE_MIGRATION_FAIL` persistente** — in-memory, se resetea con force-kill. Para validar Retry-Fail-Retry consecutivos se requeriría AsyncStorage. No bloqueante para Phase 1.

## Completado

### Refactor & Deuda técnica (2026-03)
- [x] Fix bug: navegación de mes en StatsScreen (goToPrev/goToNext invertidos)
- [x] Fix bug: clearAllTables sin transacción → rollback atómico con withTransactionAsync
- [x] Crear `src/utils/parsing.ts` — unificar safeParseJson/parseCategories
- [x] Crear `src/utils/statsHelpers.ts` — unificar buildStats()
- [x] Crear `src/utils/dateHelpers.ts` — formatTodayDate, formatHistoricDate, isValidDateString
- [x] Extraer `src/components/shared/AreaPicker.tsx` — eliminar duplicado en HabitFormModal y SpontaneousModal
- [x] Extraer `src/components/shared/MicButton.tsx` — extraído de ReflectionModal
- [x] Fix isHistoric: reemplazar `!!viewDate` por `isValidDateString(viewDate)`
- [x] Fix fetchHabitsForDate(null) → pasar fecha explícita en SettingsScreen
- [x] Fix locale hardcodeado en useSpeechRecognition → leer desde useSettingsStore
- [x] Fix as any en AppScreenHeader (navigate) y DailySheetScreen (setParams)
- [x] Eliminar inline styles: badgeContainerStyle() en DailySheetScreen, heatmapTextStyle() en StatsScreen
- [x] Eliminar inline style override en HabitFormModal.AreaPicker (chip.innerBase/innerSelected)
- [x] Agregar try-catch en operaciones async de useHabitStore
- [x] Fix animación de BottomSheet al ocultar (Animated.timing en lugar de setValue)
