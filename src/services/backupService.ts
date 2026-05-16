/**
 * backupService.ts — Lógica de respaldo y restauración local de datos.
 *
 * Exportar: Lee todas las tablas, genera JSON, abre el menú nativo
 *           de compartir para que el usuario elija dónde guardarlo.
 * Importar: Selecciona archivo JSON, valida estructura, limpia + restaura.
 *
 * Phase 3: `buildBackupData`, `parseAndValidate` y `restoreData` se exponen
 * como named exports para reuso por driveBackupService (transporte a Drive).
 *
 * Usa expo-file-system/legacy (compatible con Expo Go en SDK 54).
 * Delega SQL a backupRepository.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { BACKUP_VERSION, BACKUP_FILENAME } from '../config/constants';
import * as backupRepo from '../repositories/backupRepository';
import { dedupeAssignmentsArray } from '../utils/dedupeAssignmentsArray';
import type {
  BackupData,
  Habit,
  PerformedHabit,
  MoodEntry,
  MoodLogEntry,
  TextLibraryItem,
  WeeklyReview,
  DailyAssignment,
} from '../types';

// ─── Exportar ────────────────────────────────────────────────────────

/** Lee toda la DB, genera JSON y abre el menú de compartir del sistema. */
export async function exportBackup(): Promise<void> {
  const data = await buildBackupData();
  const json = JSON.stringify(data, null, 2);
  const path = `${FileSystem.documentDirectory}${BACKUP_FILENAME}`;

  await FileSystem.writeAsStringAsync(path, json, { encoding: 'utf8' });

  await Sharing.shareAsync(path, {
    mimeType: 'application/json',
    dialogTitle: 'Guardar respaldo CozyHabit',
  });
}

// ─── Importar ────────────────────────────────────────────────────────

/**
 * Abre el selector de archivos, lee el JSON, valida y restaura.
 * Retorna true si la importación fue exitosa, false si el usuario canceló.
 * Lanza error si el archivo es inválido.
 */
export async function importBackup(): Promise<boolean> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled) return false;

  const file = result.assets[0];
  const json = await FileSystem.readAsStringAsync(file.uri, {
    encoding: 'utf8',
  });

  const data = parseAndValidate(json);
  await restoreData(data);
  return true;
}

// ─── API pública (consumida por exportBackup/importBackup y driveBackupService) ──

/**
 * Construye el backup shape v2: reads paralelos de las 6 tablas de dominio.
 * Drafts EXCLUIDOS (transient — FOUND-04).
 */
export async function buildBackupData(): Promise<BackupData> {
  const [
    habits,
    performed_habits,
    daily_assignments,
    mood_log,
    text_library,
    weekly_reviews,
  ] = await Promise.all([
    backupRepo.readAllHabits(),
    backupRepo.readAllPerformed(),
    backupRepo.readAllAssignments(),
    backupRepo.readAllMoodLog(),
    backupRepo.readAllTextLibrary(),
    backupRepo.readAllWeeklyReviews(),
  ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    habits,
    performed_habits,
    daily_assignments,
    mood_log,
    text_library,
    weekly_reviews,
  };
}

// ─── parseAndValidate v1/v2/v3 dispatcher ────────────────────────────

const ERR_INVALID = 'Formato de respaldo inválido';
const ERR_FUTURE_VERSION =
  'Backup más nuevo que la app — actualizá la app para restaurar.';

/**
 * Parsea + valida un JSON de respaldo y normaliza al shape v2.
 * - v1: acepta y mapea `mood_entries[]` → `mood_log[]` en `restoreData`
 *   (acá se preserva en `mood_entries?` para que `restoreData` haga el mapping).
 * - v2: shape final. Permite `text_library` / `weekly_reviews` ausentes (`[]` default).
 * - v3+: throw con mensaje accionable (T-04-05).
 */
export function parseAndValidate(json: string): BackupData {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error(`${ERR_INVALID}: JSON malformado`);
  }

  if (raw == null || typeof raw !== 'object') {
    throw new Error(ERR_INVALID);
  }
  const data = raw as Record<string, unknown>;

  if (typeof data.version !== 'number') {
    throw new Error(ERR_INVALID);
  }
  if (data.version > BACKUP_VERSION) {
    throw new Error(ERR_FUTURE_VERSION);
  }
  if (!Array.isArray(data.habits) || !Array.isArray(data.performed_habits)) {
    throw new Error(ERR_INVALID);
  }

  if (data.version === 1) return parseV1(data);
  return parseV2(data);
}

function parseV1(data: Record<string, unknown>): BackupData {
  if (!Array.isArray(data.mood_entries)) {
    throw new Error('Falta mood_entries en el respaldo v1');
  }
  return {
    version: 1,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    habits: data.habits as Habit[],
    performed_habits: data.performed_habits as PerformedHabit[],
    daily_assignments: Array.isArray(data.daily_assignments)
      ? (data.daily_assignments as DailyAssignment[])
      : [],
    mood_log: [],
    text_library: [],
    weekly_reviews: [],
    mood_entries: data.mood_entries as MoodEntry[],
  };
}

function parseV2(data: Record<string, unknown>): BackupData {
  if (!Array.isArray(data.mood_log)) {
    throw new Error('Falta mood_log en el respaldo v2');
  }
  return {
    version: 2,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    habits: data.habits as Habit[],
    performed_habits: data.performed_habits as PerformedHabit[],
    daily_assignments: Array.isArray(data.daily_assignments)
      ? (data.daily_assignments as DailyAssignment[])
      : [],
    mood_log: data.mood_log as MoodLogEntry[],
    text_library: Array.isArray(data.text_library)
      ? (data.text_library as TextLibraryItem[])
      : [],
    weekly_reviews: Array.isArray(data.weekly_reviews)
      ? (data.weekly_reviews as WeeklyReview[])
      : [],
  };
}

/**
 * Restaura un backup. Si shape es v1, mapea `mood_entries[]` →
 * `mood_log[]` kind='reflection' antes del restore (mismo mapping que
 * el INSERT...SELECT de migrationV2 — single semantic).
 */
export async function restoreData(data: BackupData): Promise<void> {
  const dedupedAssignments = dedupeAssignmentsArray(
    data.daily_assignments,
    data.performed_habits,
  );
  const moodLog =
    data.version === 1 && data.mood_entries
      ? mapMoodEntriesToMoodLog(data.mood_entries)
      : data.mood_log;
  await backupRepo.restoreAllData(
    data.habits,
    data.performed_habits,
    dedupedAssignments,
    moodLog,
    data.text_library,
    data.weekly_reviews,
  );
}

/** v1 → v2 mapping en memoria. Misma semántica que el SQL INSERT...SELECT de migrationV2. */
function mapMoodEntriesToMoodLog(entries: MoodEntry[]): MoodLogEntry[] {
  return entries.map((e) => ({
    id: e.id,
    kind: 'reflection',
    date_key: e.timestamp.slice(0, 10),
    occurred_at: e.timestamp,
    mood_value: e.value,
    mood_scale_version: 'v1',
    sleep_hours: null,
    comment: e.description,
    habit_id: e.habit_id,
    created_at: e.timestamp,
    updated_at: e.timestamp,
  }));
}

