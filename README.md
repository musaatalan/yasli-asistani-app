# Güvenli Yaşlı Asistanı (Elderly Assistant App)

Yaşlı bireyler için tasarlanmış; acil durum yönetimi, düşme algılama, yüksek sesli siren, fotoğraflı hızlı rehber ve sağlık/ilaç takibi modüllerini içeren React Native / Expo tabanlı mobil uygulama.

## Özellikler

- **SOS & Acil Durum:** Tek tıkla tanımlı acil kişilere GPS ve Google Maps konum linkli SMS gönderme ve direkt arama.
- **Siren / Cihazımı Bul:** Maksimum ses seviyesinde döngüsel siren çalma ve titreşim desteği.
- **Düşme Algılama (Sensör):** İvmeölçer (Accelerometer) ile ani G-force değişimi ve serbest düşüş tespiti. 10 saniyelik sesli/görsel geri sayım ve otomatik SOS tetikleme.
- **Fotoğraflı Hızlı Rehber:** Galeri entegrasyonlu, devasa butonlu kolay arama rehberi.
- **Sağlık Takibi:** İlaç saatleri hatırlatıcısı, su sayacı, tansiyon ve kan şekeri kayıt modülü (AsyncStorage destekli).
- **Güvenli Ayarlar Paneli:** Yanlışlıkla müdahaleyi önleyen PIN korumalı (varsayılan PIN: `1234`) yönetici ekranı.

## Kurulum & Çalıştırma

```bash
# Bağımlılıkları yükleyin
npm install

# Uygulamayı başlatın
npx expo start
```

## APK Alma (EAS Build)

```bash
# EAS CLI yükleyin
npm install -g eas-cli

# Giriş yapın ve build başlatın
eas login
npx eas build --platform android --profile preview
```

### GitHub Actions (otomatik APK)

`main` / `master` branch’ine her push’ta `.github/workflows/build-apk.yml` çalışır:

1. EAS `preview` profili ile Android APK üretir  
2. APK’yı **GitHub Releases** altına yükler  

Gerekli secret (repo → Settings → Secrets and variables → Actions):

| Secret | Açıklama |
|--------|----------|
| `EXPO_TOKEN` | [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens) üzerinden alınır |

İlk kez EAS kullanıyorsanız bir kez yerelde bağlayın:

```bash
npx eas login
npx eas init
```

## Proje Yapısı

```
app/           # Expo Router ekranları
components/    # BigButton, SirenButton, HealthTracker, FallCountdownOverlay…
services/      # SosService, SirenService, FallDetectionService, PhotoService…
store/         # Zustand + AsyncStorage
constants/     # Tema
types/         # TypeScript tipleri
```
