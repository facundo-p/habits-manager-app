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
