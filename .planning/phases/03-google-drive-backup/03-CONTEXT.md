# Phase 3: Google Drive Backup - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Backup y restore manual de los datos del usuario (habits, daily_assignments, performed_habits, mood_entries) hacia/desde Google Drive, con autenticación OAuth Google nativa y errores accionables. Drive actúa como transporte sobre el `backupService` existente (serialización JSON ya resuelta por Phase 2).

**Incluido:** OAuth con Google (silent sign-in + sign-in/sign-out), upload manual a Drive, lista de backups, restore con confirmación, retención automática de archivos, manejo de errores con mensajes accionables, indicador de progreso durante operaciones largas.

**No incluido (deferred / out of scope):** backup automático periódico (V2), backup encryption (V2), diff de datos en restore, multi-cloud (Dropbox/iCloud — out of scope del milestone), sync bidireccional real-time (out of scope), import desde otras apps (out of scope).

</domain>

<decisions>
## Implementation Decisions

### Decisiones pre-cerradas (carryover de STATE.md / ROADMAP — no negociables)
- **D-01:** Librería: `@react-native-google-signin/google-signin`. NO usar `expo-auth-session` — issue confirmado en GitHub: no soporta `drive.appdata` scope. Esta decisión sobreescribe el texto literal de `REQUIREMENTS.md` DRIVE-01 ("expo-auth-session con scope drive.file").
- **D-02:** Scope OAuth: `https://www.googleapis.com/auth/drive.appdata`. NO usar `drive.file`. Razones: (a) `appdata` es hidden — los archivos no aparecen en la web de Drive del usuario; (b) no requiere Google security review (el usuario evita esa fricción); (c) cumple el modelo de "backup invisible" que es la intención del feature.
- **D-03:** Arquitectura: nuevo `driveBackupService.ts` actúa como transporte. `backupService.ts` aporta serialización (`buildBackupData`) y deserialización validada (`parseAndValidate`) — ambas son **internas** hoy y se promueven a named exports en este phase. Sin duplicar lógica de DB.
- **D-04:** Tooling: requiere EAS build (development o preview) para testear OAuth nativo. Expo Go NO soporta este flow. Documentar este requisito en plan 03-01 + en `STATE.md` blocker.
- **D-05:** Nombre base de archivo en Drive: `cozyhabits-YYYY-MM-DD.json`. Un único archivo por día (ver D-12).
- **D-06:** Restore = full replace de la DB local. Sin merge, sin conflict resolution. Ya validado en `REQUIREMENTS.md` Out of Scope.
- **D-07:** Backup/restore es **manual** — el usuario presiona el botón. Backup automático periódico es V2 (`DRIVE-V2-01`).

### Auth: persistencia y estado
- **D-08:** Silent sign-in al abrir la app. Llamar `GoogleSignin.signInSilently()` en startup (App.tsx o AppRoot equivalente). Si hay sesión válida, el botón "Backup" queda activo sin click extra; si falla (no hay token, expiró sin posibilidad de refresh), el estado queda "desconectado" y Settings muestra "Conectar con Google". El silent sign-in NO debe bloquear el render inicial — corre en background.
- **D-09:** Estado de auth vive en `useSettingsStore` extendido. Agregar 3 campos persistidos: `googleEmail: string | null`, `lastBackupAt: string | null` (ISO timestamp), `lastBackupFileId: string | null` (Drive file ID del último backup, para optimizar el "sobrescribir el del día"). Reusa el `persist + fileStorage` que ya funciona — NO crear `useAuthStore` separado (YAGNI; v1 tiene 1 sólo provider).
- **D-10:** Sign-out solo limpia token local (`GoogleSignin.signOut()`). NO llamar `revokeAccess()`. Razón: re-conexión silenciosa para el usuario que vuelve a conectar después; menos fricción. Si en V2 el usuario pide "revocar permanentemente", ese caso es separado.
- **D-11:** Sign-out gatillado por botón muestra `Alert.alert` de confirmación (mismo patrón que `ALERT_IMPORT`). Texto: "¿Desconectar tu cuenta de Google? Podés volver a conectarla cuando quieras." con cancel/confirm. Sign-out NO toca `lastBackupAt` ni `lastBackupFileId` (preservar info; se actualiza en próximo backup).

