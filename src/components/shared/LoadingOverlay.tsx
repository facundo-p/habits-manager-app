/**
 * LoadingOverlay.tsx — Overlay full-screen modal para operaciones bloqueantes (D-23).
 *
 * Usado durante upload/restore de Drive. Bloquea touches via Modal nativo y
 * captura el back button de Android (no-op mientras visible). Para spinners
 * inline (cargas cortas), usar ActivityIndicator directamente.
 */
import React from 'react';
import { Modal, View, ActivityIndicator, Text } from 'react-native';
import { colors, text } from '../../styles/ui.styles';

interface LoadingOverlayProps {
  visible: boolean;
  message: string;
}

export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={() => { /* no-op: bloqueante (D-23) */ }}
    >
      <View
        accessibilityViewIsModal
        className="flex-1 items-center justify-center bg-black/40"
      >
        <View className="bg-amber-50 rounded-2xl p-6 items-center gap-3">
          <ActivityIndicator size="large" color={colors.amber600} />
          <Text
            className={text.body + ' text-center'}
            accessibilityLiveRegion="polite"
          >
            {message}
          </Text>
        </View>
      </View>
    </Modal>
  );
}
