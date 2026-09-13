import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { HealthTracker } from '@/components/HealthTracker';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAppStore } from '@/store/appStore';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function HealthScreen() {
  const waterLogs = useAppStore((s) => s.waterLogs);
  const bloodPressure = useAppStore((s) => s.bloodPressure);
  const bloodSugar = useAppStore((s) => s.bloodSugar);
  const medicines = useAppStore((s) => s.medicines);
  const addWaterGlass = useAppStore((s) => s.addWaterGlass);
  const removeWaterGlass = useAppStore((s) => s.removeWaterGlass);
  const addBloodPressure = useAppStore((s) => s.addBloodPressure);
  const addBloodSugar = useAppStore((s) => s.addBloodSugar);

  const today = todayKey();
  const glasses = waterLogs.find((log) => log.date === today)?.glasses ?? 0;
  const lastBp = bloodPressure[0];
  const lastSugar = bloodSugar[0];
  const todayMeds = medicines.filter((m) => m.enabled);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Sağlık Takibi" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.medBox}>
          <Text style={styles.medTitle}>Bugünkü ilaçlar</Text>
          {todayMeds.length === 0 ? (
            <Text style={styles.medEmpty}>Aktif ilaç yok</Text>
          ) : (
            todayMeds.map((m) => (
              <Text key={m.id} style={styles.medItem}>
                {m.name} · {m.dosage} · {m.times.join(', ')}
              </Text>
            ))
          )}
          <Pressable
            style={styles.medLink}
            onPress={() => router.push('/medicines')}
          >
            <Text style={styles.medLinkText}>İlaç saatlerini yönet →</Text>
          </Pressable>
        </View>

        <HealthTracker
          waterGlassesToday={glasses}
          lastSystolic={lastBp?.systolic}
          lastDiastolic={lastBp?.diastolic}
          lastSugar={lastSugar?.value}
          onAddWater={() => addWaterGlass(today)}
          onRemoveWater={() => removeWaterGlass(today)}
          onSaveBloodPressure={(systolic, diastolic, pulse) =>
            addBloodPressure({
              systolic,
              diastolic,
              pulse,
              recordedAt: new Date().toISOString(),
            })
          }
          onSaveBloodSugar={(value) =>
            addBloodSugar({
              value,
              unit: 'mg/dL',
              recordedAt: new Date().toISOString(),
            })
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.md },
  content: { paddingBottom: 32, gap: 16 },
  medBox: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    gap: 8,
  },
  medTitle: {
    color: Colors.text,
    fontSize: Typography.title,
    fontWeight: '800',
  },
  medEmpty: {
    color: Colors.textMuted,
    fontSize: Typography.caption,
    fontWeight: '600',
  },
  medItem: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '700',
  },
  medLink: { marginTop: 4 },
  medLinkText: {
    color: Colors.call,
    fontSize: Typography.caption,
    fontWeight: '800',
  },
});
