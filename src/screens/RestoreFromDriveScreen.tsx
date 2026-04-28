/**
 * RestoreFromDriveScreen.tsx — Lista de backups en Google Drive (Phase 3).
 *
 * Plan 03-02 entrega el SCAFFOLD: estados loading + empty operativos. La ruta
 * ya está registrada en App.tsx, el botón "Restaurar desde Drive" en Settings
 * navega aquí desde día uno (sin Alert.alert intermedio, sin placeholders).
 *
 * Plan 03-03 EXPANDE este archivo: agrega FlatList renderizando los backups,
 * preview Alert con conteos, restore confirmation destructivo, error state con
 * reintentar, refresh de stores post-restore. Ver UI-SPEC §3.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CloudOff } from 'lucide-react-native';
import { AppScreenHeader } from '../components/layout/AppScreenHeader';
import * as drive from '../services/driveBackupService';
import { styles, colors } from './RestoreFromDriveScreen.styles';
import { iconDefaults } from '../styles/ui.styles';

type Status = 'loading' | 'empty' | 'error' | 'loaded';

export function RestoreFromDriveScreen() {
  const navigation = useNavigation();
  const [status, setStatus] = useState<Status>('loading');
  const [files, setFiles] = useState<drive.DriveBackupFile[]>([]);

  const loadList = useCallback(async () => {
    setStatus('loading');
    try {
      const result = await drive.listBackups();
      setFiles(result);
      setStatus(result.length === 0 ? 'empty' : 'loaded');
    } catch (err) {
      console.error('[RestoreFromDriveScreen.loadList]', err);
      setStatus('error');
    }
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);

  return (
    <View className={styles.container}>
      <AppScreenHeader
        title="Restaurar desde Drive"
        onBack={() => navigation.goBack()}
        showSettings={false}
      />
      {status === 'loading' && (
        <View className={styles.loading}>
          <ActivityIndicator size="large" color={colors.amber600} />
          <Text className={styles.loadingCaption}>Cargando backups...</Text>
        </View>
      )}
      {status === 'empty' && (
        <View className={styles.emptyContainer}>
          <CloudOff size={48} color={colors.amber400} strokeWidth={iconDefaults.strokeWidth} />
          <Text className={styles.emptyHeading}>No hay backups todavía</Text>
          <Text className={styles.emptyBody}>Hacé tu primer backup desde Ajustes.</Text>
        </View>
      )}
      {/* Estados `error` y `loaded` (FlatList + preview + restore) — plan 03-03 los expande. */}
      {(status === 'error' || status === 'loaded') && (
        <View className={styles.emptyContainer}>
          <Text className={styles.emptyBody}>
            {files.length} backup(s) detectados — la lista detallada se habilita al completar la próxima tarea del phase.
          </Text>
        </View>
      )}
    </View>
  );
}
