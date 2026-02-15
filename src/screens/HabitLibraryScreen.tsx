import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Trash2, Plus } from 'lucide-react-native';
import { useHabitStore } from '../store/useHabitStore';
import { ALERT_DELETE_HABIT, FREQUENCY_LABELS } from '../config/constants';
import { HabitFormModal } from '../components/modals/HabitFormModal';
import { styles, colors } from './HabitLibraryScreen.styles';
import type { Habit, HabitFormData } from '../types';

// ─── Sub-componentes ────────────────────────────────────────────────

function HabitRow({
  habit,
  onPress,
  onDelete,
}: {
  habit: Habit;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <Pressable className={styles.habitRow} onPress={onPress}>
      <View className={styles.habitInfo}>
        <Text className={styles.habitName}>{habit.name}</Text>
        <Text className={styles.habitMeta}>
          {formatMeta(habit)}
        </Text>
      </View>
      <Pressable className={styles.deleteButton} onPress={onDelete}>
        <Trash2 color={colors.rose400} size={18} />
      </Pressable>
    </Pressable>
  );
}

function Separator() {
  return <View className={styles.separator} />;
}

function EmptyList() {
  return <Text className={styles.emptyText}>No hay hábitos creados</Text>;
}

// ─── Pantalla principal ─────────────────────────────────────────────

export function HabitLibraryScreen() {
  const {
    allHabits,
    isLibraryLoading,
    fetchAllHabits,
    addHabit,
    editHabit,
    removeHabit,
  } = useHabitStore();

  const [formVisible, setFormVisible] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  useEffect(() => {
    fetchAllHabits();
  }, [fetchAllHabits]);

  const handleAdd = useCallback(() => {
    setEditingHabit(null);
    setFormVisible(true);
  }, []);

  const handleEdit = useCallback((habit: Habit) => {
    setEditingHabit(habit);
    setFormVisible(true);
  }, []);

  const handleDelete = useCallback(
    (habit: Habit) => {
      confirmDelete(habit, removeHabit);
    },
    [removeHabit],
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

  const handleCancel = useCallback(() => {
    setFormVisible(false);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Habit }) => (
      <HabitRow
        habit={item}
        onPress={() => handleEdit(item)}
        onDelete={() => handleDelete(item)}
      />
    ),
    [handleEdit, handleDelete],
  );

  if (isLibraryLoading && allHabits.length === 0) {
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
            data={allHabits}
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

function formatMeta(habit: Habit): string {
  const freq = FREQUENCY_LABELS[habit.frequency] ?? habit.frequency;
  const cats = parseCategories(habit.default_categories);
  const catStr = cats.length > 0 ? ` · ${cats.join(', ')}` : '';
  return `${freq} · ${habit.base_points} pts${catStr}`;
}

function parseCategories(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function confirmDelete(
  habit: Habit,
  remove: (id: string) => Promise<void>,
) {
  Alert.alert(
    ALERT_DELETE_HABIT.title,
    ALERT_DELETE_HABIT.message,
    [
      { text: ALERT_DELETE_HABIT.cancel, style: 'cancel' },
      { text: ALERT_DELETE_HABIT.confirm, style: 'destructive', onPress: () => remove(habit.id) },
    ],
  );
}
