/**
 * DB ŞEMA BİLGİSİ
 *
 * AI'a sistem promptunda verilir, böylece doğru SQL üretebilir.
 * Tablo yapıları değiştiğinde burası güncellenmeli.
 */

const DB_SEMA = `
VERITABANI ŞEMASI (SQLite):

-- Projeler
projeler (id, proje_no, proje_tipi, musteri_adi, bolge_id, mahalle, adres, durum, oncelik, ekip_id, tahmini_sure_gun, baslama_tarihi, bitis_tarihi, teslim_tarihi, gerceklesen_bitis, tamamlanma_yuzdesi, notlar, olusturma_tarihi, guncelleme_tarihi)
-- proje_tipi: 'YB' (Yapı Bağlantı), 'KET' (Küçük Ek Tesis), 'Tesis'
-- durum: 'teslim_alindi', 'devam_eden', 'tamamlanan', 'iptal'
-- oncelik: 'dusuk', 'normal', 'yuksek', 'acil'

-- Proje Aşamaları
proje_asamalari (id, proje_id, sablon_asama_id, sira, asama_adi, asama_kodu, renk, ikon, durum, baslangic_tarihi, bitis_tarihi, tahmini_gun, notlar)
-- durum: 'bekliyor', 'aktif', 'tamamlandi', 'atlandi'

-- Bölgeler
bolgeler (id, bolge_adi, bolge_tipi, ust_bolge_id, aktif, sira)

-- Ekipler
ekipler (id, ekip_adi, ekip_kodu, ekip_basi_id, varsayilan_bolge_id, arac_plaka, durum, notlar)

-- Personel
personel (id, ad_soyad, telefon, telegram_id, gorev, ekip_id, aktif)

-- Malzemeler (Depo Stok)
malzemeler (id, malzeme_kodu, malzeme_adi, kategori, birim, stok_miktari, kritik_seviye, birim_fiyat, depo_konumu, notlar)

-- Malzeme Hareketleri
malzeme_hareketleri (id, malzeme_id, miktar, hareket_tipi, ekip_id, proje_id, teslim_alan, teslim_eden, kaynak, belge_no, notlar, tarih)
-- hareket_tipi: 'giris', 'cikis', 'iade'

-- Günlük Rapor / Puantaj
gunluk_rapor (id, tarih, ekip_id, proje_id, bolge_id, kisi_sayisi, calisan_listesi, baslama_saati, bitis_saati, yapilan_is, is_kategorisi, hava_durumu, notlar)

-- Talepler
talepler (id, talep_no, ekip_id, proje_id, talep_eden_id, talep_tipi, aciklama, oncelik, durum, cozum_aciklama, olusturma_tarihi, cozum_tarihi)
-- durum: 'beklemede', 'isleniyor', 'cozuldu', 'reddedildi'

-- Görevler
gorevler (id, gorev_basligi, aciklama, gorev_tipi, proje_id, ekip_id, atanan_personel_id, oncelik, durum, son_tarih, tamamlanma_tarihi)
-- durum: 'atandi', 'devam_ediyor', 'tamamlandi', 'iptal'

-- Kullanıcılar
kullanicilar (id, kullanici_adi, sifre_hash, ad_soyad, email, telefon, personel_id, ekip_id, durum)

-- Roller ve Yetkiler
roller (id, rol_adi, rol_kodu, aciklama, seviye)
kullanici_rolleri (kullanici_id, rol_id)
izinler (id, modul, aksiyon, aciklama)
rol_izinleri (rol_id, izin_id, veri_kapsami)

-- Dosyalar
dosyalar (id, dosya_adi, orijinal_adi, dosya_yolu, dosya_boyutu, mime_tipi, kategori, proje_id, ekip_id, yukleyen_id, baslik, notlar, etiketler, durum, olusturma_tarihi)
-- kategori: 'fotograf', 'cizim', 'belge', 'tablo', 'harita', 'arsiv', 'diger'

-- Veri Paketleri (Saha Raporları)
veri_paketleri (id, paket_no, paket_tipi, durum, personel_id, ekip_id, proje_id, bolge_id, latitude, longitude, adres_metni, foto_sayisi, notlar, ai_ozet, olusturma_tarihi)

-- Proje Dokümanları
proje_dokumanlari (id, proje_id, kategori, dosya_adi, orijinal_adi, dosya_yolu, dosya_tipi, aciklama, olusturma_tarihi)

-- Proje Notları
proje_notlari (id, proje_id, baslik, icerik, yazar, olusturma_tarihi)

-- Proje Keşifleri
proje_kesifler (id, proje_id, kesif_tarihi, kesif_yapan, bulgular, notlar, durum)

-- AI İşlemleri
ai_islemler (id, girdi_tipi, girdi_metin, parse_sonuc, aksiyon_plani, durum, kullanici_id, proje_id, olusturma_tarihi, provider_adi)

-- Direk Kayıtları (Saha)
direk_kayitlar (id, proje_id, direk_no, direk_tipi, konum_lat, konum_lon, malzeme_durum, topraklama_yapildi, topraklama_direnc, topraklama_tarihi, durum, tamamlanma_yuzdesi, son_islem_yapan_id, notlar)
-- malzeme_durum JSON: { "konsol": { "mevcut": 7, "proje": 9 }, "izolator_n95": { "mevcut": 4, "proje": 4 } }
-- durum: 'bekliyor', 'devam', 'tamamlandi', 'sorunlu'

-- Direk Fotoğrafları
direk_fotograflar (id, direk_kayit_id, dosya_id, foto_tipi, ai_analiz, notlar, ekleyen_id)
-- foto_tipi: 'genel', 'topraklama', 'izolator', 'konsol', 'ariza', 'oncesi', 'sonrasi'

-- Direk İşlem Geçmişi
direk_islem_gecmisi (id, direk_kayit_id, islem_tipi, eski_deger, yeni_deger, islem_yapan_id)

-- Saha Tespitleri
saha_tespitler (id, proje_id, direk_kayit_id, tespit_tipi, aciklama, konum_lat, konum_lon, oncelik, durum, raporlayan_id, atanan_ekip_id, cozum_tarihi, cozum_notu)
-- tespit_tipi: 'eksiklik', 'ariza', 'tehlike', 'genel', 'kesif'
-- oncelik: 'dusuk', 'normal', 'yuksek', 'acil'
-- durum: 'acik', 'devam', 'cozuldu', 'iptal'

-- Günlük İlerleme
gunluk_ilerleme (id, proje_id, tarih, ekip_id, tamamlanan_direk_sayisi, calisan_direk_ids, toplam_ilerleme_yuzde, ai_rapor)

ÖNEMLİ İLİŞKİLER:
- malzeme_hareketleri.malzeme_id → malzemeler.id
- malzeme_hareketleri.proje_id → projeler.id
- malzeme_hareketleri.ekip_id → ekipler.id
- proje_asamalari.proje_id → projeler.id
- veri_paketleri.proje_id → projeler.id
- dosyalar.proje_id → projeler.id
- ekipler.ekip_basi_id → personel.id
- personel.ekip_id → ekipler.id
- projeler.ekip_id → ekipler.id
- projeler.bolge_id → bolgeler.id
- direk_kayitlar.proje_id → projeler.id
- direk_fotograflar.direk_kayit_id → direk_kayitlar.id
- direk_fotograflar.dosya_id → dosyalar.id
- saha_tespitler.proje_id → projeler.id
- saha_tespitler.direk_kayit_id → direk_kayitlar.id
- gunluk_ilerleme.proje_id → projeler.id
`;

module.exports = DB_SEMA;
