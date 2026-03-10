/**
 * SettingsScreen — Centro de Ajustes y Respaldo de Datos.
 *
 * Secciones:
 * - Personalización: toggles de Haptics, Sonido; placeholders de Idioma, Fondo.
 * - Seguridad y Datos: exportar/importar backup JSON.
 *
 * Los botones de importar tienen Alert de confirmación (acción destructiva).
 * Tras importar, se refrescan todos los stores de Zustand.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Switch, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Download, Upload, Globe, Image } from 'lucide-react-native';
import { useSettingsStore } from '../store/useSettingsStore';
import { useHabitStore } from '../store/useHabitStore';
import { exportBackup, importBackup } from '../services/backupService';
import { NotebookPaper } from '../components/layout/NotebookPaper';
import { AppScreenHeader } from '../components/layout/AppScreenHeader';
import {
  ALERT_IMPORT, ALERT_IMPORT_SUCCESS, ALERT_IMPORT_ERROR, ALERT_EXPORT_ERROR,
} from '../config/constants';
import { styles, switchColors, colors } from './SettingsScreen.styles';
import { iconDefaults } from '../styles/ui.styles';

// ─── Sub-componentes ────────────────────────────────────────────────

function ToggleRow({ label, value, onToggle }: {
  label: string; value: boolean; onToggle: () => void;
}) {
  return (
    <View className={styles.toggleRow}>
      <Text className={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: switchColors.trackFalse, true: switchColors.trackTrue }}
        thumbColor={value ? switchColors.thumbTrue : switchColors.thumbFalse}
      />
    </View>
  );
}

function PlaceholderRow({ label, icon: Icon }: {
  label: string; icon: typeof Globe;
}) {
  return (
    <View className={styles.placeholderRow}>
      <View className="flex-row items-center gap-2">
        <Icon size={16} color={colors.amber500} strokeWidth={iconDefaults.strokeWidth} />
        <Text className={styles.toggleLabel}>{label}</Text>
      </View>
      <Text className={styles.placeholderBadge}>Próximamente</Text>
    </View>
  );
}

function SectionDivider() {
  return <View className={styles.divider} />;
}

// ─── Pantalla principal ─────────────────────────────────────────────

export function SettingsScreen() {
  const navigation = useNavigation();
  const {
    hapticsEnabled, soundsEnabled,
    toggleHaptics, toggleSounds,
  } = useSettingsStore();

  const { fetchHabitsForDate, fetchLibrary } = useHabitStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      await exportBackup();
    } catch (err) {
      console.error('Export error:', err);
      Alert.alert(ALERT_EXPORT_ERROR.title, ALERT_EXPORT_ERROR.message);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleImportConfirm = useCallback(async () => {
    setIsImporting(true);
    try {
      const imported = await importBackup();
      if (!imported) { setIsImporting(false); return; }

      // Refrescar todos los stores tras la importación
      await Promise.all([fetchHabitsForDate(null), fetchLibrary()]);
      Alert.alert(ALERT_IMPORT_SUCCESS.title, ALERT_IMPORT_SUCCESS.message);
    } catch (err) {
      console.error('Import error:', err);
      Alert.alert(ALERT_IMPORT_ERROR.title, ALERT_IMPORT_ERROR.message);
    } finally {
      setIsImporting(false);
    }
  }, [fetchHabitsForDate, fetchLibrary]);

  const handleImport = useCallback(() => {
    Alert.alert(ALERT_IMPORT.title, ALERT_IMPORT.message, [
      { text: ALERT_IMPORT.cancel, style: 'cancel' },
      { text: ALERT_IMPORT.confirm, style: 'destructive', onPress: handleImportConfirm },
    ]);
  }, [handleImportConfirm]);

  return (
    <ScrollView className={styles.container}>
      <AppScreenHeader
        title="Ajustes"
        subtitle="Personaliza tu experiencia CozyHabit"
        onBack={() => navigation.goBack()}
        showSettings={false}
      />

      {/* ── Personalización ──────────────────────────────────────── */}
      <Text className={styles.sectionTitle}>Personalización</Text>
      <NotebookPaper>
        <ToggleRow label="Vibración al completar" value={hapticsEnabled} onToggle={toggleHaptics} />
        <SectionDivider />
        <ToggleRow label="Sonidos" value={soundsEnabled} onToggle={toggleSounds} />
        <SectionDivider />
        <PlaceholderRow label="Idioma" icon={Globe} />
        <SectionDivider />
        <PlaceholderRow label="Fondo de pantalla" icon={Image} />
      </NotebookPaper>

      <View className={styles.sectionGap} />

      {/* ── Seguridad y Datos ────────────────────────────────────── */}
      <Text className={styles.sectionTitle}>Seguridad y Datos</Text>
      <NotebookPaper>
        <Pressable
          className={styles.exportButton}
          onPress={handleExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Download size={18} color={colors.white} strokeWidth={iconDefaults.strokeWidth} />
          )}
          <Text className={styles.exportButtonText}>
            {isExporting ? 'Exportando...' : 'Exportar respaldo'}
          </Text>
        </Pressable>

        <Pressable
          className={styles.importButton}
          onPress={handleImport}
          disabled={isImporting}
        >
          {isImporting ? (
            <ActivityIndicator size="small" color={colors.amber600} />
          ) : (
            <Upload size={18} color={colors.amber600} strokeWidth={iconDefaults.strokeWidth} />
          )}
          <Text className={styles.importButtonText}>
            {isImporting ? 'Importando...' : 'Importar respaldo'}
          </Text>
        </Pressable>

        <Text className={styles.destructiveNote}>
          La importación reemplaza todos los datos actuales
        </Text>
      </NotebookPaper>

      <Text className={styles.versionText}>CozyHabit v1.0.0</Text>
    </ScrollView>
  );
}
