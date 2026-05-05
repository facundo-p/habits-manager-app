/**
 * useDriveActions — Handlers de Drive extraídos de SettingsScreen.
 *
 * Encapsula la lógica de connect, backup, sign-out y navegación a restore.
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as drive from '../services/driveBackupService';
import { getTodayPrefix } from '../services/db';
import {
  ALERT_DRIVE_SIGN_OUT,
  ALERT_DRIVE_OVERWRITE_TODAY,
  ALERT_DRIVE_BACKUP_SUCCESS, ALERT_DRIVE_BACKUP_REPLACED, ALERT_DRIVE_GENERIC,
  ALERT_DRIVE_SIGNOUT_FAILED,
} from '../config/constants';
import { formatDateEs } from '../utils/dateFormat';
import type { RootStackParamList } from '../types';
import type { MutableRefObject } from 'react';

interface Deps {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  mountedRef: MutableRefObject<boolean>;
  setGoogleEmail: (email: string) => void;
  setLastBackup: (timestamp: string, fileId: string) => void;
  clearGoogleSession: () => void;
  setIsConnecting: (v: boolean) => void;
  setIsUploading: (v: boolean) => void;
}

export function useDriveActions({
  navigation,
  mountedRef,
  setGoogleEmail,
  setLastBackup,
  clearGoogleSession,
  setIsConnecting,
  setIsUploading,
}: Deps) {
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
  }, [mountedRef, setGoogleEmail, setIsConnecting]);

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
  }, [mountedRef, setLastBackup, setIsUploading]);

  const handleBackupNow = useCallback(async () => {
    // D-13: confirmar overwrite si ya hay backup de hoy ANTES de subir.
    try {
      const backups = await drive.listBackups();
      const today = getTodayPrefix();
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

  /** IN-07: Si el SDK rechaza, NO limpiamos el slice local — un sign-out parcial
   *  donde Google dice "no" pero el estado local quedó vacío sería peor que un
   *  no-op + alerta. El usuario puede reintentar y, si persiste, tiene la opción
   *  manual de cerrar sesión desde la cuenta de Google. */
  const handleSignOutConfirm = useCallback(async () => {
    const result = await drive.signOutSafe();
    if (!result.ok) {
      console.error('[handleSignOut]', result.error);
      Alert.alert(ALERT_DRIVE_SIGNOUT_FAILED.title, ALERT_DRIVE_SIGNOUT_FAILED.message);
      return; // mantenemos el estado local: googleEmail sigue visible
    }
    clearGoogleSession(); // D-11: preserva lastBackupAt + lastBackupFileId
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

  return {
    handleConnect,
    performBackup,
    handleBackupNow,
    handleSignOut,
    handleSignOutConfirm,
    handleOpenRestore,
  };
}
