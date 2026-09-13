import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/theme';
import {
  PermissionItem,
  PermissionService,
} from '@/services/PermissionService';
import { useAppStore } from '@/store/appStore';

export default function OnboardingScreen() {
  const emergencyContacts = useAppStore((s) => s.emergencyContacts);
  const upsertEmergencyContact = useAppStore((s) => s.upsertEmergencyContact);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  const [name, setName] = useState(emergencyContacts[0]?.name || 'Acil Yakınım');
  const [phone, setPhone] = useState(emergencyContacts[0]?.phone || '');
  const [items, setItems] = useState<PermissionItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [askedOnce, setAskedOnce] = useState(false);

  const refresh = useCallback(async () => {
    const statuses = await PermissionService.getPermissionStatuses();
    setItems(statuses);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const askAll = async () => {
    setBusy(true);
    try {
      const statuses = await PermissionService.requestAllPermissions();
      setItems(statuses);
      setAskedOnce(true);
    } catch {
      Alert.alert('Hata', 'İzinler istenirken bir sorun oluştu.');
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.replace(/\D/g, '').length < 7) {
      Alert.alert(
        'Acil numara gerekli',
        'SMS ve arama için geçerli bir telefon numarası girin.'
      );
      return;
    }

    upsertEmergencyContact({
      id: emergencyContacts[0]?.id ?? '1',
      name: name.trim() || 'Acil Yakınım',
      phone: phone.trim(),
      relation: emergencyContacts[0]?.relation ?? 'Aile',
      photoUri: emergencyContacts[0]?.photoUri,
      isPrimary: true,
    });

    completeOnboarding();
    router.replace('/');
  };

  const criticalMissing = items.filter(
    (i) =>
      !i.granted &&
      (i.key === 'notifications' ||
        i.key === 'location' ||
        i.key === 'microphone' ||
        i.key === 'callPhone' ||
        i.key === 'activity')
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.brand}>Güvenli Yaşlı Asistanı</Text>
        <Text style={styles.title}>Kurulum</Text>
        <Text style={styles.subtitle}>
          Acil durum için önce yakınınızın numarasını girin, sonra tüm izinleri
          verin.
        </Text>

        <Text style={styles.section}>1. Acil kişi</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="İsim (ör. Kızım Ayşe)"
          placeholderTextColor={Colors.textMuted}
        />
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Telefon (ör. 05xx xxx xx xx)"
          placeholderTextColor={Colors.textMuted}
          keyboardType="phone-pad"
        />

        <Text style={styles.section}>2. İzinler</Text>
        {items.map((item) => (
          <View key={item.key} style={styles.permRow}>
            <Ionicons
              name={item.granted ? 'checkmark-circle' : 'ellipse-outline'}
              size={28}
              color={item.granted ? Colors.success : Colors.textMuted}
            />
            <View style={styles.permText}>
              <Text style={styles.permTitle}>{item.title}</Text>
              <Text style={styles.permDesc}>{item.description}</Text>
            </View>
          </View>
        ))}

        <Pressable
          style={[styles.primaryBtn, busy && styles.btnDisabled]}
          onPress={askAll}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={Colors.text} />
          ) : (
            <Text style={styles.primaryBtnText}>Tüm izinleri ver</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => void PermissionService.openAppPermissionSettings()}
        >
          <Text style={styles.secondaryBtnText}>Telefon ayarlarını aç</Text>
        </Pressable>

        {askedOnce && criticalMissing.length > 0 ? (
          <Text style={styles.warn}>
            Eksik kritik izinler: {criticalMissing.map((i) => i.title).join(', ')}.
            “Telefon ayarlarını aç” ile manuel verebilirsiniz.
          </Text>
        ) : null}

        <Pressable style={styles.finishBtn} onPress={finish}>
          <Text style={styles.finishBtnText}>Kaydet ve başla</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl * 2, gap: Spacing.sm },
  brand: {
    color: Colors.textMuted,
    fontSize: Typography.caption,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.hero,
    fontWeight: '800',
    marginTop: 4,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: Typography.body,
    lineHeight: 28,
    marginBottom: Spacing.md,
  },
  section: {
    color: Colors.text,
    fontSize: Typography.button,
    fontWeight: '700',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: Typography.body,
    paddingHorizontal: Spacing.md,
    paddingVertical: 16,
    minHeight: 56,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgSoft,
    borderRadius: 14,
    padding: Spacing.md,
  },
  permText: { flex: 1 },
  permTitle: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '700',
  },
  permDesc: {
    color: Colors.textMuted,
    fontSize: Typography.caption,
    marginTop: 2,
  },
  primaryBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.call,
    borderRadius: 16,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.7 },
  primaryBtnText: {
    color: Colors.text,
    fontSize: Typography.button,
    fontWeight: '800',
  },
  secondaryBtn: {
    borderRadius: 16,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryBtnText: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '600',
  },
  warn: {
    color: Colors.warning,
    fontSize: Typography.caption,
    lineHeight: 22,
  },
  finishBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.success,
    borderRadius: 16,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishBtnText: {
    color: Colors.text,
    fontSize: Typography.button,
    fontWeight: '800',
  },
});
