/**
 * DailySheetScreen — Pantalla principal "Hoy" con modo histórico.
 *
 * Soporta 3 secciones (Diarios/Semanales/Mensuales),
 * badges de área en cada hábito, y barras de progreso por sección.
 * Usa NotebookPaper con efecto anillado espiral.
 *
 * viewDate del store es la única fuente de verdad para la fecha.
 * Los route params solo se usan una vez (al llegar de Stats) y se limpian.
 * useFocusEffect garantiza recarga al ganar foco con la fecha correcta.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Check } from 'lucide-react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useHabitStore } from '../store/useHabitStore';
import { useFeedback } from '../hooks/useFeedback';
import {
  CHECKBOX_ICON_SIZE, ALERT_UNMARK, FREQUENCY_LABELS, AREAS_MAP, MONTH_NAMES, ROUTES,
} from '../config/constants';
import { NotebookPaper } from '../components/layout/NotebookPaper';
import { ReflectionModal } from '../components/modals/ReflectionModal';
import { AreaInfoModal } from '../components/modals/AreaInfoModal';
import {
  styles, nativeStyles, miniProgressFillWidth, colors,
} from './DailySheetScreen.styles';
import type { DailyHabit, DailyStats, HabitArea, FrequencyGroup, RootTabParamList } from '../types';

type DailyNavProp = BottomTabNavigationProp<RootTabParamList, 'Hoy'>;

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

function AreaBadge({ areaId, onPress }: { areaId: string; onPress: (id: string) => void }) {
  const area = AREAS_MAP[areaId];
  if (!area) return null;
  return (
    <Pressable
      style={[nativeStyles.badgeContainer, { backgroundColor: area.color }]}
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
  habit, onPress, onLongPress, onBadgePress,
}: {
  habit: DailyHabit; onPress: () => void; onLongPress: () => void; onBadgePress: (id: string) => void;
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
  group, onPress, onLongPress, onBadgePress,
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
      <NotebookPaper>
        <FlatList
          data={group.habits}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={Separator}
          scrollEnabled={false}
          ListEmptyComponent={EmptyList}
        />
      </NotebookPaper>
      <MiniProgressBar stats={group.stats} />
    </View>
  );
}

// ─── Pantalla principal ─────────────────────────────────────────────

export function DailySheetScreen() {
  const route = useRoute();
  const navigation = useNavigation<DailyNavProp>();
  const routeDate = (route.params as { date?: string } | undefined)?.date ?? null;

  const {
    dailyHabits, dailyStats, isLoading, pendingReflection, viewDate,
    resetToToday, setViewDate, fetchHabitsForDate,
    toggleHabit, openEditReflection, saveReflection, skipReflection,
  } = useHabitStore();

  const { triggerSuccess } = useFeedback();
  const [selectedArea, setSelectedArea] = useState<HabitArea | null>(null);

  // ── 1. Consumir el route param una sola vez y limpiarlo ──────────
  useEffect(() => {
    if (routeDate) {
      setViewDate(routeDate);
      navigation.setParams({ date: undefined } as any);
    }
  }, [routeDate, setViewDate, navigation]);

  // ── 2. Recargar hábitos al ganar foco o cuando viewDate cambie ───
  useFocusEffect(
    useCallback(() => {
      fetchHabitsForDate(viewDate);
    }, [viewDate, fetchHabitsForDate]),
  );

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
    setSelectedArea(AREAS_MAP[areaId] ?? null);
  }, []);

  // ── 3. Guardar y Volver: dismiss reflection + reset + ir a Stats ──
  const handleGoBack = useCallback(() => {
    skipReflection();
    resetToToday();
    navigation.navigate(ROUTES.STATS as 'Progreso');
  }, [skipReflection, resetToToday, navigation]);

  const groups = groupByFrequency(dailyHabits);

  // viewDate del store = fuente de verdad (no route params)
  const isHistoric = !!viewDate;

  if (isLoading && dailyHabits.length === 0) {
    return (
      <View className={styles.loading}>
        <ActivityIndicator size="large" color={colors.amber600} />
      </View>
    );
  }

  return (
    <ScrollView className={styles.container}>
      {isHistoric ? (
        <HistoricHeader date={viewDate!} onGoBack={handleGoBack} />
      ) : (
        <TodayHeader />
      )}

      <View className={styles.titleGap} />

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

// ─── Headers ────────────────────────────────────────────────────────

function TodayHeader() {
  return (
    <>
      <Text className={styles.title}>Hoy</Text>
      <Text className={styles.dateCaption}>{formatTodayDate()}</Text>
    </>
  );
}

function HistoricHeader({ date, onGoBack }: { date: string; onGoBack: () => void }) {
  return (
    <>
      <View className={styles.headerRow}>
        <View>
          <Text className={styles.title}>Editando</Text>
          <Text className={styles.editingLabel}>{formatHistoricDate(date)}</Text>
        </View>
        <Pressable className={styles.goBackButton} onPress={onGoBack}>
          <Text className={styles.goBackText}>Guardar y Volver</Text>
        </Pressable>
      </View>
    </>
  );
}
