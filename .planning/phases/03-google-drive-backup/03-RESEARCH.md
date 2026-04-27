# Phase 3: Google Drive Backup - Research

**Researched:** 2026-04-27
**Domain:** OAuth (Google) + Drive REST API v3 + multipart upload sobre RN/Expo (managed → prebuild)
**Confidence:** HIGH (stack y endpoints verificados; algunas pitfalls de Android `getTokens()` requieren validación en EAS build real)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Stack y arquitectura**
- **D-01:** Librería: `@react-native-google-signin/google-signin`. NO usar `expo-auth-session` — issue confirmado en GitHub: no soporta `drive.appdata` scope. Esta decisión sobreescribe DRIVE-01 ("expo-auth-session con scope drive.file").
- **D-02:** Scope OAuth: `https://www.googleapis.com/auth/drive.appdata`. NO `drive.file`. Razones: (a) hidden — archivos no aparecen en Drive web; (b) no requiere Google security review; (c) "backup invisible".
- **D-03:** Arquitectura: nuevo `driveBackupService.ts` actúa como transporte. `backupService.ts` aporta serialización (`buildBackupData`) y deserialización validada (`parseAndValidate`) — ambas son **internas** hoy y se promueven a named exports en este phase. Sin duplicar lógica de DB.
- **D-04:** Tooling: requiere EAS build (development o preview) para testear OAuth nativo. Expo Go NO soporta este flow.
- **D-05:** Nombre base de archivo: `cozyhabits-YYYY-MM-DD.json`. Un único archivo por día.
- **D-06:** Restore = full replace de la DB local. Sin merge, sin conflict resolution.
- **D-07:** Backup/restore es **manual** — usuario presiona el botón. Auto periódico es V2.

**Auth: persistencia y estado**
- **D-08:** Silent sign-in al abrir la app (`signInSilently()` en App.tsx, no bloqueante).
- **D-09:** Estado en `useSettingsStore` extendido. Agregar 3 campos persistidos: `googleEmail`, `lastBackupAt`, `lastBackupFileId`. NO crear `useAuthStore` separado.
- **D-10:** Sign-out solo limpia token local (`signOut()`). NO `revokeAccess()`.
- **D-11:** Sign-out con `Alert.alert` de confirmación. Sign-out NO toca `lastBackupAt` ni `lastBackupFileId`.

**Estrategia de archivos en Drive**
- **D-12:** Un único backup por día. Si existe `cozyhabits-YYYY-MM-DD.json` con la fecha de hoy, sobrescribir vía PATCH al `fileId` existente.
- **D-13:** Antes de sobrescribir, mostrar `Alert.alert` de confirmación (siempre que exista archivo del día actual).
- **D-14:** Retención Time Machine: últimos 30 backups diarios + 1 por mes (anterior a 30 días) + 1 por año (anterior a 12 meses). Pruning post-backup; si falla, log + continuar (no fallar el backup).
- **D-15:** Lista en UI ordenada por más reciente primero.
- **D-16:** Filtrar listado por prefijo `cozyhabits-` y extensión `.json`. Drive query `name contains 'cozyhabits-'`.

**Restore: metadata y protección**
- **D-17:** Item de la lista muestra: fecha (formateada en español "27 abr 2026") + tamaño (de Drive listing). Conteos por tabla NO en la lista — al hacer tap (preview).
- **D-18:** Modal de confirmación de restore: fecha + conteos por tabla + warning destructivo.
- **D-19:** Auto-export local automático antes de aplicar el restore como red de seguridad. Cache: `${FileSystem.cacheDirectory}cozyhabits-pre-restore-${ISO}.json`.
- **D-20:** Post-restore exitoso: queda en Settings + Alert de éxito. NO navegar.

**UX de errores y progreso**
- **D-21:** Errores con `Alert.alert` nativo, mismo patrón que `ALERT_IMPORT_ERROR`.
- **D-22:** Sin auto-retry. Mostrar Alert con botón "Reintentar".
- **D-23:** Durante upload/restore: overlay full-screen tipo Modal transparente con `ActivityIndicator` + texto contextual. Componente nuevo: `src/components/shared/LoadingOverlay.tsx`.
- **D-24:** Listing usa spinner inline (NO overlay).
- **D-25:** Si carga de lista falla por red: empty state + reintentar. Sin cache offline.
- **D-26:** 5 categorías de error + 1 genérico. Constantes en `config/constants.ts`: `ALERT_DRIVE_NO_NETWORK`, `ALERT_DRIVE_AUTH_EXPIRED`, `ALERT_DRIVE_QUOTA`, `ALERT_DRIVE_PERMISSION`, `ALERT_DRIVE_GENERIC`.

### Claude's Discretion
- Forma exacta del componente `LoadingOverlay` (tamaño/color/animation).
- Texto literal exacto de los Alerts (approach + ejemplos aprobados).
- Estructura interna de `driveBackupService.ts`.
- Estrategia de tests: mockear el SDK + cliente Drive. Tests unitarios para serializer + retention policy pura.
- Cuándo limpiar el cache `cozyhabits-pre-restore-*.json` (próximo restore exitoso, después de N días, o nunca).
- `FlatList` vs `ScrollView` para lista de backups; modal vs nueva pantalla.
- Setup detallado Google Cloud Console (SHA-1, OAuth client IDs, webClientId).
- Posición de la sección "Cloud backup" en Settings.

### Deferred Ideas (OUT OF SCOPE)
- **A V2:** Backup automático periódico (`DRIVE-V2-01`), tamaño total en Drive (`DRIVE-V2-02`), encryption (`DRIVE-V2-03`).
- **Surgieron en discusión (no entran a v1):** Diff vs datos actuales en restore; auto-retry exponencial; cache offline read-only de lista; botón "Limpiar backups antiguos"; sign-out/revoke separados; bottom sheet para errores; progress bar real (% bytes); cuándo limpiar pre-restore cache.
- **Out of scope del milestone:** Sync bidireccional real-time, multi-cloud (Dropbox/iCloud), import desde otras apps/CSV, merge on restore.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md) | Research Support |
|----|-------------------------------|-------------------|
| DRIVE-01 | Usuario puede autenticarse con Google. **NOTA:** texto literal menciona `expo-auth-session + drive.file` — OBSOLETO. D-01/D-02 reemplazan: `@react-native-google-signin/google-signin` + `drive.appdata` | OAuth Setup section + Standard Stack |
| DRIVE-02 | Subir backup completo a Drive con botón manual | Drive REST API: multipart upload + Code Examples |
| DRIVE-03 | Archivos nombrados `cozyhabits-YYYY-MM-DD.json` | File Strategy in Drive (D-05, D-12) |
| DRIVE-04 | Listar backups disponibles y seleccionar uno para restaurar | Drive REST API: `files.list` con `spaces=appDataFolder` |
| DRIVE-05 | Restaurar reemplazando datos locales con confirmación | Reuse de `parseAndValidate` + `restoreAllData` (Phase 2) + D-19 pre-restore cache |
| DRIVE-06 | Timestamp de último backup exitoso en Settings | `lastBackupAt` en `useSettingsStore` (D-09) |
| DRIVE-07 | Desconectar cuenta Google. **NOTA:** REQUIREMENTS.md dice "sign out + revocar acceso" pero D-10 cierra solo `signOut()` (sin revoke) | `signOut()` only (D-10) |
| DRIVE-08 | Errores de Drive con mensaje accionable | Error Mapping Table (D-26) |
</phase_requirements>

## Summary

Phase 3 agrega backup/restore manual a Google Drive sobre la base ya correcta de Phase 2 (`backupService` con tipos limpios). La arquitectura es deliberadamente "transporte sobre serializer existente": el nuevo `driveBackupService.ts` no toca SQL, no duplica validación, y consume `buildBackupData()` / `parseAndValidate()` promovidos a exports.

El stack está pre-cerrado: `@react-native-google-signin/google-signin@16.1.2` (peer `expo>=52.0.40`, RN `>=0.76` — el proyecto en Expo 54.0.33 + RN 0.81.5 está en el sweet spot) con scope `drive.appdata` (hidden, sin Google security review). La librería es **incompatible con Expo Go** — requiere EAS build (development o preview). Drive REST API v3 se llama directamente con `fetch` (multipart upload manual con boundary string; el wrapper RobinBobin no aporta lo suficiente sobre `fetch` directo y agrega dependency surface).

