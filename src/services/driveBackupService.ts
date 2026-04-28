/**
 * driveBackupService.ts — Transporte de respaldos a Google Drive (Phase 3).
 *
 * signIn / signOut: delega en GoogleSignin SDK (D-10: signOut local, sin revocar acceso).
 * uploadBackup: serializa con backupService.buildBackupData y sube via Drive REST v3
 *   (multipart manual armado por concatenación de strings — Pitfall #2). Si ya hay
 *   backup del día, PATCH al fileId existente (D-12); el caller debe haber
 *   confirmado (D-13).
 * listBackups: GET drive/v3/files con filtro `name contains 'cozyhabits-'` (D-16),
 *   ordenado por createdTime desc (D-15).
 * downloadBackup: GET con alt=media — retorna el JSON crudo.
 * pruneOldBackups: post-backup best-effort (D-14, Pitfall #8: NUNCA throws).
 *
 * Auth tokens se obtienen JIT vía signInSilently + getTokens (Pre-flight pattern,
 * Pitfall #1 — workaround Android cached token expirado).
 *
 * NO toca SQL — eso vive en backupRepository (vía backupService.restoreData).
 */
import * as FileSystem from 'expo-file-system/legacy';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import {
  BACKUP_FILE_PREFIX,
  BACKUP_FILE_EXTENSION,
  ALERT_DRIVE_NO_NETWORK,
  ALERT_DRIVE_AUTH_EXPIRED,
  ALERT_DRIVE_QUOTA,
  ALERT_DRIVE_PERMISSION,
  ALERT_DRIVE_GENERIC,
} from '../config/constants';
import { buildBackupData, parseAndValidate, restoreData } from './backupService';
import type { BackupData } from '../types';
import { selectFilesToPrune } from '../utils/driveRetention';

// ─── Tipos públicos ──────────────────────────────────────────────────

export interface DriveBackupFile {
  id: string;
  name: string;
  size: string;       // Drive devuelve size como string
  createdTime: string; // ISO
}

export type DriveAlert =
  | typeof ALERT_DRIVE_NO_NETWORK
  | typeof ALERT_DRIVE_AUTH_EXPIRED
  | typeof ALERT_DRIVE_QUOTA
  | typeof ALERT_DRIVE_PERMISSION
  | typeof ALERT_DRIVE_GENERIC;

export class DriveError extends Error {
  alert: DriveAlert;
  constructor(alert: DriveAlert, cause?: unknown) {
    super(alert.title);
    this.alert = alert;
    if (cause) (this as unknown as { cause: unknown }).cause = cause;
  }
}

export interface UploadResult {
  fileId: string;
  name: string;
  size: string;
  /** true si se sobrescribió un backup del día existente. */
  overwrote: boolean;
}

// ─── Constantes internas ─────────────────────────────────────────────

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

// ─── Auth ────────────────────────────────────────────────────────────

/**
 * Inicia sign-in interactivo. Retorna email o null si user canceló.
 * SDK 16 puede señalizar cancelación de dos formas: response.type==='cancelled' o
 * Promise reject con code === SIGN_IN_CANCELLED. Ambos retornan null.
 */
export async function signIn(): Promise<{ email: string } | null> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response?.type === 'success' && response.data?.user?.email) {
      return { email: response.data.user.email };
    }
    return null;
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === statusCodes.SIGN_IN_CANCELLED) {
      return null;
    }
    // IN-03: mapear errores de red durante el sign-in interactivo a NO_NETWORK
    // (en vez de genérico) para que la UI muestre el alert correcto.
    if (err instanceof TypeError && /network/i.test(err.message)) {
      throw new DriveError(ALERT_DRIVE_NO_NETWORK, err);
    }
    throw new DriveError(ALERT_DRIVE_GENERIC, err);
  }
}

/** Sign-out local. NO revoca acceso (D-10). */
export async function signOut(): Promise<void> {
  await GoogleSignin.signOut();
}

/** Pre-flight: re-trigger silentSignIn para refrescar el token (Pitfall #1).
 *  WR-01: errores del SDK (sesión revocada, token vencido, refresh failure) se
 *  mapean a DriveError tipado para que la UI muestre el Alert correcto en vez
 *  del fallback genérico. */
