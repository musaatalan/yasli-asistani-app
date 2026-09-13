import * as Location from 'expo-location';

export type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED;
}

export async function getCurrentCoordinates(): Promise<Coordinates | null> {
  try {
    const granted = await requestLocationPermission();
    if (!granted) return null;

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };
  } catch {
    return null;
  }
}

export function buildMapsLink(coords: Coordinates): string {
  return `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
}

export async function getEmergencyLocationText(): Promise<{
  text: string;
  attached: boolean;
}> {
  const coords = await getCurrentCoordinates();
  if (!coords) {
    return {
      text: 'Konum alınamadı. Lütfen hemen arayın.',
      attached: false,
    };
  }

  return {
    text: [
      `Enlem: ${coords.latitude.toFixed(6)}`,
      `Boylam: ${coords.longitude.toFixed(6)}`,
      `Harita: ${buildMapsLink(coords)}`,
    ].join('\n'),
    attached: true,
  };
}
