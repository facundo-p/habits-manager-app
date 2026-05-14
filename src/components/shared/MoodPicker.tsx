/**
 * MoodPicker — Componente compartido de selección de mood (D-02 / FOUND-02).
 *
 * Layout extraído verbatim del `MoodSection` inline de ReflectionModal:
 * label "¿Cómo te sientes?", valor numérico, Slider amber con bounds
 * MOOD_MIN/MAX/STEP. Sin props de comment/sleep — cada surface compone
 * su propio contexto por encima.
 */

import React from 'react';
import { View, Text } from 'react-native';
import Slider from '@react-native-community/slider';
import { MOOD_MIN, MOOD_MAX, MOOD_STEP } from '../../config/mood';
import { styles, sliderColors, nativeStyles } from './MoodPicker.styles';

export interface MoodPickerProps {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

export function MoodPicker({ value, onChange, disabled }: MoodPickerProps) {
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
          onValueChange={onChange}
          disabled={disabled}
          minimumTrackTintColor={sliderColors.minimumTrack}
          maximumTrackTintColor={sliderColors.maximumTrack}
          thumbTintColor={sliderColors.thumb}
        />
      </View>
      <View className={styles.sectionGap} />
    </>
  );
}
