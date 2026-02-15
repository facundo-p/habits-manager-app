/**
 * HabitLibraryScreen — Pantalla de biblioteca de hábitos.
 *
 * Muestra todos los hábitos "molde" con toggle de visibilidad,
 * conteo de completados y opciones de edición/eliminación.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Trash2, Plus, Eye, EyeOff } from 'lucide-react-native';
import { useHabitStore } from '../store/useHabitStore';
import { ALERT_DELETE_HABIT, FREQUENCY_LABELS, CATEGORY_LABELS } from '../config/constants';
import { HabitFormModal } from '../components/modals/HabitFormModal';
import { styles, colors } from './HabitLibraryScreen.styles';
import type { LibraryHabit, HabitFormData } from '../types';

// ─── Sub-componentes ────────────────────────────────────────────────

function HabitRow({
  habit,
  onPress,
  onToggleActive,
  onDelete,
}: {
  habit: LibraryHabit;
  onPress: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const isActive = habit.is_active === 1;
  const nameStyle = isActive ? styles.habitName : styles.habitNameInactive;

  return (
    <Pressable className={styles.habitRow} onPress={onPress}>
      <View className={styles.habitInfo}>
        <Text className={nameStyle}>{habit.name}</Text>
        <Text className={styles.habitMeta}>{formatMeta(habit)}</Text>
        <Text className={styles.habitCount}>
          Completado {habit.completionCount} {habit.completionCount === 1 ? 'vez' : 'veces'}
        </Text>
      </View>
      <View className={styles.actionsRow}>
        <Pressable className={styles.eyeButton} onPress={onToggleActive}>
          {isActive
            ? <Eye color={colors.amber600} size={18} strokeWidth={1.8} />
            : <EyeOff color={colors.gray400} size={18} strokeWidth={1.8} />
          }
        </Pressable>
        <Pressable className={styles.deleteButton} onPress={onDelete}>
          <Trash2 color={colors.rose400} size={18} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function Separator() { return <View className={styles.separator} />; }

function EmptyList() { return <Text className={styles.emptyText}>No hay hábitos creados</Text>; }

// ─── Pantalla principal ─────────────────────────────────────────────

export function HabitLibraryScreen() {
  const {
    libraryHabits, isLibraryLoading,
    fetchLibrary, addHabit, editHabit, removeHabit, toggleActive,
  } = useHabitStore();

  const [formVisible, setFormVisible] = useState(false);
  const [editingHabit, setEditingHabit] = useState<LibraryHabit | null>(null);

  useEffect(() => { fetchLibrary(); }, [fetchLibrary]);

  const handleAdd = useCallback(() => {
    setEditingHabit(null);
    setFormVisible(true);
  }, []);

  const handleEdit = useCallback((habit: LibraryHabit) => {
    setEditingHabit(habit);
    setFormVisible(true);
  }, []);

  const handleDelete = useCallback(
    (habit: LibraryHabit) => confirmDelete(habit, removeHabit),
    [removeHabit],
  );

  const handleToggleActive = useCallback(
    (habit: LibraryHabit) => {
      toggleActive(habit.id, habit.is_active !== 1);
    },
    [toggleActive],
  );

  const handleSave = useCallback(
    async (data: HabitFormData) => {
      if (editingHabit) {
        await editHabit(editingHabit.id, data);
      } else {
        await addHabit(data);
      }
      setFormVisible(false);
    },
    [editingHabit, editHabit, addHabit],
  );

  const handleCancel = useCallback(() => setFormVisible(false), []);

  const renderItem = useCallback(
    ({ item }: { item: LibraryHabit }) => (
      <HabitRow
        habit={item}
        onPress={() => handleEdit(item)}
        onToggleActive={() => handleToggleActive(item)}
        onDelete={() => handleDelete(item)}
      />
    ),
    [handleEdit, handleToggleActive, handleDelete],
  );

  if (isLibraryLoading && libraryHabits.length === 0) {
    return (
      <View className={styles.loading}>
        <ActivityIndicator size="large" color={colors.amber600} />
      </View>
    );
  }

  return (
    <View className={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className={styles.title}>Biblioteca</Text>
        <View className={styles.titleGap} />

        <View className={styles.paper}>
          <FlatList
            data={libraryHabits}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ItemSeparatorComponent={Separator}
            scrollEnabled={false}
            ListEmptyComponent={EmptyList}
          />
        </View>
      </ScrollView>

      <Pressable className={styles.fab} onPress={handleAdd}>
        <Plus color={colors.white} size={28} />
      </Pressable>

      <HabitFormModal
        visible={formVisible}
        editingHabit={editingHabit}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </View>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatMeta(habit: LibraryHabit): string {
  const freq = FREQUENCY_LABELS[habit.frequency] ?? habit.frequency;
  const cats = parseCategories(habit.default_categories);
  const catLabels = cats.map((c) => CATEGORY_LABELS[c] ?? c);
  const catStr = catLabels.length > 0 ? ` · ${catLabels.join(', ')}` : '';
  return `${freq} · ${habit.base_points} pts${catStr}`;
}

function parseCategories(json: string): string[] {
  try { const a = JSON.parse(json); return Array.isArray(a) ? a : []; }
  catch { return []; }
}

function confirmDelete(
  habit: LibraryHabit,
  remove: (id: string) => Promise<void>,
) {
  Alert.alert(ALERT_DELETE_HABIT.title, ALERT_DELETE_HABIT.message, [
    { text: ALERT_DELETE_HABIT.cancel, style: 'cancel' },
    { text: ALERT_DELETE_HABIT.confirm, style: 'destructive', onPress: () => remove(habit.id) },
  ]);
}