Las pitfalls críticas se concentran en (1) refresh tokens en Android: `getTokens()` puede devolver tokens caché expirados y `clearCachedAccessToken()` es flaky — la mitigación robusta es **`signInSilently()` antes de cada operación** Drive como pre-flight; (2) multipart body manual: FormData en RN produce "Malformed multipart body" — construir el string manualmente con `\r\n--boundary` separators; (3) Alerts inmediatamente después del callback de sign-in en Android pueden ser no-op porque la Activity todavía está null — usar `setTimeout(... , 0)` o esperar el next tick.

**Primary recommendation:** Implementar `driveBackupService.ts` como cliente HTTP delgado sobre `fetch` con `Authorization: Bearer ${accessToken}`, donde el accessToken se obtiene SIEMPRE haciendo `await GoogleSignin.signInSilently()` + `await GoogleSignin.getTokens()` justo antes de cada operación (no cachear el token en memoria). Build en 3 plans: 03-01 OAuth setup + store + silent sign-in startup; 03-02 driveBackupService (upload + list + download + retention) + Settings backup button; 03-03 Restore UI (lista + preview + confirm modal) + sign-out + error mapping. Cada plan termina con tests unitarios mockeando el SDK + `fetch`. UAT en EAS build con cuenta Google real cierra el milestone.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| OAuth con Google (sign-in / silent / sign-out) | Native module (google-signin SDK) | App startup hook (App.tsx) | El SDK gestiona tokens nativos (Keychain iOS / AccountManager Android); la app sólo invoca |
| Persistencia de email + last backup metadata | Zustand store (`useSettingsStore`) con `persist+fileStorage` | — | Misma capa donde viven los toggles. Persistencia con archivo JSON ya validada |
| Serialización JSON de la DB | `services/backupService.ts` (existente) | — | Phase 2 ya lo dejó tipado y limpio. Promover `buildBackupData` y `parseAndValidate` a exports |
| Comunicación con Drive REST (upload/list/download/delete) | `services/driveBackupService.ts` (NUEVO) | — | Layer separation: HTTP transport, no toca SQL ni store directo |
| Lectura/escritura de DB tras restore | `repositories/backupRepository.ts` (existente, `restoreAllData`) | — | Atómica con `withTransactionAsync`. No tocar |
| Retention policy (qué borrar tras backup) | Pure function en `driveBackupService.ts` (helper testeable) | — | Lógica determinística, ideal para test unitario sin mocks |
| UI de Settings con botones Connect/Backup/Restore/Sign-out | `screens/SettingsScreen.tsx` | `components/shared/LoadingOverlay.tsx` (NUEVO) | Patrón de Pressable + ActivityIndicator ya existe (handleExport/handleImport) |
| UI lista de backups + preview | `components/modals/RestoreListModal.tsx` (NUEVO) o `screens/RestoreFromDriveScreen.tsx` (NUEVO) | — | Decisión D-23 deja a Claude (decidir en plan 03-03 con UI snapshot) |
| Pre-restore safety cache | `expo-file-system/legacy` en `driveBackupService.ts` | `cacheDirectory` | Mismo módulo que `backupService` actual usa |
| Mapping de errores HTTP → Alert | Helper interno en `driveBackupService.ts` que retorna constante de `ALERT_DRIVE_*` | `Alert.alert` en screens | Service categoriza, screen presenta |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@react-native-google-signin/google-signin` | **16.1.2** (latest, publicado 2026-02-28) [VERIFIED: `npm view @react-native-google-signin/google-signin version`] | OAuth nativo Google + token management | Único fork mantenido (cozmo/react-native-google-signin está abandonado). Soporta `drive.appdata`. Peer deps `expo>=52.0.40`, RN `>=0.76` — compatible con el proyecto |
| Drive REST API v3 (vía `fetch`) | n/a | Upload, list, download, delete de archivos | Llamado directo HTTP. Wrappers npm (RobinBobin) agregan surface sin valor — la API es 4 endpoints |
| `expo-file-system` (legacy) | 19.0.21 ya instalado | Leer/escribir el JSON local antes de subir + pre-restore cache | Mismo módulo que `backupService` actual ya usa. NO migrar a la API nueva en este phase |
| `expo-application` o `react-native-device-info` | NO necesario | — | Drive no requiere app identity headers |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zustand` | 5.0.11 (ya) | Store de auth state (extender `useSettingsStore`) | Persistir `googleEmail`, `lastBackupAt`, `lastBackupFileId` |
| `lucide-react-native` | 0.564.0 (ya) | Íconos `Cloud`, `CloudUpload`, `CloudDownload`, `LogOut` | Settings buttons + lista items |
| `expo-secure-store` | 55.0.13 disponible | NO usar [VERIFIED: D-09 decide store + persist; SDK guarda token nativo internamente] | El SDK de google-signin guarda el accessToken en Keychain (iOS) / EncryptedSharedPreferences (Android) automáticamente. Nuestra app sólo persiste el `email`, que no es secreto |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@react-native-google-signin/google-signin` | `expo-auth-session` + `expo-web-browser` | **NO sirve** — issue confirmado, scope `drive.appdata` no funciona (D-01) |
| `fetch` directo a Drive | `@robinbobin/react-native-google-drive-api-wrapper` | Wrapper trae 4 endpoints encapsulados en una API propia; tests propios; menos control sobre headers/error handling. `fetch` directo es ~80 líneas extras pero más debuggeable |
| Multipart manual con boundary | `FormData` de RN | RN's FormData genera "Malformed multipart body" en Drive (issue documentado). Multipart manual con `\r\n--boundary` es la solución estable |
| `useSettingsStore` extendido | `useAuthStore` separado | YAGNI — un solo provider en v1 (D-09). Si V2 agrega Dropbox/iCloud, se justifica refactor |
| `revokeAccess()` | `signOut()` only | D-10: sign-out only para reconexión silenciosa al volver. `revokeAccess()` queda para V2 si user lo pide explícito |

**Installation:**
```bash
npm install @react-native-google-signin/google-signin@16.1.2
# Luego: prebuild + EAS build (no Expo Go)
npx expo prebuild --clean
npx eas build --profile development --platform android
```

**Version verification:**
```bash
npm view @react-native-google-signin/google-signin version  # 16.1.2 (2026-02-28)
npm view expo-secure-store version                          # 55.0.13 (no se usa)
```

## OAuth Setup (Google Cloud Console)

> Requisito de plan 03-01. Completar **antes** de escribir código.

**3 OAuth Client IDs requeridos en Google Cloud Console** [CITED: react-native-google-signin.github.io/docs/setting-up/get-config-file]:

| Client Type | Por qué | Cómo se obtiene |
|-------------|---------|------------------|
| **Web Client ID** | Es el `webClientId` que se pasa a `GoogleSignin.configure()`. Es el ID que el SDK usa para validar el `idToken` y para "offline access" (server-side). Aunque la app no tenga server, sigue siendo obligatorio | Cloud Console → Credentials → Create Credentials → OAuth client ID → **Web application** |
| **iOS Client ID** | Genera el "reversed client ID" que va en `iosUrlScheme` del plugin de app.json | Cloud Console → Credentials → Create OAuth client ID → **iOS** → bundle ID = `com.facupich.cozyhabit` (ver app.json — falta declarar `ios.bundleIdentifier`) |
| **Android Client ID(s)** | Una por cada SHA-1 fingerprint (debug + release + Play App Signing si aplica) | Cloud Console → Credentials → Create OAuth client ID → **Android** → package = `com.facupich.cozyhabit` + SHA-1 |

**Cómo obtener SHA-1 fingerprints:**
- **Debug local (no EAS):** `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`
- **EAS-managed keystore:** `eas credentials` → Android → seleccionar profile → "Configure existing credentials" muestra SHA-1
- **Play App Signing:** Google Play Console → App Integrity → muestra SHA-1 separado

**Scopes requeridos en Cloud Console:** `drive.appdata` se solicita programáticamente (no se configura en Cloud Console). Sí: el OAuth consent screen debe estar en **Testing** o **Production** con tu cuenta como tester. `drive.appdata` está marcado como **non-sensitive** [CITED: developers.google.com/drive/api/guides/appdata] — no requiere security review de Google.

**Configuración en `app.json`:**
```json
{
  "expo": {
    "android": {
      "package": "com.facupich.cozyhabit"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.facupich.cozyhabit"
    },
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
  }
}
```
[CITED: react-native-google-signin.github.io/docs/setting-up/expo]

**Configuración en código (un solo lugar, llamada al startup):**
```typescript
// App.tsx o src/services/googleAuth.ts
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId: '<WEB_CLIENT_ID>.apps.googleusercontent.com',
  iosClientId: '<IOS_CLIENT_ID>.apps.googleusercontent.com', // opcional si está en plugin
  scopes: ['https://www.googleapis.com/auth/drive.appdata'],
  offlineAccess: false, // true sólo si tuviéramos server backend
});
```

**`ios.bundleIdentifier` falta en app.json actual** [VERIFIED: leído app.json en este research]. Plan 03-01 debe agregarlo (`com.facupich.cozyhabit` consistente con `android.package`).

## Drive REST API v3 — Endpoints Necesarios

Base URL data API: `https://www.googleapis.com/drive/v3`
Base URL upload API: `https://www.googleapis.com/upload/drive/v3`
Header de auth en TODAS: `Authorization: Bearer ${accessToken}`

