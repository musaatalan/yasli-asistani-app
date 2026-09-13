import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Colors, Typography } from '@/constants/theme';
import { BackgroundFallService } from '@/services/BackgroundFallService';
import { FallDetectionService } from '@/services/FallDetectionService';
import { NotificationService } from '@/services/NotificationService';
import { SirenService } from '@/services/SirenService';
import { SosService } from '@/services/SosService';
import { VoiceTriggerService } from '@/services/VoiceTriggerService';
import { useAppStore } from '@/store/appStore';
import { useFallAlertStore } from '@/store/fallAlertStore';

async function resumeEmergencyListening() {
  FallDetectionService.resumeAlerts();
  await VoiceTriggerService.resumeEmergencyMode(() => {
    FallDetectionService.openFallCountdown(
      useAppStore.getState().settings.sensors.fallCountdownSeconds ?? 10,
      'Sesli imdat komutu algılandı'
    );
  });
}

async function performCancelCleanup() {
  await BackgroundFallService.cancelNativeAlert();
  await SirenService.stop();
  await resumeEmergencyListening();
}

function describeSosResult(result: {
  smsOpened: boolean;
  smsSentCount?: number;
  smsFailedCount?: number;
  calledPhone: string | null;
  locationAttached: boolean;
  error?: string;
}): string {
  const sent = result.smsSentCount ?? 0;
  if (result.error && sent === 0 && !result.smsOpened && !result.calledPhone) {
    return result.error;
  }
  return [
    result.locationAttached ? 'Konum mesaja eklendi.' : 'Konum alınamadı.',
    sent > 0
      ? `Otomatik SMS gönderildi (${sent} kişi).`
      : result.smsOpened
        ? "SMS ekranı açıldı — 'Gönder'e basın (izin eksik)."
        : 'SMS gönderilemedi.',
    result.calledPhone
      ? `Otomatik arama: ${result.calledPhone}`
      : 'Arama başlatılamadı.',
    result.error ?? '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function FallCountdownOverlay() {
  const active = useFallAlertStore((s) => s.active);
  const secondsLeft = useFallAlertStore((s) => s.secondsLeft);
  const reason = useFallAlertStore((s) => s.reason);
  const cancelledBanner = useFallAlertStore((s) => s.cancelledBanner);
  const tick = useFallAlertStore((s) => s.tick);
  const cancel = useFallAlertStore((s) => s.cancel);
  const clearCancelledBanner = useFallAlertStore((s) => s.clearCancelledBanner);
  const consumeExpired = useFallAlertStore((s) => s.consumeExpired);

  const firingRef = useRef(false);
  const [voiceHint, setVoiceHint] = useState('Yüksek sesle: İPTAL · İYİYİM · DUR');

  const handleCancel = async () => {
    if (firingRef.current) return;
    cancel();
    await VoiceTriggerService.stop();
    await performCancelCleanup();
  };

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [active, tick]);

  useEffect(() => {
    if (!active) return;

    FallDetectionService.pauseAlerts();
    firingRef.current = false;
    setVoiceHint('Yüksek sesle: İPTAL · İYİYİM · DUR');

    let disposed = false;
    void (async () => {
      const stopCancel = await VoiceTriggerService.startCancelMode(() => {
        if (!disposed) void handleCancel();
      });

      if (disposed) {
        stopCancel();
        return;
      }

      if (VoiceTriggerService.getMode() !== 'cancel') {
        setVoiceHint('Mikrofon izni yok — butonla iptal edin');
      }

      await SirenService.start({ allowRecording: true }).catch(() => undefined);
    })();

    return () => {
      disposed = true;
      void SirenService.stop();
      if (VoiceTriggerService.getMode() === 'cancel') {
        void VoiceTriggerService.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!active || secondsLeft > 0 || firingRef.current) return;

    firingRef.current = true;
    const wasNativeOwned = useFallAlertStore.getState().nativeOwned;
    const shouldFire = consumeExpired();
    if (!shouldFire) {
      firingRef.current = false;
      return;
    }

    void (async () => {
      try {
        await VoiceTriggerService.stop();
        await SirenService.stop();

        // Native guardian zaten SMS+arama yapacak — çift gönderim yok
        if (wasNativeOwned) {
          await NotificationService.sendImmediateAlert(
            'Acil durum',
            'Yakınlarınız bilgilendiriliyor…'
          );
          return;
        }

        const { emergencyContacts, settings } = useAppStore.getState();
        const phones = SosService.collectPhones(emergencyContacts);

        if (phones.length === 0) {
          await NotificationService.sendImmediateAlert(
            'SOS — Numara yok',
            'Acil kişi telefonu kayıtlı değil. Ayarlardan numara ekleyin.'
          );
          Alert.alert(
            'Acil numara yok',
            "SMS/arama yapılamadı.\n\nAyarlar (üstteki ⚙️) → şifre 1234 → Acil Kişi telefonunu gir → Kaydet."
          );
          return;
        }

        await NotificationService.sendImmediateAlert(
          'Düşme — SOS',
          'Otomatik SMS gönderiliyor, ardından arama…'
        );

        const result = await SosService.triggerSos(
          emergencyContacts,
          settings.emergencyMessage,
          'DÜŞME ALGILANDI'
        );

        Alert.alert('SOS Durumu', describeSosResult(result));
      } catch (error) {
        console.warn('[FallCountdown] SOS error', error);
        Alert.alert(
          'SOS hatası',
          'SMS veya arama başlatılamadı. Ayarlardan numarayı kontrol edin.'
        );
      } finally {
        await resumeEmergencyListening();
        firingRef.current = false;
      }
    })();
  }, [active, secondsLeft, consumeExpired]);

  useEffect(() => {
    if (!cancelledBanner) return;
    const id = setTimeout(() => {
      clearCancelledBanner();
    }, 1800);
    return () => clearTimeout(id);
  }, [cancelledBanner, clearCancelledBanner]);

  if (!active && !cancelledBanner) return null;

  if (cancelledBanner) {
    return (
      <Modal visible transparent animationType="fade" statusBarTranslucent>
        <View style={styles.backdrop}>
          <View style={[styles.card, styles.cancelledCard]}>
            <Text style={styles.cancelledTitle}>İptal Edildi</Text>
            <Text style={styles.help}>SOS gönderilmedi. Güvendesiniz.</Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.badge}>ACİL DURUM</Text>
          <Text style={styles.reason}>{reason}</Text>
          <Text style={styles.countdown}>{secondsLeft}</Text>
          <Text style={styles.help}>
            İyiyorsanız iptal edin. Süre dolunca otomatik SOS gönderilir.
          </Text>
          <Text style={styles.voiceHint}>{voiceHint}</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="İptal et, iyiyim"
            onPress={() => {
              void handleCancel();
            }}
            style={({ pressed }) => [
              styles.cancelBtn,
              pressed && styles.cancelBtnPressed,
            ]}
          >
            <Text style={styles.cancelText}>İPTAL ET / İYİYİM</Text>
            <Text style={styles.cancelSub}>Dokunarak veya sesle söyleyin</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: Colors.sos,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    borderWidth: 4,
    borderColor: '#fff',
  },
  cancelledCard: {
    backgroundColor: Colors.health,
  },
  badge: {
    color: Colors.text,
    fontSize: Typography.caption,
    fontWeight: '900',
    letterSpacing: 2,
  },
  reason: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  countdown: {
    color: Colors.text,
    fontSize: 96,
    fontWeight: '900',
    lineHeight: 110,
  },
  help: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: Typography.caption,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
  },
  voiceHint: {
    color: Colors.text,
    fontSize: Typography.caption,
    fontWeight: '800',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  cancelBtn: {
    marginTop: 8,
    minHeight: 96,
    width: '100%',
    borderRadius: 18,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 16,
  },
  cancelBtnPressed: {
    opacity: 0.88,
  },
  cancelText: {
    color: Colors.sos,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  cancelSub: {
    color: Colors.textDark,
    fontSize: Typography.caption,
    fontWeight: '700',
  },
  cancelledTitle: {
    color: Colors.text,
    fontSize: Typography.hero,
    fontWeight: '900',
    textAlign: 'center',
  },
});
