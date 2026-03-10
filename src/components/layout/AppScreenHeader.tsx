/**
 * AppScreenHeader — Header reutilizable con acceso a Ajustes.
 *
 * Evita duplicación de código entre pantallas y ubica el botón
 * de Ajustes en la esquina superior derecha del header.
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Settings } from 'lucide-react-native';
import { ROUTES } from '../../config/constants';
import { iconDefaults, colors } from '../../styles/ui.styles';
import type { RootStackParamList } from '../../types';
import { styles } from './AppScreenHeader.styles';

interface AppScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showSettings?: boolean;
}

export function AppScreenHeader({
  title,
  subtitle,
  onBack,
  showSettings = true,
}: AppScreenHeaderProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View className={styles.container}>
      {/* Slot Izquierdo: Botón Atrás */}
      <View className={styles.leftSlot}>
        {onBack && (
          <Pressable className={styles.iconButton} onPress={onBack}>
            <ArrowLeft size={18} color={colors.amber800} strokeWidth={iconDefaults.strokeWidth} />
          </Pressable>
        )}
      </View>

      {/* Slot Central: Título y Subtítulo (ocupa el espacio restante) */}
      <View className={styles.centerSlot}>
        <Text className={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text className={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>

      {/* Slot Derecho: Botón Ajustes */}
      <View className={styles.rightSlot}>
        {showSettings && (
          <Pressable
            className={styles.iconButton}
            onPress={() => navigation.navigate(ROUTES.SETTINGS as keyof RootStackParamList)}
          >
            <Settings size={18} color={colors.amber700} strokeWidth={iconDefaults.strokeWidth} />
          </Pressable>
        )}
      </View>
    </View>
  );
}