### 1. Listar backups (DRIVE-04)
[CITED: developers.google.com/drive/api/guides/appdata]

```
GET https://www.googleapis.com/drive/v3/files
  ?spaces=appDataFolder
  &q=name+contains+'cozyhabits-'+and+name+contains+'.json'+and+trashed=false
  &fields=files(id,name,size,createdTime,modifiedTime)
  &orderBy=createdTime+desc
  &pageSize=100
```
Respuesta:
```json
{
  "files": [
    {
      "id": "1AbCdEf...",
      "name": "cozyhabits-2026-04-27.json",
      "size": "12345",
      "createdTime": "2026-04-27T14:30:00.000Z",
      "modifiedTime": "2026-04-27T14:30:00.000Z"
    }
  ]
}
```

### 2. Subir backup nuevo (DRIVE-02 / DRIVE-03)
**Multipart upload (≤5 MB, suficiente para nuestro JSON)** [CITED: developers.google.com/drive/api/guides/manage-uploads]:

```
POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size
Content-Type: multipart/related; boundary=cozy_boundary_${timestamp}
```

Body manual (NO usar FormData en RN — pitfall conocido):
```
\r\n--cozy_boundary_xxx\r\n
Content-Type: application/json; charset=UTF-8\r\n
\r\n
{"name":"cozyhabits-2026-04-27.json","parents":["appDataFolder"],"mimeType":"application/json"}\r\n
--cozy_boundary_xxx\r\n
Content-Type: application/json\r\n
\r\n
{"version":1,"exportedAt":"2026-04-27T...","habits":[...],...}\r\n
--cozy_boundary_xxx--
```

### 3. Sobrescribir backup del día (D-12, PATCH)
```
PATCH https://www.googleapis.com/upload/drive/v3/files/{fileId}?uploadType=multipart&fields=id,name,size
Content-Type: multipart/related; boundary=cozy_boundary_${timestamp}
```
Mismo body. **Importante:** PATCH NO permite cambiar `parents` — el archivo sigue en appDataFolder. La metadata puede omitir `parents` (sólo `name` y `mimeType`).

### 4. Descargar backup para restore (DRIVE-05)
```
GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media
```
Body de respuesta = el JSON crudo. Parsear con `parseAndValidate()` ya existente.

### 5. Borrar backup viejo (D-14 retention)
```
DELETE https://www.googleapis.com/drive/v3/files/{fileId}
```
Respuesta: 204 No Content si OK. Importante: en `appDataFolder` el archivo NO se trashea — se borra permanentemente [CITED: developers.google.com/drive/api/guides/appdata: "files cannot be trashed"].

### Token retrieval pattern (CRÍTICO, ver Pitfall #1)

```typescript
async function getDriveAccessToken(): Promise<string> {
  // Re-trigger silent sign-in para forzar refresh en Android
  // (workaround del bug conocido getTokens() devuelve cached expirado)
  await GoogleSignin.signInSilently();
  const { accessToken } = await GoogleSignin.getTokens();
  return accessToken;
}
```

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         App.tsx (root)                                  │
│   useEffect(startup): GoogleSignin.configure() + signInSilently()       │
└─────┬──────────────────────────────────────────────────────────┬────────┘
      │                                                          │
      ▼                                                          │
┌──────────────────┐         ┌────────────────────────────┐     │
│ useSettingsStore │◄────────│ SettingsScreen             │     │
│ - googleEmail    │  read   │ - "Conectar con Google"    │     │
│ - lastBackupAt   │         │ - "Backup ahora"           │     │
│ - lastBackupFile │  set    │ - "Restaurar desde Drive"  │     │
└──────────────────┘         │ - "Cerrar sesión"          │     │
                             └─────────┬──────────────────┘     │
                                       │ click                  │
                                       ▼                        │
                             ┌──────────────────────┐           │
                             │ LoadingOverlay shown │           │
                             │ (Modal transparente) │           │
                             └─────────┬────────────┘           │
                                       │                        │
                                       ▼                        │
            ┌──────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────────────────────┐
│  driveBackupService.ts (NUEVO — transporte)                            │
│                                                                        │
│  signIn() ──► GoogleSignin.signIn() ──► email + tokens                 │
│  signOut() ──► GoogleSignin.signOut()                                  │
│                                                                        │
│  uploadBackup():                                                       │
│    1. data = backupService.buildBackupData()  ◄── (Phase 2 export)    │
│    2. token = await getDriveAccessToken()  ─── (signInSilently +      │
│                                                  getTokens)            │
│    3. fileId = await findTodayBackup(token)                            │
│    4. if fileId: confirmOverwrite() → PATCH                            │
│       else:      POST upload (multipart)                               │
│    5. updateLastBackupAt() in store                                    │
│    6. pruneOldBackups(token) (D-14 retention) ─ best-effort            │
│                                                                        │
│  listBackups() ──► GET drive/v3/files?spaces=appDataFolder             │
│                                                                        │
│  restoreFromBackup(fileId):                                            │
│    1. preRestoreCache = backupService.buildBackupData()  ──► writeFS  │
│    2. json = GET drive/v3/files/{id}?alt=media                         │
│    3. data = backupService.parseAndValidate(json)  ◄── (Phase 2)      │
│    4. await backupRepo.restoreAllData(...)  ◄── (existing, atómico)   │
│    5. refresh stores: fetchHabitsForDate + fetchLibrary                │
│                                                                        │
│  mapDriveError(httpResponse) ──► ALERT_DRIVE_* constant                │
└────────────────────────────────────────────────────────────────────────┘
            │                            │                  │
            ▼                            ▼                  ▼
   ┌─────────────────┐      ┌──────────────────┐    ┌──────────────────┐
   │ google-signin   │      │ Drive REST v3    │    │ backupService.ts │
   │ SDK (native)    │      │ via fetch()      │    │ (Phase 2)        │
   │                 │      │                  │    │ + backupRepo.ts  │
   │ Keychain (iOS)  │      │ Bearer token     │    │ (atómico txn)    │
   │ AccountMgr (And)│      │ multipart body   │    │                  │
   └─────────────────┘      └──────────────────┘    └──────────────────┘
```

### Recommended Project Structure

```
src/
├── services/
│   ├── backupService.ts              # MODIFICADO: export buildBackupData, parseAndValidate
│   ├── driveBackupService.ts         # NUEVO: signIn, signOut, upload, list, restore, retention
│   └── googleAuth.ts                 # OPCIONAL: wrapper de GoogleSignin.configure() + signInSilently()
├── store/
│   └── useSettingsStore.ts           # MODIFICADO: + 3 campos persistidos + setters
├── screens/
│   ├── SettingsScreen.tsx            # MODIFICADO: nueva sección "Backup en la nube"
│   ├── SettingsScreen.styles.ts      # MODIFICADO: estilos para nueva sección
│   └── RestoreFromDriveScreen.tsx    # NUEVO (o modal en components/modals/) — D-23 discreción
├── components/
│   └── shared/
│       └── LoadingOverlay.tsx        # NUEVO: Modal full-screen con ActivityIndicator
├── config/
│   └── constants.ts                  # MODIFICADO: + ALERT_DRIVE_* + RETENTION_RECENT_DAYS + BACKUP_FILE_PREFIX
├── utils/
│   └── driveRetention.ts             # NUEVO (helper testeable, puro): calcular qué archivos borrar
└── __tests__/
    ├── driveBackupService.test.ts    # NUEVO: mock fetch + GoogleSignin
    └── driveRetention.test.ts        # NUEVO: pure function tests
