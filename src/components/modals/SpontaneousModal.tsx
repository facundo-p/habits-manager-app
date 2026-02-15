/**
 * SpontaneousModal — Modal para registrar logros espontáneos.
 *
 * Permite ingresar un nombre y seleccionar áreas.
 * Puntos por defecto: 0. Se guarda con is_spontaneous = 1.
 * Reutiliza BottomSheet como shell.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { HABIT_AREAS } from '../../config/constants';
import { BottomSheet } from '../layout/BottomSheet';
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

        <AreaPicker selected={categories} onChange={setCategories} />
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

function AreaPicker({
  selected, onChange,
}: {
  selected: string[];
  onChange: (cats: string[]) => void;
}) {
  function toggleArea(areaId: string) {
    onChange(
      selected.includes(areaId)
        ? selected.filter((c) => c !== areaId)
        : [...selected, areaId],
    );
  }

  return (
    <>
      <Text className={styles.label}>Áreas (opcional)</Text>
      <View className={styles.chipRow}>
        {HABIT_AREAS.map((area) => {
          const active = selected.includes(area.id);
          return (
            <Pressable
              key={area.id}
              className={active ? styles.chipSelected : styles.chipBase}
              onPress={() => toggleArea(area.id)}
            >
              <Text className={active ? styles.chipTextSelected : styles.chipText}>
                {area.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
