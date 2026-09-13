import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/BigButton';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { SosService } from '@/services/SosService';
import { useAppStore } from '@/store/appStore';
import { useFallAlertStore } from '@/store/fallAlertStore';

export default function HomeScreen() {
  const userName = useAppStore((s) => s.settings.userName);
  const emergencyContacts = useAppStore((s) => s.emergencyContacts);
  const emergencyMessage = useAppStore((s) => s.settings.emergencyMessage);
  const fallEnabled = useAppStore((s) => s.settings.sensors.fallDetectionEnabled);
  const startCountdown = useFallAlertStore((s) => s.startCountdown);
  const [sosLoading, setSosLoading] = useState(false);

  const handleSos = async () => {
    setSosLoading(true);
    try {
      const result = await SosService.triggerSos(
        emergencyContacts,
        emergencyMessage,
        'ACİL DURUM'
      );
      Alert.alert(
        'SOS Gönderildi',
        [
          result.locationAttached
            ? 'Konum mesaja eklendi.'
            : 'Konum alınamadı.',
          result.smsOpened
            ? 'SMS hazırlandı/gönderildi.'
            : 'SMS açılamadı — acil kişi numarasını ayarlardan girin.',
          result.calledPhone
            ? `Arama başlatıldı: ${result.calledPhone}`
            : 'Aranacak numara bulunamadı.',
        ].join('\n')
      );
    } catch {
      Alert.alert('Hata', 'SOS işlemi tamamlanamadı. Lütfen tekrar deneyin.');
    } finally {
      setSosLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <View style={styles.topText}>
          <Text style={styles.brand}>Güvenli Yaşlı Asistanı</Text>
          <Text style={styles.greeting}>Merhaba, {userName}</Text>
          {fallEnabled ? (
            <Text style={styles.sensorBadge}>Düşme algılama açık</Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ayarlar"
          onPress={() => router.push('/settings')}
          style={styles.settingsBtn}
          hitSlop={Layout.hitSlop}
        >
          <Ionicons name="settings-sharp" size={28} color={Colors.text} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        <View style={styles.row}>
          <BigButton
            title="SOS Acil"
            subtitle="Tek tık yardım"
            color={Colors.sos}
            icon="alert-circle"
            onPress={handleSos}
            loading={sosLoading}
          />
          <BigButton
            title="İlaçlarım"
            subtitle="Hatırlatmalar"
            color={Colors.medicine}
            icon="medkit"
            onPress={() => router.push('/medicines')}
          />
        </View>

        <View style={styles.row}>
          <BigButton
            title="Hızlı Arama"
            subtitle="Fotoğraflı rehber"
            color={Colors.call}
            icon="call"
            onPress={() => router.push('/contacts')}
          />
          <BigButton
            title="Siren"
            subtitle="Cihazımı bul"
            color={Colors.siren}
            icon="volume-high"
            onPress={() => router.push('/siren')}
          />
        </View>

        <View style={styles.row}>
          <BigButton
            title="Sağlık"
            subtitle="Su · tansiyon · şeker"
            color={Colors.health}
            icon="heart"
            onPress={() => router.push('/health')}
          />
          <BigButton
            title="Randevular"
            subtitle="Doktor / kontrol"
            color={Colors.appointments}
            icon="calendar"
            onPress={() => router.push('/appointments')}
          />
        </View>
      </View>

      {__DEV__ ? (
        <Pressable
          style={styles.devFall}
          onPress={() =>
            startCountdown(10, 'Test: düşme simülasyonu')
          }
        >
          <Text style={styles.devFallText}>[DEV] Düşme simüle et</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    gap: 8,
  },
  topText: { flex: 1 },
  brand: {
    color: Colors.text,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  greeting: {
    marginTop: 4,
    color: Colors.textMuted,
    fontSize: Typography.body,
    fontWeight: '600',
  },
  sensorBadge: {
    marginTop: 6,
    color: Colors.success,
    fontSize: Typography.caption,
    fontWeight: '700',
  },
  settingsBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  grid: {
    flex: 1,
    gap: Layout.gridGap,
    paddingBottom: Spacing.sm,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: Layout.gridGap,
  },
  devFall: {
    alignItems: 'center',
    paddingBottom: 6,
  },
  devFallText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
