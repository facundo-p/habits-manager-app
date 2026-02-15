/**
 * AreaInfoModal — Modal informativo sobre un área de hábito.
 *
 * Muestra descripción y ejemplos del HABIT_AREAS.
 * Reutiliza BottomSheet como shell (Regla 001: DRY).
 */

import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import {
  Heart, Brain, Users, Target, Wallet,
  TrendingUp, Sparkles, Palette, Home,
} from 'lucide-react-native';
import { BottomSheet } from '../layout/BottomSheet';
import { styles } from './AreaInfoModal.styles';
import type { HabitArea } from '../../types';

interface AreaInfoModalProps {
  visible: boolean;
  area: HabitArea | null;
  onClose: () => void;
}

// ─── Mapa de iconos ─────────────────────────────────────────────────

const ICON_MAP: Record<string, typeof Heart> = {
  Heart, Brain, Users, Target, Wallet,
  TrendingUp, Sparkles, Palette, Home,
};

// ─── Componente principal ───────────────────────────────────────────

export function AreaInfoModal({ visible, area, onClose }: AreaInfoModalProps) {
  if (!area) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <AreaHeader area={area} />
        <Text className={styles.description}>{area.description}</Text>
        <ExamplesList examples={area.examples} />
        <View className={styles.bottomGap} />
        <CloseAction onClose={onClose} />
      </ScrollView>
    </BottomSheet>
  );
}

// ─── Sub-componentes ────────────────────────────────────────────────

function AreaHeader({ area }: { area: HabitArea }) {
  const Icon = ICON_MAP[area.iconName] ?? Heart;
  return (
    <View className={styles.header}>
      <Icon color={area.color} size={28} strokeWidth={1.8} />
      <Text className={styles.title}>{area.label}</Text>
    </View>
  );
}

function ExamplesList({ examples }: { examples: readonly string[] }) {
  return (
    <>
      <Text className={styles.examplesTitle}>Ejemplos</Text>
      {examples.map((ex) => (
        <View key={ex} className={styles.exampleCard}>
          <Text className={styles.exampleText}>{ex}</Text>
        </View>
      ))}
    </>
  );
}

function CloseAction({ onClose }: { onClose: () => void }) {
  return (
    <Pressable className={styles.closeButton} onPress={onClose}>
      <Text className={styles.closeButtonText}>Cerrar</Text>
    </Pressable>
  );
}