```

### Pattern 1: Layer Separation (Service / Repo / Store / Screen)

**What:** Drive HTTP en service; serialización en service existente; transactions en repo existente; estado de auth/timestamps en store; UI en screens.
**When to use:** Siempre — el codebase ya lo aplica consistentemente (Phase 2 lo refinó).
**Example:**
```typescript
// driveBackupService.ts
export async function uploadBackup(): Promise<{ fileId: string; size: number }> {
  const data = await buildBackupData(); // ← reuse Phase 2
  const json = JSON.stringify(data);
  const token = await getDriveAccessToken();
  const today = new Date().toISOString().slice(0, 10);
  const filename = `${BACKUP_FILE_PREFIX}${today}.json`;
  const existing = await findFileByName(filename, token);
  return existing
    ? await patchMultipart(existing.id, filename, json, token)
    : await postMultipart(filename, json, token);
}
```

### Pattern 2: Pre-flight Silent Sign-In (mitigates Android refresh bug)

**What:** Antes de cada operación Drive, llamar `signInSilently()` + `getTokens()` para forzar refresh.
**When to use:** Toda operación que use accessToken. Costo es bajo (<200ms cuando ya hay sesión válida).
**Example:**
```typescript
async function getDriveAccessToken(): Promise<string> {
  try {
    await GoogleSignin.signInSilently();
  } catch (err) {
    // Si silent sign-in falla, el user no tiene sesión válida
    throw new DriveAuthError('No active session');
  }
  const tokens = await GoogleSignin.getTokens();
  return tokens.accessToken;
}
```

### Pattern 3: Manual multipart body (NOT FormData)

**What:** Construir el body como string literal con `\r\n--boundary` separators.
**When to use:** Siempre que se interactúe con Drive multipart upload desde RN.
**Example:**
```typescript
// Source: https://cmichel.io/google-drive-in-react-native (verified pattern)
function buildMultipartBody(metadata: object, content: string, boundary: string): string {
  return (
    `\r\n--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`
  );
}
```

### Pattern 4: Existing Pressable + ActivityIndicator (replicar de SettingsScreen)

**What:** Botón con estado `isLoading`, `disabled` cuando loading, `ActivityIndicator` reemplaza ícono.
**When to use:** Botones de Settings (excepto cuando D-23 manda overlay full-screen para upload/restore).
**Example:** Ver `handleExport` actual (líneas 76-86 de SettingsScreen.tsx).

### Anti-Patterns to Avoid

- **No cachear el accessToken en variable de módulo o store.** El SDK ya lo cachea internamente; cachearlo dos veces produce drift y bugs imposibles de debuggear cuando expira.
- **No usar FormData para Drive multipart upload.** RN's FormData genera "Malformed multipart body" — issue documentado.
- **No hacer `Alert.alert` inmediatamente en el `.then()` de un sign-in callback en Android.** La Activity puede estar null. Usar `setTimeout(() => Alert.alert(...), 0)` o navegar al next tick.
- **No pasar `parents:["appDataFolder"]` en PATCH/update.** Sólo en POST inicial. PATCH conserva el parent. Pasarlo causa error.
- **No bloquear el render inicial con `signInSilently()`.** Correr en `useEffect` async no-await; si falla, log + continuar. Render de UI no espera.
- **No llamar `revokeAccess()` en sign-out (D-10).** Sólo `signOut()` para reconexión silenciosa.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth flow con Google (intent + redirect URIs + token exchange) | Custom `expo-web-browser` flow | `@react-native-google-signin/google-signin` | El SDK gestiona Keychain/AccountManager, refresh, revoke. Custom flow tiene 100+ edge cases (back nav, cancel, deep linking) |
| Almacenamiento seguro del accessToken | `expo-secure-store` con escritura propia | El SDK lo guarda automáticamente | Doble cache → drift → bugs |
| Multipart body builder | `FormData` | Plantilla de string manual (Pattern 3) | RN FormData incompatible con Drive multipart/related |
| Retry con backoff exponencial | Custom loop | Mostrar Alert con botón "Reintentar" (D-22) | YAGNI; user-driven retry es predecible |
| Cache offline de la lista de backups | Persistir lista en AsyncStorage | Empty state + "Reintentar" (D-25) | Sin red el user no puede restaurar igual |
| Diff visual entre backup y datos actuales | Computar conteos locales + diff | Mostrar conteos del backup en preview (D-17/D-18) | Deferred — overkill para v1 |
| Encryption del JSON antes de subir | AES con clave derivada de password | — | Deferred a `DRIVE-V2-03` |
| Silent token refresh con endpoint de Google | POST a `oauth2.googleapis.com/token` con refresh_token | `GoogleSignin.signInSilently() + getTokens()` | El SDK no expone refresh_token (issue documentado); usar pre-flight pattern (Pattern 2) |

**Key insight:** Drive backup es un dominio donde casi cada función reusable ya existe — Phase 2 dejó `buildBackupData/parseAndValidate` listos, `backupRepo.restoreAllData` es atómico, `useSettingsStore` con `persist+fileStorage` está validado. El código nuevo debería ser sobre todo glue + multipart body construction + error mapping.

## Common Pitfalls

### Pitfall 1: `getTokens()` returns expired token on Android (CRITICAL)

**What goes wrong:** En Android, `GoogleSignin.getTokens()` puede devolver el accessToken viejo expirado del cache nativo. `clearCachedAccessToken()` es flaky (issues #926, #1234 en GitHub) [VERIFIED: search results 2026].
**Why it happens:** El SDK guarda el token en AccountManager pero no siempre lo invalida cuando el server lo rechaza con 401.
**How to avoid:** Implementar Pattern 2 (Pre-flight `signInSilently()` antes de cada `getTokens()`). En la práctica, `signInSilently()` siempre fuerza al SDK a re-validar contra Google.
**Warning signs:** UAT en Android: hacer backup, esperar 60+ minutos, intentar otro backup → 401 sin que el SDK lo detecte. Plan 03-02 debe testear este escenario manualmente.

### Pitfall 2: FormData rompe multipart upload

**What goes wrong:** Usar `new FormData()` con `body.append('metadata', json)` + `body.append('file', content)` → Drive responde "Malformed multipart body".
**Why it happens:** RN's FormData no respeta el formato `multipart/related` que Drive espera (RFC 2387). Genera `multipart/form-data` con headers diferentes.
**How to avoid:** Construir el body como string manual (Pattern 3). Usar `fetch` con `body` string + `Content-Type: multipart/related; boundary=...`.
**Warning signs:** Test request en EAS build devuelve 400 con mensaje de Drive sobre multipart parsing.

### Pitfall 3: `Alert.alert` no-op tras sign-in callback en Android

**What goes wrong:** Llamar `Alert.alert("Conectado", ...)` inmediatamente en el `.then()` de `GoogleSignin.signIn()` → no aparece nada en Android.
**Why it happens:** La Activity de Google sign-in todavía está en transición de cierre cuando el callback resuelve [CITED: react-native-google-signin docs/errors].
**How to avoid:** Diferir el Alert con `setTimeout(() => Alert.alert(...), 0)` o usar `requestAnimationFrame`. Patrón más limpio: sólo actualizar el store y dejar que el render reactivo refleje el estado conectado; mostrar Alert sólo en errores.
**Warning signs:** UAT Android: tras conectar, no aparece feedback. UAT iOS: aparece normal (sólo Android tiene este bug).

### Pitfall 4: `parents:["appDataFolder"]` en PATCH causa error 400

**What goes wrong:** Reusar el mismo metadata blob para POST y PATCH → PATCH falla.
**Why it happens:** En PATCH, Drive interpreta `parents` como cambio de ubicación, pero archivos en appDataFolder no pueden moverse [CITED: developers.google.com/drive/api/guides/appdata].
**How to avoid:** Función separada `buildCreateMetadata()` (incluye `parents`) vs `buildUpdateMetadata()` (sólo `name`, `mimeType`).
**Warning signs:** Sobrescribir el backup del día devuelve 400 con `notSupportedForAppDataFolderFiles`.

### Pitfall 5: silent sign-in bloquea el render inicial

**What goes wrong:** `await GoogleSignin.signInSilently()` en el render del root → app muestra splash 2-3 segundos extra.
**Why it happens:** `signInSilently()` puede tomar varios segundos si la red está lenta o el SDK necesita renovar el token.
**How to avoid:** `useEffect` async sin awaitear el render; mostrar UI desconectada mientras corre, actualizar reactivo cuando termine. Mismo patrón de `initDatabase()` actual en App.tsx.
**Warning signs:** Splash visible más tiempo del normal en device físico.

### Pitfall 6: Faltó declarar `ios.bundleIdentifier` en app.json

**What goes wrong:** Plugin del SDK exige bundleIdentifier para configurar `iosUrlScheme`. Build falla en EAS con mensaje opaco.
**Why it happens:** app.json actual sólo tiene `android.package` (`com.facupich.cozyhabit`), no tiene `ios.bundleIdentifier` [VERIFIED: leído app.json en este research].
**How to avoid:** Plan 03-01 debe agregar `ios.bundleIdentifier: "com.facupich.cozyhabit"` (consistente con Android). Documentar en checklist.
**Warning signs:** EAS build de iOS falla en config phase.

### Pitfall 7: Drive query con espacios sin URL-encode

**What goes wrong:** `q=name contains 'cozyhabits-'` con espacios literales → 400 invalid query.
**Why it happens:** El parámetro `q` debe ir URL-encoded (`+` o `%20` para espacios, `%27` para comillas).
**How to avoid:** Usar `URLSearchParams` o `encodeURIComponent` para construir el query string completo.
**Warning signs:** GET de listing devuelve 400 con `Invalid query`.

### Pitfall 8: Retention pruning falla y bloquea backup exitoso

**What goes wrong:** Si DELETE de un archivo falla (404 si ya no existe, 401 si token expiró a mitad), un await sin try-catch tira la promesa entera.
**Why it happens:** Pruning corre después de upload exitoso (D-14). Si pruning tira, el llamador interpreta backup-failed.
**How to avoid:** Envolver pruning en `try { await prune(...) } catch (err) { console.warn(...) }` — D-14 explícito: "si el pruning falla, no fallar el backup".
**Warning signs:** UAT: backup exitoso pero usuario ve error rojo.

## Code Examples

> Verified patterns. Source attribution inline.

### Example 1: Configure + Silent Sign-In en App.tsx (Pattern verified)

```typescript
// App.tsx — agregar al startup, NO bloqueante
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useSettingsStore } from './src/store/useSettingsStore';

