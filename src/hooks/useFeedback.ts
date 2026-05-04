/**
 * useFeedback.ts — Hook para feedback sensorial (haptics + sonido).
 *
 * Lee la configuración de useSettingsStore para activar/desactivar.
 * El sonido queda preparado para cuando se añadan archivos de audio.
 */

import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../store/useSettingsStore';

export function useFeedback() {
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);

  const triggerSuccess = useCallback(async () => {
    if (!hapticsEnabled) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [hapticsEnabled]);

  return { triggerSuccess };
}
