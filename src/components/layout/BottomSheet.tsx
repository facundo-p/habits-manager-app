/**
 * BottomSheet — Shell reutilizable para modales de tipo "sheet inferior".
 *
 * Encapsula Modal + KeyboardAvoidingView + backdrop + sheet.
 * Evita duplicar esta lógica en cada modal (Regla 001: DRY).
 */

import React from 'react';
import { Modal, KeyboardAvoidingView, Platform, View } from 'react-native';
import { styles } from './BottomSheet.styles';

interface BottomSheetProps {
  visible: boolean;
  children: React.ReactNode;
}

export function BottomSheet({ visible, children }: BottomSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className={styles.backdrop}
      >
        <View
          className={styles.sheet}
          style={{ marginTop: 24, alignSelf: 'stretch' }}
        >
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
