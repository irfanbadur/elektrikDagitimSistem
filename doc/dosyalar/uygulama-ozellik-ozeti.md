# ElektraTrack - Uygulama Özellik Özeti

> Son güncelleme: 2026-02-16

## Genel Bakış

ElektraTrack, elektrik dağıtım müteahhitleri için geliştirilmiş kapsamlı bir iş takip ve koordinasyon sistemidir. Proje yönetimi, saha operasyonları, malzeme takibi, ekip koordinasyonu ve yapay zeka destekli raporlama modüllerini tek bir platformda birleştirir.

**Teknoloji:** React 18 + Vite | TailwindCSS v4 | Node.js + Express | SQLite | Leaflet.js | Recharts | TanStack Query/Table

---

## 1. Kimlik Doğrulama ve Yetkilendirme (RBAC)

| Özellik | Açıklama |
|---------|----------|
| JWT Tabanlı Giriş | Kullanıcı adı/şifre ile giriş, 24 saat süreli token |
| Rol Yönetimi | Özelleştirilebilir roller ve izin atamaları |
| İzin Kontrolü | Sayfa ve işlem bazlı erişim kısıtlaması |
| Kullanıcı Yönetimi | Kullanıcı oluşturma, rol atama, durum yönetimi |

**Sayfa:** `/giris` | **API:** `POST /api/auth/giris`, `GET /api/auth/profil`, `/api/yonetim/*`

---

## 2. Dashboard (Ana Panel)

| Özellik | Açıklama |
|---------|----------|
| Özet Kartlar | Toplam proje, aktif ekip, bekleyen talep, kritik malzeme sayıları |
| Ekip Durumları | Tüm ekiplerin anlık durum görselleştirmesi |
| Son Aktiviteler | Son 20 sistem olayının zaman çizelgesi |
| Bölge Dağılımı | Projelerin bölgesel dağılımı (pasta/çubuk grafik) |
| Açık Talepler | Bekleyen taleplerin hızlı özeti |

**Sayfa:** `/` | **API:** `/api/dashboard/ozet`, `/api/dashboard/aktiviteler`, `/api/dashboard/ekip-durumlari`

---

## 3. Proje Yönetimi

| Özellik | Açıklama |
|---------|----------|
| Proje CRUD | Oluşturma, listeleme, güncelleme, silme |
| Durum Takibi | 9 aşamalı durum yönetimi (teslim alındı → tamamlandı) |
| Filtreleme | Durum, bölge, tip bazlı filtreleme |
| İstatistikler | Proje dağılımı ve ilerleme oranları |

### Proje Detay Sekmeleri (7 adet)

| Sekme | Açıklama |
|-------|----------|
| **Dokümanlar** | Proje belgelerinin yüklenmesi ve yönetimi |
| **Proje Dosyaları** | CAD çizimleri ve teknik dosyalar |
| **Notlar** | Zaman damgalı proje notları |
| **Fotoğraflar** | Galeri görünümlü fotoğraf yönetimi (lightbox) |
| **Keşifler** | Malzeme listesi (metraj/keşif kalemleri) |
| **Birleşik Dokümanlar** | Konsolide belge paketi |
| **Proje Döngüsü** | Aşama bazlı ilerleme zaman çizelgesi |

**Sayfalar:** `/projeler`, `/projeler/yeni`, `/projeler/:id`, `/projeler/:id/duzenle`

---

## 4. Proje Döngü Sistemi (Yaşam Döngüsü)

| Özellik | Açıklama |
|---------|----------|
| Döngü Şablonları | Özelleştirilebilir aşama şablonları tanımlama |
| Şablon Atama | Projeye döngü şablonu atama |
| Aşama İlerlemesi | Başlat → Tamamla → Sonraki aşama geçişi |
| Zaman Çizelgesi | Görsel aşama ilerleme takibi |
| Aşama Atlama | Gereksiz aşamaları atlayabilme |

**API:** `/api/dongu/sablon`, `/api/dongu/proje/:id`, `/api/dongu/asama/:id/*`

---

## 5. Ekip Yönetimi

| Özellik | Açıklama |
|---------|----------|
| Ekip CRUD | Oluşturma, listeleme, güncelleme |
| Üye Kadrosu | Ekip üyeleri ve görev unvanları |
| Durum Takibi | Aktif, izinli, pasif durumları |
| Proje Atamaları | Ekibe atanmış projelerin listesi |
| Araç Ataması | Ekip araç takibi |

**Sayfalar:** `/ekipler`, `/ekipler/yeni`, `/ekipler/:id`, `/ekipler/:id/duzenle`

---

## 6. Personel Yönetimi