// En el módulo (configurar una sola vez):
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
  scopes: ['https://www.googleapis.com/auth/drive.appdata'],
  offlineAccess: false,
});

// En el componente App:
useEffect(() => {
  // Fire-and-forget: si falla, simplemente no hay sesión
  (async () => {
    try {
      const response = await GoogleSignin.signInSilently();
      if (response?.type === 'success') {
        useSettingsStore.getState().setGoogleEmail(response.data.user.email);
      }
    } catch {
      // No hay sesión guardada — UI mostrará "Conectar"
    }
  })();
}, []);
```
[CITED: react-native-google-signin.github.io/docs/api]

### Example 2: Sign-In interactivo

```typescript
async function connectGoogle(): Promise<string | null> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (response.type === 'success') {
    return response.data.user.email;
  }
  return null; // user canceled
}
```

### Example 3: Upload (POST) — multipart manual

```typescript
async function postMultipart(
  filename: string,
  jsonContent: string,
  token: string,
): Promise<{ id: string; name: string; size: string }> {
  const boundary = `cozy_boundary_${Date.now()}`;
  const metadata = {
    name: filename,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
  };
  const body =
    `\r\n--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${jsonContent}\r\n` +
    `--${boundary}--`;

  const url =
    'https://www.googleapis.com/upload/drive/v3/files' +
    '?uploadType=multipart&fields=id,name,size';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) throw await driveErrorFromResponse(res);
  return res.json();
}
```
[CITED: cmichel.io/google-drive-in-react-native + developers.google.com/drive/api/guides/manage-uploads]

### Example 4: List de backups con filtro

```typescript
async function listBackups(token: string): Promise<DriveFile[]> {
  const q = `name contains 'cozyhabits-' and name contains '.json' and trashed=false`;
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q,
    fields: 'files(id,name,size,createdTime)',
    orderBy: 'createdTime desc',
    pageSize: '100',
  });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw await driveErrorFromResponse(res);
  const data = await res.json();
  return data.files ?? [];
}
```

### Example 5: Download para restore

```typescript
async function downloadBackup(fileId: string, token: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw await driveErrorFromResponse(res);
  return res.text(); // JSON crudo, parseAndValidate lo procesa
}
```

### Example 6: Error mapping a constantes ALERT_DRIVE_*

```typescript
import {
  ALERT_DRIVE_NO_NETWORK,
  ALERT_DRIVE_AUTH_EXPIRED,
  ALERT_DRIVE_QUOTA,
  ALERT_DRIVE_PERMISSION,
  ALERT_DRIVE_GENERIC,
} from '../config/constants';

export type DriveAlertKey =
  | typeof ALERT_DRIVE_NO_NETWORK
  | typeof ALERT_DRIVE_AUTH_EXPIRED
  | typeof ALERT_DRIVE_QUOTA
  | typeof ALERT_DRIVE_PERMISSION
  | typeof ALERT_DRIVE_GENERIC;

export class DriveError extends Error {
  constructor(public alertKey: DriveAlertKey, public httpStatus?: number) {
    super(alertKey.title);
  }
}

async function driveErrorFromResponse(res: Response): Promise<DriveError> {
  let reason = '';
  try {
    const body = await res.json();
    reason = body?.error?.errors?.[0]?.reason ?? '';
  } catch { /* ignore */ }

  if (res.status === 401) return new DriveError(ALERT_DRIVE_AUTH_EXPIRED, 401);
  if (res.status === 403 && reason === 'storageQuotaExceeded')
    return new DriveError(ALERT_DRIVE_QUOTA, 403);
  if (res.status === 403 && reason === 'appNotAuthorizedToFile')
    return new DriveError(ALERT_DRIVE_PERMISSION, 403);
  if (res.status === 403) return new DriveError(ALERT_DRIVE_PERMISSION, 403);
  return new DriveError(ALERT_DRIVE_GENERIC, res.status);
}

// En el catch del screen:
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && /network|fetch/i.test(err.message);
}
```
[CITED: developers.google.com/drive/api/guides/handle-errors]

### Example 7: Pre-restore safety cache (D-19)

```typescript
import * as FileSystem from 'expo-file-system/legacy';
import { buildBackupData } from './backupService';

async function writePreRestoreCache(): Promise<string> {
  const data = await buildBackupData();
  const json = JSON.stringify(data, null, 2);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const path = `${FileSystem.cacheDirectory}cozyhabits-pre-restore-${ts}.json`;
  await FileSystem.writeAsStringAsync(path, json, { encoding: 'utf8' });
  return path;
}
```

### Example 8: Retention policy (pure function, testable)

```typescript
// utils/driveRetention.ts
export interface RetainableFile {
  id: string;
  name: string; // cozyhabits-YYYY-MM-DD.json
  createdTime: string; // ISO
}

const RETENTION_RECENT_DAYS = 30;

/**
 * Dado un set de archivos en Drive, devuelve los IDs que deben borrarse según
 * D-14: últimos 30 diarios + 1 por mes anterior + 1 por año anterior.
 * Función pura — no toca Drive ni red.
 */
