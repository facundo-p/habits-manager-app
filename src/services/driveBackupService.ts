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
import { buildBackupData } from './backupService';
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
    throw new DriveError(ALERT_DRIVE_GENERIC, err);
  }
}

/** Sign-out local. NO revoca acceso (D-10). */
export async function signOut(): Promise<void> {
  await GoogleSignin.signOut();
}

/** Pre-flight: re-trigger silentSignIn para refrescar el token (Pitfall #1). */
async function getDriveAccessToken(): Promise<string> {
  await GoogleSignin.signInSilently();
  const { accessToken } = await GoogleSignin.getTokens();
  return accessToken;
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

  // Pruning post-backup, best-effort (Pitfall #8 — NUNCA throws)
  void pruneOldBackupsBestEffort(token);

  return { ...result, overwrote: !!existing };
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
  const data = await res.json();
  return { fileId: data.id, name: data.name, size: data.size };
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
  const data = await res.json();
  return { fileId: data.id, name: data.name, size: data.size };
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

async function pruneOldBackupsBestEffort(token: string): Promise<void> {
  try {
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
