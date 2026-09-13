import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { EmergencyCard } from '@/components/EmergencyCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { pickAndPersistContactPhoto } from '@/services/PhotoService';
import { PermissionService } from '@/services/PermissionService';
import { SosService } from '@/services/SosService';
import { FallDetectionService } from '@/services/FallDetectionService';
import { useAppStore } from '@/store/appStore';

export default function SettingsScreen() {
  const settings = useAppStore((s) => s.settings);
  const unlocked = useAppStore((s) => s.settingsUnlocked);
  const verifyPin = useAppStore((s) => s.verifyPin);
  const setSettingsUnlocked = useAppStore((s) => s.setSettingsUnlocked);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const emergencyContacts = useAppStore((s) => s.emergencyContacts);
  const upsertEmergencyContact = useAppStore((s) => s.upsertEmergencyContact);

  const [pin, setPin] = useState('');
  const [userName, setUserName] = useState(settings.userName);
  const [newPin, setNewPin] = useState(settings.settingsPin);
  const [contactName, setContactName] = useState(
    emergencyContacts[0]?.name ?? ''
  );
  const [contactPhone, setContactPhone] = useState(
    emergencyContacts[0]?.phone ?? ''
  );
  const [contactPhoto, setContactPhoto] = useState(
    emergencyContacts[0]?.photoUri
  );

  const unlock = () => {
    if (verifyPin(pin)) {
      setPin('');
      return;
    }
    Alert.alert('Yanlış şifre', 'Ayarlar paneli kilitli.');
  };

  const lockAndExit = () => {
    setSettingsUnlocked(false);
    router.back();
  };

  const save = () => {
    updateSettings({
      userName: userName.trim() || 'Kullanıcı',
      settingsPin: newPin.trim() || '1234',
    });

    upsertEmergencyContact({
      id: emergencyContacts[0]?.id ?? '1',
      name: contactName.trim() || 'Acil Yakınım',
      phone: contactPhone.trim(),
      relation: emergencyContacts[0]?.relation ?? 'Aile',
      photoUri: contactPhoto,
      isPrimary: true,
    });

    Alert.alert('Kaydedildi', 'Ayarlar güncellendi.');
  };

  if (!unlocked) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="Ayarlar Kilidi" />
        <View style={styles.lockBox}>
          <Text style={styles.lockTitle}>Korumalı Bölüm</Text>
          <Text style={styles.lockHint}>
            Ayarları açmak için 4 haneli şifreyi girin.
          </Text>
          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={8}
            placeholder="Şifre"
            placeholderTextColor={Colors.textMuted}
          />
          <Pressable style={styles.primaryBtn} onPress={unlock}>
            <Text style={styles.primaryBtnText}>Kilidi Aç</Text>
          </Pressable>
          <Text style={styles.defaultPin}>Varsayılan: 1234</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Ayarlar"
        rightLabel="Kilitle"
        onRightPress={lockAndExit}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.section}>Kullanıcı</Text>
        <TextInput
          style={styles.input}
          value={userName}
          onChangeText={setUserName}
          placeholder="Adınız"
          placeholderTextColor={Colors.textMuted}
        />
        <TextInput
          style={styles.input}
          value={newPin}
          onChangeText={setNewPin}
          keyboardType="number-pad"
          secureTextEntry
          placeholder="Ayarlar PIN"
          placeholderTextColor={Colors.textMuted}
        />

        <Text style={styles.section}>Acil Kişi (SOS)</Text>
        <Pressable
          style={styles.photoBtn}
          onPress={async () => {
            const uri = await pickAndPersistContactPhoto();
            if (uri) setContactPhoto(uri);
          }}
        >
          <Text style={styles.photoBtnText}>
            {contactPhoto ? 'Fotoğraf değiştir' : 'Fotoğraf ekle'}
          </Text>
        </Pressable>
        <TextInput
          style={styles.input}
          value={contactName}
          onChangeText={setContactName}
          placeholder="İsim"
          placeholderTextColor={Colors.textMuted}
        />
        <TextInput
          style={styles.input}
          value={contactPhone}
          onChangeText={setContactPhone}
          keyboardType="phone-pad"
          placeholder="Telefon"
          placeholderTextColor={Colors.textMuted}
        />

        <EmergencyCard
          name={contactName || 'Acil Yakınım'}
          phone={contactPhone}
          relation="Aile"
          photoUri={contactPhoto}
          isPrimary
          onCall={() => void SosService.dialNumber(contactPhone)}
        />

        <Text style={styles.section}>Sensörler</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Düşme algılama</Text>
          <Switch
            value={settings.sensors.fallDetectionEnabled}
            onValueChange={(value) =>
              updateSettings({
                sensors: { ...settings.sensors, fallDetectionEnabled: value },
              })
            }
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Yüksek ses tespiti (iskelet)</Text>
          <Switch
            value={settings.sensors.loudNoiseDetectionEnabled}
            onValueChange={(value) =>
              updateSettings({
                sensors: {
                  ...settings.sensors,
                  loudNoiseDetectionEnabled: value,
                },
              })
            }
          />
        </View>

        <Pressable
          style={styles.testFall}
          onPress={() =>
            FallDetectionService.openFallCountdown(
              settings.sensors.fallCountdownSeconds ?? 10,
              'Ayarlardan test edildi'
            )
          }
        >
          <Text style={styles.testFallText}>Düşme geri sayımını test et</Text>
        </Pressable>

        <Pressable
          style={styles.permBtn}
          onPress={() => router.push('/onboarding')}
        >
          <Text style={styles.permBtnText}>Kurulum / izinleri yeniden aç</Text>
        </Pressable>

        <Pressable
          style={styles.permBtnSecondary}
          onPress={() => void PermissionService.openAppPermissionSettings()}
        >
          <Text style={styles.permBtnSecondaryText}>Telefon izin ayarları</Text>
        </Pressable>

        <Pressable style={styles.primaryBtn} onPress={save}>
          <Text style={styles.primaryBtnText}>Kaydet</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.md },
  content: { gap: 12, paddingBottom: 40 },
  lockBox: {
    flex: 1,
    justifyContent: 'center',
    gap: 14,
    paddingBottom: 60,
  },
  lockTitle: {
    color: Colors.text,
    fontSize: Typography.hero,
    fontWeight: '900',
    textAlign: 'center',
  },
  lockHint: {
    color: Colors.textMuted,
    fontSize: Typography.body,
    textAlign: 'center',
    marginBottom: 8,
  },
  defaultPin: {
    color: Colors.textMuted,
    fontSize: Typography.caption,
    textAlign: 'center',
  },
  section: {
    marginTop: 8,
    color: Colors.text,
    fontSize: Typography.title,
    fontWeight: '800',
  },
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
  photoBtn: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Colors.bgSoft,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBtnText: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '700',
  },
  switchRow: {
    minHeight: 64,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '700',
    flex: 1,
    paddingRight: 12,
  },
  testFall: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: Colors.siren,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testFallText: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '800',
  },
  permBtn: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: Colors.medicine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permBtnText: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '800',
  },
  permBtnSecondary: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permBtnSecondaryText: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '700',
  },
  primaryBtn: {
    minHeight: 68,
    borderRadius: 14,
    backgroundColor: Colors.call,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    color: Colors.text,
    fontSize: Typography.button,
    fontWeight: '800',
  },
});