async function getDriveAccessToken(): Promise<string> {
  try {
    await GoogleSignin.signInSilently();
    const { accessToken } = await GoogleSignin.getTokens();
    if (!accessToken) throw new DriveError(ALERT_DRIVE_AUTH_EXPIRED);
    return accessToken;
  } catch (err) {
    if (err instanceof DriveError) throw err;
    if (err instanceof TypeError && /network/i.test(err.message)) {
      throw new DriveError(ALERT_DRIVE_NO_NETWORK, err);
    }
    throw new DriveError(ALERT_DRIVE_AUTH_EXPIRED, err);
  }
}

// ─── Drive list / find ───────────────────────────────────────────────

/** Lista todos los backups en appDataFolder ordenados por más reciente primero. */
export async function listBackups(): Promise<DriveBackupFile[]> {
  const token = await getDriveAccessToken();
  const q = `name contains '${BACKUP_FILE_PREFIX}' and name contains '${BACKUP_FILE_EXTENSION}' and trashed=false`;
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q,
    fields: 'files(id,name,size,createdTime)',
    orderBy: 'createdTime desc',
    pageSize: '100',
  });
  const url = `${DRIVE_BASE}/files?${params.toString()}`;
  const res = await fetchOrFail(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  return Array.isArray(data?.files) ? data.files : [];
}

async function findFileByName(name: string, token: string): Promise<DriveBackupFile | null> {
  const q = `name='${name}' and trashed=false`;
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q,
    fields: 'files(id,name,size,createdTime)',
    pageSize: '1',
  });
  const url = `${DRIVE_BASE}/files?${params.toString()}`;
  const res = await fetchOrFail(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  return Array.isArray(data?.files) && data.files.length > 0 ? data.files[0] : null;
}

// ─── Upload (POST + PATCH) ───────────────────────────────────────────

/**
 * Sube un backup a Drive. Si ya existe `cozyhabits-YYYY-MM-DD.json` con la fecha
 * de hoy, hace PATCH al fileId existente (D-12). El caller debe haber confirmado
 * (D-13) antes de invocar — este método no muestra UI.
 */
export async function uploadBackup(): Promise<UploadResult> {
  const data = await buildBackupData();
  const json = JSON.stringify(data);
  const token = await getDriveAccessToken();
  const today = new Date().toISOString().slice(0, 10);
  const filename = `${BACKUP_FILE_PREFIX}${today}${BACKUP_FILE_EXTENSION}`;

  const existing = await findFileByName(filename, token);
  const result = existing
    ? await patchMultipart(existing.id, filename, json, token)
    : await postMultipart(filename, json, token);

  // Pruning post-backup, best-effort (Pitfall #8 — NUNCA throws).
  // IN-04: el helper re-fetchea su propio token para evitar usar uno stale si
  // el upload tardó y el token rotó.
  void pruneOldBackupsBestEffort();

  return { ...result, overwrote: !!existing };
}

/** IN-05: valida que la respuesta de Drive (POST/PATCH `files`) trae al menos
 *  un `id` string no vacío. Defensivo — el contrato de la API debería garantizarlo,
 *  pero un partial response causaría persistir `lastBackupFileId: undefined`
 *  en el store. Falla a `DriveError(GENERIC)` para que la UI muestre el alert. */
function parseUploadResponse(
  data: unknown,
  filename: string,
): { fileId: string; name: string; size: string } {
  const d = data as { id?: unknown; name?: unknown; size?: unknown } | null;
  if (!d || typeof d.id !== 'string' || d.id.length === 0) {
    throw new DriveError(ALERT_DRIVE_GENERIC);
  }
  return {
    fileId: d.id,
    name: typeof d.name === 'string' ? d.name : filename,
    size: typeof d.size === 'string' ? d.size : '0',
  };
}

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

