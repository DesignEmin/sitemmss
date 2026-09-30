# Google Play ve App Store’a Yükleme Rehberi

Bu proje **Capacitor** ile hazırlanmıştır: aynı kod hem web’de hem Android’de hem iOS’ta çalışır.
Android ve iOS projeleri `android/` ve `ios/` klasörlerinde hazırdır.

| Bilgi | Değer |
| --- | --- |
| Uygulama adı | Müziğim |
| Paket / Bundle kimliği | `com.designemin.muzigim` |
| En düşük Android | Android 7.0 (API 24) |
| Hedef Android | Android 16 (API 36) |
| En düşük iOS | iOS 15 |

> ⚠️ **Paket kimliği (`com.designemin.muzigim`) mağazaya ilk yüklemeden sonra değiştirilemez.**
> Değiştirmek istersen ilk yüklemeden **önce** söyle ya da `capacitor.config.json`, `android/app/build.gradle`
> ve Xcode’daki *Bundle Identifier* alanını birlikte değiştir.

---

## 0. Hazırlık (bir kere)

Gerekenler:
- [Node.js 22](https://nodejs.org)
- **Android için:** [Android Studio](https://developer.android.com/studio) (Windows, Mac veya Linux)
- **iOS için:** Bir **Mac** ve [Xcode](https://apps.apple.com/app/xcode/id497799835) (App Store’a yüklemek için Mac şart; Mac’in yoksa aşağıdaki “Mac’im yok” bölümüne bak)

Projeyi indirip kur:

```bash
git clone https://github.com/DesignEmin/sitemmss.git
cd sitemmss
git checkout ccr-dc8db721-pe0gu8   # (birleştirdikten sonra ana dalı kullan)
npm install
```

Sık kullanılan komutlar:

| Komut | Ne yapar |
| --- | --- |
| `npm run dev` | Uygulamayı tarayıcıda açar (http://localhost:8000) |
| `npm run build` | `src/` → `www/` derler |
| `npm test` | Tüm özellikleri otomatik test eder (önce `npm run build`) |
| `npm run android` | Derler, Android’e kopyalar ve Android Studio’yu açar |
| `npm run ios` | Derler, iOS’a kopyalar ve Xcode’u açar |
| `npm run assets` | `assets/` içindeki PNG’lerden simge ve açılış ekranlarını üretir |

> Kodda (`src/` içinde) her değişiklikten sonra `npm run sync` çalıştır ki telefon projeleri güncellensin.

---

## 1. Önce telefonda dene

### Android
1. `npm run android` → Android Studio açılır.
2. Telefonunu USB ile bağla (Geliştirici seçenekleri → USB hata ayıklama açık) veya bir emülatör seç.
3. Yeşil ▶ **Run** düğmesine bas.

Kurulum yapmadan denemek istersen: GitHub’da **Actions → Test ve Derleme → son çalışma → Artifacts**
bölümünden `muzigim-android-debug-apk` dosyasını indir, telefona atıp kur.

### iOS
1. `npm run ios` → Xcode açılır.
2. Sol üstte **App** hedefini seç → **Signing & Capabilities** → *Team* olarak Apple hesabını seç.
3. iPhone’unu bağla, ▶ düğmesine bas.

### Kontrol listesi (telefonda mutlaka dene)
- [ ] Şarkı yükleme (Dosyalar uygulamasından / indirilenlerden)
- [ ] Beğenme, çalma listesi oluşturma, listeye ekleme/çıkarma, sıralama
- [ ] Ekranı kilitle → müzik devam ediyor mu? Kilit ekranında ⏯ ⏭ ⏮ çalışıyor mu?
- [ ] Başka uygulamaya geç → müzik devam ediyor mu?
- [ ] Uygulamayı kapatıp aç → şarkılar, listeler, beğeniler duruyor mu?
- [ ] Android’de geri tuşu: menüleri kapatıyor, geri gidiyor, ana sayfada uygulamayı arka plana alıyor mu?

---

## 2. Google Play

### 2.1 Geliştirici hesabı
[Google Play Console](https://play.google.com/console)’dan hesap aç (tek seferlik **25 $**).
Yeni kişisel hesaplarda, uygulamayı herkese açmadan önce **en az 12 test kullanıcısıyla 14 gün kapalı test**
yapman istenir. Bunu planına ekle.

### 2.2 İmza anahtarı (bir kere oluştur, **asla kaybetme**)

```bash
keytool -genkey -v -keystore muzigim-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias muzigim
```

Dosyayı ve şifreleri güvenli bir yere yedekle. Sonra `android/keystore.properties` dosyası oluştur
(bu dosya git’e **eklenmez**):

```properties
storeFile=/tam/yol/muzigim-release.jks
storePassword=ŞİFREN
keyAlias=muzigim
keyPassword=ŞİFREN
```

### 2.3 Yayın paketini (AAB) oluştur

**Yol A – Bilgisayarında:**
```bash
npm run sync
cd android
./gradlew bundleRelease        # Windows: gradlew.bat bundleRelease
```
Çıktı: `android/app/build/outputs/bundle/release/app-release.aab`

**Yol B – GitHub’da otomatik (bilgisayarında Android Studio olmasa bile):**
GitHub’da depo → **Settings → Secrets and variables → Actions → New repository secret** ile şunları ekle:

| Secret adı | Değeri |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 muzigim-release.jks` komutunun çıktısı (Mac: `base64 -i muzigim-release.jks`) |
| `ANDROID_KEYSTORE_PASSWORD` | anahtar deposu şifresi |
| `ANDROID_KEY_ALIAS` | `muzigim` |
| `ANDROID_KEY_PASSWORD` | anahtar şifresi |

Her gönderimde **Actions** sekmesinde imzalı `muzigim-android-release-aab` dosyası oluşur.
Sürüm numarası (versionCode) otomatik artar.

> Bilgisayarda derlerken sürümü artırmak için: `VERSION_CODE=2 VERSION_NAME=1.0.1 ./gradlew bundleRelease`

### 2.4 Play Console’da doldurulacaklar
1. **Uygulama oluştur** → Ad: *Müziğim*, dil: Türkçe, *Uygulama*, *Ücretsiz*.
2. **Uygulama içeriği** bölümü:
   - **Gizlilik politikası URL’si:** `GIZLILIK-POLITIKASI.md` dosyasının GitHub adresi
     (depo herkese açık olmalı) veya bu metni koyduğun herhangi bir web sayfası.
     Önce dosyadaki `[BURAYA-E-POSTA-ADRESİNİ-YAZ]` kısmını düzelt.
   - **Reklamlar:** Hayır.
   - **Veri güvenliği:** “Uygulama kullanıcı verisi toplamıyor veya paylaşmıyor” seç.
   - **Hedef kitle:** 13 yaş ve üzeri (veya 18+).
   - **İçerik derecelendirmesi:** Anketi doldur (şiddet vb. yok → genelde “Herkes / 3+”).
   - **Ön plan hizmeti izinleri:** *Medya oynatma (mediaPlayback)* seç. Açıklama: “Kullanıcının başlattığı
     müzik, ekran kapalıyken ve uygulama arka plandayken çalmaya devam eder.” İstenirse bunu gösteren kısa bir video
     (ekran kaydı) yükle.
3. **Mağaza girişi:**
   - Kısa açıklama (80 karakter): *Kendi şarkılarınla çalma listeleri oluştur, beğen ve dinle.*
   - Tam açıklama: aşağıdaki “Mağaza metinleri” bölümünden kopyala.
   - Simge 512×512, öne çıkan görsel 1024×500, en az 2 telefon ekran görüntüsü (görseller sonra).
4. **Test → Kapalı test** ile AAB’yi yükle, test kullanıcılarını ekle. Süre dolunca **Üretim**’e gönder.

---

## 3. App Store (iOS)

### 3.1 Apple Developer hesabı
[developer.apple.com/programs](https://developer.apple.com/programs/) → yıllık **99 $**.

### 3.2 Xcode ayarları
1. `npm run ios`
2. **App** hedefi → **Signing & Capabilities**:
   - *Team*: geliştirici hesabın
   - *Bundle Identifier*: `com.designemin.muzigim`
   - **Background Modes** yeteneğinde **Audio, AirPlay, and Picture in Picture** işaretli olmalı
     (Info.plist’e eklendi; Xcode’da görünmüyorsa “+ Capability → Background Modes” ile ekle ve işaretle).
3. **General** → *Version* `1.0.0`, *Build* `1` (her yüklemede Build’i artır).

### 3.3 Yükleme
1. Üstte cihaz olarak **Any iOS Device (arm64)** seç.
2. **Product → Archive**.
3. Açılan pencerede **Distribute App → App Store Connect → Upload**.
4. [App Store Connect](https://appstoreconnect.apple.com)’te **Uygulamalarım → +** ile uygulamayı oluştur
   (aynı Bundle ID), yüklenen build’i seç.
5. Doldurulacaklar:
   - **Gizlilik politikası URL’si** (Google Play ile aynı)
   - **App Privacy:** “Veri toplamıyoruz” (Data Not Collected)
   - Kategori: **Müzik**
   - Yaş derecelendirmesi anketi
   - Ekran görüntüleri: 6.9" iPhone (1320×2868) zorunlu; iPad desteklenirse iPad 13" de gerekir
   - **Şifreleme:** Info.plist’te `ITSAppUsesNonExemptEncryption = NO` ayarlı, soru sorulmaz.
6. İstersen önce **TestFlight** ile kendi telefonunda dene, sonra **İncelemeye Gönder**.

### İnceleme notu (App Review Notes) önerisi
> Müziğim, kullanıcının kendi cihazındaki ses dosyalarını çalan kişisel bir müzik çalardır.
> Denemek için: Kitaplık → “Şarkı yükle” → Dosyalar’dan herhangi bir MP3 seçin. Hesap gerekmez.
> Uygulama hiçbir veri toplamaz; tüm veriler cihazda saklanır.

İnceleyicinin deneyebilmesi için bir test MP3’ünü bir bağlantıya koyup notta belirtmek incelemeyi hızlandırır.

### Mac’im yok
- Mac kiralama servisleri (ör. MacinCloud) veya bir arkadaşın Mac’i kullanılabilir.
- Ya da [Codemagic](https://codemagic.io) / GitHub Actions (macOS) ile bulutta imzalayıp yüklenebilir.
  Bu projede GitHub Actions iOS derlemesini zaten **doğruluyor** (imzasız). İmzalı yükleme için Apple
  sertifikaları gerekir; istersen bunu da ekleyebiliriz.

---

## 4. Mağaza metinleri (taslak)

**Başlık:** Müziğim – Kişisel Müzik Çalar

**Kısa açıklama:** Kendi şarkılarınla çalma listeleri oluştur, beğen ve dinle.

**Tam açıklama:**
> Müziğim, kendi müzik dosyaların için sade ve şık bir müzik çalar.
>
> 🎵 Telefonundaki MP3, M4A, FLAC, WAV ve diğer ses dosyalarını ekle
> ❤️ Sevdiğin şarkıları beğen, “Beğenilen Şarkılar” listende topla
> 📋 Sınırsız çalma listesi oluştur, düzenle, sırala, kapak resmi ekle
> 🔀 Karıştır, tekrarla, sıradaki şarkıları yönet
> 🔎 Şarkı, sanatçı ve albümlerde hızlı arama
> 🔒 Kilit ekranından ve bildirimden kontrol, arka planda çalma
> 🛡️ Hesap yok, reklam yok, veri toplama yok – her şey yalnızca senin cihazında
>
> Şarkı adları, sanatçılar, albümler ve kapak resimleri dosyalardan otomatik okunur.

**Anahtar kelimeler (iOS):** müzik,çalar,mp3,çalma listesi,offline,şarkı,player,müzik çalar

---

## 5. Görseller (sonra)
Şu an simge ve açılış ekranı basit bir yeşil nota logosudur. Kendi tasarımını kullanmak için:
1. `assets/icon-only.png` (1024×1024), `assets/icon-foreground.png` (1024×1024, şeffaf, logo ortada),
   `assets/icon-background.png`, `assets/splash.png` ve `assets/splash-dark.png` (2732×2732) dosyalarını değiştir.
2. `npm run assets` çalıştır. Tüm Android ve iOS boyutları otomatik üretilir.

---

## 6. Bilinen sınırlamalar
- **Apple Music / Spotify** gibi uygulamaların şarkıları (DRM korumalı) eklenemez; yalnızca kendi ses dosyaların.
- Şarkılar uygulamanın içinde saklanır; uygulamayı silersen şarkılar da silinir (orijinal dosyaların durur).
- Telefonlar arasında eşitleme yok (her cihaz kendi kitaplığına sahip).
