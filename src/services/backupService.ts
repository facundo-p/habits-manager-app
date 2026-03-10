/**
 * backupService.ts — Lógica de respaldo y restauración de datos.
 *
 * Exportar: Lee todas las tablas, genera JSON, abre el menú nativo
 *           de compartir para que el usuario elija dónde guardarlo.
 * Importar: Selecciona archivo JSON, valida estructura, limpia + restaura.
 *
 * Usa expo-file-system/legacy (compatible con Expo Go en SDK 54).
 * Delega SQL a backupRepository.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { BACKUP_VERSION, BACKUP_FILENAME } from '../config/constants';
import * as backupRepo from '../repositories/backupRepository';
import type { BackupData } from '../types';

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
  const data = JSON.parse(json) as Partial<BackupData>;

  if (!data.version || !Array.isArray(data.habits)) {
    throw new Error('Formato de respaldo inválido');
  }

  if (!Array.isArray(data.performed_habits)) {
    throw new Error('Falta performed_habits en el respaldo');
  }

  if (!Array.isArray(data.mood_entries)) {
    throw new Error('Falta mood_entries en el respaldo');
  }

  return {
    ...data,
    daily_assignments: Array.isArray(data.daily_assignments) ? data.daily_assignments : [],
  } as BackupData;
}

async function restoreData(data: BackupData): Promise<void> {
  await backupRepo.clearAllTables();
  await backupRepo.insertHabits(data.habits);
  await backupRepo.insertAssignments(data.daily_assignments);
  await backupRepo.insertPerformed(data.performed_habits);
  await backupRepo.insertMoods(data.mood_entries);
}
