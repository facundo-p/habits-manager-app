/**
 * RestoreFromDriveScreen.tsx — Lista de backups en Google Drive (Phase 3).
 *
 * Plan 03-02 dejó el SCAFFOLD: estados loading + empty operativos. La ruta ya
 * está registrada en App.tsx, el botón "Restaurar desde Drive" en Settings
 * navega aquí desde día uno.
 *
 * Plan 03-03 EXPANDE este archivo: agrega FlatList renderizando los backups,
 * preview Alert con conteos vía drive.prepareRestore (single download),
 * restore confirmation destructivo, error state con reintentar, refresh de
 * stores post-restore. Ver UI-SPEC §3.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FileText, ChevronRight, CloudOff, WifiOff } from 'lucide-react-native';
import { AppScreenHeader } from '../components/layout/AppScreenHeader';
import { LoadingOverlay } from '../components/shared/LoadingOverlay';
import * as drive from '../services/driveBackupService';
import { useHabitStore } from '../store/useHabitStore';
import { formatDateEs, formatSize } from '../utils/dateFormat';
import { getLocalDayKey } from '../utils/date';
import { useIsMounted } from '../hooks/useIsMounted';
import {
  ALERT_DRIVE_RESTORE_CONFIRM,
  ALERT_DRIVE_RESTORE_SUCCESS,
  ALERT_DRIVE_GENERIC,
  RESTORE_SCREEN_TITLE,
  RESTORE_SCREEN_LOADING,
  RESTORE_SCREEN_OVERLAY_READING,
  RESTORE_SCREEN_OVERLAY_RESTORING,
  EMPTY_DRIVE_BACKUPS,
  ERROR_DRIVE_LOAD,
} from '../config/constants';
import { styles, colors } from './RestoreFromDriveScreen.styles';
import { iconDefaults } from '../styles/ui.styles';

type Status = 'loading' | 'empty' | 'error' | 'loaded';
type OverlayMsg =
  | null
  | typeof RESTORE_SCREEN_OVERLAY_READING
  | typeof RESTORE_SCREEN_OVERLAY_RESTORING;

interface RowProps { file: drive.DriveBackupFile; onPress: () => void; disabled?: boolean }
function BackupRow({ file, onPress, disabled = false }: RowProps) {
  const dateLabel = formatDateEs(new Date(file.createdTime));
  const sizeLabel = formatSize(file.size);
  return (
    <Pressable
      className={styles.itemRow}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Restaurar backup del ${dateLabel}, ${sizeLabel}`}
    >
      <FileText size={22} color={colors.amber600} strokeWidth={iconDefaults.strokeWidth} />
      <View className="flex-1">
        <Text className={styles.itemPrimary}>{dateLabel}</Text>
        <Text className={styles.itemCaption}>{sizeLabel}</Text>
      </View>
      <ChevronRight size={18} color={colors.amber400} strokeWidth={iconDefaults.strokeWidth} />
    </Pressable>
  );
}

function Separator() { return <View className={styles.separator} />; }

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View className={styles.errorContainer}>
      <WifiOff size={48} color={colors.rose400} strokeWidth={iconDefaults.strokeWidth} />
      <Text className={styles.errorHeading}>{ERROR_DRIVE_LOAD.heading}</Text>
      <Text className={styles.errorBody}>{ERROR_DRIVE_LOAD.body}</Text>
      <Pressable
        className={styles.errorRetryButton}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Reintentar carga de backups"
      >
        <Text className={styles.errorRetryButtonText}>{ERROR_DRIVE_LOAD.retryLabel}</Text>
      </Pressable>
    </View>
  );
}

export function RestoreFromDriveScreen() {
  const navigation = useNavigation();
  const fetchHabitsForDate = useHabitStore((s) => s.fetchHabitsForDate);
  const fetchLibrary = useHabitStore((s) => s.fetchLibrary);

  const [status, setStatus] = useState<Status>('loading');
  const [files, setFiles] = useState<drive.DriveBackupFile[]>([]);
  const [overlayMsg, setOverlayMsg] = useState<OverlayMsg>(null);
  // WR-04: belt-and-suspenders single-download guard. El LoadingOverlay Modal
  // ya bloquea la mayoría de doble-tap, pero su animación fade deja una ventana
  // de ~250ms en algunas versiones de RN.
  const [isPreparing, setIsPreparing] = useState(false);

  // WR-03: guard contra setState después de unmount (back-press durante async work)
  const mountedRef = useIsMounted();

  const loadList = useCallback(async () => {
    setStatus('loading');
    try {
      const result = await drive.listBackups();
      if (!mountedRef.current) return;
      setFiles(result);
      setStatus(result.length === 0 ? 'empty' : 'loaded');
    } catch (err) {
      console.error('[RestoreFromDriveScreen.loadList]', err);
      if (!mountedRef.current) return;
      setStatus('error');
    }
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);

  const showError = useCallback((err: unknown) => {
    const alert = err instanceof drive.DriveError ? err.alert : ALERT_DRIVE_GENERIC;
    Alert.alert(alert.title, alert.message);
  }, []);

  const performRestore = useCallback(async (payload: drive.RestorePayload) => {
    setOverlayMsg(RESTORE_SCREEN_OVERLAY_RESTORING);
    try {
      await drive.applyRestore(payload);
      const today = getLocalDayKey();
      await Promise.all([fetchHabitsForDate(today), fetchLibrary()]);
      if (!mountedRef.current) return; // WR-03
      const fechaLabel = formatDateEs(new Date(payload.exportedAt));
      Alert.alert(
        ALERT_DRIVE_RESTORE_SUCCESS.title,
        `Tus datos fueron restaurados desde el backup del ${fechaLabel}. Tus datos previos quedaron respaldados en el dispositivo por si querés revertir.`,
      );
    } catch (err) {
      console.error('[performRestore]', err);
      if (!mountedRef.current) return; // WR-03
      showError(err);
    } finally {
      if (mountedRef.current) setOverlayMsg(null); // WR-03
    }
  }, [fetchHabitsForDate, fetchLibrary, showError]);

  const previewAndConfirm = useCallback(async (file: drive.DriveBackupFile) => {
    if (isPreparing) return; // WR-04: single-download invariant
    setIsPreparing(true);
    setOverlayMsg(RESTORE_SCREEN_OVERLAY_READING);
    try {
      const payload = await drive.prepareRestore(file.id);
      if (!mountedRef.current) return; // WR-03
      setOverlayMsg(null);

      const fechaLabel = formatDateEs(new Date(payload.exportedAt));
      const message =
        `Vas a restaurar el backup del ${fechaLabel} (` +
        `${payload.counts.habits} hábitos, ` +
        `${payload.counts.performed_habits} completados, ` +
        `${payload.counts.mood} moods, ` +
        `${payload.counts.daily_assignments} assignments).\n\n` +
        `Esto reemplazará todos tus datos actuales. Esta acción no se puede deshacer.`;
      Alert.alert(
        ALERT_DRIVE_RESTORE_CONFIRM.title,
        message,
        [
          { text: ALERT_DRIVE_RESTORE_CONFIRM.cancel, style: 'cancel' },
          { text: ALERT_DRIVE_RESTORE_CONFIRM.confirm, style: 'destructive', onPress: () => void performRestore(payload) },
        ],
      );
    } catch (err) {
      console.error('[previewAndConfirm]', err);
      if (!mountedRef.current) return; // WR-03
      setOverlayMsg(null);
      showError(err);
    } finally {
      if (mountedRef.current) setIsPreparing(false); // WR-04
    }
  }, [isPreparing, performRestore, showError]);

  return (
    <View className={styles.container}>
      <AppScreenHeader
        title={RESTORE_SCREEN_TITLE}
        onBack={() => navigation.goBack()}
        showSettings={false}
      />
      {status === 'loading' && (
        <View className={styles.loading}>
          <ActivityIndicator size="large" color={colors.amber600} />
          <Text className={styles.loadingCaption}>{RESTORE_SCREEN_LOADING}</Text>
        </View>
      )}
      {status === 'empty' && (
        <View className={styles.emptyContainer}>
          <CloudOff size={48} color={colors.amber400} strokeWidth={iconDefaults.strokeWidth} />
          <Text className={styles.emptyHeading}>{EMPTY_DRIVE_BACKUPS.heading}</Text>
          <Text className={styles.emptyBody}>{EMPTY_DRIVE_BACKUPS.body}</Text>
        </View>
      )}
      {status === 'error' && <ErrorState onRetry={() => void loadList()} />}
      {status === 'loaded' && (
        <FlatList
          data={files}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <BackupRow
              file={item}
              onPress={() => void previewAndConfirm(item)}
              disabled={isPreparing}
            />
          )}
          ItemSeparatorComponent={Separator}
        />
      )}
      <LoadingOverlay visible={overlayMsg !== null} message={overlayMsg ?? ''} />
    </View>
  );
}
