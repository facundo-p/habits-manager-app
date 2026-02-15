/**
 * useSettingsStore.ts — Store de configuración de la app (Zustand).
 *
 * Maneja preferencias de feedback sensorial y dictado de voz.
 */

import { create } from 'zustand';

interface SettingsState {
  hapticsEnabled: boolean;
  soundsEnabled: boolean;
  voiceDictationEnabled: boolean;

  toggleHaptics: () => void;
  toggleSounds: () => void;
  toggleVoiceDictation: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  hapticsEnabled: true,
  soundsEnabled: true,
  voiceDictationEnabled: true,

  toggleHaptics: () => set((s) => ({ hapticsEnabled: !s.hapticsEnabled })),
  toggleSounds: () => set((s) => ({ soundsEnabled: !s.soundsEnabled })),
  toggleVoiceDictation: () => set((s) => ({ voiceDictationEnabled: !s.voiceDictationEnabled })),
}));
