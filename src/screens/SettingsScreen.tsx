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

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import * as drive from '../services/driveBackupService';
import { NotebookPaper } from '../components/layout/NotebookPaper';
import { AppScreenHeader } from '../components/layout/AppScreenHeader';
import { LoadingOverlay } from '../components/shared/LoadingOverlay';
import {
  ALERT_IMPORT, ALERT_IMPORT_SUCCESS, ALERT_IMPORT_ERROR, ALERT_EXPORT_ERROR,
  ALERT_DRIVE_SIGN_OUT, ALERT_DRIVE_OVERWRITE_TODAY,
  ALERT_DRIVE_BACKUP_SUCCESS, ALERT_DRIVE_BACKUP_REPLACED, ALERT_DRIVE_GENERIC,
} from '../config/constants';
import { formatDateEs, formatRelativeBackup } from '../utils/dateFormat';
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
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

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
      const today = new Date().toISOString().slice(0, 10);
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

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const session = await drive.signIn();
      if (!mountedRef.current) return; // WR-03
      if (session) setGoogleEmail(session.email);
    } catch (err) {
      console.error('[handleConnect]', err);
      if (!mountedRef.current) return; // WR-03
      const alert = err instanceof drive.DriveError ? err.alert : ALERT_DRIVE_GENERIC;
      // Pitfall #3 (Android): defer Alert.alert para que el modal del SDK se cierre primero
      setTimeout(() => Alert.alert(alert.title, alert.message), 0);
    } finally {
      if (mountedRef.current) setIsConnecting(false); // WR-03
    }
  }, [setGoogleEmail]);

  const performBackup = useCallback(async () => {
    setIsUploading(true);
    try {
      const result = await drive.uploadBackup();
      if (!mountedRef.current) return; // WR-03
      setLastBackup(new Date().toISOString(), result.fileId);
      // D-13: Alert refleja si reemplazó el backup del día o si fue uno nuevo
      const successAlert = result.overwrote
        ? ALERT_DRIVE_BACKUP_REPLACED
        : ALERT_DRIVE_BACKUP_SUCCESS;
      Alert.alert(successAlert.title, successAlert.message);
    } catch (err) {
      console.error('[performBackup]', err);
      if (!mountedRef.current) return; // WR-03
      const alert = err instanceof drive.DriveError ? err.alert : ALERT_DRIVE_GENERIC;
      Alert.alert(alert.title, alert.message);
    } finally {
      if (mountedRef.current) setIsUploading(false); // WR-03
    }
  }, [setLastBackup]);

  const handleBackupNow = useCallback(async () => {
    // D-13: confirmar overwrite si ya hay backup de hoy ANTES de subir.
    try {
      const backups = await drive.listBackups();
      const today = new Date().toISOString().slice(0, 10);
      const hasToday = backups.some((b) => b.name.includes(today));
      if (hasToday) {
        const fechaHoy = formatDateEs(new Date());
        Alert.alert(
          ALERT_DRIVE_OVERWRITE_TODAY.title,
          `Ya hay un backup del ${fechaHoy} en tu Drive. Si continuás, el nuevo reemplazará al actual.`,
          [
            { text: ALERT_DRIVE_OVERWRITE_TODAY.cancel, style: 'cancel' },
            { text: ALERT_DRIVE_OVERWRITE_TODAY.confirm, onPress: performBackup },
          ],
        );
      } else {
        void performBackup();
      }
    } catch (err) {
      // Si listBackups falla, intentamos el backup igual — el service detecta duplicado y reemplaza
      console.warn('[handleBackupNow] listBackups falló, procediendo con upload', err);
      void performBackup();
    }
  }, [performBackup]);

  const handleSignOutConfirm = useCallback(async () => {
    try {
      await drive.signOut();
      clearGoogleSession(); // D-11: preserva lastBackupAt + lastBackupFileId
    } catch (err) {
      console.error('[handleSignOut]', err);
      Alert.alert(ALERT_DRIVE_GENERIC.title, ALERT_DRIVE_GENERIC.message);
    }
  }, [clearGoogleSession]);

  const handleSignOut = useCallback(() => {
    Alert.alert(ALERT_DRIVE_SIGN_OUT.title, ALERT_DRIVE_SIGN_OUT.message, [
      { text: ALERT_DRIVE_SIGN_OUT.cancel, style: 'cancel' },
      { text: ALERT_DRIVE_SIGN_OUT.confirm, style: 'destructive', onPress: handleSignOutConfirm },
    ]);
  }, [handleSignOutConfirm]);

  const handleOpenRestore = useCallback(() => {
    navigation.navigate('RestoreFromDrive');
  }, [navigation]);

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

      <Text className={styles.versionText}>CozyHabit v1.0.0</Text>
    </ScrollView>
    <LoadingOverlay visible={isUploading} message="Subiendo a Drive..." />
    </>
  );
}
