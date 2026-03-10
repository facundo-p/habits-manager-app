/**
 * HabitLibraryScreen — Pantalla de biblioteca de hábitos.
 *
 * Dividida en "Hábitos Activos" y "Hábitos Archivados".
 * Los archivados se muestran al final con opacidad del 50%.
 * Usa NotebookPaper con efecto de anillado espiral.
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Trash2, Plus, Eye, EyeOff } from 'lucide-react-native';
import { useHabitStore } from '../store/useHabitStore';
import { ALERT_DELETE_HABIT, FREQUENCY_LABELS, CATEGORY_LABELS } from '../config/constants';
import { AppScreenHeader } from '../components/layout/AppScreenHeader';
import { NotebookPaper } from '../components/layout/NotebookPaper';
import { HabitFormModal } from '../components/modals/HabitFormModal';
import { styles, nativeStyles, colors } from './HabitLibraryScreen.styles';
import type { LibraryHabit, HabitFormData } from '../types';
import { parseJsonArray } from '../utils/parsing';

// ─── Sub-componentes ────────────────────────────────────────────────

function HabitRow({
  habit, onPress, onToggleActive, onDelete, isArchived,
}: {
  habit: LibraryHabit; onPress: () => void; onToggleActive: () => void;
  onDelete: () => void; isArchived: boolean;
}) {
  const nameStyle = isArchived ? styles.habitNameInactive : styles.habitName;
  const metaStyle = isArchived ? styles.habitMetaInactive : styles.habitMeta;
  const countStyle = isArchived ? styles.habitCountInactive : styles.habitCount;

  return (
    <Pressable className={styles.habitRow} onPress={onPress}>
      <View className={styles.habitInfo}>
        <Text className={nameStyle}>{habit.name}</Text>
        <Text className={metaStyle}>{formatMeta(habit)}</Text>
        <Text className={countStyle}>
          Completado {habit.completionCount} {habit.completionCount === 1 ? 'vez' : 'veces'}
        </Text>
      </View>
      <View className={styles.actionsRow}>
        <Pressable className={styles.eyeButton} onPress={onToggleActive}>
          {!isArchived
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
function EmptyArchived() { return <Text className={styles.emptyText}>Sin hábitos archivados</Text>; }

// ─── Pantalla principal ─────────────────────────────────────────────

export function HabitLibraryScreen() {
  const {
    libraryHabits, isLibraryLoading,
    fetchLibrary, addHabit, editHabit, removeHabit, toggleActive,
  } = useHabitStore();

  const [formVisible, setFormVisible] = useState(false);
  const [editingHabit, setEditingHabit] = useState<LibraryHabit | null>(null);

  useEffect(() => { fetchLibrary(); }, [fetchLibrary]);

  const { active, archived } = useMemo(() => splitByActive(libraryHabits), [libraryHabits]);

  const handleAdd = useCallback(() => { setEditingHabit(null); setFormVisible(true); }, []);
  const handleEdit = useCallback((h: LibraryHabit) => { setEditingHabit(h); setFormVisible(true); }, []);
  const handleDelete = useCallback((h: LibraryHabit) => confirmDelete(h, removeHabit), [removeHabit]);
  const handleToggle = useCallback((h: LibraryHabit) => toggleActive(h.id, h.is_active !== 1), [toggleActive]);

  const handleSave = useCallback(async (data: HabitFormData) => {
    if (editingHabit) { await editHabit(editingHabit.id, data); }
    else { await addHabit(data); }
    setFormVisible(false);
  }, [editingHabit, editHabit, addHabit]);

  const handleCancel = useCallback(() => setFormVisible(false), []);

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
        <AppScreenHeader title="Biblioteca" />
        <View className={styles.titleGap} />

        <Text className={styles.sectionTitle}>Hábitos Activos</Text>
        <View className={styles.sectionGap} />
        <NotebookPaper>
          <HabitList
            data={active}
            isArchived={false}
            onEdit={handleEdit}
            onToggle={handleToggle}
            onDelete={handleDelete}
            emptyComponent={EmptyList}
          />
        </NotebookPaper>

        <View className={styles.sectionGap} />

        {archived.length > 0 && (
          <View style={nativeStyles.archivedWrapper}>
            <Text className={styles.sectionTitle}>Hábitos Archivados</Text>
            <View className={styles.sectionGap} />
            <NotebookPaper>
              <HabitList
                data={archived}
                isArchived
                onEdit={handleEdit}
                onToggle={handleToggle}
                onDelete={handleDelete}
                emptyComponent={EmptyArchived}
              />
            </NotebookPaper>
          </View>
        )}

        <View className={styles.sectionGap} />
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

// ─── Sub-componente lista ───────────────────────────────────────────

function HabitList({
  data, isArchived, onEdit, onToggle, onDelete, emptyComponent: Empty,
}: {
  data: LibraryHabit[];
  isArchived: boolean;
  onEdit: (h: LibraryHabit) => void;
  onToggle: (h: LibraryHabit) => void;
  onDelete: (h: LibraryHabit) => void;
  emptyComponent: React.ComponentType;
}) {
  const renderItem = useCallback(
    ({ item }: { item: LibraryHabit }) => (
      <HabitRow
        habit={item}
        isArchived={isArchived}
        onPress={() => onEdit(item)}
        onToggleActive={() => onToggle(item)}
        onDelete={() => onDelete(item)}
      />
    ),
    [isArchived, onEdit, onToggle, onDelete],
  );

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ItemSeparatorComponent={Separator}
      scrollEnabled={false}
      ListEmptyComponent={Empty}
    />
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function splitByActive(habits: LibraryHabit[]) {
  const active: LibraryHabit[] = [];
  const archived: LibraryHabit[] = [];
  for (const h of habits) {
    (h.is_active === 1 ? active : archived).push(h);
  }
  return { active, archived };
}

function formatMeta(habit: LibraryHabit): string {
  const freq = FREQUENCY_LABELS[habit.frequency] ?? habit.frequency;
  const cats = parseJsonArray(habit.default_categories);
  const catLabels = cats.map((c) => CATEGORY_LABELS[c] ?? c);
  const catStr = catLabels.length > 0 ? ` · ${catLabels.join(', ')}` : '';
  return `${freq} · ${habit.base_points} pts${catStr}`;
}

function confirmDelete(habit: LibraryHabit, remove: (id: string) => Promise<void>) {
  Alert.alert(ALERT_DELETE_HABIT.title, ALERT_DELETE_HABIT.message, [
    { text: ALERT_DELETE_HABIT.cancel, style: 'cancel' },
    { text: ALERT_DELETE_HABIT.confirm, style: 'destructive', onPress: () => remove(habit.id) },
  ]);
}
