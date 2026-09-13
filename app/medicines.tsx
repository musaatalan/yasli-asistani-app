import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { NotificationService } from '@/services/NotificationService';
import { useAppStore } from '@/store/appStore';

export default function MedicinesScreen() {
  const medicines = useAppStore((s) => s.medicines);
  const addMedicine = useAppStore((s) => s.addMedicine);
  const toggleMedicine = useAppStore((s) => s.toggleMedicine);
  const removeMedicine = useAppStore((s) => s.removeMedicine);

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [times, setTimes] = useState('08:00,20:00');

  const enabledCount = useMemo(
    () => medicines.filter((m) => m.enabled).length,
    [medicines]
  );

  const handleAdd = async () => {
    if (!name.trim() || !dosage.trim()) {
      Alert.alert('Eksik bilgi', 'İlaç adı ve dozaj gerekli.');
      return;
    }

    const parsedTimes = times
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    addMedicine({
      name: name.trim(),
      dosage: dosage.trim(),
      times: parsedTimes.length ? parsedTimes : ['09:00'],
      enabled: true,
    });

    // schedule after store updates — slight delay via next tick medicines from getState
    setTimeout(() => {
      void NotificationService.scheduleMedicineReminders(
        useAppStore.getState().medicines
      );
    }, 0);

    setName('');
    setDosage('');
    setTimes('08:00,20:00');
  };

  const handleToggle = (id: string) => {
    toggleMedicine(id);
    setTimeout(() => {
      void NotificationService.scheduleMedicineReminders(
        useAppStore.getState().medicines
      );
    }, 0);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="İlaçlarım" />
      <Text style={styles.hint}>{enabledCount} aktif hatırlatma</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="İlaç adı"
          placeholderTextColor={Colors.textMuted}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Dozaj (örn. 1 tablet)"
          placeholderTextColor={Colors.textMuted}
          value={dosage}
          onChangeText={setDosage}
        />
        <TextInput
          style={styles.input}
          placeholder="Saatler (08:00,20:00)"
          placeholderTextColor={Colors.textMuted}
          value={times}
          onChangeText={setTimes}
        />
        <Pressable style={styles.addBtn} onPress={handleAdd}>
          <Text style={styles.addBtnText}>İlaç Ekle</Text>
        </Pressable>
      </View>

      <FlatList
        data={medicines}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Henüz ilaç eklenmedi.</Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, !item.enabled && styles.cardOff]}>
            <Pressable onPress={() => handleToggle(item.id)}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>{item.dosage}</Text>
              <Text style={styles.cardMeta}>{item.times.join(' · ')}</Text>
              <Text style={styles.toggle}>
                {item.enabled
                  ? 'Açık — kapatmak için dokun'
                  : 'Kapalı — açmak için dokun'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Alert.alert('Silinsin mi?', item.name, [
                  { text: 'Vazgeç', style: 'cancel' },
                  {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: () => {
                      removeMedicine(item.id);
                      setTimeout(() => {
                        void NotificationService.scheduleMedicineReminders(
                          useAppStore.getState().medicines
                        );
                      }, 0);
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.delete}>Sil</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.md },
  hint: {
    color: Colors.textMuted,
    fontSize: Typography.caption,
    fontWeight: '600',
    marginBottom: 12,
  },
  form: { gap: 10, marginBottom: 16 },
  input: {
    minHeight: 60,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '700',
    paddingHorizontal: 14,
  },
  addBtn: {
    minHeight: 64,
    borderRadius: 14,
    backgroundColor: Colors.medicine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: Colors.text,
    fontSize: Typography.button,
    fontWeight: '800',
  },
  list: { gap: 12, paddingBottom: 24 },
  empty: {
    color: Colors.textMuted,
    fontSize: Typography.body,
    textAlign: 'center',
    marginTop: 24,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    gap: 8,
  },
  cardOff: { opacity: 0.55 },
  cardTitle: {
    color: Colors.text,
    fontSize: Typography.title,
    fontWeight: '800',
  },
  cardMeta: {
    color: Colors.textMuted,
    fontSize: Typography.caption,
    fontWeight: '600',
  },
  toggle: {
    marginTop: 8,
    color: Colors.text,
    fontSize: Typography.caption,
    fontWeight: '700',
  },
  delete: {
    color: Colors.sos,
    fontSize: Typography.caption,
    fontWeight: '800',
    textAlign: 'right',
  },
});
