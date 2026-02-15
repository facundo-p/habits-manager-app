import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  MONTH_NAMES,
  WEEKDAY_LABELS,
  CATEGORY_LABELS,
  CATEGORY_CHART_COLORS,
} from '../config/constants';
import {
  getMonthlyHeatmapData,
  getCategoryDistribution,
  getWeeklyComparison,
  getHabitsForDate,
} from '../services/statsService';
import {
  styles,
  nativeStyles,
  chartConfig,
  heatmapCellBg,
  heatmapTextColor,
  compBarWidth,
  colors,
  CHART_WIDTH,
  CHART_HEIGHT,
} from './StatsScreen.styles';
import type { DaySummaryHabit, CategoryPoints, WeeklyComparison } from '../types';

// ─── Pantalla principal ─────────────────────────────────────────────

export function StatsScreen() {
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
    setHeatmap(h);
    setCategories(c);
    setWeekly(w);
    setIsLoading(false);
    setSelectedDay(null);
  }, [month, year]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats]),
  );

  const handleDayPress = useCallback(
    async (day: number) => {
      const isSame = selectedDay === day;
      setSelectedDay(isSame ? null : day);
      if (!isSame) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const habits = await getHabitsForDate(dateStr);
        setDaySummary(habits);
      }
    },
    [selectedDay, month, year],
  );

  const goToPrev = useCallback(() => {
    setMonth((m) => (m === 1 ? 12 : m - 1));
    if (month === 1) setYear((y) => y - 1);
  }, [month]);

  const goToNext = useCallback(() => {
    setMonth((m) => (m === 12 ? 1 : m + 1));
    if (month === 12) setYear((y) => y + 1);
  }, [month]);

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
      <Text className={styles.title}>Progreso</Text>
      <View className={styles.titleGap} />

      <HeatmapSection
        month={month}
        year={year}
        cells={cells}
        heatmap={heatmap}
        selectedDay={selectedDay}
        onDayPress={handleDayPress}
        onPrev={goToPrev}
        onNext={goToNext}
      />

      {selectedDay !== null && (
        <>
          <View className={styles.itemGap} />
          <DayDetailCard day={selectedDay} month={month} habits={daySummary} />
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

function HeatmapSection({
  month,
  year,
  cells,
  heatmap,
  selectedDay,
  onDayPress,
  onPrev,
  onNext,
}: {
  month: number;
  year: number;
  cells: (number | null)[];
  heatmap: Record<number, number>;
  selectedDay: number | null;
  onDayPress: (day: number) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View className={styles.section}>
      <MonthNavigator month={month} year={year} onPrev={onPrev} onNext={onNext} />
      <WeekdayHeaders />
      <View className={styles.gridContainer}>
        {cells.map((day, i) => (
          <HeatmapCell
            key={i}
            day={day}
            percentage={day ? heatmap[day] : undefined}
            isSelected={day === selectedDay}
            onPress={day ? () => onDayPress(day) : undefined}
          />
        ))}
      </View>
    </View>
  );
}

function MonthNavigator({
  month,
  year,
  onPrev,
  onNext,
}: {
  month: number;
  year: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View className={styles.monthNav}>
      <Pressable className={styles.navButton} onPress={onPrev}>
        <ChevronLeft color={colors.amber700} size={22} />
      </Pressable>
      <Text className={styles.monthLabel}>
        {MONTH_NAMES[month - 1]} {year}
      </Text>
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

function HeatmapCell({
  day,
  percentage,
  isSelected,
  onPress,
}: {
  day: number | null;
  percentage: number | undefined;
  isSelected: boolean;
  onPress?: () => void;
}) {
  if (day === null) {
    return <View style={nativeStyles.cell} />;
  }

  return (
    <Pressable
      style={[nativeStyles.cell, heatmapCellBg(percentage), isSelected && nativeStyles.selectedCell]}
      onPress={onPress}
    >
      <Text className={styles.cellDay} style={{ color: heatmapTextColor(percentage) }}>
        {day}
      </Text>
    </Pressable>
  );
}

// ─── Day Detail ─────────────────────────────────────────────────────

function DayDetailCard({
  day,
  month,
  habits,
}: {
  day: number;
  month: number;
  habits: DaySummaryHabit[];
}) {
  return (
    <View className={styles.section}>
      <Text className={styles.detailTitle}>
        Hábitos del {day} de {MONTH_NAMES[month - 1].toLowerCase()}
      </Text>
      <View className={styles.itemGap} />
      {habits.length === 0 ? (
        <Text className={styles.emptyText}>Sin hábitos registrados</Text>
      ) : (
        habits.map((h) => <DaySummaryRow key={h.name} habit={h} />)
      )}
    </View>
  );
}

function DaySummaryRow({ habit }: { habit: DaySummaryHabit }) {
  return (
    <View className={styles.detailRow}>
      {habit.completed ? (
        <Check color={colors.sage700} size={16} />
      ) : (
        <X color={colors.amber400} size={16} />
      )}
      <Text className={habit.completed ? styles.detailDone : styles.detailMissed}>
        {habit.name}
      </Text>
    </View>
  );
}

// ─── Category Chart ─────────────────────────────────────────────────

function CategoryCard({ data }: { data: CategoryPoints[] }) {
  return (
    <View className={styles.section}>
      <Text className={styles.sectionTitle}>Distribución por Área</Text>
      <View className={styles.itemGap} />
      {data.length > 0 ? (
        <CategoryPie data={data} />
      ) : (
        <Text className={styles.emptyText}>Sin datos este mes</Text>
      )}
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
        data={pieData}
        width={CHART_WIDTH}
        height={CHART_HEIGHT}
        chartConfig={chartConfig}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="15"
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

function ComparisonBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
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
