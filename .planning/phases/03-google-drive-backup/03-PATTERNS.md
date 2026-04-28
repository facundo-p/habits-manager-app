# Phase 03: Google Drive Backup — Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** 14 (9 nuevos + 4 modificados + 1 config nativo)
**Analogs found:** 13 / 14 (1 sin analog directo: `LoadingOverlay` componente nuevo, pero hereda primitives de `BottomSheet`)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/services/backupService.ts` | service | file-I/O | `src/services/backupService.ts` mismo (in-place: promote `buildBackupData` y `parseAndValidate` a exports) | exact — in-place edit |
| `src/services/driveBackupService.ts` *(NEW)* | service | request-response (HTTP) | `src/services/backupService.ts` (capa Service: orquesta repos + IO) | role-match — single existing service file pattern |
| `src/services/googleAuth.ts` *(NEW, opcional)* | service | event-driven (auth lifecycle) | `src/services/db.ts` (singleton initializer pattern) | role-match — initialize-once on app startup |
| `src/utils/driveRetention.ts` *(NEW)* | utility | transform (pure function) | `src/utils/parsing.ts` (`parseAndValidateCategories`) | role-match — pure deterministic transform |
| `src/utils/dateFormat.ts` *(NEW, opcional)* | utility | transform | `src/utils/dateHelpers.ts` | role-match — date utility |
| `src/store/useSettingsStore.ts` | store (Zustand persist) | CRUD (state) | `src/store/useSettingsStore.ts` mismo (extender state + partialize) | exact — in-place additive |
| `src/screens/SettingsScreen.tsx` | component | request-response (UI) | `src/screens/SettingsScreen.tsx` mismo (handleExport / handleImport) | exact — in-place additive section |
| `src/screens/SettingsScreen.styles.ts` | style module | — | `src/screens/SettingsScreen.styles.ts` mismo | exact — extend `styles` object |
| `src/screens/RestoreFromDriveScreen.tsx` *(NEW)* | screen | request-response (HTTP+UI) | `src/screens/HabitLibraryScreen.tsx` (FlatList + AppScreenHeader + states) | role-match — list screen with loading/empty/error |
| `src/screens/RestoreFromDriveScreen.styles.ts` *(NEW)* | style module | — | `src/screens/HabitLibraryScreen.styles.ts` | role-match |
| `src/components/shared/LoadingOverlay.tsx` *(NEW)* | component | event-driven (visibility prop) | `src/components/layout/BottomSheet.tsx` (Modal transparent + back handler) | partial — extracts only Modal+ActivityIndicator subset |
| `src/config/constants.ts` | config | — | `src/config/constants.ts` mismo (sección `Alerts` + `Backup`) | exact — append constants in existing sections |
| `App.tsx` | root | event-driven (startup) | `App.tsx` mismo (`useEffect` → `initDatabase` chain) | exact — add second startup hook |
| `app.json` | native config | — | `app.json` mismo (`plugins[]` array) | exact — append plugin entry |
| `src/__tests__/driveRetention.test.ts` *(NEW)* | test | — | `src/__tests__/parsing.test.ts` | exact — pure function unit tests |
| `src/__tests__/driveBackupService.test.ts` *(NEW)* | test | — | `src/__tests__/speechRecognition.test.ts` (jest.doMock + virtual native module) | role-match — mock SDK + fetch |

---

## Pattern Assignments

### `src/services/backupService.ts` (service, file-I/O — promover internas a exports)

**Analog:** mismo archivo, edit in-place.

**Existing internal functions to promote to `export`** (lines 60-121, en `backupService.ts`):
```typescript
// ─── Helpers internos ────────────────────────────────────────────────

