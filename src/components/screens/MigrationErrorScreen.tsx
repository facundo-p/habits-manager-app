/**
 * MigrationErrorScreen — Pantalla bloqueante cuando migrationV2 falla (D-05).
 *
 * Reemplaza al NavigationContainer mientras `migrationState.status === 'failed'`.
 * El usuario tiene dos salidas: restaurar desde backup (snapshot pre-v2 local
 * o Drive) o reintentar la migración.
 *
 * Copy empático alineado a tone-of-voice (Plan 07 / Wave 6): la app **no culpa**
 * al usuario, asegura que los datos están a salvo, ofrece acción concreta.
 * Solo bajo `__DEV__` se muestra el `err.message` para debugging (T-06-01).
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { nativeStyles } from './MigrationErrorScreen.styles';

export interface MigrationErrorScreenProps {
  error: unknown;
  onRetry: () => void;
  onRestore: () => void;
}

export function MigrationErrorScreen({
  error,
  onRetry,
  onRestore,
}: MigrationErrorScreenProps) {
  const detail =
    error instanceof Error ? error.message : 'Error desconocido';

  return (
    <View style={nativeStyles.container}>
      <Text style={nativeStyles.headline}>
        No se pudo actualizar la base de datos.
      </Text>
      <Text style={nativeStyles.subhead}>
        Tu información está a salvo. Podés restaurar desde un backup o
        reintentar la actualización.
      </Text>

      <View style={nativeStyles.actions}>
        <Pressable style={nativeStyles.primaryButton} onPress={onRetry}>
          <Text style={nativeStyles.primaryButtonText}>
            Reintentar migración
          </Text>
        </Pressable>
        <Pressable style={nativeStyles.secondaryButton} onPress={onRestore}>
          <Text style={nativeStyles.secondaryButtonText}>
            Restaurar desde backup
          </Text>
        </Pressable>
      </View>

      {__DEV__ && (
        <Text style={nativeStyles.errorDetail}>{detail}</Text>
      )}
    </View>
  );
}
