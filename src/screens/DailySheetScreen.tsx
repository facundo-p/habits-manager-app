/**
 * DailySheetScreen — Pantalla principal "Hoy" con modo histórico.
 *
 * Soporta 3 secciones (Diarios/Semanales/Mensuales),
 * badges de área en cada hábito, y barras de progreso por sección.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Check } from 'lucide-react-native';
import { useRoute } from '@react-navigation/native';
import { useHabitStore } from '../store/useHabitStore';
import { useFeedback } from '../hooks/useFeedback';
import { colors } from '../styles/ui.styles';
import {
  CHECKBOX_ICON_SIZE, ALERT_UNMARK, FREQUENCY_LABELS, AREAS_MAP, MONTH_NAMES,
} from '../config/constants';
import { ReflectionModal } from '../components/modals/ReflectionModal';
import { AreaInfoModal } from '../components/modals/AreaInfoModal';
import { styles, progressFillWidth, miniProgressFillWidth } from './DailySheetScreen.styles';
import type { DailyHabit, DailyStats, HabitArea, FrequencyGroup } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────

function formatTodayDate(): string {
  return new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function formatHistoricDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} de ${MONTH_NAMES[m - 1]} ${y}`;
}

function safeParseJson(json: string): string[] {
  try { const a = JSON.parse(json); return Array.isArray(a) ? a : []; }
  catch { return []; }
}

function computeGroupStats(habits: DailyHabit[]): DailyStats {
  const total = habits.reduce((s, h) => s + h.base_points, 0);
  const earned = habits.filter((h) => h.completedToday).reduce((s, h) => s + h.base_points, 0);
  const pct = total > 0 ? Math.round((earned / total) * 100) : 0;
  return { earned, total, percentage: pct };
}

function groupByFrequency(habits: DailyHabit[]): FrequencyGroup[] {
  const freqs: Array<'daily' | 'weekly' | 'monthly'> = ['daily', 'weekly', 'monthly'];
  return freqs
    .map((f) => {
      const h = habits.filter((x) => x.frequency === f);
      return { frequency: f, habits: h, stats: computeGroupStats(h) };
    })
    .filter((g) => g.habits.length > 0);
}

function confirmUnmark(habit: DailyHabit, toggle: (h: DailyHabit) => Promise<void>) {
  Alert.alert(ALERT_UNMARK.title, ALERT_UNMARK.message, [
    { text: ALERT_UNMARK.cancel, style: 'cancel' },
    { text: ALERT_UNMARK.confirm, style: 'destructive', onPress: () => toggle(habit) },
  ]);
}

// ─── Sub-componentes ────────────────────────────────────────────────

function ProgressHeader({ stats }: { stats: DailyStats }) {
  return (
    <View className={styles.progressWrapper}>
      <View className={styles.progressRow}>
        <Text className={styles.progressEarned}>{stats.earned}</Text>
        <Text className={styles.progressTotal}>/ {stats.total} puntos</Text>
      </View>
      <View className={styles.progressTrack}>
        <View className={styles.progressFill} style={progressFillWidth(stats.percentage)} />
      </View>
    </View>
  );
}

function MiniProgressBar({ stats }: { stats: DailyStats }) {
  return (
    <View className={styles.miniProgressWrapper}>
      <View className={styles.miniProgressRow}>
        <Text className={styles.miniProgressEarned}>{stats.earned}</Text>
        <Text className={styles.miniProgressTotal}>/ {stats.total} pts · {stats.percentage}%</Text>
      </View>
      <View className={styles.miniProgressTrack}>
        <View className={styles.miniProgressFill} style={miniProgressFillWidth(stats.percentage)} />
      </View>
    </View>
  );
}

function AreaBadge({
  areaId,
  onPress,
}: {
  areaId: string;
  onPress: (id: string) => void;
}) {
  const area = AREAS_MAP[areaId];
  if (!area) return null;
  return (
    <Pressable
      className={styles.badgeRow ? undefined : undefined}
      style={{ backgroundColor: area.color, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginRight: 6, marginTop: 4 }}
      onPress={() => onPress(areaId)}
    >
      <Text className={styles.badgeText}>{area.label}</Text>
    </Pressable>
  );
}

function AreaBadges({ categories, onBadgePress }: { categories: string; onBadgePress: (id: string) => void }) {
  const ids = safeParseJson(categories);
  if (ids.length === 0) return null;
  return (
    <View className={styles.badgeRow}>
      {ids.map((id) => <AreaBadge key={id} areaId={id} onPress={onBadgePress} />)}
    </View>
  );
}

function HabitRow({
  habit,
  onPress,
  onLongPress,
  onBadgePress,
}: {
  habit: DailyHabit;
  onPress: () => void;
  onLongPress: () => void;
  onBadgePress: (id: string) => void;
}) {
  const checkStyle = habit.completedToday ? styles.checkboxChecked : styles.checkboxUnchecked;
  const textStyle = habit.completedToday ? styles.habitTextCompleted : styles.habitText;

  return (
    <Pressable className={styles.habitRow} onPress={onPress} onLongPress={onLongPress}>
      <View className={checkStyle}>
        {habit.completedToday && <Check color={colors.white} size={CHECKBOX_ICON_SIZE} />}
      </View>
      <View className={styles.habitContent}>
        <Text className={textStyle}>{habit.name}</Text>
        <AreaBadges categories={habit.default_categories} onBadgePress={onBadgePress} />
      </View>
    </Pressable>
  );
}

function Separator() { return <View className={styles.separator} />; }

function EmptyList() { return <Text className={styles.emptyText}>No hay hábitos registrados</Text>; }

function FrequencySection({
  group,
  onPress,
  onLongPress,
  onBadgePress,
}: {
  group: FrequencyGroup;
  onPress: (h: DailyHabit) => void;
  onLongPress: (h: DailyHabit) => void;
  onBadgePress: (id: string) => void;
}) {
  const renderItem = useCallback(
    ({ item }: { item: DailyHabit }) => (
      <HabitRow
        habit={item}
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress(item)}
        onBadgePress={onBadgePress}
      />
    ),
    [onPress, onLongPress, onBadgePress],
  );

  return (
    <View className={styles.sectionContainer}>
      <Text className={styles.sectionTitle}>{FREQUENCY_LABELS[group.frequency]}</Text>
      <MiniProgressBar stats={group.stats} />
      <View className={styles.paper}>
        <FlatList
          data={group.habits}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={Separator}
          scrollEnabled={false}
          ListEmptyComponent={EmptyList}
        />
      </View>
    </View>
  );
}

// ─── Pantalla principal ─────────────────────────────────────────────

export function DailySheetScreen() {
  const route = useRoute();
  const targetDate = (route.params as { date?: string } | undefined)?.date ?? null;

  const {
    dailyHabits, dailyStats, isLoading, pendingReflection, viewDate,
    setViewDate, fetchHabitsForDate,
    toggleHabit, openEditReflection, saveReflection, skipReflection,
  } = useHabitStore();

  const { triggerSuccess } = useFeedback();
  const [selectedArea, setSelectedArea] = useState<HabitArea | null>(null);

  // Sincronizar viewDate con route params
  useEffect(() => {
    setViewDate(targetDate);
  }, [targetDate, setViewDate]);

  useEffect(() => {
    fetchHabitsForDate(viewDate);
  }, [viewDate, fetchHabitsForDate]);

  const handlePress = useCallback(
    (habit: DailyHabit) => {
      if (habit.completedToday) {
        confirmUnmark(habit, toggleHabit);
      } else {
        toggleHabit(habit).then(() => triggerSuccess());
      }
    },
    [toggleHabit, triggerSuccess],
  );

  const handleLongPress = useCallback(
    (habit: DailyHabit) => {
      if (habit.completedToday) openEditReflection(habit);
    },
    [openEditReflection],
  );

  const handleBadgePress = useCallback((areaId: string) => {
    const area = AREAS_MAP[areaId] ?? null;
    setSelectedArea(area);
  }, []);

  const groups = groupByFrequency(dailyHabits);

  if (isLoading && dailyHabits.length === 0) {
    return (
      <View className={styles.loading}>
        <ActivityIndicator size="large" color={colors.amber600} />
      </View>
    );
  }

  const isHistoric = !!targetDate;
  const title = isHistoric ? 'Editando' : 'Hoy';
  const subtitle = isHistoric
    ? formatHistoricDate(targetDate!)
    : formatTodayDate();

  return (
    <ScrollView className={styles.container}>
      <Text className={styles.title}>{title}</Text>
      {isHistoric && <Text className={styles.editingLabel}>{subtitle}</Text>}
      {!isHistoric && <Text className={styles.dateCaption}>{subtitle}</Text>}

      <View className={styles.titleGap} />
      <ProgressHeader stats={dailyStats} />

      {groups.map((g) => (
        <FrequencySection
          key={g.frequency}
          group={g}
          onPress={handlePress}
          onLongPress={handleLongPress}
          onBadgePress={handleBadgePress}
        />
      ))}

      {groups.length === 0 && <EmptyList />}

      <ReflectionModal
        visible={!!pendingReflection}
        habitName={pendingReflection?.habit.name ?? ''}
        initialDescription={pendingReflection?.initialDescription}
        initialMoodValue={pendingReflection?.initialMoodValue}
        onSave={saveReflection}
        onSkip={skipReflection}
      />

      <AreaInfoModal
        visible={!!selectedArea}
        area={selectedArea}
        onClose={() => setSelectedArea(null)}
      />
    </ScrollView>
  );
}
