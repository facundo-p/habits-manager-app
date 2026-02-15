/**
 * ReflectionModal — Modal de reflexión y humor tras completar un hábito.
 *
 * Soporta modo "nuevo" y "edición". Incluye botón de micrófono para
 * dictado de voz (requiere dev build con expo-speech-recognition).
 * Reutiliza BottomSheet como shell (Regla 001: DRY).
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, Animated } from 'react-native';
import Slider from '@react-native-community/slider';
import { Mic, MicOff } from 'lucide-react-native';
import { MOOD_MIN, MOOD_MAX, MOOD_STEP, MOOD_DEFAULT_VALUE } from '../../config/constants';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { BottomSheet } from '../layout/BottomSheet';
import { styles, sliderColors, nativeStyles, colors } from './ReflectionModal.styles';

interface ReflectionModalProps {
  visible: boolean;
  habitName: string;
  initialDescription?: string;
  initialMoodValue?: number;
  onSave: (description: string, moodValue: number) => void;
  onSkip: () => void;
}

export function ReflectionModal({
  visible, habitName,
  initialDescription, initialMoodValue,
  onSave, onSkip,
}: ReflectionModalProps) {
  const [moodValue, setMoodValue] = useState(MOOD_DEFAULT_VALUE);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (visible) {
      setMoodValue(initialMoodValue ?? MOOD_DEFAULT_VALUE);
      setDescription(initialDescription ?? '');
    }
  }, [visible, initialDescription, initialMoodValue]);

  function handleSave() { onSave(description.trim(), moodValue); }

  return (
    <BottomSheet visible={visible}>
      <ModalHeader habitName={habitName} />
      <MoodSection value={moodValue} onValueChange={setMoodValue} />
      <DescriptionWithMic value={description} onChangeText={setDescription} />
      <ModalActions onSave={handleSave} onSkip={onSkip} />
    </BottomSheet>
  );
}

// ─── Sub-componentes ────────────────────────────────────────────────

function ModalHeader({ habitName }: { habitName: string }) {
  return (
    <>
      <Text className={styles.title}>Reflexión</Text>
      <Text className={styles.habitName}>{habitName}</Text>
      <View className={styles.sectionGap} />
    </>
  );
}

function MoodSection({
  value, onValueChange,
}: {
  value: number; onValueChange: (v: number) => void;
}) {
  return (
    <>
      <Text className={styles.label}>¿Cómo te sientes?</Text>
      <Text className={styles.moodValue}>{value.toFixed(1)}</Text>
      <View className={styles.sliderWrapper}>
        <Slider
          style={nativeStyles.slider}
          minimumValue={MOOD_MIN}
          maximumValue={MOOD_MAX}
          step={MOOD_STEP}
          value={value}
          onValueChange={onValueChange}
          minimumTrackTintColor={sliderColors.minimumTrack}
          maximumTrackTintColor={sliderColors.maximumTrack}
          thumbTintColor={sliderColors.thumb}
        />
      </View>
      <View className={styles.sectionGap} />
    </>
  );
}

function DescriptionWithMic({
  value, onChangeText,
}: {
  value: string; onChangeText: (t: string) => void;
}) {
  const handleVoiceResult = (transcript: string) => {
    const updated = value ? `${value} ${transcript}` : transcript;
    onChangeText(updated);
  };

  const { isListening, isAvailable, toggle } = useSpeechRecognition(handleVoiceResult);

  return (
    <>
      <Text className={styles.label}>Notas (opcional)</Text>
      <View className={styles.textRow}>
        <TextInput
          className={styles.textAreaFlex}
          placeholder="¿Qué reflexión te deja este hábito?"
          placeholderTextColor="#b45309"
          multiline
          value={value}
          onChangeText={onChangeText}
        />
        <MicButton
          isListening={isListening}
          isAvailable={isAvailable}
          onPress={toggle}
        />
      </View>
      <View className={styles.sectionGap} />
    </>
  );
}

function MicButton({
  isListening, isAvailable, onPress,
}: {
  isListening: boolean; isAvailable: boolean; onPress: () => void;
}) {
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
    <Pressable className={styles.micButton} onPress={onPress}>
      <Animated.View style={{ opacity: pulseAnim }}>
        <Icon color={color} size={20} strokeWidth={1.8} />
      </Animated.View>
    </Pressable>
  );
}

function ModalActions({ onSave, onSkip }: { onSave: () => void; onSkip: () => void }) {
  return (
    <>
      <Pressable className={styles.saveButton} onPress={onSave}>
        <Text className={styles.saveButtonText}>Guardar</Text>
      </Pressable>
      <Pressable className={styles.skipButton} onPress={onSkip}>
        <Text className={styles.skipText}>Omitir</Text>
      </Pressable>
    </>
  );
}
