/**
 * dateFormat.ts — Utilidades de formato de fecha y tamaño en español (Phase 3).
 *
 * formatDateEs: "27 abr 2026" — abreviatura de mes en español.
 * formatRelativeBackup: caption del último backup ("hace 5 h", "ayer", "el 27 abr 2026").
 * formatSize: convierte un string de bytes (Drive API) a "12 KB" / "1.5 MB" / "".
 *
 * Funciones puras, sin IO. Usadas por SettingsScreen y RestoreFromDriveScreen
 * (centralizado para evitar duplicación — CLAUDE.md Regla 3).
 */

import { MONTH_NAMES_SHORT } from '../config/constants';

/** Formatea una Date como "D mmm YYYY" usando abreviatura de mes en español. */
export function formatDateEs(d: Date): string {
  return `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Formatea un timestamp ISO como caption del último backup.
 * Si no hay backup previo (null), retorna texto explícito.
 */
export function formatRelativeBackup(iso: string | null): string {
  if (!iso) return 'Aún no hiciste un backup';
  const d = new Date(iso);
  const now = new Date();
  const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000);
  if (diffH < 1) return 'Último backup: hace menos de una hora';
  if (diffH < 24) return `Último backup: hace ${diffH} h`;
  if (diffH < 48) return 'Último backup: ayer';
  return `Último backup: el ${formatDateEs(d)}`;
}

/** Convierte un string de bytes (formato Drive API) a un label legible. */
export function formatSize(sizeStr: string): string {
  const bytes = parseInt(sizeStr, 10);
  if (Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
