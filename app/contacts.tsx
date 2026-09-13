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

import { EmergencyCard } from '@/components/EmergencyCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { pickAndPersistContactPhoto } from '@/services/PhotoService';
import { SosService } from '@/services/SosService';
import { useAppStore } from '@/store/appStore';

export default function ContactsScreen() {
  const quickContacts = useAppStore((s) => s.quickContacts);
  const addQuickContact = useAppStore((s) => s.addQuickContact);
  const updateQuickContact = useAppStore((s) => s.updateQuickContact);
  const removeQuickContact = useAppStore((s) => s.removeQuickContact);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUri, setPhotoUri] = useState<string | undefined>();

  const pickPhotoForForm = async () => {
    const uri = await pickAndPersistContactPhoto();
    if (uri) setPhotoUri(uri);
  };

  const addContact = () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Eksik bilgi', 'İsim ve telefon gerekli.');
      return;
    }

    addQuickContact({
      name: name.trim(),
      phone: phone.trim(),
      photoUri,
    });
    setName('');
    setPhone('');
    setPhotoUri(undefined);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Hızlı Arama" />

      <View style={styles.form}>
        <Pressable style={styles.photoPick} onPress={pickPhotoForForm}>
          <Text style={styles.photoPickText}>
            {photoUri ? 'Fotoğraf seçildi ✓' : 'Galeriden Fotoğraf Seç'}
          </Text>
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="İsim"
          placeholderTextColor={Colors.textMuted}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Telefon"
          placeholderTextColor={Colors.textMuted}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <Pressable style={styles.addBtn} onPress={addContact}>
          <Text style={styles.addBtnText}>Kişi Ekle</Text>
        </Pressable>
      </View>

      <FlatList
        data={quickContacts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Fotoğraflı hızlı arama kartları burada görünür. Önce kişi ekleyin.
          </Text>
        }
        renderItem={({ item }) => (
          <EmergencyCard
            name={item.name}
            phone={item.phone}
            photoUri={item.photoUri}
            onCall={() => {
              void SosService.dialNumber(item.phone);
            }}
            onPickPhoto={async () => {
              const uri = await pickAndPersistContactPhoto();
              if (uri) updateQuickContact(item.id, { photoUri: uri });
            }}
            onDelete={() =>
              Alert.alert('Silinsin mi?', item.name, [
                { text: 'Vazgeç', style: 'cancel' },
                {
                  text: 'Sil',
                  style: 'destructive',
                  onPress: () => removeQuickContact(item.id),
                },
              ])
            }
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.md },
  form: { gap: 10, marginBottom: 16 },
  photoPick: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: Colors.bgSoft,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPickText: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '700',
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
  addBtn: {
    minHeight: 64,
    borderRadius: 14,
    backgroundColor: Colors.call,
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
    lineHeight: 28,
  },
});
