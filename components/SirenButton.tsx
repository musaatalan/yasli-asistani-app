import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Colors, Typography } from '@/constants/theme';
import { SirenService } from '@/services/SirenService';

type SirenButtonProps = {
  compact?: boolean;
};

export function SirenButton({ compact = false }: SirenButtonProps) {
  const [playing, setPlaying] = useState(SirenService.getIsPlaying());
  const [busy, setBusy] = useState(false);

  useEffect(() => SirenService.subscribe(setPlaying), []);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await SirenService.toggle();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Sireni durdur' : 'Sireni çal'}
        onPress={toggle}
        disabled={busy}
        style={({ pressed }) => [
          styles.button,
          compact && styles.buttonCompact,
          playing ? styles.buttonActive : styles.buttonIdle,
          (pressed || busy) && { opacity: 0.9 },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={Colors.text} size="large" />
        ) : (
          <Ionicons
            name={playing ? 'stop-circle' : 'volume-high'}
            size={compact ? 48 : 72}
            color={Colors.text}
          />
        )}
        <Text style={[styles.label, compact && styles.labelCompact]}>
          {playing ? 'SİRENİ DURDUR' : 'SİRENİ ÇAL'}
        </Text>
        <Text style={styles.hint}>
          {playing
            ? 'Ses ve titreşim açık — tekrar dokunun'
            : 'Tam ses · döngüsel alarm'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  button: {
    minHeight: 220,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 20,
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  buttonCompact: {
    minHeight: 160,
    borderRadius: 22,
  },
  buttonIdle: {
    backgroundColor: Colors.siren,
  },
  buttonActive: {
    backgroundColor: Colors.sos,
  },
  label: {
    color: Colors.text,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 28,
  },
  hint: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: Typography.caption,
    fontWeight: '700',
    textAlign: 'center',
  },
});