export function computeFilesToDelete(
  files: RetainableFile[],
  now: Date = new Date(),
): string[] {
  const cutoffRecent = new Date(now);
  cutoffRecent.setDate(cutoffRecent.getDate() - RETENTION_RECENT_DAYS);
  const cutoffMonthly = new Date(now);
  cutoffMonthly.setFullYear(cutoffMonthly.getFullYear() - 1);

  const sorted = [...files].sort(
    (a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime(),
  );

  const keep = new Set<string>();
  // Últimos 30 días: keep all
  for (const f of sorted) {
    if (new Date(f.createdTime) >= cutoffRecent) keep.add(f.id);
  }
  // Entre 30 días y 12 meses: keep el más antiguo de cada mes
  const byMonth = new Map<string, RetainableFile>();
  for (const f of sorted) {
    const d = new Date(f.createdTime);
    if (d < cutoffRecent && d >= cutoffMonthly) {
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
      const cur = byMonth.get(key);
      if (!cur || new Date(cur.createdTime) > d) byMonth.set(key, f);
    }
  }
  byMonth.forEach((f) => keep.add(f.id));
  // Anterior a 12 meses: keep el más antiguo de cada año
  const byYear = new Map<number, RetainableFile>();
  for (const f of sorted) {
    const d = new Date(f.createdTime);
    if (d < cutoffMonthly) {
      const key = d.getUTCFullYear();
      const cur = byYear.get(key);
      if (!cur || new Date(cur.createdTime) > d) byYear.set(key, f);
    }
  }
  byYear.forEach((f) => keep.add(f.id));

  return files.filter((f) => !keep.has(f.id)).map((f) => f.id);
}
```

## Error Mapping Table (DRIVE-08, D-26)

| Trigger | HTTP / Source | Reason field | Constante a mostrar | Texto base |
|---------|---------------|---------------|---------------------|------------|
| `fetch` lanza `TypeError` con "Network request failed" | n/a (offline) | n/a | `ALERT_DRIVE_NO_NETWORK` | "Sin conexión a internet. Verificá tu red e intentá de nuevo." |
| `signInSilently` lanza con `NoSavedCredentialFound` | SDK | n/a | `ALERT_DRIVE_AUTH_EXPIRED` | "Tu sesión expiró. Volvé a conectar tu cuenta de Google." |
| Drive API responde 401 | HTTP 401 | `authError` | `ALERT_DRIVE_AUTH_EXPIRED` | igual |
| Drive API 403 | HTTP 403 | `storageQuotaExceeded` | `ALERT_DRIVE_QUOTA` | "Tu Google Drive está lleno. Liberá espacio o usá otra cuenta." |
| Drive API 403 | HTTP 403 | `appNotAuthorizedToFile` | `ALERT_DRIVE_PERMISSION` | "Cozy Habits ya no tiene acceso a tu Drive. Reconectá tu cuenta." |
| Drive API 403 | HTTP 403 | `userRateLimitExceeded` o `rateLimitExceeded` | `ALERT_DRIVE_GENERIC` | "Algo salió mal. Intentá de nuevo en unos minutos." (con retry) |
| Drive API 5xx / 429 | HTTP 5xx, 429 | n/a | `ALERT_DRIVE_GENERIC` | igual (con retry) |
| `notSupportedForAppDataFolderFiles` (caso edge: trash en appData) | HTTP 400 | `notSupportedForAppDataFolderFiles` | `ALERT_DRIVE_GENERIC` | igual (defensa: este error indica bug del lado nuestro, no del user) |
| Sign-in interactivo cancelado por user | SDK | `SIGN_IN_CANCELLED` | (silencioso, no Alert) | — |

[CITED: developers.google.com/drive/api/guides/handle-errors] [VERIFIED: cross-checked vs CONTEXT D-26]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `expo-google-app-auth` | `@react-native-google-signin/google-signin` | 2021 (deprecated officially) | Old package no recibe updates; new SDK soporta SDK 54 |
| `expo-auth-session` for Drive | `google-signin` SDK | 2024+ (drive.appdata bug) | `expo-auth-session` no soporta el scope; D-01 lock |
| Original Google Sign-In API | "Web Sign-In" / Credential Manager (Android 14+) | 2024 | El SDK envuelve ambos; user no debe preocuparse |
| `cozmo/react-native-google-signin` | `react-native-google-signin/google-signin` | 2020 fork | Original abandoned; nuevo fork mantenido activamente (publish 2026-02-28) |

**Deprecated/outdated:**
- `expo-google-app-auth` — replaced years ago; do not consider.
- `expo-auth-session` — works for sign-in only; doesn't support Drive scopes reliably.
- `react-native-fs` for file reading — `expo-file-system` is the standard in this project.

## Validation Architecture

> Required: `workflow.nyquist_validation: true` en `.planning/config.json` [VERIFIED].

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30.3.0 + ts-jest 29.4.6 [VERIFIED: `package.json` + `jest.config.js`] |
| Config file | `jest.config.js` — `testEnvironment: 'node'`, no type-check, `transformIgnorePatterns: ['node_modules/(?!(expo-sqlite\|expo-crypto)/)']` |
| Quick run command | `npm test -- --testPathPattern=driveBackupService` |
| Full suite command | `npm test` |
| Coverage | `npm run test:coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| DRIVE-01 | `connectGoogle()` calls `GoogleSignin.signIn()`, retorna email en éxito, retorna null en cancel | unit (mocked SDK) | `npm test -- driveBackupService.test.ts -t "connectGoogle"` | ❌ Wave 0 |
| DRIVE-01 | `signInSilently` startup actualiza `googleEmail` en store si tiene sesión | unit (mocked SDK + zustand store) | `npm test -- driveBackupService.test.ts -t "silent sign-in"` | ❌ Wave 0 |
| DRIVE-02 | `uploadBackup()` hace POST multipart cuando NO existe archivo del día | unit (mocked fetch) | `npm test -- driveBackupService.test.ts -t "uploadBackup new"` | ❌ Wave 0 |
| DRIVE-02 | `uploadBackup()` hace PATCH cuando SÍ existe archivo del día (después de confirmar) | unit (mocked fetch + Alert) | `npm test -- driveBackupService.test.ts -t "uploadBackup existing"` | ❌ Wave 0 |
| DRIVE-02 | `uploadBackup()` actualiza `lastBackupAt` y `lastBackupFileId` post-éxito | unit (mocked fetch + store) | `npm test -- driveBackupService.test.ts -t "post-success metadata"` | ❌ Wave 0 |
| DRIVE-03 | El metadata enviado contiene `name` con formato `cozyhabits-YYYY-MM-DD.json` | unit (assert sobre body interceptado) | `npm test -- driveBackupService.test.ts -t "filename format"` | ❌ Wave 0 |
| DRIVE-04 | `listBackups()` retorna sólo archivos con prefijo `cozyhabits-` y extensión `.json`, ordenados desc | unit (mocked fetch responde varios) | `npm test -- driveBackupService.test.ts -t "listBackups filter"` | ❌ Wave 0 |
| DRIVE-04 | `listBackups()` con respuesta vacía retorna array vacío (no crash) | unit | `npm test -- driveBackupService.test.ts -t "listBackups empty"` | ❌ Wave 0 |
| DRIVE-05 | `restoreFromBackup(fileId)` escribe pre-restore cache, luego llama `parseAndValidate` y `restoreAllData` | unit (mocked fetch + FS + repo) | `npm test -- driveBackupService.test.ts -t "restoreFromBackup happy"` | ❌ Wave 0 |
| DRIVE-05 | Si `parseAndValidate` falla (JSON inválido), `restoreAllData` NO se llama | unit | `npm test -- driveBackupService.test.ts -t "restore invalid json"` | ❌ Wave 0 |
| DRIVE-05 | El pre-restore cache se escribe con timestamp en nombre y en `cacheDirectory` | unit | `npm test -- driveBackupService.test.ts -t "pre-restore cache path"` | ❌ Wave 0 |
| DRIVE-06 | `lastBackupAt` se persiste vía `partialize` extendido | unit (rehydrate store) | `npm test -- useSettingsStore.test.ts -t "persistence drive fields"` | ❌ Wave 0 |
| DRIVE-07 | `signOut()` limpia `googleEmail` pero NO `lastBackupAt` ni `lastBackupFileId` (D-11) | unit | `npm test -- driveBackupService.test.ts -t "signOut preserves metadata"` | ❌ Wave 0 |
| DRIVE-07 | `signOut()` NO llama `revokeAccess()` (D-10) | unit (assert mock not called) | `npm test -- driveBackupService.test.ts -t "no revokeAccess"` | ❌ Wave 0 |
| DRIVE-08 | 401 → `ALERT_DRIVE_AUTH_EXPIRED` | unit (table-driven) | `npm test -- driveBackupService.test.ts -t "error mapping 401"` | ❌ Wave 0 |
| DRIVE-08 | 403 storageQuotaExceeded → `ALERT_DRIVE_QUOTA` | unit | idem | ❌ Wave 0 |
| DRIVE-08 | 403 appNotAuthorizedToFile → `ALERT_DRIVE_PERMISSION` | unit | idem | ❌ Wave 0 |
| DRIVE-08 | TypeError network → `ALERT_DRIVE_NO_NETWORK` | unit | idem | ❌ Wave 0 |
| DRIVE-08 | 5xx / 429 / unknown → `ALERT_DRIVE_GENERIC` | unit | idem | ❌ Wave 0 |
| D-14 (retention) | Pure function `computeFilesToDelete`: con 35 backups diarios, conserva 30 | unit (puro) | `npm test -- driveRetention.test.ts -t "30 daily kept"` | ❌ Wave 0 |
| D-14 | Conserva 1 por mes para entries entre 30d y 12mo | unit | `npm test -- driveRetention.test.ts -t "monthly retention"` | ❌ Wave 0 |
| D-14 | Conserva 1 por año anterior a 12 meses | unit | `npm test -- driveRetention.test.ts -t "yearly retention"` | ❌ Wave 0 |
| D-14 | Si `pruneOldBackups` falla, `uploadBackup` no falla (best-effort) | unit (force throw) | `npm test -- driveBackupService.test.ts -t "prune failure swallowed"` | ❌ Wave 0 |
| **OAuth E2E (DRIVE-01..DRIVE-08)** | Sign-in real, backup real, restore real, sign-out real, errores reales | **manual UAT** (EAS build + cuenta Google) | n/a | n/a — ver UAT |

### Sampling Rate

- **Per task commit:** `npm test -- --testPathPattern=drive` (subset rápido)
- **Per wave merge:** `npm test` (suite completa)
- **Phase gate:** Full suite green + UAT manual completo (5 success criteria de ROADMAP) antes de `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/driveBackupService.test.ts` — cubre DRIVE-01, 02, 03, 04, 05, 07, 08 (mock `@react-native-google-signin/google-signin` + `fetch` global + `expo-file-system/legacy`)
- [ ] `src/__tests__/driveRetention.test.ts` — cubre D-14 retention policy (función pura)
- [ ] `src/__tests__/useSettingsStore.test.ts` — extender (si existe) o crear; cubre DRIVE-06 persist + signOut behavior
- [ ] `__mocks__/google-signin.ts` — manual mock del SDK con `signIn`, `signInSilently`, `signOut`, `getTokens`, `hasPlayServices` mockeados
- [ ] No requiere instalar framework — Jest 30 + ts-jest ya configurado

### Manual UAT Checklist (NO automatizable)

> Ejecutar en EAS development build con cuenta Google real (no Expo Go).

- [ ] **Auth happy path:** Settings → "Conectar con Google" → flow nativo → vuelve a app → email visible
- [ ] **Silent sign-in:** Cerrar app, volver a abrir → email visible sin click
- [ ] **Backup primer día:** "Backup ahora" → overlay → éxito → timestamp visible
- [ ] **Backup mismo día (overwrite):** "Backup ahora" 2da vez → Alert "ya existe" → confirmar → éxito → timestamp actualizado
- [ ] **Backup mismo día cancelado:** "Backup ahora" → Alert → cancelar → no se sube nada, nada cambia
- [ ] **List de backups:** Settings → "Restaurar desde Drive" → lista muestra backups recientes orden desc
- [ ] **Restore happy path:** Tap item → preview con conteos → confirmar → overlay → éxito → datos restaurados (verificar al menos 1 hábito desde backup)
- [ ] **Pre-restore cache:** Restaurar exitoso → archivo `cozyhabits-pre-restore-*.json` aparece en cacheDirectory (verificar con script o emulator filesystem)
- [ ] **Sign-out:** "Cerrar sesión" → Alert → confirmar → email desaparece, `lastBackupAt` se conserva
- [ ] **Re-conexión post sign-out:** "Conectar con Google" → debe ser silencioso (sin volver a pedir consent — D-10)
- [ ] **Sin red — backup:** modo avión → "Backup" → Alert `ALERT_DRIVE_NO_NETWORK`
- [ ] **Sin red — list:** modo avión → "Restaurar" → empty state + reintentar
- [ ] **Token expirado en Android (after 60+ min):** dejar la app, volver, hacer backup → debe funcionar (Pattern 2 protege)
- [ ] **Quota llena:** simular con cuenta de prueba con cuota llena (o mockear) → Alert `ALERT_DRIVE_QUOTA`
- [ ] **Acceso revocado externamente:** revocar acceso desde myaccount.google.com → backup → Alert `ALERT_DRIVE_PERMISSION`
- [ ] **Retention policy real:** simular 35+ backups (o forzar fechas) → tras backup #36, los más viejos se borran según D-14
- [ ] **Cancel sign-in:** "Conectar" → cancelar el dialog nativo → app vuelve sin error visible (silencioso)

## Files to Create / Modify

| Path | Action | Purpose |
|------|--------|---------|
| `package.json` | modify | add `@react-native-google-signin/google-signin: 16.1.2` |
| `app.json` | modify | add `ios.bundleIdentifier`, plugin entry para google-signin (con `iosUrlScheme`) |
| `src/services/backupService.ts` | modify | promote `buildBackupData` y `parseAndValidate` a `export function` |
| `src/services/driveBackupService.ts` | **NEW** | core: `connectGoogle`, `signOut`, `uploadBackup`, `listBackups`, `restoreFromBackup`, `pruneOldBackups`, `getDriveAccessToken`, `mapDriveError` |
| `src/services/googleAuth.ts` | **NEW** (opcional) | wrapper de `GoogleSignin.configure()` + `signInSilently()` para keepar App.tsx limpio |
| `src/store/useSettingsStore.ts` | modify | + 3 fields persisted: `googleEmail`, `lastBackupAt`, `lastBackupFileId` + setters; extender `partialize` |
| `src/screens/SettingsScreen.tsx` | modify | add sección "Backup en la nube" — botones connect/backup/restore/sign-out |
| `src/screens/SettingsScreen.styles.ts` | modify | estilos para nueva sección (reusar tokens existentes `colors.amber*`) |
| `src/components/shared/LoadingOverlay.tsx` | **NEW** | Modal transparente full-screen + `ActivityIndicator` + texto contextual (~30 LOC) |
| `src/screens/RestoreFromDriveScreen.tsx` o `src/components/modals/RestoreListModal.tsx` | **NEW** (D-23 discreción) | lista backups + preview + confirm modal |
| `src/utils/driveRetention.ts` | **NEW** | pure function `computeFilesToDelete()` (D-14) |
| `src/config/constants.ts` | modify | + `ALERT_DRIVE_NO_NETWORK`, `ALERT_DRIVE_AUTH_EXPIRED`, `ALERT_DRIVE_QUOTA`, `ALERT_DRIVE_PERMISSION`, `ALERT_DRIVE_GENERIC`, `ALERT_DRIVE_OVERWRITE` (confirm), `ALERT_DRIVE_RESTORE_CONFIRM`, `ALERT_DRIVE_SIGNOUT_CONFIRM`, `ALERT_DRIVE_RESTORE_SUCCESS`, `BACKUP_FILE_PREFIX = 'cozyhabits-'`, `RETENTION_RECENT_DAYS = 30` |
| `App.tsx` | modify | + `GoogleSignin.configure()` (top-level) + `useEffect` no-bloqueante con `signInSilently()` |
| `src/__tests__/driveBackupService.test.ts` | **NEW** | tests unitarios mockeando SDK + fetch + FS + repo |
| `src/__tests__/driveRetention.test.ts` | **NEW** | tests unitarios pure function |
| `src/__tests__/useSettingsStore.test.ts` | **NEW** (o agregar a existente) | tests de partialize + signOut behavior |
| `__mocks__/google-signin.ts` | **NEW** | manual mock del SDK |
| `eas.json` | likely OK (no change) | development profile ya existe |

## Project Constraints (from CLAUDE.md)

- **Planning obligatorio antes de código** — este RESEARCH.md alimenta el planner; el plan se valida antes de implementar.
- **Tareas pequeñas** — el ROADMAP define 3 plans (03-01, 03-02, 03-03); coherente.
- **Cada funcionalidad define comportamiento esperado + criterios de verificación + casos borde + tests.** — Validation Architecture cubre.
- **No duplicar código.** — re-usar `buildBackupData/parseAndValidate` (Phase 2 export), `restoreAllData` (existing), patrón Pressable+ActivityIndicator (existing).
- **Refactor si función >20 líneas.** — `driveBackupService.ts` debe partirse en helpers (multipart builder, error mapper, token getter, retention runner).
- **Separar lógica y presentación.** — service NO toca UI. Screens consumen.
- **Actualizar `.md` desactualizados.** — `STATE.md` y `PROJECT.md` se actualizan en `/gsd-verify-work` post-phase.
- **Estrategia de subagentes liberal.** — n/a a research.
- **Self-improvement loop con `tasks/lessons.md`.** — si surge una corrección durante implementación, capturarla.
- **Frontend rules:** React funcional con hooks; componentes pequeños y reutilizables; sin inline styling; CSS separado y reutilizable; parametrizar colores. — `LoadingOverlay` y nueva sección de Settings deben respetar.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | dev/test | ✓ | tooling | — |
| Jest | tests | ✓ | 30.3.0 | — |
| ts-jest | tests | ✓ | 29.4.6 | — |
| Expo CLI | build | ✓ (via `npx`) | 54.x | — |
| EAS CLI | OAuth-capable build | ⚠️ requerido | >=18.0.1 (eas.json declara) | usuario debe instalar `npm i -g eas-cli` y `eas login` |
| Google Cloud Console access | OAuth client IDs | ⚠️ usuario | n/a | — |
| Cuenta Google de prueba | UAT | ⚠️ usuario | n/a | — |
| Android device físico o emulador (Google Play) | UAT Android | ⚠️ usuario | Google Play services obligatorio | iOS-only validation si imposible |
| iOS device físico (sin TestFlight) | UAT iOS | ⚠️ usuario | n/a | EAS internal distribution |

**Missing dependencies con no fallback:**
- EAS account + login configurado — bloqueante para UAT (D-04). Plan 03-01 incluye checklist.
- Google Cloud project con OAuth client IDs creados — bloqueante. Plan 03-01 incluye procedimiento.
- SHA-1 fingerprints obtenidos — bloqueante para Android. Plan 03-01 documenta `eas credentials`.

**Missing dependencies con fallback:**
- Test sin red real: mockear `fetch` global con `jest.fn()` (estándar Jest). Tests unitarios cubren todo lo automatizable; UAT manual cubre lo que require red real.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | El JSON del backup pesa <5MB → multipart simple alcanza | Drive REST API | Si crece (>5MB), Drive devuelve 413; fix: switch a resumable upload (`uploadType=resumable`). Para v1 con 1 user es seguro. |
| A2 | `expo-file-system/legacy` sigue disponible en Expo 54 | Code Examples | Si Expo deprecó: cambiar a la nueva API File-based. Verificación: el repo lo usa hoy en producción. |
| A3 | El bug de Android `getTokens()` cached expirado se mitiga con `signInSilently()` pre-flight | Pattern 2 + Pitfall 1 | Issue antiguo (#1234, 2024). Mi mitigación es el workaround estándar de la comunidad pero no oficialmente confirmada por mantainer. UAT crítico para validar. |
| A4 | El SDK guarda el accessToken automáticamente en Keychain/AccountManager (no requerimos `expo-secure-store`) | Standard Stack | [VERIFIED parcial: lo afirma docs/api]. Si no, agregar persistencia explícita (improbable). |
| A5 | Drive API `q=name contains 'cozyhabits-' and ...trashed=false` no requiere OR especial — Drive lo evalúa correctamente con AND | Drive REST endpoints | Si Drive interpreta sintaxis distinta, ajustar query. Validable rápido en UAT. |
| A6 | Bundle ID Android `com.facupich.cozyhabit` debe replicarse en iOS sin conflicto con cuenta Apple Dev del usuario | OAuth Setup | Si conflicto: usar otro identifier consistente (`com.facupich.cozyhabits` plural, etc.). |
| A7 | El usuario tiene EAS account configurado y al menos un build profile de development funcional | Environment Availability | Si no: bloqueador real, plan 03-01 incluye checklist explícito. |
| A8 | La cuenta Google de testing tiene Drive habilitado (default), sin restricciones org Workspace | UAT | Si tiene restricciones, los scopes pueden ser bloqueados por admin. User → cuenta personal Gmail. |

## Open Questions

1. **¿Cómo manejar el cleanup del cache `cozyhabits-pre-restore-*.json` (D-19)?**
   - What we know: D-19 establece la creación; CONTEXT marca el cleanup como Claude's discretion.
   - What's unclear: si limpiar al próximo restore exitoso, después de N días, o nunca (en cuyo caso el sistema lo limpia eventualmente).
   - Recommendation: limpiar al próximo restore exitoso (mantener el último siempre como red de seguridad). Plan 03-03 decide.

2. **¿La sección "Cloud backup" en Settings va separada o fusionada con "Seguridad y Datos"?**
   - What we know: D-23 lo deja a Claude con UI snapshot.
   - What's unclear: separada (más explícita) vs fusionada (menos clutter).
   - Recommendation: nueva sección separada arriba de "Seguridad y Datos" — más clara para el user. Plan 03-03 produce UI spec.

3. **¿Modal expandible vs nueva pantalla para restore list?**
   - What we know: D-17/D-18 piden lista + preview + confirm.
   - What's unclear: forma exacta del flow.
   - Recommendation: nueva pantalla `RestoreFromDriveScreen` con `AppScreenHeader` + `FlatList` (consistente con resto de la app que usa screens en el stack). Modal anidado para preview. Plan 03-03 produce UI spec.

4. **¿`offlineAccess: true` o `false` en `GoogleSignin.configure()`?**
   - What we know: app no tiene server backend; el SDK refresca tokens internamente.
   - What's unclear: con `offlineAccess: true` el SDK pide un `serverAuthCode` que no se usa.
   - Recommendation: `offlineAccess: false` — minimiza data requested al user en consent screen.

5. **¿UAT en iOS y Android, o sólo uno?**
   - What we know: app es cross-platform; bug de `getTokens()` sólo en Android; bug de Alert sólo en Android.
   - What's unclear: capacidad del user de testear ambos.
   - Recommendation: UAT en Android obligatorio (donde están los bugs); iOS si dispositivo disponible. Documentar en plan 03-03.

## Sources

### Primary (HIGH confidence)
- [react-native-google-signin/docs/setting-up/expo](https://react-native-google-signin.github.io/docs/setting-up/expo) — Plugin config + Expo Go incompat
- [react-native-google-signin/docs/setting-up/get-config-file](https://react-native-google-signin.github.io/docs/setting-up/get-config-file) — 3 OAuth client IDs requeridos
- [react-native-google-signin/docs/api](https://react-native-google-signin.github.io/docs/api) — `configure`, `signIn`, `signInSilently`, `getTokens`, `signOut`, `revokeAccess`
- [react-native-google-signin/docs/original](https://react-native-google-signin.github.io/docs/original) — `getTokens()` auto-refresh iOS-only; Android requiere `clearCachedAccessToken`
- [react-native-google-signin/docs/errors](https://react-native-google-signin.github.io/docs/errors) — `statusCodes`, Alert no-op en Android post sign-in
- [developers.google.com/drive/api/guides/appdata](https://developers.google.com/drive/api/guides/appdata) — `drive.appdata` scope, `parents:["appDataFolder"]`, list con `spaces=appDataFolder`, no-trash
- [developers.google.com/drive/api/guides/manage-uploads](https://developers.google.com/drive/api/guides/manage-uploads) — multipart vs resumable, 5MB threshold, exact endpoints
- [developers.google.com/drive/api/guides/handle-errors](https://developers.google.com/drive/api/guides/handle-errors) — 401/403/429/5xx mapping, `storageQuotaExceeded` vs `rateLimitExceeded`
- npm registry — `@react-native-google-signin/google-signin@16.1.2` published 2026-02-28

### Secondary (MEDIUM confidence)
- [cmichel.io/google-drive-in-react-native](https://cmichel.io/google-drive-in-react-native) — multipart manual body construction (cross-checked vs Google docs)
- [GitHub issue #1234](https://github.com/react-native-google-signin/google-signin/issues/1234) — Android refresh bug (multiple corroborating issues #926, #792, #673)

### Tertiary (LOW confidence — flagged for UAT validation)
- Workaround específico `signInSilently()` pre-flight en Android — patrón comunitario, no documentado oficialmente. **UAT debe verificar.**
- `setTimeout(() => Alert.alert(...), 0)` post sign-in en Android — patrón general de RN, no específico de google-signin docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — version verified contra npm; peer deps explícitos; Expo Go incompat documentado por el proyecto.
- Architecture: HIGH — re-uses existing patterns (Phase 2 lo refinó), single new transport service.
- OAuth setup: HIGH — pasos verificados con docs oficiales.
- Drive REST endpoints: HIGH — todos los endpoints citados con docs oficiales + curl examples.
- Multipart body: MEDIUM — pattern cross-checked en 2 fuentes pero RN-FormData incompat es comunitario, no Google official.
- Pitfalls 1 (Android getTokens): MEDIUM — issue confirmado, workaround es comunitario. UAT crítico.
- Pitfalls 3 (Android Alert no-op): MEDIUM — documentado en errors page del SDK pero sin code sample del workaround.
- Retention policy (D-14): HIGH — lógica pura, fácilmente testeable.

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (30 días — google-signin SDK puede liberar minor; Drive API es estable)

---

*Phase: 03-google-drive-backup*
*Researcher: gsd-phase-researcher*