async function postMultipart(
  filename: string,
  json: string,
  token: string,
): Promise<{ fileId: string; name: string; size: string }> {
  const boundary = `cozy_boundary_${Date.now()}`;
  const metadata = { name: filename, parents: ['appDataFolder'], mimeType: 'application/json' };
  const body = buildMultipartBody(metadata, json, boundary);
  const url = `${UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,size`;
  const res = await fetchOrFail(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const data: unknown = await res.json();
  return parseUploadResponse(data, filename);
}

async function patchMultipart(
  fileId: string,
  filename: string,
  json: string,
  token: string,
): Promise<{ fileId: string; name: string; size: string }> {
  const boundary = `cozy_boundary_${Date.now()}`;
  // CRÍTICO (Pitfall #4): PATCH NO debe incluir parents
  const metadata = { name: filename, mimeType: 'application/json' };
  const body = buildMultipartBody(metadata, json, boundary);
  const url = `${UPLOAD_BASE}/files/${fileId}?uploadType=multipart&fields=id,name,size`;
  const res = await fetchOrFail(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const data: unknown = await res.json();
  return parseUploadResponse(data, filename);
}

// ─── Download ────────────────────────────────────────────────────────

/** Descarga el JSON crudo de un backup. Caller decide cuándo aplicar parseAndValidate. */
export async function downloadBackup(fileId: string): Promise<string> {
  const token = await getDriveAccessToken();
  const url = `${DRIVE_BASE}/files/${fileId}?alt=media`;
  const res = await fetchOrFail(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.text();
}

// ─── Delete ──────────────────────────────────────────────────────────

async function deleteFile(fileId: string, token: string): Promise<void> {
  const url = `${DRIVE_BASE}/files/${fileId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  // 204 No Content esperado; 404 también aceptable (ya no existe)
  if (!res.ok && res.status !== 404) {
    throw new DriveError(await mapDriveError(null, res));
  }
}

// ─── Retention pruning ───────────────────────────────────────────────

/** IN-04: re-fetchea token fresco aquí en vez de aceptar uno del caller. Evita
 *  que un upload largo deje un token vencido propagado a los DELETE. Sigue siendo
 *  best-effort (Pitfall #8 — NUNCA throws). */
async function pruneOldBackupsBestEffort(): Promise<void> {
  try {
    const token = await getDriveAccessToken();
    const files = await listBackups();
    const toPrune = selectFilesToPrune(files, new Date());
    for (const id of toPrune) {
      try {
        await deleteFile(id, token);
      } catch (err) {
        console.warn('[pruneOldBackups] delete fallo, continuando', id, err);
      }
    }
  } catch (err) {
    // D-14: si pruning falla, NO fallar el backup
    console.warn('[pruneOldBackups] pruning skipped', err);
  }
}

// ─── Error mapping (DRIVE-08 + D-26) ────────────────────────────────

/**
 * Mapea errores HTTP / TypeError a una constante ALERT_DRIVE_*. Heurístico:
 *   - TypeError "Network request failed" → ALERT_DRIVE_NO_NETWORK
 *   - HTTP 401 → ALERT_DRIVE_AUTH_EXPIRED
 *   - HTTP 403 con body quotaExceeded → ALERT_DRIVE_QUOTA
 *   - HTTP 403 con body insufficientPermissions → ALERT_DRIVE_PERMISSION
 *   - cualquier otro → ALERT_DRIVE_GENERIC
 */
export async function mapDriveError(
  err: unknown,
  response?: Response | null,
): Promise<DriveAlert> {
  if (err instanceof TypeError && /network/i.test(err.message)) {
    return ALERT_DRIVE_NO_NETWORK;
  }
  if (response) {
    if (response.status === 401) return ALERT_DRIVE_AUTH_EXPIRED;
    if (response.status === 403) {
      try {
        const body = await response.clone().text();
        if (/quotaExceeded|storageQuotaExceeded/i.test(body)) return ALERT_DRIVE_QUOTA;
        if (/insufficientPermissions|permissionDenied/i.test(body)) return ALERT_DRIVE_PERMISSION;
      } catch {
        // Si no podemos leer el body, fallback a genérico
      }
    }
  }
  return ALERT_DRIVE_GENERIC;
}

// Helper: fetch wrapper que tira DriveError tipado en !ok
async function fetchOrFail(url: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new DriveError(await mapDriveError(err, null), err);
  }
  if (!res.ok) {
    throw new DriveError(await mapDriveError(null, res));
  }
  return res;
}

// ─── Restore (DRIVE-04 + DRIVE-05 + D-19) ───────────────────────────

/**
 * Conteos por tabla derivados del backup parseado. Se usan para construir el
 * Alert de confirmación (D-18) sin volver a parsear en la UI.
 */
export interface RestoreCounts {
  habits: number;
  performed_habits: number;
  mood_entries: number;
  daily_assignments: number;
}

/**
 * Resultado de prepareRestore: la data parseada + conteos. La UI muestra los
 * conteos en el Alert destructivo y, en confirm, pasa el MISMO payload a
 * applyRestore (evita un segundo download).
 */
export interface RestorePayload {
  data: BackupData;
  counts: RestoreCounts;
  /** ISO timestamp del backup tal cual lo serializa buildBackupData. */
  exportedAt: string;
}

/**
 * Descarga + parsea + valida el backup. NO toca DB, NO escribe cache, NO corre
 * cleanup. Si parseAndValidate falla, se re-lanza como DriveError(GENERIC) y
 * la DB queda intacta (UI-SPEC Risk Note #4 + warning #9).
 *
 * Llamado primero por la pantalla para mostrar el Alert de confirmación con
 * conteos derivados de `counts`.
 */
export async function prepareRestore(fileId: string): Promise<RestorePayload> {
  const json = await downloadBackup(fileId);
  let data: BackupData;
  try {
    data = parseAndValidate(json);
  } catch (err) {
    console.error('[prepareRestore] parseAndValidate failed', err);
    throw new DriveError(ALERT_DRIVE_GENERIC, err);
  }
  return {
    data,
    counts: {
      habits: data.habits.length,
      performed_habits: data.performed_habits.length,
      mood_entries: data.mood_entries.length,
      daily_assignments: data.daily_assignments.length,
    },
    exportedAt: data.exportedAt,
  };
}

/**
 * Aplica el restore. Orden estricto:
 *   1. writePreRestoreCache(buildBackupData())   — D-19 safety cache
 *   2. restoreData(payload.data)                 — mutar DB (atómico via withTransactionAsync)
 *   3. cleanupOldPreRestoreCache()               — SÓLO en éxito (warning #9)
 *
 * Si writePreRestoreCache falla, log y continuar (best-effort, D-19).
 * Si restoreData throws, re-lanzar como DriveError(GENERIC); cleanup NO corre
 * para que el cache previo sobreviva y el usuario pueda recuperar.
 */
export async function applyRestore(payload: RestorePayload): Promise<void> {
  await writePreRestoreCache(); // best-effort: nunca throws
  try {
    await restoreData(payload.data);
  } catch (err) {
    console.error('[applyRestore] restoreData threw — cache previo conservado', err);
    throw new DriveError(ALERT_DRIVE_GENERIC, err);
  }
  // Cleanup SÓLO post-success: si restoreData lanzó, no llegamos acá.
  await cleanupOldPreRestoreCache();
}

async function writePreRestoreCache(): Promise<void> {
  try {
    const snapshot = await buildBackupData();
    const iso = new Date().toISOString().replace(/[:.]/g, '-');
    const path = `${FileSystem.cacheDirectory}cozyhabits-pre-restore-${iso}.json`;
    await FileSystem.writeAsStringAsync(path, JSON.stringify(snapshot), { encoding: 'utf8' });
  } catch (err) {
    // D-19: pre-restore cache es red de seguridad. Si falla, NO bloquear restore.
    console.warn('[writePreRestoreCache] no se pudo escribir cache de seguridad', err);
  }
}

/** WR-02: borra TODOS los pre-restore caches EXCEPTO el más reciente. El más
 *  reciente (el que se escribió en writePreRestoreCache para este restore) debe
 *  sobrevivir para honrar la promesa de la UI: "Tus datos previos quedaron
 *  respaldados en el dispositivo por si querés revertir." Los timestamps ISO en
 *  el nombre se ordenan lexicográficamente igual que cronológicamente. */
async function cleanupOldPreRestoreCache(): Promise<void> {
  try {
    const dir = FileSystem.cacheDirectory;
    if (!dir) return;
    const entries = (await FileSystem.readDirectoryAsync(dir))
      .filter((n) => n.startsWith('cozyhabits-pre-restore-') && n.endsWith('.json'))
      .sort();
    const toDelete = entries.slice(0, -1); // preserva el más reciente
    for (const name of toDelete) {
      await FileSystem.deleteAsync(`${dir}${name}`, { idempotent: true });
    }
  } catch (err) {
    console.warn('[cleanupOldPreRestoreCache] cleanup skipped', err);
  }
}
