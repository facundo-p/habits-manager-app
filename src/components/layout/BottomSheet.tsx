/**
 * BottomSheet — Shell reutilizable para modales tipo "TopSheet".
 *
 * Desliza desde la parte superior de la pantalla.
 * Encapsula Modal + KeyboardAvoidingView + animación + backdrop.
 * Android Back: usa BackHandler para cerrar el modal y detener la propagación.
 */

import React, { useEffect, useRef } from 'react';
import { Modal, KeyboardAvoidingView, Platform, Animated, BackHandler, useWindowDimensions } from 'react-native';
import { styles, nativeStyles } from './BottomSheet.styles';

interface BottomSheetProps {
  visible: boolean;
  onClose?: () => void;
  children: React.ReactNode;
}

export function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  const { height } = useWindowDimensions();
  const offscreenY = -height * 0.8;
  const translateY = useRef(new Animated.Value(offscreenY)).current;

  // ─── Android hardware back button ───────────────────────────────
  useEffect(() => {
    if (!visible || !onClose) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true; // Detener propagación
    });

    return () => subscription.remove();
  }, [visible, onClose]);

  // ─── Animación de entrada/salida ────────────────────────────────
  useEffect(() => {
    if (visible) {
      animateIn(translateY);
    } else {
      animateOut(translateY, offscreenY);
    }
  }, [visible, translateY, offscreenY]);

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

function animateOut(translateY: Animated.Value, toValue: number) {
  Animated.timing(translateY, {
    toValue,
    duration: 200,
    useNativeDriver: true,
  }).start();
}
