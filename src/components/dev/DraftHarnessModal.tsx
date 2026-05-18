/**
 * DraftHarnessModal — Dev-only modal para validar FOUND-05 E2E.
 *
 * Gateado por `__DEV__`: invisible en builds production. Entry-point en
 * Settings → "Dev — Draft harness". El modal monta `useDraftAutosave` con
 * un TextInput controlado; al cerrar+reabrir, el texto se restaura desde
 * SQLite. UAT Scenario 3 (Wave 7) lo usa para verificar survives-kill.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { BottomSheet } from '../layout/BottomSheet';
import { useDraftAutosave } from '../../hooks/useDraftAutosave';
import * as draftsRepo from '../../repositories/draftsRepository';
import { styles } from './DraftHarnessModal.styles';

const HARNESS_KIND = 'harness';
const HARNESS_KEY = 'dev-key';

interface DraftHarnessModalProps {
  visible: boolean;
  onClose: () => void;
}

export function DraftHarnessModal({ visible, onClose }: DraftHarnessModalProps) {
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const row = await draftsRepo.find(HARNESS_KIND, HARNESS_KEY);
      if (cancelled) return;
      if (row) {
        try {
          const parsed = JSON.parse(row.payload_json) as { text?: string };
          setText(parsed.text ?? '');
        } catch {
          setText('');
        }
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [visible]);

  useDraftAutosave(HARNESS_KIND, HARNESS_KEY, { text });

  async function handleClear() {
    await draftsRepo.deleteOne(HARNESS_KIND, HARNESS_KEY);
    setText('');
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text className={styles.title}>Dev — Draft harness</Text>
      <Text className={styles.hint}>
        Tipeá algo, esperá 500ms, cerrá la app y volvé a abrirla.
        El texto debería sobrevivir.
      </Text>
      <View className={styles.sectionGap} />
      <Text className={styles.label}>Texto borrador</Text>
      <TextInput
        className={styles.textArea}
        placeholder="Escribí algo..."
        placeholderTextColor="#b45309"
        multiline
        value={text}
        onChangeText={setText}
        editable={loaded}
      />
      <Text className={styles.status}>
        {loaded ? 'Autosave activo (500ms debounce)' : 'Cargando draft...'}
      </Text>
      <View className={styles.sectionGap} />
      <Pressable className={styles.clearButton} onPress={handleClear}>
        <Text className={styles.clearButtonText}>Limpiar draft</Text>
      </Pressable>
      <Pressable className={styles.closeButton} onPress={onClose}>
        <Text className={styles.closeText}>Cerrar</Text>
      </Pressable>
    </BottomSheet>
  );
}
