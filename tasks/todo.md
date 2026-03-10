# Cozy Habits — Task Board

## En progreso

_(vacío)_

## Pendiente

- [ ] Persistencia de settings con AsyncStorage (useSettingsStore)
- [ ] Agregar tests para servicios críticos (habitService, assignmentService, backupService)

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