### Estrategia de archivos en Drive
- **D-12:** Un único backup por día. Si ya existe `cozyhabits-YYYY-MM-DD.json` con la fecha de hoy, sobrescribir el contenido (PATCH al `fileId` existente, no crear archivo nuevo). Esto requiere consultar Drive primero para detectar duplicado del día.
- **D-13:** Antes de sobrescribir, mostrar `Alert.alert` de confirmación: "Ya hay un backup de hoy. ¿Reemplazarlo?" — cancel/confirm. Se muestra **siempre** que exista un archivo del día actual (sin lógica condicional por antigüedad). Defensivo contra doble-tap.
- **D-14:** Política de retención tipo Time Machine: preservar últimos 30 backups diarios + 1 backup por mes (el más antiguo de cada mes anterior a los 30 días) + 1 backup por año (el más antiguo de cada año anterior a 12 meses). Pruning corre **después de cada backup exitoso** — listar archivos, calcular cuáles eliminar según la política, hacer `delete()` por cada sobrante. Si el pruning falla, no fallar el backup (log + continuar).
- **D-15:** Lista de backups en UI ordenada por más reciente primero (orden descendente por `createdTime` o nombre del archivo, ambos coinciden por convención de naming).
- **D-16:** Filtrar listado por prefijo `cozyhabits-` y extensión `.json`. Defensivo contra futuros archivos en `appDataFolder` que no sean backups (cache, settings cloud, etc.). Drive permite query `name contains 'cozyhabits-'`.

### Restore: metadata y protección
- **D-17:** Item de la lista de restore muestra: fecha (formateada en español: "27 abr 2026") + tamaño (de Drive listing — gratis, sin fetch). Conteos por tabla (habits, performed_habits, mood_entries, daily_assignments) NO se cargan en la lista — se obtienen al hacer tap del item, en una vista de "preview" antes del modal de confirmación.
- **D-18:** Modal de confirmación de restore muestra: fecha del backup + conteos de items por tabla + warning destructivo. Texto base: "Vas a restaurar el backup del {fecha} ({N} hábitos, {M} completados, {K} moods, {J} assignments). Esto reemplazará todos tus datos actuales. Esta acción no se puede deshacer." Confirm (destructive) / cancel.
- **D-19:** Auto-export local automático antes de aplicar el restore como red de seguridad. Antes de tocar la DB, llamar `buildBackupData()` y escribir a cache: `${FileSystem.cacheDirectory}cozyhabits-pre-restore-${ISO_timestamp}.json`. Se preserva en cache (no se sube a Drive). Mencionar al usuario en el Alert de éxito post-restore: "Tus datos previos quedaron respaldados en el dispositivo por si querés revertir." Si el restore falla a mitad, este archivo es la fuente de truth para rollback (rollback automático no está en scope; el archivo queda accesible).
- **D-20:** Post-restore exitoso: queda en Settings + `Alert.alert` de éxito (mismo patrón actual de `ALERT_IMPORT_SUCCESS`). NO navegar automáticamente a otra pantalla. Stores se refrescan en background (`fetchHabitsForDate`, `fetchLibrary` — igual que en `handleImportConfirm` actual).

### UX de errores y progreso
- **D-21:** Errores de Drive se muestran con `Alert.alert` nativo, mismo patrón que `ALERT_IMPORT_ERROR` / `ALERT_EXPORT_ERROR`. Cada error tiene título + mensaje + acción sugerida. Sin banners/toasts inline (mantener consistencia con el flow existente de import/export).
- **D-22:** Sin auto-retry. El SDK de google-signin refresca tokens internamente al llamar operaciones Drive (esto es transparente). Si la operación falla después del refresh, mostrar Alert con botón "Reintentar" en el Alert (`Alert.alert` acepta múltiples botones) que vuelve a llamar la operación. Predecible y sin loops.
- **D-23:** Durante upload y restore: overlay full-screen tipo Modal transparente con `ActivityIndicator` grande + texto contextual ("Subiendo a Drive...", "Restaurando datos..."). Componente nuevo: `src/components/shared/LoadingOverlay.tsx` (~30 líneas). Bloquea touches automáticamente vía Modal nativo, captura back button de Android. Reusable para futuros casos.
- **D-24:** Listing de backups (cargar la lista) usa spinner inline en el componente de lista (ej: `ActivityIndicator` centrado dentro del FlatList vacío mientras `isLoading`). NO usar el overlay full-screen — la lista típica tarda <1s y bloquear la pantalla es excesivo.
- **D-25:** Si la carga de la lista falla por red, empty state con ícono + texto "No se pudo cargar la lista. Verificá tu conexión." + botón "Reintentar". Sin cache offline de la lista (over-engineering para v1).
- **D-26:** Mapping de errores aprobado (5 categorías + 1 genérico). Texto exacto puede afinarse en el plan, approach es:
  - Sin red → "Sin conexión a internet. Verificá tu red e intentá de nuevo."
  - Token expirado / refresh failed → "Tu sesión expiró. Volvé a conectar tu cuenta de Google."
  - Quota llena (HTTP 403 quotaExceeded) → "Tu Google Drive está lleno. Liberá espacio o usá otra cuenta."
  - Permisos revocados → "Cozy Habits ya no tiene acceso a tu Drive. Reconectá tu cuenta."
  - Genérico → "Algo salió mal. Intentá de nuevo en unos minutos."
  Constantes nuevas en `src/config/constants.ts`: `ALERT_DRIVE_NO_NETWORK`, `ALERT_DRIVE_AUTH_EXPIRED`, `ALERT_DRIVE_QUOTA`, `ALERT_DRIVE_PERMISSION`, `ALERT_DRIVE_GENERIC`.

