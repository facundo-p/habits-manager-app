import React, { useCallback, useEffect } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Check } from 'lucide-react-native';
import { useHabitStore } from '../store/useHabitStore';
import { colors } from '../styles/ui.styles';
import { CHECKBOX_ICON_SIZE, ALERT_UNMARK } from '../config/constants';
import { ReflectionModal } from '../components/modals/ReflectionModal';
import { styles, progressFillWidth } from './DailySheetScreen.styles';
import type { DailyHabit, DailyStats } from '../types';

function formatTodayDate(): string {
  return new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
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

function HabitRow({
  habit,
  onPress,
  onLongPress,
}: {
  habit: DailyHabit;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const checkboxStyle = habit.completedToday
    ? styles.checkboxChecked
    : styles.checkboxUnchecked;

  const textStyle = habit.completedToday
    ? styles.habitTextCompleted
    : styles.habitText;

  return (
    <Pressable className={styles.habitRow} onPress={onPress} onLongPress={onLongPress}>
      <View className={checkboxStyle}>
        {habit.completedToday && (
          <Check color={colors.white} size={CHECKBOX_ICON_SIZE} />
        )}
      </View>
      <Text className={textStyle}>{habit.name}</Text>
    </Pressable>
  );
}

function Separator() {
  return <View className={styles.separator} />;
}

function EmptyList() {
  return <Text className={styles.emptyText}>No hay hábitos registrados</Text>;
}

// ─── Pantalla principal ─────────────────────────────────────────────

export function DailySheetScreen() {
  const {
    dailyHabits,
    dailyStats,
    isLoading,
    pendingReflection,
    fetchDailyHabits,
    toggleHabit,
    openEditReflection,
    saveReflection,
    skipReflection,
  } = useHabitStore();

  useEffect(() => {
    fetchDailyHabits();
  }, [fetchDailyHabits]);

  const handlePress = useCallback(
    (habit: DailyHabit) => {
      if (habit.completedToday) {
        confirmUnmark(habit, toggleHabit);
      } else {
        toggleHabit(habit);
      }
    },
    [toggleHabit],
  );

  const handleLongPress = useCallback(
    (habit: DailyHabit) => {
      if (habit.completedToday) {
        openEditReflection(habit);
      }
    },
    [openEditReflection],
  );

  const renderItem = useCallback(
    ({ item }: { item: DailyHabit }) => (
      <HabitRow
        habit={item}
        onPress={() => handlePress(item)}
        onLongPress={() => handleLongPress(item)}
      />
    ),
    [handlePress, handleLongPress],
  );

  if (isLoading && dailyHabits.length === 0) {
    return (
      <View className={styles.loading}>
        <ActivityIndicator size="large" color={colors.amber600} />
      </View>
    );
  }

  return (
    <ScrollView className={styles.container}>
      <Text className={styles.title}>Hoy</Text>
      <Text className={styles.dateCaption}>{formatTodayDate()}</Text>

      <View className={styles.titleGap} />

      <ProgressHeader stats={dailyStats} />

      <View className={styles.paper}>
        <FlatList
          data={dailyHabits}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={Separator}
          scrollEnabled={false}
          ListEmptyComponent={EmptyList}
        />
      </View>

      <ReflectionModal
        visible={!!pendingReflection}
        habitName={pendingReflection?.habit.name ?? ''}
        initialDescription={pendingReflection?.initialDescription}
        initialMoodValue={pendingReflection?.initialMoodValue}
        onSave={saveReflection}
        onSkip={skipReflection}
      />
    </ScrollView>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function confirmUnmark(
  habit: DailyHabit,
  toggle: (h: DailyHabit) => Promise<void>,
) {
  Alert.alert(
    ALERT_UNMARK.title,
    ALERT_UNMARK.message,
    [
      { text: ALERT_UNMARK.cancel, style: 'cancel' },
      { text: ALERT_UNMARK.confirm, style: 'destructive', onPress: () => toggle(habit) },
    ],
  );
}
