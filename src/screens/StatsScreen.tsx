/**
 * StatsScreen — Pantalla de progreso con heatmap, pie chart y comparación.
 *
 * Al tocar un día en el heatmap, se puede navegar a DailySheet
 * en modo histórico para editar hábitos de esa fecha.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { ChevronLeft, ChevronRight, Check, X, Edit3, Star } from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  MONTH_NAMES, WEEKDAY_LABELS, CATEGORY_LABELS, CATEGORY_CHART_COLORS,
  FREQUENCY_LABELS, ROUTES,
} from '../config/constants';
import { AppScreenHeader } from '../components/layout/AppScreenHeader';
import {
  getMonthlyHeatmapData, getCategoryDistribution, getWeeklyComparison, getHabitsForDate,
} from '../services/statsService';
import {
  styles, nativeStyles, chartConfig, heatmapCellBg, heatmapTextStyle, compBarWidth,
  colors, CHART_WIDTH, CHART_HEIGHT,
} from './StatsScreen.styles';
import type { DaySummaryHabit, CategoryPoints, WeeklyComparison, RootTabParamList } from '../types';

type StatsNavProp = BottomTabNavigationProp<RootTabParamList, 'Progreso'>;

// ─── Pantalla principal ─────────────────────────────────────────────

export function StatsScreen() {
  const navigation = useNavigation<StatsNavProp>();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const [heatmap, setHeatmap] = useState<Record<number, number>>({});
  const [categories, setCategories] = useState<CategoryPoints[]>([]);
  const [weekly, setWeekly] = useState<WeeklyComparison>({ thisWeek: 0, lastWeek: 0 });
  const [daySummary, setDaySummary] = useState<DaySummaryHabit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    const [h, c, w] = await Promise.all([
      getMonthlyHeatmapData(month, year),
      getCategoryDistribution(month, year),
      getWeeklyComparison(),
    ]);
    setHeatmap(h); setCategories(c); setWeekly(w);
    setIsLoading(false); setSelectedDay(null);
  }, [month, year]);

  useFocusEffect(useCallback(() => { loadStats(); }, [loadStats]));

  const handleDayPress = useCallback(
    async (day: number) => {
      const isSame = selectedDay === day;
      setSelectedDay(isSame ? null : day);
      if (!isSame) {
        const dateStr = buildDateStr(year, month, day);
        const habits = await getHabitsForDate(dateStr);
        setDaySummary(habits);
      }
    },
    [selectedDay, month, year],
  );

  const handleEditDay = useCallback(() => {
    if (selectedDay === null) return;
    const dateStr = buildDateStr(year, month, selectedDay);
    navigation.navigate(ROUTES.DAILY_SHEET, { date: dateStr });
  }, [selectedDay, month, year, navigation]);

  const goToPrev = useCallback(() => {
    setMonth((m) => {
      if (m === 1) {
        setYear((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  }, []);

  const goToNext = useCallback(() => {
    setMonth((m) => {
      if (m === 12) {
        setYear((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
  }, []);

  if (isLoading) {
    return (
      <View className={styles.loading}>
        <ActivityIndicator size="large" color={colors.amber600} />
      </View>
    );
  }

  const cells = buildCalendarCells(month, year);

  return (
    <ScrollView className={styles.container} showsVerticalScrollIndicator={false}>
      <AppScreenHeader title="Progreso" />
      <View className={styles.titleGap} />

      <HeatmapSection
        month={month} year={year} cells={cells} heatmap={heatmap}
        selectedDay={selectedDay} onDayPress={handleDayPress}
        onPrev={goToPrev} onNext={goToNext}
      />

      {selectedDay !== null && (
        <>
          <View className={styles.itemGap} />
          <DayDetailCard
            day={selectedDay} month={month} habits={daySummary}
            onEdit={handleEditDay}
          />
        </>
      )}

      <View className={styles.sectionGap} />
      <CategoryCard data={categories} />

      <View className={styles.sectionGap} />
      <WeeklyCard data={weekly} />

      <View className={styles.sectionGap} />
    </ScrollView>
  );
}

// ─── Heatmap Section ────────────────────────────────────────────────

function HeatmapSection(props: {
  month: number; year: number; cells: (number | null)[];
  heatmap: Record<number, number>; selectedDay: number | null;
  onDayPress: (day: number) => void; onPrev: () => void; onNext: () => void;
}) {
  const { month, year, cells, heatmap, selectedDay, onDayPress, onPrev, onNext } = props;
  return (
    <View className={styles.section}>
      <MonthNavigator month={month} year={year} onPrev={onPrev} onNext={onNext} />
      <WeekdayHeaders />
      <View className={styles.gridContainer}>
        {cells.map((day, i) => (
          <HeatmapCell key={i} day={day} percentage={day ? heatmap[day] : undefined}
            isSelected={day === selectedDay} onPress={day ? () => onDayPress(day) : undefined} />
        ))}
      </View>
    </View>
  );
}

function MonthNavigator({ month, year, onPrev, onNext }: { month: number; year: number; onPrev: () => void; onNext: () => void }) {
  return (
    <View className={styles.monthNav}>
      <Pressable className={styles.navButton} onPress={onPrev}>
        <ChevronLeft color={colors.amber700} size={22} />
      </Pressable>
      <Text className={styles.monthLabel}>{MONTH_NAMES[month - 1]} {year}</Text>
      <Pressable className={styles.navButton} onPress={onNext}>
        <ChevronRight color={colors.amber700} size={22} />
      </Pressable>
    </View>
  );
}

function WeekdayHeaders() {
  return (
    <View className={styles.gridContainer}>
      {WEEKDAY_LABELS.map((label, i) => (
        <View key={i} style={nativeStyles.weekdayCell}>
          <Text className={styles.weekdayLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function HeatmapCell({ day, percentage, isSelected, onPress }: {
  day: number | null; percentage: number | undefined; isSelected: boolean; onPress?: () => void;
}) {
  if (day === null) return <View style={nativeStyles.cell} />;

  return (
    <Pressable
      style={[nativeStyles.cell, heatmapCellBg(percentage), isSelected && nativeStyles.selectedCell]}
      onPress={onPress}
    >
      <Text className={styles.cellDay} style={heatmapTextStyle(percentage)}>{day}</Text>
    </Pressable>
  );
}

// ─── Day Detail ─────────────────────────────────────────────────────

function DayDetailCard({ day, month, habits, onEdit }: {
  day: number; month: number; habits: DaySummaryHabit[]; onEdit: () => void;
}) {
  const regular = habits.filter((h) => !h.isSpontaneous);
  const spontaneous = habits.filter((h) => h.isSpontaneous);

  return (
    <View className={styles.section}>
      <View className={styles.monthNav}>
        <Text className={styles.detailTitle}>
          Hábitos del {day} de {MONTH_NAMES[month - 1].toLowerCase()}
        </Text>
        <Pressable className={styles.navButton} onPress={onEdit}>
          <Edit3 color={colors.amber700} size={18} strokeWidth={1.8} />
        </Pressable>
      </View>
      {regular.length === 0 && spontaneous.length === 0 ? (
        <Text className={styles.emptyText}>Sin registros para este día</Text>
      ) : (
        <>
          {regular.map((h, i) => <DaySummaryRow key={`r-${i}`} habit={h} />)}
          {spontaneous.length > 0 && (
            <>
              <View className={styles.spontaneousDivider} />
              <Text className={styles.spontaneousLabel}>Logros del Día</Text>
              {spontaneous.map((h, i) => <SpontaneousSummaryRow key={`s-${i}`} habit={h} />)}
            </>
          )}
        </>
      )}
    </View>
  );
}

function DaySummaryRow({ habit }: { habit: DaySummaryHabit }) {
  const freqLabel = FREQUENCY_LABELS[habit.frequency] ?? '';
  return (
    <View className={styles.detailRow}>
      {habit.completed
        ? <Check color={colors.sage700} size={16} />
        : <X color={colors.amber400} size={16} />
      }
      <Text className={habit.completed ? styles.detailDone : styles.detailMissed}>
        {habit.name}
      </Text>
      {habit.points > 0 && (
        <Text className={styles.detailPoints}>{habit.points} pts</Text>
      )}
      {freqLabel ? (
        <Text className={styles.detailFreq}>{freqLabel}</Text>
      ) : null}
    </View>
  );
}

function SpontaneousSummaryRow({ habit }: { habit: DaySummaryHabit }) {
  return (
    <View className={styles.detailRow}>
      <Star color={colors.amber500} size={14} fill={colors.amber500} />
      <Text className={styles.detailSpontaneous}>{habit.name}</Text>
    </View>
  );
}

// ─── Category Chart ─────────────────────────────────────────────────

function CategoryCard({ data }: { data: CategoryPoints[] }) {
  return (
    <View className={styles.section}>
      <Text className={styles.sectionTitle}>Distribución por Área</Text>
      <View className={styles.itemGap} />
      {data.length > 0
        ? <CategoryPie data={data} />
        : <Text className={styles.emptyText}>Sin datos este mes</Text>
      }
    </View>
  );
}

function CategoryPie({ data }: { data: CategoryPoints[] }) {
  const pieData = data.map((cp) => ({
    name: CATEGORY_LABELS[cp.category] ?? cp.category,
    population: cp.points,
    color: CATEGORY_CHART_COLORS[cp.category] ?? colors.amber400,
    legendFontColor: colors.amber800,
    legendFontSize: 12,
  }));

  return (
    <View className={styles.chartCenter}>
      <PieChart
        data={pieData} width={CHART_WIDTH} height={CHART_HEIGHT}
        chartConfig={chartConfig} accessor="population"
        backgroundColor="transparent" paddingLeft="15"
      />
    </View>
  );
}

// ─── Weekly Comparison ──────────────────────────────────────────────

function WeeklyCard({ data }: { data: WeeklyComparison }) {
  const max = Math.max(data.thisWeek, data.lastWeek, 1);
  return (
    <View className={styles.section}>
      <Text className={styles.sectionTitle}>Semana vs Semana</Text>
      <View className={styles.itemGap} />
      <ComparisonBar label="Esta semana" value={data.thisWeek} max={max} color={colors.sage400} />
      <ComparisonBar label="Semana anterior" value={data.lastWeek} max={max} color={colors.amber400} />
    </View>
  );
}

function ComparisonBar({ label, value, max, color }: {
  label: string; value: number; max: number; color: string;
}) {
  return (
    <View className={styles.compRow}>
      <Text className={styles.compLabel}>{label}</Text>
      <View className={styles.compBarRow}>
        <View style={nativeStyles.compTrack}>
          <View style={[nativeStyles.compBar, compBarWidth(value, max), { backgroundColor: color }]} />
        </View>
        <Text className={styles.compValue}>{value} pts</Text>
      </View>
    </View>
  );
}

// ─── Calendar helpers ───────────────────────────────────────────────

function buildCalendarCells(month: number, year: number): (number | null)[] {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function buildDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