async function buildBackupData(): Promise<BackupData> {
  const [habits, performed_habits, mood_entries, daily_assignments] = await Promise.all([
    backupRepo.readAllHabits(),
    backupRepo.readAllPerformed(),
    backupRepo.readAllMoods(),
    backupRepo.readAllAssignments(),
  ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    habits,
    performed_habits,
    mood_entries,
    daily_assignments,
  };
}

function parseAndValidate(json: string): BackupData {
  // ... ya tipado en Phase 2 (D-04) sin `any` ni `as Partial`
}
```

**Pattern to apply:** simply prefix both with `export` and lift the `// ─── Helpers internos ───` comment so consumers see them as the public surface for `driveBackupService`. **No body changes.** Update existing internal callers (`exportBackup`, `importBackup`) to import from the same module — they already do (same-file). Also export `restoreData` (the local helper that wraps `backupRepo.restoreAllData`) so Drive restore can use the exact same wrapper.

**Cabecera JSDoc a actualizar** (lines 1-10) — añadir nota de que ahora esos helpers son superficie pública para Drive. Mantener el estilo existente:
```typescript
/**
 * backupService.ts — Lógica de respaldo y restauración de datos.
 *
 * Exportar: ... Importar: ... (igual que antes)
 * Phase 3: `buildBackupData`, `parseAndValidate` y `restoreData` se exponen
 * como named exports para reuso por driveBackupService (transporte a Drive).
 */
```

---

### `src/services/driveBackupService.ts` (NEW — service, request-response HTTP)

**Analog primario:** `src/services/backupService.ts` (capa Service en este codebase: orquesta repos + IO + valida).
**Analog secundario:** `src/services/db.ts` (singleton initialized at startup, mismo `Promise.all` patrón para work paralelo).

**Header pattern to mirror** (de `backupService.ts` lines 1-10):
```typescript
/**
 * driveBackupService.ts — Transporte de respaldos a Google Drive.
 *
 * upload: serializa con `buildBackupData` y sube via Drive REST v3
 *         (multipart manual; sobrescribe si ya hay backup del día).
 * list:   lista archivos `cozyhabits-*.json` en `appDataFolder`.
 * restore: descarga + `parseAndValidate` + `restoreData` (atómico).
 * sign-in/out: delega en GoogleSignin SDK.
 *
 * NO toca SQL directamente — eso vive en backupRepository.
 * Auth tokens se obtienen JIT vía `signInSilently + getTokens` antes de
 * cada operación (workaround de pitfall conocido en Android).
 */
```

**Imports pattern** (sigue convención existente — config primero, repos/services internos, types al final):
```typescript
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as FileSystem from 'expo-file-system/legacy';
import {
  BACKUP_FILE_PREFIX,
  BACKUP_FILE_EXTENSION,
  RETENTION_RECENT_DAYS,
  ALERT_DRIVE_NO_NETWORK,
  ALERT_DRIVE_AUTH_EXPIRED,
  ALERT_DRIVE_QUOTA,
  ALERT_DRIVE_PERMISSION,
  ALERT_DRIVE_GENERIC,
} from '../config/constants';
import { buildBackupData, parseAndValidate, restoreData } from './backupService';
import { selectFilesToPrune } from '../utils/driveRetention';
import type { BackupData } from '../types';
```

**Promise.all + secuencia explícita** (replicar de `buildBackupData` lines 62-78). Usar la misma forma de orquestar pasos paralelos cuando aplique:
```typescript
const [data, token] = await Promise.all([buildBackupData(), getDriveAccessToken()]);
```

**Token retrieval helper** (PATRÓN NUEVO — no analog directo, único en el codebase porque ningún otro archivo habla con un OAuth SDK; documentar con JSDoc explicativo):
```typescript
/**
 * Obtiene un accessToken válido para Drive REST API.
 * Pre-flight: re-trigger silent sign-in para forzar refresh interno del SDK
 * (workaround del bug de Android donde getTokens() devuelve cache expirada).
 */
async function getDriveAccessToken(): Promise<string> {
  await GoogleSignin.signInSilently();
  const { accessToken } = await GoogleSignin.getTokens();
  return accessToken;
}
```

**Multipart body manual** (no analog — pitfall específico de Drive REST). Construir como template literal explícito:
```typescript
function buildMultipartBody(metadata: object, json: string, boundary: string): string {
  return (
    `\r\n--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${json}\r\n` +
    `--${boundary}--`
  );
}
```

**Error handling pattern — mapear HTTP a constante de Alert** (analog: `parseAndValidate` en `backupService.ts` lines 85-91 usa try/catch + throw `new Error('Formato...')` con mensajes en español; replicar el shape pero retornando la constante en vez de throw):
```typescript
type DriveAlert =
  | typeof ALERT_DRIVE_NO_NETWORK
  | typeof ALERT_DRIVE_AUTH_EXPIRED
  | typeof ALERT_DRIVE_QUOTA
  | typeof ALERT_DRIVE_PERMISSION
  | typeof ALERT_DRIVE_GENERIC;

async function mapDriveError(err: unknown, response?: Response): Promise<DriveAlert> {
  // Sin red detectado por TypeError 'Network request failed' (RN convention)
  if (err instanceof TypeError && /network/i.test(err.message)) return ALERT_DRIVE_NO_NETWORK;
  if (response?.status === 401) return ALERT_DRIVE_AUTH_EXPIRED;
  if (response?.status === 403) {
    const body = await response.clone().text();
    if (/quotaExceeded|storageQuotaExceeded/i.test(body)) return ALERT_DRIVE_QUOTA;
    if (/insufficientPermissions|permissionDenied/i.test(body)) return ALERT_DRIVE_PERMISSION;
  }
  return ALERT_DRIVE_GENERIC;
}
```

**Console.error en español** (replicar convención de `useHabitStore.ts` line 109): `console.error('[uploadBackup]', err);` con prefijo `[functionName]` entre brackets.

---

### `src/services/googleAuth.ts` (NEW, opcional — service, event-driven)

**Analog:** `src/services/db.ts` (initialize-once singleton helper invocado desde App.tsx). Ver `App.tsx` lines 99-104:
```typescript
useEffect(() => {
  initDatabase()
    .then(() => checkAndBackfillHistory())
    .then(() => console.log('DB inicializada y backfill completado'))
    .catch((err) => console.error('Error inicializando DB:', err));
}, []);
```

**Pattern to mirror:** exportar dos funciones: `configureGoogleSignin()` (idempotente, llamada al cargar el módulo o desde startup) y `silentSignInIfPossible()` (best-effort, no bloqueante).

**Header JSDoc:**
```typescript
/**
 * googleAuth.ts — Configuración del SDK de Google Sign-in y silent sign-in.
 *
 * configureGoogleSignin: registra clientIds + scope drive.appdata. Idempotente.
 * silentSignInIfPossible: intenta restaurar sesión sin UI. Si falla, no throw.
 * Llamado desde App.tsx en startup, no bloquea el render.
 */
```

**Implementation pattern** (sigue try/catch silencioso de `useSettingsStore.ts` lines 30-44 — never bloquear la app):
```typescript
export async function silentSignInIfPossible(): Promise<{ email: string } | null> {
  try {
    const user = await GoogleSignin.signInSilently();
    return { email: user.user.email };
  } catch {
    // No hay sesión previa o expiró — no es error de la app.
    return null;
  }
}
```

---

### `src/utils/driveRetention.ts` (NEW — utility, pure transform)

**Analog:** `src/utils/parsing.ts` (`parseAndValidateCategories`) — pura, testeable, comentario en español.

**Existing pattern from `parsing.ts`** (lines 1-30 — copia el header + estilo de JSDoc):
```typescript
/**
 * parsing.ts — Utilidades de parseo compartidas entre services, screens y componentes.
 */
import { VALID_AREA_IDS } from '../config/constants';

/**
 * Parsea un JSON de array de categorías de forma segura.
 * Filtra IDs inválidos silenciosamente y emite console.warn con los descartados.
 * Retorna [] ante cualquier error de parsing.
 */
export function parseAndValidateCategories(json: string): string[] {
  // ...
}
```

**Pattern to copy:**
- 1 export por archivo, función pura (no IO, no side-effects salvo console.warn al estilo de `parsing.ts`).
- JSDoc en español, formato de 1 línea de descripción + 1-2 de detalle.
- Tipos exhaustivos (no `any` — Phase 2 cerró ese cap).

**Recommended signature for retention:**
```typescript
/**
 * Calcula qué archivos eliminar según la política Time Machine:
 * - Mantener los últimos `recentDays` (default 30) backups diarios.
 * - Para cada mes anterior a `recentDays`, mantener solo el más antiguo.
 * - Para cada año anterior a 12 meses, mantener solo el más antiguo.
 * Retorna los IDs de archivos a borrar. Función pura — no toca Drive.
 */
export function selectFilesToPrune(
  files: ReadonlyArray<{ id: string; name: string; createdTime: string }>,
  now: Date = new Date(),
  recentDays: number = 30,
): string[] {
  // ...
}
```

---

### `src/store/useSettingsStore.ts` (store extension, in-place additive)

**Analog:** mismo archivo (in-place edit).

**Existing state interface to extend** (lines 14-24):
```typescript
interface SettingsState {
  hapticsEnabled: boolean;
  soundsEnabled: boolean;
  voiceDictationEnabled: boolean;
  language: SupportedLanguage;

  toggleHaptics: () => void;
  toggleSounds: () => void;
  toggleVoiceDictation: () => void;
  setLanguage: (lang: SupportedLanguage) => void;
}
```

**Add after `language`:**
```typescript
  googleEmail: string | null;
  lastBackupAt: string | null;     // ISO timestamp
  lastBackupFileId: string | null; // Drive file ID
  setGoogleEmail: (email: string | null) => void;
  setLastBackup: (at: string | null, fileId: string | null) => void;
  clearGoogleSession: () => void;  // sign-out: borra solo email; preserva lastBackup* (D-11)
```

**Initial state pattern** (lines 59-62 — defaults explícitos):
```typescript
hapticsEnabled: true,
soundsEnabled: true,
voiceDictationEnabled: true,
language: 'es',
// añadir:
googleEmail: null,
lastBackupAt: null,
lastBackupFileId: null,
```

**Setter style** (replicar de `setLanguage` line 67):
```typescript
setLanguage: (lang) => set({ language: lang }),
// nuevo, mismo estilo:
setGoogleEmail: (email) => set({ googleEmail: email }),
setLastBackup: (at, fileId) => set({ lastBackupAt: at, lastBackupFileId: fileId }),
clearGoogleSession: () => set({ googleEmail: null }),
```

**`partialize` extension** (lines 72-77 — agregar las 3 keys nuevas):
```typescript
partialize: (state) => ({
  hapticsEnabled: state.hapticsEnabled,
  soundsEnabled: state.soundsEnabled,
  voiceDictationEnabled: state.voiceDictationEnabled,
  language: state.language,
  // nuevos — persistidos en settings.json
  googleEmail: state.googleEmail,
  lastBackupAt: state.lastBackupAt,
  lastBackupFileId: state.lastBackupFileId,
}),
```

---

### `src/screens/SettingsScreen.tsx` (in-place additive — nueva sección "Backup en la nube")

**Analog:** mismo archivo, nueva sección entre "Personalización" (lines 122-132) y "Seguridad y Datos" (lines 137-172).

**Pattern de sección a clonar** — replicar la estructura de la sección "Seguridad y Datos" (lines 137-172):
```typescript
<Text className={styles.sectionTitle}>Seguridad y Datos</Text>
<NotebookPaper>
  <Pressable
    className={styles.exportButton}
    onPress={handleExport}
    disabled={isExporting}
  >
    {isExporting ? (
      <ActivityIndicator size="small" color={colors.white} />
    ) : (
      <Download size={18} color={colors.white} strokeWidth={iconDefaults.strokeWidth} />
    )}
    <Text className={styles.exportButtonText}>
      {isExporting ? 'Exportando...' : 'Exportar respaldo'}
    </Text>
  </Pressable>
  // ...
</NotebookPaper>
```

**Pattern de async handler con isLoading state** (lines 76-86 — `handleExport`):
```typescript
const handleExport = useCallback(async () => {
  setIsExporting(true);
  try {
    await exportBackup();
  } catch (err) {
    console.error('Export error:', err);
    Alert.alert(ALERT_EXPORT_ERROR.title, ALERT_EXPORT_ERROR.message);
  } finally {
    setIsExporting(false);
  }
}, []);
```
Aplicar verbatim para `handleConnect`, `handleSignOut`, `handleBackupNow`. Para Drive, el `Alert.alert` recibe la constante mapeada por `mapDriveError` desde el service.

**Pattern de Alert con cancel/destructive + handler separado** (lines 88-111 — `handleImportConfirm` + `handleImport`):
```typescript
const handleImportConfirm = useCallback(async () => {
  setIsImporting(true);
  try {
    const imported = await importBackup();
    if (!imported) { setIsImporting(false); return; }

    // Refrescar todos los stores tras la importación
    const today = new Date().toISOString().slice(0, 10);
    await Promise.all([fetchHabitsForDate(today), fetchLibrary()]);
    Alert.alert(ALERT_IMPORT_SUCCESS.title, ALERT_IMPORT_SUCCESS.message);
  } catch (err) {
    console.error('Import error:', err);
    Alert.alert(ALERT_IMPORT_ERROR.title, ALERT_IMPORT_ERROR.message);
  } finally {
    setIsImporting(false);
  }
}, [fetchHabitsForDate, fetchLibrary]);

const handleImport = useCallback(() => {
  Alert.alert(ALERT_IMPORT.title, ALERT_IMPORT.message, [
    { text: ALERT_IMPORT.cancel, style: 'cancel' },
    { text: ALERT_IMPORT.confirm, style: 'destructive', onPress: handleImportConfirm },
  ]);
}, [handleImportConfirm]);
```

**Refresh post-restore Promise.all** — copiar verbatim `Promise.all([fetchHabitsForDate(today), fetchLibrary()])` (line 96) en el handler de Drive restore. Si Drive restore se hace dentro de `RestoreFromDriveScreen`, el screen llama estos del store por sí mismo.

**Sub-component idiom** (lines 27-61) — extraer `<DriveSection>` o `<ConnectedRow>` como sub-componente local del archivo, mismo patrón que `ToggleRow` / `PlaceholderRow` / `SectionDivider`. Tamaño máximo 20 líneas (Regla 3 de CLAUDE.md).

**Import additions to SettingsScreen.tsx top:**
```typescript
import { Cloud, CloudUpload, CloudDownload, CheckCircle2, LogOut } from 'lucide-react-native';
import {
  ALERT_DRIVE_SIGN_OUT, ALERT_DRIVE_BACKUP_SUCCESS, /* ...resto */
} from '../config/constants';
import * as drive from '../services/driveBackupService';
import { LoadingOverlay } from '../components/shared/LoadingOverlay';
```

---

### `src/screens/SettingsScreen.styles.ts` (extend `styles` object)

**Analog:** mismo archivo (lines 13-45). Append nuevas keys siguiendo la convención.

**Pattern observado:**
```typescript
exportButton: button.primary + ' flex-row gap-2 mt-2',
exportButtonText: button.primaryText,
importButton: button.secondary + ' flex-row gap-2 mt-3',
importButtonText: button.secondaryText,
```

**Append (mantener mismo orden + comentarios decorativos `/** */`):**
```typescript
/** Drive backup — botones específicos */
connectButton: button.primary + ' flex-row gap-2 mt-2',
connectButtonText: button.primaryText,
backupNowButton: button.primary + ' flex-row gap-2 mt-2',
restoreFromDriveButton: button.secondary + ' flex-row gap-2 mt-3',
signOutButton: 'flex-row items-center gap-2 py-3 mt-3 self-start',
signOutText: text.caption + ' text-amber-700',
identityRow: 'flex-row items-center gap-2 py-3',
identityEmail: text.body,
lastBackupCaption: text.caption,
```

Reutiliza `text`, `button` ya importados (line 9). NO agregar nuevos colores.

---

### `src/screens/RestoreFromDriveScreen.tsx` (NEW — list screen)

**Analog primario:** `src/screens/HabitLibraryScreen.tsx` (estructura: AppScreenHeader + ScrollView/FlatList + sub-componentes locales `HabitRow` + `Separator` + `EmptyList` + states de loading/empty).

**Header pattern** (`HabitLibraryScreen.tsx` lines 1-7):
```typescript
/**
 * RestoreFromDriveScreen — Lista de backups disponibles en Google Drive.
 *
 * Pulsar un item abre preview (lee conteos) → Alert de confirmación → restore.
 * Estados: loading inicial / empty (cero backups) / error (sin red) / loaded.
 * Restore aplica `parseAndValidate` + `restoreData` y refresca stores.
 */
```

**Estructura del componente** (replicar lines 63-150 de `HabitLibraryScreen.tsx`):
```typescript
export function RestoreFromDriveScreen() {
  const navigation = useNavigation();
  const { fetchHabitsForDate, fetchLibrary } = useHabitStore();

  const [files, setFiles] = useState<DriveBackupFile[]>([]);
  const [status, setStatus] = useState<'loading' | 'empty' | 'error' | 'loaded'>('loading');
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => { void loadList(); }, [loadList]);

  // ... loadList, handleSelect, handleRestoreConfirm

  if (status === 'loading') {
    return (
      <View className={styles.loading}>
        <ActivityIndicator size="large" color={colors.amber600} />
      </View>
    );
  }
  // ...
}
```

**FlatList + Separator + Empty pattern** (lines 154-187 de `HabitLibraryScreen.tsx` — `HabitList`):
```typescript
<FlatList
  data={files}
  keyExtractor={(item) => item.id}
  renderItem={renderItem}
  ItemSeparatorComponent={Separator}
  ListEmptyComponent={EmptyList}
/>
```

**Loading state** (line 89-95 de `HabitLibraryScreen.tsx`):
```typescript
if (isLibraryLoading && libraryHabits.length === 0) {
  return (
    <View className={styles.loading}>
      <ActivityIndicator size="large" color={colors.amber600} />
    </View>
  );
}
```

**Item row pattern** (lines 23-55 — `HabitRow`):
- Wrapper `Pressable className={styles.habitRow} onPress={onPress}`
- Info column (flex-1): primary line + caption
- Trailing icon
- Sub-components ≤20 líneas (CLAUDE.md Regla 3)

**Confirmar destructiva** (`HabitLibraryScreen.tsx` lines 208-213):
```typescript
function confirmDelete(habit: LibraryHabit, remove: (id: string) => Promise<void>) {
  Alert.alert(ALERT_DELETE_HABIT.title, ALERT_DELETE_HABIT.message, [
    { text: ALERT_DELETE_HABIT.cancel, style: 'cancel' },
    { text: ALERT_DELETE_HABIT.confirm, style: 'destructive', onPress: () => remove(habit.id) },
  ]);
}
```
Replicar para confirmación de restore — pero el mensaje se templatea con conteos en runtime (D-18, ver UI-SPEC).

**Imports** — exactamente la lista de `HabitLibraryScreen.tsx` lines 9-19, pero swappeando los íconos:
```typescript
import { FileText, ChevronRight, CloudOff, WifiOff } from 'lucide-react-native';
import { AppScreenHeader } from '../components/layout/AppScreenHeader';
import { LoadingOverlay } from '../components/shared/LoadingOverlay';
import * as drive from '../services/driveBackupService';
import { useHabitStore } from '../store/useHabitStore';
import { ALERT_DRIVE_RESTORE_CONFIRM, ALERT_DRIVE_RESTORE_SUCCESS, ALERT_DRIVE_GENERIC } from '../config/constants';
```

---

### `src/screens/RestoreFromDriveScreen.styles.ts` (NEW)

**Analog:** `src/screens/HabitLibraryScreen.styles.ts` (mismo shape, mismas tokens).

**Pattern verbatim a clonar** (líneas 8-39 de `HabitLibraryScreen.styles.ts`):
```typescript
import { text, layout, button, spacing, colors } from '../styles/ui.styles';

export const styles = {
  container: layout.transparentPadded,
  sectionTitle: text.sectionTitle,
  sectionGap: spacing.sectionGap,

  // ─── Item row ─────────────────────────────────────────────────────
  itemRow: 'flex-row items-center gap-3 py-3 px-4',
  itemPrimary: text.body,
  itemCaption: text.caption,
  separator: 'border-b border-amber-100/60',

  // ─── States ───────────────────────────────────────────────────────
  loading: layout.centered,
  emptyContainer: 'flex-1 items-center justify-center px-5 pt-12',
  emptyHeading: text.sectionTitle + ' text-center',
  emptyBody: text.caption + ' text-center mt-2',
  errorRetryButton: button.primary + ' w-40 mt-4',
} as const;

export { colors };
```

---

### `src/components/shared/LoadingOverlay.tsx` (NEW — Modal-based blocking spinner)

**Analog primario:** `src/components/layout/BottomSheet.tsx` (uso de `Modal`, `transparent`, `statusBarTranslucent`, `onRequestClose`, `BackHandler`). Es el único componente del proyecto que usa `Modal` directamente.

**Header JSDoc** (replicar tono de `BottomSheet.tsx` lines 1-7):
```typescript
/**
 * LoadingOverlay — Overlay full-screen modal para operaciones bloqueantes.
 *
 * Usado durante upload/restore de Drive (D-23). Bloquea touches via Modal nativo,
 * captura el back button de Android (no-op mientras visible).
 * Para spinners inline (cargas cortas), usar ActivityIndicator directamente.
 */
```

**Pattern to copy from `BottomSheet.tsx` lines 19-64** (extraer subset Modal + ActivityIndicator):
```typescript
import React from 'react';
import { Modal, View, ActivityIndicator, Text } from 'react-native';
import { colors, text } from '../../styles/ui.styles';

interface LoadingOverlayProps {
  visible: boolean;
  message: string;
}

export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={() => { /* no-op: bloqueante */ }}
      accessibilityViewIsModal
    >
      <View className="flex-1 items-center justify-center bg-black/40">
        <View className="bg-amber-50 rounded-2xl p-6 items-center gap-3">
          <ActivityIndicator size="large" color={colors.amber600} />
          <Text
            className={text.body + ' text-center'}
            accessibilityLiveRegion="polite"
          >
            {message}
          </Text>
        </View>
      </View>
    </Modal>
  );
}
```

**Tokens to reuse:** `colors.amber600` (spinner), `colors.amber50` (inner card bg), `colors.black40` (backdrop) — todos ya en `ui.styles.ts` lines 13-34. **NO** crear nuevos colores ni nuevas keys en `ui.styles.ts`. Tamaño objetivo: ≤30 líneas (D-23).

---

### `src/config/constants.ts` (in-place additive — sección Drive Alerts)

**Analog:** mismo archivo, lines 226-246 (sección Backup actual con `ALERT_IMPORT*`).

**Pattern observed for Alert constants** (lines 226-246):
```typescript
export const ALERT_IMPORT = {
  title: '¿Importar datos?',
  message: 'Esto reemplazará TODOS tus datos actuales (...). Esta acción no se puede deshacer.',
  confirm: 'Importar',
  cancel: 'Cancelar',
} as const;

export const ALERT_IMPORT_SUCCESS = {
  title: 'Importación exitosa',
  message: 'Tus datos han sido restaurados correctamente.',
} as const;
```

**Pattern de sección con `// ─── Nombre ───` divider** (lines 8, 11, 17, 39, 44, 152, 159, 163, 190, 207, 213, 222) — agregar dos secciones nuevas tras `// ─── Backup ─── (line 222)`:

```typescript
// ─── Drive Backup ───────────────────────────────────────────────────
export const BACKUP_FILE_PREFIX = 'cozyhabits-';
export const BACKUP_FILE_EXTENSION = '.json';
export const RETENTION_RECENT_DAYS = 30;
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

// ─── Drive Alerts ───────────────────────────────────────────────────
export const ALERT_DRIVE_SIGN_OUT = { /* ... ver UI-SPEC */ } as const;
export const ALERT_DRIVE_OVERWRITE_TODAY = { /* ... */ } as const;
export const ALERT_DRIVE_RESTORE_CONFIRM = { /* ... */ } as const;
export const ALERT_DRIVE_BACKUP_SUCCESS = { /* ... */ } as const;
export const ALERT_DRIVE_RESTORE_SUCCESS = { /* ... */ } as const;
export const ALERT_DRIVE_NO_NETWORK = { /* + retry: true */ } as const;
export const ALERT_DRIVE_AUTH_EXPIRED = { /* + actionLabel: 'Ir a Ajustes' */ } as const;
export const ALERT_DRIVE_QUOTA = { /* */ } as const;
export const ALERT_DRIVE_PERMISSION = { /* + actionLabel */ } as const;
export const ALERT_DRIVE_GENERIC = { /* + retry: true */ } as const;
```

**Important:** Mensajes en voseo argentino (existing convention — "Verificá", "Volvé", "Podés"). Ver constantes existentes lines 226-246. UI-SPEC tiene los strings exactos.

---

### `App.tsx` (root — add second startup hook)

**Analog:** mismo archivo, lines 99-104.

**Existing startup pattern:**
```typescript
useEffect(() => {
  initDatabase()
    .then(() => checkAndBackfillHistory())
    .then(() => console.log('DB inicializada y backfill completado'))
    .catch((err) => console.error('Error inicializando DB:', err));
}, []);
```

**Pattern to mirror — second `useEffect` for Google Auth** (mismo estilo, no bloquea render — D-08):
```typescript
useEffect(() => {
  configureGoogleSignin();
  silentSignInIfPossible()
    .then((session) => {
      if (session) {
        useSettingsStore.getState().setGoogleEmail(session.email);
      }
    })
    .catch((err) => console.error('Error en silent sign-in:', err));
}, []);
```

**Notes:**
- Llamar `configureGoogleSignin()` síncrono primero (idempotente). El silent sign-in async corre en background.
- NO añadir `await` en el `useEffect` — el componente debe renderizar inmediatamente.
- Usar `useSettingsStore.getState()` (mismo patrón que `useHabitStore.getState().resetToToday()` en line 69) para evitar re-renders del root.

**Import additions** (sigue el orden alfabético de imports existentes):
```typescript
import { configureGoogleSignin, silentSignInIfPossible } from './src/services/googleAuth';
import { useSettingsStore } from './src/store/useSettingsStore';
```

---

### `app.json` (native config — append plugin entry)

**Analog:** mismo archivo, line 28-31 (`plugins` array).

**Existing plugins array:**
```json
"plugins": [
  "expo-font",
  "expo-sqlite"
]
```

**Pattern to extend (D-01 + D-02 + RESEARCH OAuth Setup):**
```json
"plugins": [
  "expo-font",
  "expo-sqlite",
  [
    "@react-native-google-signin/google-signin",
    {
      "iosUrlScheme": "com.googleusercontent.apps.<TU_IOS_CLIENT_ID_REVERSED>"
    }
  ]
]
```

**Also required (RESEARCH lines 175-189):** add `"ios.bundleIdentifier": "com.facupich.cozyhabit"` (consistent with `android.package` line 19) — currently missing.

---

### `src/__tests__/driveRetention.test.ts` (NEW — pure function tests)

**Analog:** `src/__tests__/parsing.test.ts` (entire file).

**Pattern to copy verbatim** (parsing.test.ts lines 1-37):
```typescript
import { selectFilesToPrune } from '../utils/driveRetention';

describe('selectFilesToPrune', () => {
  test('retiene los últimos 30 backups diarios', () => {
    const files = makeFiles(40); // helper local
    const result = selectFilesToPrune(files, new Date('2026-04-27'), 30);
    expect(result).toHaveLength(/* ... según política */);
  });

  test('retiene 1 backup por mes anterior a recentDays', () => { /* ... */ });
  test('retiene 1 backup por año anterior a 12 meses', () => { /* ... */ });
  test('no devuelve nada cuando hay menos backups que recentDays', () => {
    expect(selectFilesToPrune(makeFiles(10), new Date(), 30)).toEqual([]);
  });
  test('retorna [] para input vacío', () => {
    expect(selectFilesToPrune([], new Date())).toEqual([]);
  });
});
```

**No DB needed** — like `parsing.test.ts`. No `jest.mock` calls. Solo importa la función + ejecuta casos.

---

### `src/__tests__/driveBackupService.test.ts` (NEW — mock SDK + fetch)

**Analog primario:** `src/__tests__/speechRecognition.test.ts` — mismo patrón de `jest.doMock` con módulos virtuales (líneas 18-99).

**Mock the Google Sign-in SDK** (replicar pattern de `speechRecognition.test.ts` lines 78-99):
```typescript
jest.doMock(
  '@react-native-google-signin/google-signin',
  () => ({
    GoogleSignin: {
      configure: jest.fn(),
      signInSilently: jest.fn().mockResolvedValue({ user: { email: 'a@b.com' } }),
      signIn: jest.fn().mockResolvedValue({ user: { email: 'a@b.com' } }),
      signOut: jest.fn().mockResolvedValue(undefined),
      getTokens: jest.fn().mockResolvedValue({ accessToken: 'fake_token' }),
    },
  }),
  { virtual: true },
);
```

**Mock global `fetch`:**
```typescript
beforeEach(() => {
  global.fetch = jest.fn();
});
afterEach(() => {
  jest.clearAllMocks();
});
```

**Test pattern for upload** (mock fetch responding 200 + verify multipart body shape):
```typescript
test('uploadBackup: POST a /upload con multipart cuando no hay archivo del día', async () => {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) })  // listFiles
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'new_id' }) }); // upload

  const { uploadBackup } = require('../services/driveBackupService');
  const result = await uploadBackup();

  expect(result.fileId).toBe('new_id');
  const uploadCall = (global.fetch as jest.Mock).mock.calls[1];
  expect(uploadCall[0]).toContain('/upload/drive/v3/files');
  expect(uploadCall[1].body).toContain('multipart/related');
});
```

**Test error mapping pattern** (replicar throw + assertion de `habitService.test.ts` line 41):
```typescript
test('mapDriveError: 403 quotaExceeded → ALERT_DRIVE_QUOTA', async () => {
  const response = new Response('{"error":{"errors":[{"reason":"quotaExceeded"}]}}', { status: 403 });
  const alert = await mapDriveError(null, response);
  expect(alert).toBe(ALERT_DRIVE_QUOTA);
});
```

**No DB needed** — el service es transporte HTTP. No mock de `expo-sqlite` ni de `getDatabase`. Sí mock de `expo-file-system/legacy` para el pre-restore cache (similar al estilo de `speechRecognition.test.ts` con módulos virtuales si Jest no lo resuelve).

---

## Shared Patterns

### JSDoc en español con header de propósito
**Source:** `src/services/backupService.ts` lines 1-10, `src/store/useSettingsStore.ts` lines 1-6, `src/components/layout/BottomSheet.tsx` lines 1-7
**Apply to:** TODOS los archivos nuevos (`driveBackupService.ts`, `googleAuth.ts`, `driveRetention.ts`, `LoadingOverlay.tsx`, `RestoreFromDriveScreen.tsx`)
```typescript
/**
 * <archivo>.ts — <propósito en una línea>.
 *
 * <2-4 líneas describiendo qué hace + cuándo usar + restricciones>.
 *
 * <opcional: nota de integración con otros módulos>.
 */
```

### Comentarios decorativos `// ─── Sección ───`
**Source:** Todos los archivos del codebase (e.g., `backupService.ts` lines 19, 35, 60; `useHabitStore.ts` lines 41, 78, 89, 256)
**Apply to:** Cualquier archivo nuevo con ≥2 secciones lógicas.

### Console.error con prefijo `[functionName]`
**Source:** `src/store/useHabitStore.ts` lines 109, 141, 215; `src/screens/SettingsScreen.tsx` lines 81, 99
**Apply to:** Cualquier `catch` block en services/store/screens nuevos.
```typescript
} catch (err) {
  console.error('[uploadBackup]', err);
  // ...
}
```

### Async handler con `setIsX(true) → try/finally → setIsX(false)`
**Source:** `src/screens/SettingsScreen.tsx` lines 76-86 (`handleExport`)
**Apply to:** Todos los handlers async en SettingsScreen y RestoreFromDriveScreen.

### Alert.alert con cancel/destructive button
**Source:** `src/screens/SettingsScreen.tsx` lines 106-111 (`handleImport`); `src/screens/HabitLibraryScreen.tsx` lines 208-213 (`confirmDelete`)
**Apply to:** Confirmación de sign-out, restore, overwrite-today.
```typescript
Alert.alert(ALERT_X.title, ALERT_X.message, [
  { text: ALERT_X.cancel, style: 'cancel' },
  { text: ALERT_X.confirm, style: 'destructive', onPress: handleConfirm },
]);
```

### Refresh stores tras data mutation
**Source:** `src/screens/SettingsScreen.tsx` lines 95-96 (post-import); `src/store/useHabitStore.ts` `refreshAll` lines 280-293
**Apply to:** Post-restore handler en RestoreFromDriveScreen.
```typescript
const today = new Date().toISOString().slice(0, 10);
await Promise.all([fetchHabitsForDate(today), fetchLibrary()]);
```

### Persist + fileStorage + partialize (Zustand)
**Source:** `src/store/useSettingsStore.ts` lines 28-80
**Apply to:** Extension del mismo store con 3 nuevos campos persistidos. NO duplicar `fileStorage` — reusar el adapter existente.

### Iconos lucide con `iconDefaults.strokeWidth`
**Source:** `src/screens/SettingsScreen.tsx` lines 51, 147; `src/components/layout/AppScreenHeader.tsx` lines 39, 59
**Apply to:** Todos los íconos nuevos en SettingsScreen + RestoreFromDriveScreen.
```typescript
<Cloud size={18} color={colors.amber700} strokeWidth={iconDefaults.strokeWidth} />
```

### Layer separation (Service / Repo / Store / Screen)
**Source:** Todo el codebase. Phase 2 lo cementó (`backupService` no toca SQL — delega a `backupRepository`).
**Apply to:** `driveBackupService.ts` solo HTTP+IO; `useSettingsStore` solo state; `RestoreFromDriveScreen` solo UI; `backupRepository.ts` (existente) intacto.

### Try/catch silencioso para storage no crítico
**Source:** `src/store/useSettingsStore.ts` lines 30-44 (fileStorage adapter — never throws)
**Apply to:** `silentSignInIfPossible` (nunca debe romper la app), `pruneOldBackups` (best-effort, log + continue per D-14).

---

## File Patterns Catálogo (sub-component idiom)

**Source:** `src/screens/SettingsScreen.tsx` lines 27-61, `src/screens/HabitLibraryScreen.tsx` lines 23-59
**Apply to:** `RestoreFromDriveScreen.tsx`, `SettingsScreen.tsx` (nueva sección Drive)

Patrón: archivos `.tsx` >100 líneas DEBEN extraer sub-componentes locales del archivo (no de un módulo separado), tamaño ≤20 líneas (CLAUDE.md Regla 3). Ejemplos:
- `ToggleRow`, `PlaceholderRow`, `SectionDivider` (SettingsScreen)
- `HabitRow`, `Separator`, `EmptyList`, `EmptyArchived` (HabitLibrary)

Para Phase 3 sugerir:
- `<DriveSection>` wrapping NotebookPaper en SettingsScreen
- `<ConnectedRow>`, `<DisconnectedRow>` para variantes según `googleEmail`
- `<BackupListItem>`, `<EmptyBackups>`, `<ErrorState>`, `<LoadingState>` en RestoreFromDriveScreen

---

## No Analog Found

| File | Role | Razón |
|------|------|-------|
| `src/components/shared/LoadingOverlay.tsx` (parcial) | overlay component | Único componente del proyecto que es Modal estrictamente bloqueante (BottomSheet usa Modal pero con KeyboardAvoidingView + Animated, optimizado para sheets de input). Subset del pattern de BottomSheet — se documenta el subset arriba. |
| `driveBackupService.ts` (multipart body manual) | HTTP client | El proyecto no llama a ningún REST API externo hoy. El multipart manual con `\r\n--boundary` es pattern específico de Drive — no hay analog interno. RESEARCH.md lo cubre con citation. |
| `driveBackupService.ts` (mapping de errores HTTP) | error categorization | El codebase no tiene casos previos de catch + categorize HTTP. El patrón general (try/catch + retorna Alert constant) sí — pero el contenido de mapDriveError es nuevo. |

Para los 3 casos arriba, el planner debe seguir RESEARCH.md (sección "Drive REST API v3" + "Error Mapping Table") como fuente primaria, y los patterns de este PATTERNS.md como envoltorio (JSDoc + console.error + return type).

---

## Metadata

**Analog search scope:** `src/services/`, `src/store/`, `src/screens/`, `src/components/`, `src/utils/`, `src/__tests__/`, `App.tsx`, `app.json`
**Files scanned:** 19 files (services 6, store 2, screens 7, components 4, utils 3, tests 5, root 2)
**Pattern extraction date:** 2026-04-27
**Project conventions referenced:** `.claude/CLAUDE.md` (Reglas 3, 4, 5), `.planning/codebase/CONVENTIONS.md` (JSDoc en español, layer separation), `.planning/phases/02-tech-debt/02-PATTERNS.md` (precedente de pattern map)
