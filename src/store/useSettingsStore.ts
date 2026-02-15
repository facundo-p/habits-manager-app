/**
 * useSettingsStore.ts — Store de configuración de la app (Zustand).
 *
 * Maneja preferencias de feedback sensorial, dictado de voz e idioma.
 * La propiedad `language` deja la infraestructura lista para i18n.
 */

import { create } from 'zustand';

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
}

export const useSettingsStore = create<SettingsState>((set) => ({
  hapticsEnabled: true,
  soundsEnabled: true,
  voiceDictationEnabled: true,
  language: 'es',

  toggleHaptics: () => set((s) => ({ hapticsEnabled: !s.hapticsEnabled })),
  toggleSounds: () => set((s) => ({ soundsEnabled: !s.soundsEnabled })),
  toggleVoiceDictation: () => set((s) => ({ voiceDictationEnabled: !s.voiceDictationEnabled })),
  setLanguage: (lang) => set({ language: lang }),
}));
