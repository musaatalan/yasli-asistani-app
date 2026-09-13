import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export async function pickAndPersistContactPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'İzin gerekli',
      'Galeriden fotoğraf seçmek için medya izni vermelisiniz.'
    );
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return null;
  }

  const sourceUri = result.assets[0].uri;
  const folder = `${FileSystem.documentDirectory}contact-photos/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(
    () => undefined
  );

  const filename = `contact_${Date.now()}.jpg`;
  const dest = `${folder}${filename}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}
