/**
 * HabitFormModal — Modal para crear o editar hábitos "molde".
 *
 * Reutiliza BottomSheet como shell y estilos de ui.styles (Regla 001 + 002).
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import {
  FREQUENCY_OPTIONS,
  HABIT_CATEGORIES,
  BASE_POINTS_MIN,
  BASE_POINTS_MAX,
  BASE_POINTS_DEFAULT,
} from '../../config/constants';
import { BottomSheet } from '../layout/BottomSheet';
import { styles } from './HabitFormModal.styles';
import type { Habit, HabitFormData } from '../../types';

interface HabitFormModalProps {
  visible: boolean;
  editingHabit: Habit | null;
  onSave: (data: HabitFormData) => void;
  onCancel: () => void;
}

export function HabitFormModal({
  visible,
  editingHabit,
  onSave,
  onCancel,
}: HabitFormModalProps) {
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<HabitFormData['frequency']>('daily');
  const [basePoints, setBasePoints] = useState(BASE_POINTS_DEFAULT);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    if (editingHabit) {
      setName(editingHabit.name);
      setFrequency(editingHabit.frequency);
      setBasePoints(editingHabit.base_points);
      setCategories(parseCategories(editingHabit.default_categories));
    } else {
      resetForm();
    }
  }, [visible, editingHabit]);

  function handleSave() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), frequency, basePoints, categories });
  }

  function resetForm() {
    setName('');
    setFrequency('daily');
    setBasePoints(BASE_POINTS_DEFAULT);
    setCategories([]);
  }

  return (
    <BottomSheet visible={visible}>
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

        <CategoryPicker selected={categories} onChange={setCategories} />
        <View className={styles.sectionGap} />

        <FormActions onSave={handleSave} onCancel={onCancel} />
      </ScrollView>
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
  function decrement() {
    if (value > BASE_POINTS_MIN) onChange(value - 1);
  }

  function increment() {
    if (value < BASE_POINTS_MAX) onChange(value + 1);
  }

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
  value,
  onChange,
}: {
  value: string;
  onChange: (v: HabitFormData['frequency']) => void;
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

function CategoryPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (cats: string[]) => void;
}) {
  function toggleCategory(catId: string) {
    onChange(
      selected.includes(catId)
        ? selected.filter((c) => c !== catId)
        : [...selected, catId],
    );
  }

  return (
    <>
      <Text className={styles.label}>Categorías</Text>
      <View className={styles.chipRow}>
        {HABIT_CATEGORIES.map((cat) => {
          const active = selected.includes(cat.id);
          return (
            <Pressable
              key={cat.id}
              className={active ? styles.chipSelected : styles.chipBase}
              onPress={() => toggleCategory(cat.id)}
            >
              <Text className={active ? styles.chipTextSelected : styles.chipText}>
                {cat.label}
              </Text>
            </Pressable>
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
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