### Claude's Discretion
- Forma exacta del componente `LoadingOverlay` (tamaño del spinner, color, animation de fade) — seguir tokens visuales existentes (`colors.amber*`, `iconDefaults`).
- Texto literal exacto de los Alerts de error (aprobado el approach + ejemplos; refinar en plan 03-03).
- Estructura interna de `driveBackupService.ts`: orden de funciones, helpers internos para query Drive, mapping de errores HTTP a constantes de `ALERT_DRIVE_*`.
- Estrategia de tests: mockear el SDK de google-signin + cliente Drive (no hacer tests E2E con cuenta real). Tests unitarios para parser/serializer + tests de pure logic para retention policy (calcular qué archivos borrar dadas N entries).
- Cuándo limpiar el cache `cozyhabits-pre-restore-*.json` (D-19): puede ser al próximo restore exitoso, después de N días, o nunca (el user limpia con la app de archivos del sistema). Decidir en plan 03-03.
- Forma exacta del componente de lista de backups (`FlatList` vs `ScrollView`), interacción del preview (modal expandible vs nueva pantalla).
- Setup detallado de Google Cloud Console (SHA-1 fingerprint para Android, OAuth client IDs para iOS y Android, webClientId para idToken). El user ya conoce este requisito (ver `STATE.md` blockers); el plan 03-01 documenta los pasos exactos.
- Si la sección "Cloud backup" en Settings va arriba o abajo de "Seguridad y Datos" actual, o si las dos secciones se fusionan. Decidir en plan 03-03 con snapshot del UI.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements y success criteria
- `.planning/ROADMAP.md` §"Phase 3: Google Drive Backup" — 5 success criteria que deben ser TRUE
- `.planning/REQUIREMENTS.md` §"Google Drive Backup" — DRIVE-01 a DRIVE-08
  - **NOTA:** DRIVE-01 menciona literalmente "expo-auth-session con scope drive.file" — **OBSOLETO**. Las decisiones D-01 y D-02 reemplazan esa redacción (google-signin + drive.appdata). El plan debe seguir las decisiones de este CONTEXT.md, no el texto literal de DRIVE-01.

### Project context
- `.planning/PROJECT.md` — constraints sobre Expo managed workflow + lista de "Validated existing" (no romper)
- `.planning/STATE.md` §"Decisions" + §"Blockers/Concerns" — confirmación de stack google-signin + scope drive.appdata + bloqueos de OAuth setup (SHA-1, webClientId, EAS build)

### Codebase intel relevante
- `.planning/codebase/STACK.md` — Expo 54.0.33, RN 0.81.5, TS 5.9.3, Zustand 5, expo-sqlite 16, expo-file-system 19 (legacy)
- `.planning/codebase/STRUCTURE.md` — layout de services/store/screens/components
- `.planning/codebase/CONVENTIONS.md` — naming, layer separation (Repo CRUD / Service business logic), JSDoc en español, mensajes Alert en `config/constants.ts`
- `.planning/codebase/INTEGRATIONS.md` — patrones de integración con módulos nativos
- `.planning/phases/02-tech-debt/02-CONTEXT.md` D-04 — `parseAndValidate` de `backupService.ts` ya está tipado (sin `as Partial<BackupData>`); base limpia para promover a export

