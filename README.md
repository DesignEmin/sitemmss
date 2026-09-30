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

## Nasıl açılır?

### Seçenek 1: GitHub Pages (önerilen, telefondan da açılır)
1. GitHub’da bu deponun **Settings → Pages** bölümüne gir.
2. “Branch” olarak bu dalı ve `/ (root)` klasörünü seç, kaydet.
3. Birkaç dakika sonra verilen adresi aç (ör. `https://<kullanıcı-adın>.github.io/sitemmss/`).
4. Telefonda tarayıcı menüsünden **“Ana ekrana ekle”** diyerek uygulama gibi kullanabilirsin.

### Seçenek 2: Bilgisayarında
Klasörde bir yerel sunucu başlat ve tarayıcıda aç:

```bash
python3 -m http.server 8000
# sonra http://localhost:8000 adresine git
```

> Not: `index.html` dosyasına çift tıklayarak (`file://`) açmak bazı tarayıcılarda çalışmaz; yerel sunucu kullan.

## Önemli notlar

- Şarkılar hangi cihaz ve tarayıcıda yüklendiyse **orada** saklanır. Telefonda ve bilgisayarda ayrı ayrı yüklemen gerekir.
- Tarayıcı verilerini (site verileri) temizlersen yüklediğin şarkılar da silinir. Orijinal dosyalarını sakla.
- Uygulama tarayıcıdan kalıcı depolama izni ister; böylece tarayıcı yer açmak için şarkılarını kendiliğinden silmez.
- Gizli / özel sekmede veriler kalıcı olmaz.

## Dosya yapısı

```
index.html            Sayfa iskeleti
css/style.css         Tasarım (koyu tema, mobil uyumlu)
js/app.js             Uygulama: sayfalar, çalar, çalma listeleri, sıra
js/db.js              IndexedDB depolama katmanı
js/metadata.js        ID3 etiketi / kapak / süre okuma
js/icons.js           SVG ikonlar
sw.js                 Çevrimdışı çalışma için service worker
manifest.webmanifest  “Ana ekrana ekle” (PWA) ayarları
```
