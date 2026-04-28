/**
 * __mocks__/expo-file-system.ts
 *
 * Mock manual de expo-file-system para tests Jest.
 * Provee la API mínima usada por useSettingsStore (legacy) y backupService.
 * NO escribe a disco — mantiene un Map en memoria.
 *
 * NOTA: el subpath 'expo-file-system/legacy' se mockea vía moduleNameMapper en jest.config.js.
 */

const memoryFs = new Map<string, string>();

export const documentDirectory = '/mock/documents/';
export const cacheDirectory = '/mock/cache/';

export interface FileInfo {
  exists: boolean;
  uri: string;
  size?: number;
  isDirectory?: boolean;
}

export async function getInfoAsync(uri: string): Promise<FileInfo> {
  return {
    exists: memoryFs.has(uri),
    uri,
    size: memoryFs.get(uri)?.length ?? 0,
    isDirectory: false,
  };
}

export async function readAsStringAsync(
  uri: string,
  _opts?: { encoding?: string },
): Promise<string> {
  const value = memoryFs.get(uri);
  if (value === undefined) {
    throw new Error(`[expo-file-system mock] File not found: ${uri}`);
  }
  return value;
}

export async function writeAsStringAsync(
  uri: string,
  content: string,
  _opts?: { encoding?: string },
): Promise<void> {
  memoryFs.set(uri, content);
}

export async function deleteAsync(
  uri: string,
  _opts?: { idempotent?: boolean },
): Promise<void> {
  memoryFs.delete(uri);
}

/** Helper de tests para limpiar el FS en memoria. */
export function __resetMockFs(): void {
  memoryFs.clear();
}

export default {
  documentDirectory,
  cacheDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
  deleteAsync,
  __resetMockFs,
};
