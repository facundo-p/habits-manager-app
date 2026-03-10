/**
 * AreaPicker — Selector de áreas compartido entre HabitFormModal y SpontaneousModal.
 *
 * Cuando se provee `onInfo`, muestra un botón (i) junto a cada chip.
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { HABIT_AREAS } from '../../config/constants';
import { chip, text } from '../../styles/ui.styles';

const styles = {
  label: text.label,
  chipRow: chip.row,
  chipBase: chip.base,
  chipSelected: chip.selected,
  chipInnerBase: chip.innerBase,
  chipInnerSelected: chip.innerSelected,
  chipText: chip.text,
  chipTextSelected: chip.textSelected,
  chipWithInfo: 'flex-row items-center mr-2 mb-2',
  infoButton: 'w-5 h-5 rounded-full items-center justify-center ml-0.5',
  infoButtonText: 'text-[10px] font-bold text-amber-500',
} as const;

interface AreaPickerProps {
  selected: string[];
  onChange: (cats: string[]) => void;
  label?: string;
  onInfo?: (areaId: string) => void;
}

export function AreaPicker({
  selected, onChange, label = 'Áreas', onInfo,
}: AreaPickerProps) {
  function toggleArea(areaId: string) {
    onChange(
      selected.includes(areaId)
        ? selected.filter((c) => c !== areaId)
        : [...selected, areaId],
    );
  }

  return (
    <>
      <Text className={styles.label}>{label}</Text>
      <View className={styles.chipRow}>
        {HABIT_AREAS.map((area) => {
          const active = selected.includes(area.id);

          if (onInfo) {
            return (
              <View key={area.id} className={styles.chipWithInfo}>
                <Pressable
                  className={active ? styles.chipInnerSelected : styles.chipInnerBase}
                  onPress={() => toggleArea(area.id)}
                >
                  <Text className={active ? styles.chipTextSelected : styles.chipText}>
                    {area.label}
                  </Text>
                </Pressable>
                <Pressable className={styles.infoButton} onPress={() => onInfo(area.id)}>
                  <Text className={styles.infoButtonText}>i</Text>
                </Pressable>
              </View>
            );
          }

          return (
            <Pressable
              key={area.id}
              className={active ? styles.chipSelected : styles.chipBase}
              onPress={() => toggleArea(area.id)}
            >
              <Text className={active ? styles.chipTextSelected : styles.chipText}>
                {area.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}