### Archivos a modificar / crear
- `src/services/backupService.ts` — promover `buildBackupData` y `parseAndValidate` a named exports (hoy son internal)
- `src/services/driveBackupService.ts` — **NUEVO** — upload, list (con filtro `cozyhabits-*.json`), download, delete, retention pruning, error mapping
- `src/store/useSettingsStore.ts` — agregar 3 campos (`googleEmail`, `lastBackupAt`, `lastBackupFileId`) + setters; integrar silent sign-in en startup
- `src/screens/SettingsScreen.tsx` — sección nueva "Backup en la nube": botón Conectar/Desconectar, email mostrado, botón "Backup ahora", botón "Restaurar desde Drive", último backup timestamp
- `src/screens/SettingsScreen.styles.ts` — estilos para nueva sección (reusar tokens existentes)
- `src/components/shared/LoadingOverlay.tsx` — **NUEVO** — Modal transparente con spinner + texto contextual
- `src/screens/RestoreFromDriveScreen.tsx` o `src/components/modals/RestoreListModal.tsx` — **NUEVO** — lista de backups con preview + confirm. Forma exacta (screen vs modal) decidir en plan 03-03
- `src/config/constants.ts` — agregar `ALERT_DRIVE_*` (5 errores + genérico), constantes de retención (`RETENTION_RECENT_DAYS = 30`), `BACKUP_FILE_PREFIX = 'cozyhabits-'`
- `app.json` — agregar plugin de `@react-native-google-signin/google-signin`, configuración OAuth client IDs (iOS/Android), agregar a `plugins[]`
- `package.json` — agregar `@react-native-google-signin/google-signin`
- `App.tsx` (o root component) — gancho de silent sign-in en startup (no bloqueante)

### Constantes y utilidades existentes a reusar
- `src/config/constants.ts` — `BACKUP_VERSION`, `BACKUP_FILENAME`, patrón `ALERT_*` (cancel/confirm/destructive)
- `src/services/backupService.ts` — `buildBackupData`, `parseAndValidate` (tras Phase 2 ya tipados y limpios)
- `src/store/useHabitStore.ts` — `fetchHabitsForDate`, `fetchLibrary` (refrescar tras restore)
- `src/components/layout/NotebookPaper.tsx` — wrapper visual usado por las secciones de Settings
- `iconDefaults` (`src/styles/ui.styles.ts`) — `strokeWidth` para íconos lucide

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`buildBackupData()` / `parseAndValidate()`** (backupService.ts): Phase 2 D-04 ya los limpió — sin `any`, sin `as Partial`. Promoverlos a named exports da a Drive una base correcta sin duplicar lógica de DB ni de validación.
- **`useSettingsStore` con `persist + fileStorage`**: ya funciona en producción; agregar 3 campos es bajo riesgo. El `partialize` actual debe extenderse para incluir los nuevos campos.
- **Patrón de Pressable + ActivityIndicator + isLoading state** (SettingsScreen.tsx handleExport/handleImport): replicar exacto para Connect/Backup/Restore en la nueva sección.
- **`Alert.alert` con cancel/destructive** (handleImport): mismo patrón aplica para sign-out, overwrite confirm, restore confirm.
- **Refresh post-import** (`Promise.all([fetchHabitsForDate, fetchLibrary])`): replicar idéntico tras restore exitoso.
- **`AppScreenHeader`** (components/layout): si la lista de Restore es nueva pantalla, usa este header.

### Established Patterns
- **Layer separation**: lógica de Drive vive en `services/driveBackupService.ts`, NO en screens. Screens consumen funciones puras del service. Store solo guarda estado de auth + timestamps.
- **JSDoc en español + bloque de cabecera con propósito**: cada archivo nuevo (`driveBackupService.ts`, `LoadingOverlay.tsx`, etc.) debe abrir con bloque tipo `/** archivo.ts — propósito... */` siguiendo el estilo de `backupService.ts` y `useSettingsStore.ts`.
- **Mensajes en español en `config/constants.ts`**: cualquier copy nuevo (Alerts, empty states) va centralizado allí. NO hardcodear strings en componentes.
- **NativeWind className** para estilos. Colores tokens (`amber500`, `amber600`, etc.) ya definidos en `colors` de `SettingsScreen.styles.ts`.
- **Bloques de comentario decorativos `// ─── Sección ───`** separan zonas dentro de un mismo archivo. Mantener.
- **Tipos exhaustivos sin `any`** (Phase 2 acaba de eliminar el último `any` y `as`). Drive types pueden venir del SDK o definirse localmente — pero NO usar `any`.

