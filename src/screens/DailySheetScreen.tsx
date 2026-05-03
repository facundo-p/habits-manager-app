/**
 * DailySheetScreen — Pantalla principal "Hoy" con modo histórico.
 *
 * Basada en daily_assignments (DailyItem): snapshots inmutables del día.
 * Soporta 3 secciones (Diarios/Semanales/Mensuales) + "Logros del Día".
 * Usa NotebookPaper con efecto anillado espiral.
 *
 * viewDate del store es la única fuente de verdad para la fecha.
 * Los route params solo se usan una vez (al llegar de Stats) y se limpian.
 * useFocusEffect garantiza recarga al ganar foco con la fecha correcta.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Check, Plus, Trash2 } from 'lucide-react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useHabitStore } from '../store/useHabitStore';
import { useFeedback } from '../hooks/useFeedback';
import {
  CHECKBOX_ICON_SIZE, ALERT_UNMARK, ALERT_UNMARK_SPONTANEOUS,
  FREQUENCY_LABELS, SPONTANEOUS_SECTION_LABEL,
  AREAS_MAP, ROUTES,
} from '../config/constants';
import { NotebookPaper } from '../components/layout/NotebookPaper';
import { AppScreenHeader } from '../components/layout/AppScreenHeader';
import { ReflectionModal } from '../components/modals/ReflectionModal';
import { AreaInfoModal } from '../components/modals/AreaInfoModal';
import { SpontaneousModal } from '../components/modals/SpontaneousModal';
import {
  styles, miniProgressFillWidth, badgeContainerStyle, colors, iconDefaults,
} from './DailySheetScreen.styles';
import type { DailyItem, DailyStats, HabitArea, FrequencyGroup, RootTabParamList } from '../types';
import { parseAndValidateCategories } from '../utils/parsing';
import { formatTodayDate, formatHistoricDate, isValidDateString } from '../utils/dateHelpers';

type DailyNavProp = BottomTabNavigationProp<RootTabParamList, 'Hoy'>;

function computeGroupStats(items: DailyItem[]): DailyStats {
  const total = items.reduce((s, h) => s + h.points, 0);
  const earned = items.filter((h) => h.isCompleted).reduce((s, h) => s + h.points, 0);
  const pct = total > 0 ? Math.round((earned / total) * 100) : 0;
  return { earned, total, percentage: pct };
}

function groupByFrequency(items: DailyItem[]): {
  groups: FrequencyGroup[];
  spontaneous: DailyItem[];
} {
  const regular = items.filter((i) => !i.isSpontaneous);
  const spontaneous = items.filter((i) => i.isSpontaneous);
  const freqs: Array<'daily' | 'weekly' | 'monthly'> = ['daily', 'weekly', 'monthly'];

  const groups = freqs
    .map((f) => {
      const h = regular.filter((x) => x.frequency === f);
      return { frequency: f, items: h, stats: computeGroupStats(h) };
    })
    .filter((g) => g.items.length > 0);

  return { groups, spontaneous };
}

function confirmUnmark(item: DailyItem, toggle: (i: DailyItem) => Promise<void>) {
  const alert = item.isSpontaneous ? ALERT_UNMARK_SPONTANEOUS : ALERT_UNMARK;
  Alert.alert(alert.title, alert.message, [
    { text: alert.cancel, style: 'cancel' },
    { text: alert.confirm, style: 'destructive', onPress: () => toggle(item) },
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
      style={badgeContainerStyle(area.color)}
      onPress={() => onPress(areaId)}
    >
      <Text className={styles.badgeText}>{area.label}</Text>
    </Pressable>
  );
}

function AreaBadges({ categories, onBadgePress }: { categories: string; onBadgePress: (id: string) => void }) {
  const ids = parseAndValidateCategories(categories);
  if (ids.length === 0) return null;
  return (
    <View className={styles.badgeRow}>
      {ids.map((id) => <AreaBadge key={id} areaId={id} onPress={onBadgePress} />)}
    </View>
  );
}

function ItemRow({
  item, onPress, onLongPress, onBadgePress,
}: {
  item: DailyItem; onPress: () => void; onLongPress: () => void; onBadgePress: (id: string) => void;
}) {
  const checkStyle = item.isCompleted ? styles.checkboxChecked : styles.checkboxUnchecked;
  const textStyle = item.isCompleted ? styles.habitTextCompleted : styles.habitText;

  return (
    <Pressable className={styles.habitRow} onPress={onPress} onLongPress={onLongPress}>
      <View className={checkStyle}>
        {item.isCompleted && <Check color={colors.white} size={CHECKBOX_ICON_SIZE} />}
      </View>
      <View className={styles.habitContent}>
        <Text className={textStyle}>{item.name}</Text>
        <AreaBadges categories={item.categories} onBadgePress={onBadgePress} />
      </View>
    </Pressable>
  );
}

function SpontaneousRow({
  item, onRemove, onBadgePress,
}: {
  item: DailyItem; onRemove: () => void; onBadgePress: (id: string) => void;
}) {
  return (
    <View className={styles.spontaneousRow}>
      <View className={styles.checkboxChecked}>
        <Check color={colors.white} size={CHECKBOX_ICON_SIZE} />
      </View>
      <View className={styles.habitContent}>
        <Text className={styles.spontaneousName}>{item.name}</Text>
        <AreaBadges categories={item.categories} onBadgePress={onBadgePress} />
      </View>
      <Pressable className={styles.spontaneousDeleteBtn} onPress={onRemove}>
        <Trash2 color={colors.amber600} size={iconDefaults.small} />
      </Pressable>
    </View>
  );
}

function Separator() { return <View className={styles.separator} />; }
function EmptyList() { return <Text className={styles.emptyText}>No hay hábitos registrados</Text>; }

function FrequencySection({
  group, onPress, onLongPress, onBadgePress,
}: {
  group: FrequencyGroup;
  onPress: (i: DailyItem) => void;
  onLongPress: (i: DailyItem) => void;
  onBadgePress: (id: string) => void;
}) {
  const renderItem = useCallback(
    ({ item }: { item: DailyItem }) => (
      <ItemRow
        item={item}
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
          data={group.items}
          keyExtractor={(item) => item.assignmentId}
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

function SpontaneousSection({
  items, onRemove, onBadgePress,
}: {
  items: DailyItem[];
  onRemove: (item: DailyItem) => void;
  onBadgePress: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <View className={styles.sectionContainer}>
      <Text className={styles.sectionTitle}>{SPONTANEOUS_SECTION_LABEL}</Text>
      <NotebookPaper>
        {items.map((item, idx) => (
          <React.Fragment key={item.assignmentId}>
            {idx > 0 && <Separator />}
            <SpontaneousRow
              item={item}
              onRemove={() => onRemove(item)}
              onBadgePress={onBadgePress}
            />
          </React.Fragment>
        ))}
      </NotebookPaper>
    </View>
  );
}

// ─── Pantalla principal ─────────────────────────────────────────────

export function DailySheetScreen() {
  const route = useRoute();
  const navigation = useNavigation<DailyNavProp>();
  const routeDate = (route.params as { date?: string } | undefined)?.date ?? null;

  const {
    dailyItems, dailyStats, isLoading, pendingReflection, viewDate,
    resetToToday, setViewDate, fetchHabitsForDate,
    toggleItem, openEditReflection, saveReflection, skipReflection,
    addSpontaneous, removeSpontaneousItem,
  } = useHabitStore();

  const { triggerSuccess } = useFeedback();
  const [selectedArea, setSelectedArea] = useState<HabitArea | null>(null);
  const [spontaneousVisible, setSpontaneousVisible] = useState(false);

  // ── 1. Consumir el route param una sola vez y limpiarlo ──────────
  useEffect(() => {
    if (routeDate) {
      setViewDate(routeDate);
      navigation.setParams({ date: undefined });
    }
  }, [routeDate, setViewDate, navigation]);

  // ── 2. Recargar ítems al ganar foco o cuando viewDate cambie ──────
  useFocusEffect(
    useCallback(() => {
      fetchHabitsForDate(viewDate);
    }, [viewDate, fetchHabitsForDate]),
  );

  const handlePress = useCallback(
    (item: DailyItem) => {
      if (item.isCompleted) {
        confirmUnmark(item, toggleItem);
      } else {
        toggleItem(item).then(() => triggerSuccess());
      }
    },
    [toggleItem, triggerSuccess],
  );

  const handleLongPress = useCallback(
    (item: DailyItem) => {
      if (item.isCompleted && item.habitId) openEditReflection(item);
    },
    [openEditReflection],
  );

  const handleBadgePress = useCallback((areaId: string) => {
    setSelectedArea(AREAS_MAP[areaId] ?? null);
  }, []);

  const handleRemoveSpontaneous = useCallback(
    (item: DailyItem) => {
      Alert.alert(
        ALERT_UNMARK_SPONTANEOUS.title,
        ALERT_UNMARK_SPONTANEOUS.message,
        [
          { text: ALERT_UNMARK_SPONTANEOUS.cancel, style: 'cancel' },
          {
            text: ALERT_UNMARK_SPONTANEOUS.confirm,
            style: 'destructive',
            onPress: () => removeSpontaneousItem(item),
          },
        ],
      );
    },
    [removeSpontaneousItem],
  );

  const handleSaveSpontaneous = useCallback(
    (name: string, categories: string[]) => {
      addSpontaneous(name, categories).then(() => {
        triggerSuccess();
        setSpontaneousVisible(false);
      });
    },
    [addSpontaneous, triggerSuccess],
  );

  // ── 3. Guardar y Volver: dismiss reflection + reset + ir a Stats ──
  const handleGoBack = useCallback(() => {
    skipReflection();
    resetToToday();
    navigation.navigate(ROUTES.STATS as 'Progreso');
  }, [skipReflection, resetToToday, navigation]);

  const { groups, spontaneous } = groupByFrequency(dailyItems);

  // viewDate del store = fuente de verdad (no route params)
  const isHistoric = isValidDateString(viewDate);

  if (isLoading && dailyItems.length === 0) {
    return (
      <View className={styles.loading}>
        <ActivityIndicator size="large" color={colors.amber600} />
      </View>
    );
  }

  return (
    <ScrollView className={styles.container}>
      <AppScreenHeader
        title={isHistoric ? 'Editando' : 'Hoy'}
        subtitle={isHistoric ? formatHistoricDate(viewDate!) : formatTodayDate()}
      />

      {isHistoric ? (
        <View className={styles.headerRow}>
          <Pressable className={styles.goBackButton} onPress={handleGoBack}>
            <Text className={styles.goBackText}>Guardar y Volver</Text>
          </Pressable>
        </View>
      ) : null}

      <View className={styles.titleGap} />

      {/* Botón de logro espontáneo */}
      <Pressable
        className={styles.spontaneousButton}
        onPress={() => setSpontaneousVisible(true)}
      >
        <Plus color={colors.amber600} size={iconDefaults.medium} />
        <Text className={styles.spontaneousButtonText}>Añadir algo espontáneo</Text>
      </Pressable>

      {groups.map((g) => (
        <FrequencySection
          key={g.frequency}
          group={g}
          onPress={handlePress}
          onLongPress={handleLongPress}
          onBadgePress={handleBadgePress}
        />
      ))}

      <SpontaneousSection
        items={spontaneous}
        onRemove={handleRemoveSpontaneous}
        onBadgePress={handleBadgePress}
      />

      {groups.length === 0 && spontaneous.length === 0 && <EmptyList />}

      <ReflectionModal
        visible={!!pendingReflection}
        habitName={pendingReflection?.item.name ?? ''}
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

      <SpontaneousModal
        visible={spontaneousVisible}
        onSave={handleSaveSpontaneous}
        onCancel={() => setSpontaneousVisible(false)}
      />
    </ScrollView>
  );
}
