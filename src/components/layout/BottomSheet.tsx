/**
 * BottomSheet — Shell reutilizable para modales tipo "TopSheet".
 *
 * Desliza desde la parte superior de la pantalla.
 * Encapsula Modal + KeyboardAvoidingView + animación + backdrop.
 * Android Back: usa BackHandler para cerrar el modal y detener la propagación.
 */

import React, { useEffect, useRef } from 'react';
import { Modal, KeyboardAvoidingView, Platform, Animated, BackHandler } from 'react-native';
import { styles, nativeStyles, OFFSCREEN_Y } from './BottomSheet.styles';

interface BottomSheetProps {
  visible: boolean;
  onClose?: () => void;
  children: React.ReactNode;
}

export function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  const translateY = useRef(new Animated.Value(OFFSCREEN_Y)).current;

  // ─── Android hardware back button ───────────────────────────────
  useEffect(() => {
    if (!visible || !onClose) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true; // Detener propagación
    });

    return () => subscription.remove();
  }, [visible, onClose]);

  // ─── Animación de entrada ───────────────────────────────────────
  useEffect(() => {
    if (visible) {
      animateIn(translateY);
    } else {
      translateY.setValue(OFFSCREEN_Y);
    }
  }, [visible, translateY]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className={styles.backdrop}
      >
        <Animated.View
          className={styles.sheet}
          style={[nativeStyles.sheetAnimated, { transform: [{ translateY }] }]}
        >
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Animación ──────────────────────────────────────────────────────

function animateIn(translateY: Animated.Value) {
  Animated.spring(translateY, {
    toValue: 0,
    useNativeDriver: true,
    damping: 20,
    stiffness: 180,
  }).start();
}