| Özellik | Açıklama |
|---------|----------|
| Personel CRUD | Kayıt, listeleme, güncelleme |
| Rol Ataması | Personel pozisyon ve yetki tanımları |
| Ekip Bağlantısı | Personeli ekibe atama |
| İletişim Bilgileri | Telefon, e-posta vb. |

**Sayfalar:** `/personel`, `/personel/yeni`, `/personel/:id`, `/personel/:id/duzenle`

---

## 7. Malzeme ve Stok Yönetimi

| Özellik | Açıklama |
|---------|----------|
| Stok Takibi | Kategorize envanter (kablo, direk, trafo, klemens, pano vb.) |
| Hareket Geçmişi | Giriş/çıkış hareketleri ve denetim izi |
| Kritik Stok Uyarıları | Eşik değerine düşen malzeme bildirimleri |
| Malzeme Kataloğu | Standart malzeme referans kütüphanesi |

**Sayfalar:** `/malzeme`, `/malzeme/yeni`, `/malzeme/hareketler`, `/katalog`

---

## 8. Talep Yönetimi

| Özellik | Açıklama |
|---------|----------|
| Talep Türleri | Malzeme, enerji kesintisi, araç, teknik destek, iş güvenliği, diğer |
| Öncelik Seviyeleri | Acil, yüksek, normal, düşük |
| Durum İzleme | Beklemede → İşleniyor → Onaylandı/Reddedildi → Tamamlandı |
| Ekip Ataması | Talebi sorumlu ekibe yönlendirme |

**Sayfalar:** `/talepler`, `/talepler/yeni`, `/talepler/:id`

---

## 9. Puantaj (Günlük Hakedişler)

| Özellik | Açıklama |
|---------|----------|
| Günlük Yoklama | Personel bazlı günlük devam kaydı |
| İş Kategorileri | Kablo çekimi, direk dikimi, trafo montajı vb. |
| Hava Durumu | Günlük hava koşulu kaydı |
| Takvim Görünümü | Aylık takvim üzerinden puantaj takibi |
| Özet Raporlar | Ekip ve dönem bazlı puantaj özetleri |

**Sayfalar:** `/puantaj`, `/puantaj/yeni`, `/puantaj/:id`

---

## 10. Raporlar ve Analitik

| Özellik | Açıklama |
|---------|----------|
| Günlük Özet | Günlük faaliyet raporu |
| Haftalık Rapor | Haftalık ilerleme raporu |
| Malzeme Raporu | Malzeme kullanım ve stok raporu |
| Tarih Aralığı | Özelleştirilebilir dönem filtreleme |
| Grafik Görselleştirme | Recharts ile etkileşimli grafikler |

**Sayfa:** `/raporlar`

---

## 11. Saha Haritası (Gerçek Zamanlı)

| Özellik | Açıklama |
|---------|----------|
| Etkileşimli Harita | Leaflet.js + OpenStreetMap tabanlı |
| Ekip Konumları | Özel ikonlarla ekip lokasyon işaretçileri |
| Veri Paketi Konumları | Tip bazlı ikonlarla saha verileri |
| Katman Kontrolü | Ekipler ve veri paketleri katman açma/kapama |
| Manuel Konum | Harita üzerinde tıklayarak konum atama |
| Otomatik Yenileme | 30 saniyede bir veri güncelleme |
| Detay Popup | İşaretçiye tıklayınca bilgi kartı |
| Fotoğraf Lightbox | Veri paketi fotoğraflarını haritadan görüntüleme |

**Sayfa:** `/saha` | **API:** `/api/saha/ekipler`, `/api/saha/veri-paketleri`

---

## 12. Saha Mesaj (AI Destekli Doğal Dil Raporlama)

| Özellik | Açıklama |
|---------|----------|
| Sohbet Arayüzü | Mobil uyumlu mesajlaşma tarzı UI |
| AI Mesaj Ayrıştırma | Doğal dil → yapısal veri dönüşümü (NLP) |
| Fotoğraf Eki | Çoklu fotoğraf yükleme desteği |
| GPS Konum | Otomatik veya manuel konum ekleme |
| Güven Skoru | AI ayrıştırma doğruluk göstergesi |
| Mesaj Geçmişi | Ayrıştırma sonuçlarıyla birlikte kayıt |

### Tanınan Operasyon Türleri
- Malzeme Talebi
- Malzeme Kullanım
- Günlük Rapor
- Enerji Kesintisi
- Arıza Bildirim
- İlerleme Notu
- Genel Not

**Sayfa:** `/saha-mesaj` | **API:** `POST /api/mesaj/gonder`, `GET /api/mesaj/gecmis`

