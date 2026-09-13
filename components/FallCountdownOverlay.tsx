import { useEffect, useRef } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Colors, Typography } from '@/constants/theme';
import { SosService } from '@/services/SosService';
import { useAppStore } from '@/store/appStore';
import { useFallAlertStore } from '@/store/fallAlertStore';
import { NotificationService } from '@/services/NotificationService';

export function FallCountdownOverlay() {
  const active = useFallAlertStore((s) => s.active);
  const secondsLeft = useFallAlertStore((s) => s.secondsLeft);
  const reason = useFallAlertStore((s) => s.reason);
  const tick = useFallAlertStore((s) => s.tick);
  const cancel = useFallAlertStore((s) => s.cancel);
  const consumeExpired = useFallAlertStore((s) => s.consumeExpired);

  const emergencyContacts = useAppStore((s) => s.emergencyContacts);
  const emergencyMessage = useAppStore((s) => s.settings.emergencyMessage);
  const firingRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [active, tick]);

  useEffect(() => {
    if (!active || secondsLeft > 0 || firingRef.current) return;

    firingRef.current = true;
    const shouldFire = consumeExpired();
    if (!shouldFire) {
      firingRef.current = false;
      return;
    }

    void (async () => {
      try {
        await NotificationService.sendImmediateAlert(
          'Düşme — SOS',
          'Geri sayım bitti, acil kişiler bilgilendiriliyor.'
        );
        await SosService.triggerSos(
          emergencyContacts,
          emergencyMessage,
          'DÜŞME ALGILANDI'
        );
      } finally {
        firingRef.current = false;
      }
    })();
  }, [active, secondsLeft, consumeExpired, emergencyContacts, emergencyMessage]);

  if (!active) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.badge}>DÜŞME ALGILANDI</Text>
          <Text style={styles.reason}>{reason}</Text>
          <Text style={styles.countdown}>{secondsLeft}</Text>
          <Text style={styles.help}>
            İyiyorsanız iptal edin. Süre dolunca otomatik SOS gönderilir.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="SOS iptal"
            onPress={cancel}
            style={styles.cancelBtn}
          >
            <Text style={styles.cancelText}>İYİYİM — İPTAL</Text>
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
  cancelBtn: {
    marginTop: 8,
    minHeight: 72,
    width: '100%',
    borderRadius: 16,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: Colors.sos,
    fontSize: Typography.button,
    fontWeight: '900',
  },
});
