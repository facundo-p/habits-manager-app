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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Download, Upload, Globe, Image,
  Cloud, CloudUpload, CloudDownload, CheckCircle2, LogOut,
} from 'lucide-react-native';
import { useSettingsStore } from '../store/useSettingsStore';
import { useHabitStore } from '../store/useHabitStore';
import { exportBackup, importBackup } from '../services/backupService';
import { useDriveActions } from '../hooks/useDriveActions';
import { NotebookPaper } from '../components/layout/NotebookPaper';
import { AppScreenHeader } from '../components/layout/AppScreenHeader';
import { LoadingOverlay } from '../components/shared/LoadingOverlay';
import { DraftHarnessModal } from '../components/dev/DraftHarnessModal';
import {
  ALERT_IMPORT, ALERT_IMPORT_SUCCESS, ALERT_IMPORT_ERROR, ALERT_EXPORT_ERROR,
} from '../config/constants';
import { formatRelativeBackup } from '../utils/dateFormat';
import { getLocalDayKey } from '../utils/date';
import { useIsMounted } from '../hooks/useIsMounted';
import { styles, switchColors, colors } from './SettingsScreen.styles';
import { iconDefaults } from '../styles/ui.styles';
import type { RootStackParamList } from '../types';

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    hapticsEnabled, soundsEnabled,
    toggleHaptics, toggleSounds,
  } = useSettingsStore();

  const [draftHarnessVisible, setDraftHarnessVisible] = useState(false);

  // Drive auth slice (Phase 3)
  const googleEmail = useSettingsStore((s) => s.googleEmail);
  const lastBackupAt = useSettingsStore((s) => s.lastBackupAt);
  const setGoogleEmail = useSettingsStore((s) => s.setGoogleEmail);
  const setLastBackup = useSettingsStore((s) => s.setLastBackup);
  const clearGoogleSession = useSettingsStore((s) => s.clearGoogleSession);

  const { fetchHabitsForDate, fetchLibrary } = useHabitStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // WR-03: guard contra setState después de unmount (back-press durante async work)
  const mountedRef = useIsMounted();

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
      const today = getLocalDayKey();
      await Promise.all([fetchHabitsForDate(today), fetchLibrary()]);
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

  // ─── Handlers Drive (Phase 3) ────────────────────────────────────

  const {
    handleConnect, performBackup, handleBackupNow,
    handleSignOut, handleOpenRestore,
  } = useDriveActions({
    navigation,
    mountedRef,
    setGoogleEmail,
    setLastBackup,
    clearGoogleSession,
    setIsConnecting,
    setIsUploading,
  });

  return (
    <>
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

      {/* ── Backup en la nube (Phase 3) ──────────────────────────── */}
      <Text className={styles.driveSectionTitle}>Backup en la nube</Text>
      <NotebookPaper>
        {googleEmail ? (
          <>
            <View className={styles.identityRow}>
              <CheckCircle2 size={18} color={colors.sage400} strokeWidth={iconDefaults.strokeWidth} />
              <Text className={styles.identityEmail} numberOfLines={1}>
                {googleEmail}
              </Text>
            </View>
            <Text className={styles.lastBackupCaption}>{formatRelativeBackup(lastBackupAt)}</Text>

            <Pressable
              className={styles.backupNowButton}
              onPress={handleBackupNow}
              disabled={isUploading}
              accessibilityRole="button"
              accessibilityLabel="Hacer backup ahora a Google Drive"
            >
              <CloudUpload size={18} color={colors.white} strokeWidth={iconDefaults.strokeWidth} />
              <Text className={styles.backupNowButtonText}>
                {isUploading ? 'Subiendo...' : 'Backup ahora'}
              </Text>
            </Pressable>

            <Pressable
              className={styles.restoreFromDriveButton}
              onPress={handleOpenRestore}
              accessibilityRole="button"
              accessibilityLabel="Restaurar desde Google Drive"
            >
              <CloudDownload size={18} color={colors.amber600} strokeWidth={iconDefaults.strokeWidth} />
              <Text className={styles.restoreFromDriveButtonText}>Restaurar desde Drive</Text>
            </Pressable>

            <Pressable
              className={styles.signOutButton}
              onPress={handleSignOut}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Cerrar sesión de Google"
            >
              <LogOut size={14} color={colors.amber700} strokeWidth={iconDefaults.strokeWidth} />
              <Text className={styles.signOutText}>Cerrar sesión</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              className={styles.connectButton}
              onPress={handleConnect}
              disabled={isConnecting}
              accessibilityRole="button"
              accessibilityLabel="Conectar con Google"
            >
              {isConnecting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Cloud size={18} color={colors.white} strokeWidth={iconDefaults.strokeWidth} />
              )}
              <Text className={styles.connectButtonText}>
                {isConnecting ? 'Conectando...' : 'Conectar con Google'}
              </Text>
            </Pressable>
            <Text className={styles.driveDescription}>
              Guardá un respaldo en tu Google Drive y restauralo desde cualquier dispositivo.
            </Text>
          </>
        )}
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

      {__DEV__ && (
        <>
          <View className={styles.sectionGap} />
          <Text className={styles.sectionTitle}>Dev tools</Text>
          <NotebookPaper>
            <Pressable
              className={styles.toggleRow}
              onPress={() => setDraftHarnessVisible(true)}
            >
              <Text className={styles.toggleLabel}>Dev — Draft harness</Text>
              <Text className={styles.placeholderBadge}>FOUND-05 UAT</Text>
            </Pressable>
          </NotebookPaper>
        </>
      )}

      <Text className={styles.versionText}>CozyHabit v1.0.0</Text>
    </ScrollView>
    <LoadingOverlay visible={isUploading} message="Subiendo a Drive..." />
    {__DEV__ && (
      <DraftHarnessModal
        visible={draftHarnessVisible}
        onClose={() => setDraftHarnessVisible(false)}
      />
    )}
    </>
  );
}
