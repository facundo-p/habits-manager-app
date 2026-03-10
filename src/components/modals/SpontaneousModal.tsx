/**
 * SpontaneousModal — Modal para registrar logros espontáneos.
 *
 * Permite ingresar un nombre y seleccionar áreas.
 * Puntos por defecto: 0. Se guarda con is_spontaneous = 1.
 * Reutiliza BottomSheet como shell.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { BottomSheet } from '../layout/BottomSheet';
import { AreaPicker } from '../shared/AreaPicker';
import { styles } from './SpontaneousModal.styles';

interface SpontaneousModalProps {
  visible: boolean;
  onSave: (name: string, categories: string[]) => void;
  onCancel: () => void;
}

export function SpontaneousModal({
  visible, onSave, onCancel,
}: SpontaneousModalProps) {
  const [name, setName] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setCategories([]);
  }, [visible]);

  function handleSave() {
    if (!name.trim()) return;
    onSave(name.trim(), categories);
  }

  return (
    <BottomSheet visible={visible} onClose={onCancel}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className={styles.title}>Nuevo Logro</Text>
        <View className={styles.sectionGap} />

        <NameField value={name} onChangeText={setName} />
        <Text className={styles.note}>Se guardará con 0 puntos.</Text>
        <View className={styles.sectionGap} />

        <AreaPicker selected={categories} onChange={setCategories} label="Áreas (opcional)" />
        <View className={styles.sectionGap} />

        <FormActions onSave={handleSave} onCancel={onCancel} />
      </ScrollView>
    </BottomSheet>
  );
}

// ─── Sub-componentes ────────────────────────────────────────────────

function NameField({ value, onChangeText }: { value: string; onChangeText: (t: string) => void }) {
  return (
    <>
      <Text className={styles.label}>¿Qué lograste?</Text>
      <TextInput
        className={styles.nameInput}
        placeholder="Ej: Cociné algo nuevo"
        placeholderTextColor="#b45309"
        value={value}
        onChangeText={onChangeText}
      />
    </>
  );
}

function FormActions({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <>
      <Pressable className={styles.saveButton} onPress={onSave}>
        <Text className={styles.saveButtonText}>Guardar</Text>
      </Pressable>
      <Pressable className={styles.cancelButton} onPress={onCancel}>
        <Text className={styles.cancelText}>Cancelar</Text>
      </Pressable>
    </>
  );
}
