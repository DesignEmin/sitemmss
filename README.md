# Müziğim 🎵

Sadece senin kullanacağın, Spotify / YouTube Müzik tarzı kişisel müzik platformu.
Hiçbir sunucu, hesap ya da kurulum gerekmez. Tamamen tarayıcıda çalışır ve şarkıların
**yalnızca senin cihazında** (tarayıcının IndexedDB deposunda) saklanır.

## Özellikler

- **Şarkı yükleme**: MP3, M4A, FLAC, OGG, WAV… Dosya seçerek ya da pencereye sürükleyip bırakarak ekle.
  - Şarkı adı, sanatçı, albüm ve kapak resmi MP3 etiketlerinden (ID3) otomatik okunur.
  - Etiket yoksa `Sanatçı - Şarkı Adı.mp3` biçimindeki dosya adından tahmin edilir.
  - Aynı dosyayı iki kez eklemez.
- **Bağlantıdan ekleme**: Doğrudan bir ses dosyasına giden URL ile şarkı ekle.
- **Beğenilen Şarkılar** ❤️: Kalbe dokun, şarkı otomatik olarak listene eklensin.
- **Çalma listeleri**: Oluştur, adını, açıklamasını ve kapağını düzenle, sil.
  - Şarkıları listeye ekle / listeden çıkar, sürükleyerek (veya menüden) sırala.
  - Liste sayfasındaki “Bu listeye şarkı ekle” bölümünden hızlıca ekleme.
  - Bir listenin sayfasındayken yüklediğin şarkılar doğrudan o listeye eklenir.
- **Çalar**: Çal/duraklat, önceki/sonraki, karıştır, tekrarla (liste / tek şarkı), ses ve konum ayarı.
- **Sıra (kuyruk)**: “Sıradaki olarak çal”, “Sıraya ekle”, sıradan kaldırma, sırayı temizleme.
- **Kitaplık**: Tüm şarkılar; başlık, sanatçı, albüm, eklenme tarihi, dinlenme sayısı veya süreye göre sıralama ve filtreleme.
- **Arama**: Şarkı, sanatçı, albüm ve çalma listelerinde Türkçe karakter duyarsız arama (ör. “simarik” → “Şımarık”).
- **Sanatçı ve albüm sayfaları**.
- **Ana sayfa**: Son çalınanlar, en çok dinlediklerin, yeni eklenenler, sanatçıların.
- **Şarkı bilgilerini düzenleme**: Ad, sanatçı, albüm, yıl ve kapak resmi.
- **Tam ekran “Şimdi çalıyor”** görünümü (alttaki çalara dokun).
- **Telefonda da çalışır**: Mobil uyumlu tasarım, kilit ekranı / bildirim kontrolleri (Media Session),
  ana ekrana eklenebilir uygulama (PWA) ve çevrimdışı açılış.
- Kaldığın şarkı, konum, sıra ve ses seviyesi hatırlanır.

### Klavye kısayolları

| Tuş | İşlev |
| --- | --- |
| `Boşluk` | Çal / duraklat |
| `Shift + →` / `Shift + ←` | Sonraki / önceki şarkı |
| `→` / `←` | 5 sn ileri / geri |
| `↑` / `↓` | Sesi aç / kıs |
| `L` | Çalan şarkıyı beğen |
| `S` | Karıştır |
| `R` | Tekrar modu |
| `M` | Sessiz |
| `/` | Ara |

## Telefon uygulaması (Google Play / App Store)

Proje [Capacitor](https://capacitorjs.com) ile Android ve iOS uygulaması olarak paketlenmeye hazırdır.
Adım adım yükleme talimatları için **[MAGAZA-REHBERI.md](MAGAZA-REHBERI.md)** dosyasına bak.
Gizlilik politikası: [GIZLILIK-POLITIKASI.md](GIZLILIK-POLITIKASI.md).

Telefonda ekstra olarak:
- Ekran kapalıyken / başka uygulamadayken müzik çalmaya devam eder.
- Kilit ekranı ve bildirimden çal/duraklat/ileri/geri kontrolü.
- Android geri tuşu desteği.

## Geliştirme

```bash
npm install
npm run dev        # http://localhost:8000 (değişiklikleri otomatik derler)
npm run build      # src/ -> www/
npm test           # uçtan uca testler (önce npm run build)
npm run android    # Android Studio ile aç
npm run ios        # Xcode ile aç
```

Her gönderimde GitHub Actions testleri çalıştırır, Android APK/AAB ve iOS derlemesini yapar
(**Actions** sekmesi → *Test ve Derleme*). Android deneme APK’sı oradan indirilebilir.

## Önemli notlar

- Şarkılar hangi cihaz ve tarayıcıda yüklendiyse **orada** saklanır. Telefonda ve bilgisayarda ayrı ayrı yüklemen gerekir.
- Tarayıcı verilerini (site verileri) temizlersen yüklediğin şarkılar da silinir. Orijinal dosyalarını sakla.
- Uygulama tarayıcıdan kalıcı depolama izni ister; böylece tarayıcı yer açmak için şarkılarını kendiliğinden silmez.
- Gizli / özel sekmede veriler kalıcı olmaz.

## Dosya yapısı

```
src/                  Uygulama kaynak kodu (web)
  index.html          Sayfa iskeleti
  css/style.css       Tasarım (koyu tema, mobil uyumlu)
  js/app.js           Sayfalar, çalar, çalma listeleri, sıra
  js/native.js        Telefon entegrasyonu (arka planda çalma, kilit ekranı, geri tuşu)
  js/db.js            IndexedDB depolama katmanı
  js/metadata.js      ID3 etiketi / kapak / süre okuma
  js/icons.js         SVG ikonlar
android/              Android Studio projesi
ios/                  Xcode projesi
assets/               Simge ve açılış ekranı kaynakları
scripts/              Derleme ve görsel üretme betikleri
tests/e2e.mjs         Uçtan uca testler
capacitor.config.json Uygulama kimliği ve telefon ayarları
```
