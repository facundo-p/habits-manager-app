# Cozy Habits — Lecciones aprendidas

## Patrones a seguir

### setState asíncrono en React
**Lección:** Nunca leer estado justo después de un setter — el valor aún no actualizó.
**Ejemplo del bug:** En `StatsScreen.goToPrev()`, se evaluaba `if (month === 1)` DESPUÉS de llamar `setMonth()`. El año nunca decrementaba.
**Regla:** Cuando un efecto depende del valor nuevo, calcular primero, actualizar después.

```ts
// ❌ Incorrecto
setMonth((m) => (m === 1 ? 12 : m - 1));
if (month === 1) setYear((y) => y - 1); // month aún es el viejo

// ✅ Correcto
if (month === 1) setYear((y) => y - 1);
setMonth((m) => (m === 1 ? 12 : m - 1));
```

---

### Operaciones de DB destructivas sin transacción
**Lección:** Cualquier secuencia de writes (DELETE + INSERT) debe estar en una transacción.
**Riesgo:** Si falla en el paso N, la DB queda en estado inconsistente.
**Regla:** Usar `db.withTransactionAsync()` para todas las operaciones de restore/import.

---

### Funciones duplicadas entre archivos
**Lección:** `safeParseJson`, `parseCategories` y `buildStats` aparecieron en 3+ archivos cada una.
**Regla:** Si una función aparece en más de un archivo → mover a `src/utils/`.
**Archivos de utils creados:**
- `src/utils/parsing.ts` → `parseJsonArray()`
- `src/utils/statsHelpers.ts` → `buildStats()`
- `src/utils/dateHelpers.ts` → `formatTodayDate()`, `formatHistoricDate()`, `isValidDateString()`

---

### Inline styles con valores dinámicos
**Lección:** `style={{ color: fn(x) }}` y `style={{ backgroundColor: color }}` son inline styles.
**Regla:** Crear funciones `*Style(param): ViewStyle | TextStyle` en el `.styles.ts` del componente.
```ts
// ❌ Incorrecto
<Text style={{ color: heatmapTextColor(pct) }}>

// ✅ Correcto — helper en styles.ts
export function heatmapTextStyle(pct): TextStyle { return { color: heatmapTextColor(pct) }; }
<Text style={heatmapTextStyle(pct)}>
```

---

### Truthy check de string para validación de fecha
**Lección:** `!!viewDate` es `true` para cualquier string no vacía, incluidas fechas malformadas.
**Regla:** Usar regex explícita para validar formato `YYYY-MM-DD`:
```ts
export function isValidDateString(s): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
```

---

### `as any` en navegación
**Lección:** El uso de `as any` en `navigate()` y `setParams()` oculta errores de tipo en tiempo de compilación.
**Causa raíz:** `RootTabParamList` tipaba `Hoy: { date?: string } | undefined`, lo que impedía `setParams`.
**Regla:** Tipar params de screen como `{ date?: string }` (sin `| undefined`) para permitir `setParams` parcial.

---

### Componentes duplicados en modales
**Lección:** `AreaPicker` y `MicButton` eran casi idénticos en múltiples modales.
**Regla:** Sub-componentes compartidos entre 2+ modales → `src/components/shared/`.

---

### Locale hardcodeado
**Lección:** `'es-AR'` estaba hardcodeado en `useSpeechRecognition`.
**Regla:** Siempre leer configuración de idioma desde el store y mapear a locale.
```ts
const LOCALE_MAP = { es: 'es-AR', en: 'en-US' };
const locale = LOCALE_MAP[language] ?? 'es-AR';
```

---

### Codemod-before-migration (Phase 1 v1.1, 2026-05-15)
**Lección:** Renames y refactors cross-cutting (codemod) deben preceder migraciones de schema en una wave aislada. En Phase 1, Plan 02 (codemod date helpers) terminó antes de Plan 04 (migration v2). Mezclarlos hubiese duplicado el blast radius y producido diffs no-revisables.
**Indicador concreto:** Plan 02 introdujo `getLocalDayKey()` y eliminó `new Date().toISOString().slice(0,10)`. Plan 04 después pudo importar `getLocalDayKey` desde día 1 sin tocar nada de date.
**Regla:** Para futuras phases que mezclen refactor cross-cutting + migration de schema, separar en wave N = codemod, wave N+1 = migration. Permite PRs independientes, revisables, fácilmente revertibles.

---

### Verificar disponibilidad de test infra deps en RESEARCH stage (Phase 1 v1.1, 2026-05-15)
**Lección:** El planner asumió A5 (`@testing-library/react-native` available) en el research stage. Al ejecutar Plan 03, grep al `package.json` reveló que la dep NO existía. Resultado: FOUND-02 unit test degradó a UAT visual, y Plan 05 tuvo que extraer un scheduler puro (Option B) para testear el hook sin renderHook.
**Indicador concreto:** Plan 03 y Plan 05 ambos pivotearon su test strategy durante ejecución, no durante planning.
**Regla:** RESEARCH stage debe ejecutar `cat package.json | grep <dep>` (o equivalente lockfile check) para CADA test infra dep asumida — no solo declararla en Assumptions Log. Si la dep falta, surfacear cost-of-adding vs. cost-of-degrading antes de lock-in.

---

### Atomic commit boundary para schema+backup bumps (Phase 1 v1.1, 2026-05-15)
**Lección:** Plan 04 entrega migration v2 + `BACKUP_VERSION = 2` en **un único commit**, excediendo el cap de 400 LOC documentado en `feedback_git_workflow.md`. Razón: separarlos abriría una ventana donde `restoreData` mapea `mood_entries[]` a una tabla droppeada → crash en runtime.
**Indicador concreto:** Pitfall #4 (atomic boundary) explicitado en el plan + waiver documentado en el PR body.
**Regla:** Cuando un commit cruza un trust boundary entre formato de datos persistidos (backup version) y schema de DB (migration), el cap de LOC se excepciona con documentación explícita. Estos commits requieren extra human review en el PR.

---

### Stacked PRs y auto-retargeting de GitHub (Phase 1 v1.1, 2026-05-18)
**Lección:** Cuando un PR base mergea, GitHub debería re-targetear el head PR a `main` automáticamente. En la práctica, si los merges ocurren muy cerca en el tiempo (segundos/minutos), el retarget falla silenciosamente y el head PR mergea contra su branch base obsoleta — los commits no llegan a main. Ocurrió 2 veces en Phase 1 (#26 → #27, #31 → #32).
**Indicador concreto:** Después de mergear el base, el head PR se mantiene "ahead of main" pero su mergeCommit landea en la branch base, no en main.
**Regla:** Para plans paralelizables (sin deps de código entre ellos), preferir abrir cada PR rooted off main directamente (cherry-pick si necesario), NO stacked. Stacked PRs solo cuando la dep es estricta y el primer PR está listo para merge ANTES de abrir el segundo. Después de mergear un base PR, verificar que el head PR tenga base correcta antes de mergearlo.
