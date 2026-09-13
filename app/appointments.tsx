import { useState } from 'react';
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
import { useAppStore } from '@/store/appStore';
import type { Appointment } from '@/types';

export default function AppointmentsScreen() {
  const appointments = useAppStore((s) => s.appointments);
  const setAppointments = useAppStore((s) => s.setAppointments);

  const [title, setTitle] = useState('');
  const [doctor, setDoctor] = useState('');
  const [datetime, setDatetime] = useState('');

  const addAppointment = () => {
    if (!title.trim() || !datetime.trim()) {
      Alert.alert('Eksik bilgi', 'Başlık ve tarih/saat gerekli.');
      return;
    }

    const next: Appointment = {
      id: Date.now().toString(),
      title: title.trim(),
      doctor: doctor.trim() || undefined,
      datetime: datetime.trim(),
    };

    setAppointments(
      [...appointments, next].sort((a, b) => a.datetime.localeCompare(b.datetime))
    );
    setTitle('');
    setDoctor('');
    setDatetime('');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Randevular" />

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Randevu başlığı"
          placeholderTextColor={Colors.textMuted}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={styles.input}
          placeholder="Doktor / klinik"
          placeholderTextColor={Colors.textMuted}
          value={doctor}
          onChangeText={setDoctor}
        />
        <TextInput
          style={styles.input}
          placeholder="Tarih saat (2026-09-20 14:30)"
          placeholderTextColor={Colors.textMuted}
          value={datetime}
          onChangeText={setDatetime}
        />
        <Pressable style={styles.addBtn} onPress={addAppointment}>
          <Text style={styles.addBtnText}>Randevu Ekle</Text>
        </Pressable>
      </View>

      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Kayıtlı randevu yok.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.doctor ? (
              <Text style={styles.cardMeta}>{item.doctor}</Text>
            ) : null}
            <Text style={styles.cardTime}>{item.datetime}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.md },
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
    backgroundColor: Colors.appointments,
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
    gap: 4,
  },
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
  cardTime: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '700',
    marginTop: 4,
  },
});
