import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect } from 'react';

import { ScreenHeader } from '@/components/ScreenHeader';
import { SirenButton } from '@/components/SirenButton';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { SirenService } from '@/services/SirenService';

export default function SirenScreen() {
  useEffect(() => {
    return () => {
      // Ekrandan çıkınca sireni kapatma — kullanıcı bilinçli bıraksın.
      // İsterseniz burada SirenService.stop() çağrılabilir.
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Siren / Cihazımı Bul" />

      <View style={styles.content}>
        <Text style={styles.help}>
          Tam ses ve titreşim ile döngüsel siren başlatır. Yakınınızın telefonu
          bulmasına yardımcı olur.
        </Text>

        <SirenButton />

        <Text style={styles.tip}>
          İpucu: Sessiz modda bile çalışır. Durdurmak için tekrar dokunun.
        </Text>

        <Text
          style={styles.stopHint}
          onPress={() => {
            void SirenService.stop();
          }}
        >
          Acil sessizleştir
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.md },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingBottom: 40,
  },
  help: {
    color: Colors.textMuted,
    fontSize: Typography.body,
    textAlign: 'center',
    lineHeight: 30,
    paddingHorizontal: 12,
  },
  tip: {
    color: Colors.textMuted,
    fontSize: Typography.caption,
    textAlign: 'center',
    fontWeight: '600',
  },
  stopHint: {
    color: Colors.text,
    fontSize: Typography.caption,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
