/**
 * HabitFormModal — Modal para crear o editar hábitos "molde".
 *
 * Usa HABIT_AREAS (9 áreas) con botón (i) para ver info de cada una.
 * Reutiliza BottomSheet como shell (Regla 001 + 002).
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import {
  FREQUENCY_OPTIONS, HABIT_AREAS, AREAS_MAP,
  BASE_POINTS_MIN, BASE_POINTS_MAX, BASE_POINTS_DEFAULT,
} from '../../config/constants';
import { BottomSheet } from '../layout/BottomSheet';
import { AreaInfoModal } from './AreaInfoModal';
import { styles } from './HabitFormModal.styles';
import type { Habit, HabitFormData, HabitArea } from '../../types';

interface HabitFormModalProps {
  visible: boolean;
  editingHabit: Habit | null;
  onSave: (data: HabitFormData) => void;
  onCancel: () => void;
}

export function HabitFormModal({
  visible, editingHabit, onSave, onCancel,
}: HabitFormModalProps) {
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<HabitFormData['frequency']>('daily');
  const [basePoints, setBasePoints] = useState(BASE_POINTS_DEFAULT);
  const [categories, setCategories] = useState<string[]>([]);
  const [infoArea, setInfoArea] = useState<HabitArea | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (editingHabit) {
      populateForm(editingHabit, setName, setFrequency, setBasePoints, setCategories);
    } else {
      resetForm(setName, setFrequency, setBasePoints, setCategories);
    }
  }, [visible, editingHabit]);

  function handleSave() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), frequency, basePoints, categories });
  }

  function handleAreaInfo(areaId: string) {
    setInfoArea(AREAS_MAP[areaId] ?? null);
  }

  return (
    <BottomSheet visible={visible} onClose={onCancel}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className={styles.title}>
          {editingHabit ? 'Editar Hábito' : 'Nuevo Hábito'}
        </Text>
        <View className={styles.sectionGap} />

        <NameField value={name} onChangeText={setName} />
        <View className={styles.sectionGap} />

        <PointsStepper value={basePoints} onChange={setBasePoints} />
        <View className={styles.sectionGap} />

        <FrequencyPicker value={frequency} onChange={setFrequency} />
        <View className={styles.sectionGap} />

        <AreaPicker
          selected={categories}
          onChange={setCategories}
          onInfo={handleAreaInfo}
        />
        <View className={styles.sectionGap} />

        <FormActions onSave={handleSave} onCancel={onCancel} />
      </ScrollView>

      <AreaInfoModal
        visible={!!infoArea}
        area={infoArea}
        onClose={() => setInfoArea(null)}
      />
    </BottomSheet>
  );
}

// ─── Sub-componentes ────────────────────────────────────────────────

function NameField({ value, onChangeText }: { value: string; onChangeText: (t: string) => void }) {
  return (
    <>
      <Text className={styles.label}>Nombre</Text>
      <TextInput
        className={styles.nameInput}
        placeholder="Ej: Meditación matutina"
        placeholderTextColor="#b45309"
        value={value}
        onChangeText={onChangeText}
      />
    </>
  );
}

function PointsStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const decrement = () => { if (value > BASE_POINTS_MIN) onChange(value - 1); };
  const increment = () => { if (value < BASE_POINTS_MAX) onChange(value + 1); };

  return (
    <>
      <Text className={styles.label}>Puntos base</Text>
      <View className={styles.stepperContainer}>
        <Pressable className={styles.stepperButton} onPress={decrement}>
          <Text className={styles.stepperButtonText}>−</Text>
        </Pressable>
        <Text className={styles.stepperValue}>{value}</Text>
        <Pressable className={styles.stepperButton} onPress={increment}>
          <Text className={styles.stepperButtonText}>+</Text>
        </Pressable>
      </View>
    </>
  );
}

function FrequencyPicker({
  value, onChange,
}: {
  value: string; onChange: (v: HabitFormData['frequency']) => void;
}) {
  return (
    <>
      <Text className={styles.label}>Frecuencia</Text>
      <View className={styles.chipRow}>
        {FREQUENCY_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            className={value === opt.value ? styles.chipSelected : styles.chipBase}
            onPress={() => onChange(opt.value as HabitFormData['frequency'])}
          >
            <Text className={value === opt.value ? styles.chipTextSelected : styles.chipText}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

function AreaPicker({
  selected, onChange, onInfo,
}: {
  selected: string[];
  onChange: (cats: string[]) => void;
  onInfo: (areaId: string) => void;
}) {
  function toggleArea(areaId: string) {
    onChange(
      selected.includes(areaId)
        ? selected.filter((c) => c !== areaId)
        : [...selected, areaId],
    );
  }

  return (
    <>
      <Text className={styles.label}>Áreas</Text>
      <View className={styles.chipRow}>
        {HABIT_AREAS.map((area) => {
          const active = selected.includes(area.id);
          return (
            <View key={area.id} className={styles.chipWithInfo}>
              <Pressable
                className={active ? styles.chipSelected : styles.chipBase}
                onPress={() => toggleArea(area.id)}
                style={{ marginRight: 0, marginBottom: 0 }}
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
        })}
      </View>
    </>
  );
}

function FormActions({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <>
      <Pressable className={styles.saveButton} onPress={onSave}>
        <Text className={styles.saveButtonText}>Guardar</Text>
      </Pressable>
      <Pressable className={styles.cancelButton} onPress={onCancel}>
        <Text className={styles.cancelText}>Cancelar</Text>
      </Pressable>
    </>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function parseCategories(json: string): string[] {
  try { const a = JSON.parse(json); return Array.isArray(a) ? a : []; }
  catch { return []; }
}

function populateForm(
  habit: Habit,
  setName: (v: string) => void,
  setFreq: (v: HabitFormData['frequency']) => void,
  setPts: (v: number) => void,
  setCats: (v: string[]) => void,
) {
  setName(habit.name);
  setFreq(habit.frequency);
  setPts(habit.base_points);
  setCats(parseCategories(habit.default_categories));
}

function resetForm(
  setName: (v: string) => void,
  setFreq: (v: HabitFormData['frequency']) => void,
  setPts: (v: number) => void,
  setCats: (v: string[]) => void,
) {
  setName('');
  setFreq('daily');
  setPts(BASE_POINTS_DEFAULT);
  setCats([]);
}
