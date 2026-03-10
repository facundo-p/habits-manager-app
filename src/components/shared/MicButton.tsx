/**
 * MicButton — Botón de micrófono con animación de pulso para dictado por voz.
 *
 * Extraído de ReflectionModal para cumplir con el límite de 20 líneas por función.
 * La opacidad animada requiere `style={{ opacity: pulseAnim }}` (valor Animated, no NativeWind).
 */

import React, { useEffect, useRef } from 'react';
import { Pressable, Animated } from 'react-native';
import { Mic, MicOff } from 'lucide-react-native';
import { button, colors } from '../../styles/ui.styles';

const micButtonStyle = button.iconSmall + ' mt-3';

interface MicButtonProps {
  isListening: boolean;
  isAvailable: boolean;
  onPress: () => void;
}

export function MicButton({ isListening, isAvailable, onPress }: MicButtonProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isListening, pulseAnim]);

  const color = isListening ? colors.rose400 : colors.amber600;
  const Icon = isListening ? MicOff : Mic;

  return (
    <Pressable className={micButtonStyle} onPress={onPress} disabled={!isAvailable}>
      <Animated.View style={{ opacity: pulseAnim }}>
        <Icon color={color} size={20} strokeWidth={1.8} />
      </Animated.View>
    </Pressable>
  );
}
