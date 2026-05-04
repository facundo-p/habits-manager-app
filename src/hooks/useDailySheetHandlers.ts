/**
 * useDailySheetHandlers — Event handlers extraídos de DailySheetScreen.
 *
 * Acepta las dependencias del store y callbacks de estado local, y retorna
 * los handlers listos para usar en la pantalla.
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  ALERT_UNMARK, ALERT_UNMARK_SPONTANEOUS,
  AREAS_MAP, ROUTES,
} from '../config/constants';
import type { DailyItem, HabitArea, RootTabParamList } from '../types';

type DailyNavProp = BottomTabNavigationProp<RootTabParamList, 'Hoy'>;

interface Deps {
  navigation: DailyNavProp;
  toggleItem: (item: DailyItem) => Promise<void>;
  openEditReflection: (item: DailyItem) => void;
  removeSpontaneousItem: (item: DailyItem) => void;
  addSpontaneous: (name: string, categories: string[]) => Promise<void>;
  skipReflection: () => void;
  resetToToday: () => void;
  triggerSuccess: () => void;
  setSelectedArea: (area: HabitArea | null) => void;
  setSpontaneousVisible: (visible: boolean) => void;
}

function confirmUnmark(item: DailyItem, toggle: (i: DailyItem) => Promise<void>) {
  const alert = item.isSpontaneous ? ALERT_UNMARK_SPONTANEOUS : ALERT_UNMARK;
  Alert.alert(alert.title, alert.message, [
    { text: alert.cancel, style: 'cancel' },
    { text: alert.confirm, style: 'destructive', onPress: () => toggle(item) },
  ]);
}

export function useDailySheetHandlers({
  navigation,
  toggleItem,
  openEditReflection,
  removeSpontaneousItem,
  addSpontaneous,
  skipReflection,
  resetToToday,
  triggerSuccess,
  setSelectedArea,
  setSpontaneousVisible,
}: Deps) {
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
  }, [setSelectedArea]);

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
    [addSpontaneous, triggerSuccess, setSpontaneousVisible],
  );

  const handleGoBack = useCallback(() => {
    skipReflection();
    resetToToday();
    navigation.navigate(ROUTES.STATS as 'Progreso');
  }, [skipReflection, resetToToday, navigation]);

  return {
    handlePress,
    handleLongPress,
    handleBadgePress,
    handleRemoveSpontaneous,
    handleSaveSpontaneous,
    handleGoBack,
  };
}