### Integration Points
- **App.tsx (root)**: gancho de `signInSilently()` al mount. NO bloquear render — `useEffect` async sin await en el render. Si falla, log + continuar.
- **SettingsScreen.tsx**: la sección nueva se inserta entre las dos existentes ("Personalización" y "Seguridad y Datos") O reemplaza/extiende "Seguridad y Datos" para fusionar local backup + cloud backup. Decidir en plan 03-03 (D-23 lo deja a discreción de Claude con UI snapshot).
- **`useSettingsStore` partialize**: agregar 3 campos al objeto retornado para que persistan.
- **expo-file-system/legacy** (no migrar a la nueva API): el `cozyhabits-pre-restore-*.json` (D-19) usa el mismo módulo que `backupService` actual.
- **Stores a refrescar tras restore**: actualmente `fetchHabitsForDate` + `fetchLibrary`. Si Drive restore introduce data en `mood_entries` que no se renderea sin un refresh extra, evaluar agregar `useMoodStore.refresh()` (si existe) o equivalente. Verificar en planning.

</code_context>

<specifics>
## Specific Ideas

- El usuario eligió **overlay full-screen** (D-23) sobre el patrón actual de spinner inline en botón. Es una desviación deliberada del patrón de Export/Import actuales — justifica componente nuevo `LoadingOverlay`. NO interpretar como "actualizar también Export/Import al overlay" — el alcance es solo upload/restore Drive.
- El usuario eligió **retención Time Machine** (D-14) sobre las opciones más simples ("dejar todo" / "últimos N"). Vale la pena la complejidad por safety long-term. La política exacta (30 + mensual + anual) está definida — el planner debe expresarla como función pura y testeable.
- El usuario aprobó el approach de **mensajes de error categorizados** (D-26) con texto-ejemplo, dejando margen al planner para afinar. NO inventar nuevos mensajes; quedarse en las 5 categorías + genérico. Si aparece un nuevo error en testing, agregarlo como deferred idea, no improvisar.
- El usuario explícitamente quiere **sign-out solo local** (D-10), NO `revokeAccess()`. Si en planning aparece la tentación de "ser más limpio" con revoke, respetar la decisión.
- **DRIVE-01 está obsoleto en su redacción** (menciona expo-auth-session + drive.file). Las decisiones D-01 y D-02 son la fuente de truth. El planner NO debe actualizar `REQUIREMENTS.md` en este phase; documentar la divergencia en el VERIFICATION.md final.

</specifics>

<deferred>
## Deferred Ideas

### A v2 (ya en `REQUIREMENTS.md` v2)
- **Backup automático periódico** — `DRIVE-V2-01` (auto-backup diario o al cerrar app)
- **Mostrar tamaño total del backup en Drive** — `DRIVE-V2-02`
- **Backup encryption antes de subir** — `DRIVE-V2-03`

### Surgieron durante esta discusión (no entran a v1)
- **Diff vs datos actuales en modal de restore** — más visibilidad pero requiere computar conteos locales adicionales y diff visual; overkill para v1. Re-evaluar si el user reporta confusión post-restore.
- **Auto-retry con backoff exponencial** — sobrecomplicado para 1 user con operaciones manuales. Si Drive empieza a fallar de forma sistemática, reconsiderar.
- **Cachear lista offline read-only** — el user igualmente no puede restaurar sin red, mostrar nombres no agrega valor. Empty state + reintentar es suficiente.
- **Botón manual "Limpiar backups antiguos"** — la retención automática post-backup lo cubre. Si en V2 el user pide control granular, agregarlo entonces.
- **Botones separados sign-out (local) y revokeAccess (revocar)** — overkill para v1. Una sola acción "Cerrar sesión" cubre el caso.
- **Bottom sheet con detalle + retry para errores** — Alert nativo es consistente con el flow actual; bottom sheet sería el primer caso, no vale el componente nuevo.
- **Progress bar real (% bytes uploaded)** — el backup pesa <1MB típicamente; spinner es suficiente. Reconsiderar si los archivos crecen mucho.
- **Cuándo limpiar cache `cozyhabits-pre-restore-*.json`** — Claude decide en planning (puede acumular indefinidamente sin daño, o limpiar al próximo restore exitoso).

### Out of scope del milestone (ya en `REQUIREMENTS.md` Out of Scope)
- Sync bidireccional real-time
- Multi-cloud (Dropbox, iCloud)
- Import desde otras apps / CSV
- Merge on restore

</deferred>

---

*Phase: 03-google-drive-backup*
*Context gathered: 2026-04-27*