---

## 13. AI Sohbet (Çok Turlu Yapay Zeka Asistanı)

| Özellik | Açıklama |
|---------|----------|
| Sohbet Geçmişi | Çoklu konuşma yönetimi |
| Doğal Dil Sorgu | Veritabanı sorguları doğal dilde |
| SQL İnceleme | AI'ın çalıştırdığı SQL'i görüntüleme |
| Eylem Planı Onayı | Yazma işlemleri için kullanıcı onayı |
| Çoklu AI Sağlayıcı | Claude, Ollama, Gemini, Groq desteği |

**Sayfa:** `/ai-sohbet` | **API:** `/api/ai-sohbet/*`

---

## 14. Veri Paketleri (Saha Veri Toplama)

| Özellik | Açıklama |
|---------|----------|
| Paket Türleri | Direk tespit, montaj öncesi/sonrası, arıza tespit, keşif, denetim, malzeme, genel |
| Durum Takibi | Devam ediyor, tamamlandı, iptal |
| Fotoğraf Galerisi | Paket başına çoklu fotoğraf |
| GPS Konum | Konum etiketleme |

**Sayfalar:** `/veri-paketleri`, `/veri-paketleri/:id`

---

## 16. Dosya Yönetim Sistemi

### 8 Ana Dosya Alanı

| Alan | İçerik |
|------|--------|
| **Projeler** | Fotoğraflar, çizimler, belgeler |
| **Personel** | Kimlik, sertifikalar, sağlık, SGK |
| **Ekipman/Araç** | Ruhsat, muayene, bakım belgeleri |
| **İhale** | Teklifler, sözleşmeler, keşifler |
| **İSG** | Risk değerlendirme, eğitim, denetim |
| **Firma Belgeleri** | Lisans, sigorta, resmi belgeler |
| **Muhasebe** | Fatura, bordro, banka, vergi |
| **Kurum Yazışması** | YEDAŞ, belediye yazışmaları |

### Ek Özellikler

| Özellik | Açıklama |
|---------|----------|
| Süresi Dolan Belgeler | Yaklaşan belge sona erme uyarıları |
| Global Arama | Tüm dosyalarda tam metin arama |
| İstatistikler | Alan bazlı dosya sayısı ve boyut analizi |
| Şablonlar | Şablon dosya yönetimi |
| Meta Veri | Başlık, alt kategori, ilişkili proje/kişi |

**Sayfa:** `/dosya-yonetimi` | **API:** `/api/dosya/*`, `/api/medya/*`

---

## 17. Ayarlar ve Sistem Yönetimi

| Sekme | Açıklama |
|-------|----------|
| Firma Bilgileri | Şirket bilgileri ve genel ayarlar |
| Bölge Yönetimi | Coğrafi bölge tanımları |
| Proje Tipleri | Proje türü kategorileri |
| Döngü Şablonları | Proje yaşam döngüsü şablon tanımları |
| Rol Yönetimi | Kullanıcı rolleri ve izin atamaları (RBAC) |
| Kullanıcılar | Kullanıcı hesap yönetimi |

**Sayfa:** `/ayarlar`

---

## Sayısal Özet

| Metrik | Sayı |
|--------|------|
| Toplam Sayfa | 17 |
| Toplam Bileşen | 65 |
| API Hook Kalıbı | 19 |
| Backend API Yolu | 33+ |
| Veritabanı Tablosu | 35+ |
| AI Sağlayıcı Desteği | 4 (Claude, Ollama, Gemini, Groq) |
| Dosya Alanı | 8 |
| Proje Durumu | 9 |
| Talep Türü | 6 |

---

## Mimari Yapı

```
ElektraTrack/
├── client/                  # React 18 + Vite Frontend
│   └── src/
│       ├── components/      # 65 bileşen (shared, layout, domain)
│       ├── pages/           # 17 sayfa
│       ├── hooks/           # 19 React Query hook kalıbı
│       ├── utils/           # Sabitler, biçimlendiriciler
│       └── api/             # Axios HTTP istemcisi
├── server/                  # Node.js + Express Backend
│   ├── routes/              # API rotaları
│   ├── services/            # AI ayrıştırma, iş servisleri
│   ├── middleware/          # Auth, RBAC, dosya yükleme
│   └── database/            # SQLite şema, seed, bağlantı
└── uploads/                 # Yüklenen dosyalar
```

**Geliştirme:**
- Frontend: `localhost:3000` (Vite dev server)
- Backend: `localhost:4000` (Express)
- Proxy: `/api` → `http://localhost:4000`
- Veritabanı: SQLite (otomatik başlatma)
