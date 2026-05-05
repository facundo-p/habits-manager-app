/**
 * useSettingsStore.ts — Store de configuración de la app (Zustand + persist).
 *
 * Maneja preferencias de feedback sensorial, dictado de voz, idioma y
 * el slice de auth de Google Drive (Phase 3): googleEmail + lastBackup*.
 * Persiste en un archivo JSON vía expo-file-system para sobrevivir reinicios.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as FileSystem from 'expo-file-system/legacy';

export type SupportedLanguage = 'es' | 'en';

interface SettingsState {
  hapticsEnabled: boolean;
  soundsEnabled: boolean;
  voiceDictationEnabled: boolean;
  language: SupportedLanguage;

  toggleHaptics: () => void;
  toggleSounds: () => void;
  toggleVoiceDictation: () => void;
  setLanguage: (lang: SupportedLanguage) => void;

  // Drive auth (Phase 3)
  googleEmail: string | null;
  lastBackupAt: string | null;     // ISO timestamp del último backup exitoso (D-09)
  lastBackupFileId: string | null; // Drive file ID del último backup (D-09)
  setGoogleEmail: (email: string | null) => void;
  setLastBackup: (at: string | null, fileId: string | null) => void;
  clearGoogleSession: () => void;  // sign-out: limpia email; preserva lastBackup* (D-11)
}

const SETTINGS_PATH = `${FileSystem.documentDirectory}settings.json`;

/** Storage adapter que escribe/lee un archivo JSON con expo-file-system. */
const fileStorage = createJSONStorage(() => ({
  getItem: async (_key: string): Promise<string | null> => {
    try {
      const info = await FileSystem.getInfoAsync(SETTINGS_PATH);
      if (!info.exists) return null;
      return FileSystem.readAsStringAsync(SETTINGS_PATH, { encoding: 'utf8' });
    } catch {
      return null;
    }
  },
  setItem: async (_key: string, value: string): Promise<void> => {
    try {
      await FileSystem.writeAsStringAsync(SETTINGS_PATH, value, { encoding: 'utf8' });
    } catch {
      // No bloquear la app si falla el write
    }
  },
  removeItem: async (_key: string): Promise<void> => {
    try {
      const info = await FileSystem.getInfoAsync(SETTINGS_PATH);
      if (info.exists) await FileSystem.deleteAsync(SETTINGS_PATH);
    } catch {
      // ignore
    }
  },
}));

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      hapticsEnabled: true,
      soundsEnabled: true,
      voiceDictationEnabled: true, // TODO: expose toggle in Settings (Phase 5)
      language: 'es',
      googleEmail: null,
      lastBackupAt: null,
      lastBackupFileId: null,

      toggleHaptics: () => set((s) => ({ hapticsEnabled: !s.hapticsEnabled })),
      toggleSounds: () => set((s) => ({ soundsEnabled: !s.soundsEnabled })),
      toggleVoiceDictation: () => set((s) => ({ voiceDictationEnabled: !s.voiceDictationEnabled })),
      setLanguage: (lang) => set({ language: lang }), // Settings UI pending (Phase 5)
      setGoogleEmail: (email) => set({ googleEmail: email }),
      setLastBackup: (at, fileId) => set({ lastBackupAt: at, lastBackupFileId: fileId }),
      clearGoogleSession: () => set({ googleEmail: null }),
    }),
    {
      name: 'cozy-habits-settings',
      storage: fileStorage,
      partialize: (state) => ({
        hapticsEnabled: state.hapticsEnabled,
        soundsEnabled: state.soundsEnabled,
        voiceDictationEnabled: state.voiceDictationEnabled,
        language: state.language,
        googleEmail: state.googleEmail,
        lastBackupAt: state.lastBackupAt,
        lastBackupFileId: state.lastBackupFileId,
      }),
    },
  ),
);
