UPDATE firma_ayarlari SET deger = 'Örnek Elektrik Müteahhitlik Ltd.' WHERE anahtar = 'firma_adi';
UPDATE firma_ayarlari SET deger = 'Samsun' WHERE anahtar = 'firma_il';
UPDATE firma_ayarlari SET deger = 'YEDAŞ' WHERE anahtar = 'dagitim_sirketi';

INSERT INTO bolgeler (bolge_adi, bolge_tipi, ust_bolge_id, sira) VALUES ('Samsun', 'il', NULL, 1);
INSERT INTO bolgeler (bolge_adi, bolge_tipi, ust_bolge_id, sira) VALUES ('Bafra', 'ilce', 1, 1), ('Alaçam', 'ilce', 1, 2), ('Yakakent', 'ilce', 1, 3), ('19 Mayıs', 'ilce', 1, 4);

INSERT OR IGNORE INTO personel (ad_soyad, telefon, gorev) VALUES
('Ahmet Yıldız', '0532-111-2233', 'ekip_basi'),
('Mehmet Kara', '0533-222-3344', 'usta'),
('Ali Demir', '0534-333-4455', 'teknisyen'),
('Hasan Çelik', '0535-444-5566', 'ekip_basi'),
('Osman Koç', '0536-555-6677', 'usta'),
('Veli Arslan', '0537-666-7788', 'teknisyen'),
('Emre Şahin', '0538-777-8899', 'ekip_basi'),
('Burak Aydın', '0539-888-9900', 'sofor'),
('Serkan Öz', '0530-999-0011', 'cirak'),
('Fatih Erdoğan', '0531-000-1122', 'usta');

INSERT INTO ekipler (ekip_adi, ekip_kodu, ekip_basi_id, varsayilan_bolge_id, arac_plaka, son_latitude, son_longitude, son_konum_zamani, son_konum_kaynagi) VALUES
('Ekip 1', 'EK-01', 1, 2, '55 ABC 101', 41.5667, 35.9000, datetime('now'), 'manuel'),
('Ekip 2', 'EK-02', 4, 3, '55 DEF 202', 41.2000, 36.4167, datetime('now'), 'manuel'),
('Ekip 3', 'EK-03', 7, 5, '55 GHI 303', 41.3500, 36.6333, datetime('now'), 'manuel');

UPDATE personel SET ekip_id = 1 WHERE id IN (1, 2, 3);
UPDATE personel SET ekip_id = 2 WHERE id IN (4, 5, 6, 8);
UPDATE personel SET ekip_id = 3 WHERE id IN (7, 9, 10);

INSERT INTO malzemeler (malzeme_kodu, malzeme_adi, kategori, birim, stok_miktari, kritik_seviye) VALUES
('KBL-3x150', '3x150mm² XLPE Kablo', 'kablo', 'metre', 2500, 500),
('KBL-3x70', '3x70mm² XLPE Kablo', 'kablo', 'metre', 1800, 300),
('KBL-3x35', '3x35mm² NYY Kablo', 'kablo', 'metre', 3200, 400),
('DIR-BET-9', '9m Beton Direk', 'direk', 'adet', 45, 10),
('DIR-BET-12', '12m Beton Direk', 'direk', 'adet', 20, 5),
('KLM-50', '50mm² Klemens', 'klemens', 'adet', 320, 50),
('KLM-95', '95mm² Klemens', 'klemens', 'adet', 180, 30),
('PNO-DAG', 'Dağıtım Panosu', 'pano', 'adet', 12, 3),
('TRF-100', '100 kVA Trafo', 'trafo', 'adet', 3, 1),
('SIG-35', '35mm² Sigorta', 'diger', 'adet', 500, 100),
('IZL-BANT', 'İzole Bant (Top)', 'diger', 'top', 150, 30),
('CIV-M12', 'M12 Civata Takımı', 'diger', 'takım', 200, 40);

INSERT INTO projeler (proje_no, proje_tipi, musteri_adi, bolge_id, mahalle, durum, oncelik, ekip_id, tamamlanma_yuzdesi) VALUES
('YB-2025-001', 'YB', 'OSB Müdürlüğü', 2, 'Sanayi Mah.', 'sahada', 'yuksek', 1, 60),
('YB-2025-002', 'YB', 'Belediye Başkanlığı', 3, 'Merkez', 'malzeme_bekliyor', 'normal', NULL, 20),
('KET-2025-010', 'KET', 'Tarım Kooperatifi', 4, 'Çarşı Mah.', 'programda', 'normal', 2, 10),
('YB-2025-003', 'YB', 'Üniversite Rektörlüğü', 5, 'Kampüs', 'tasarimda', 'yuksek', NULL, 5),
('KET-2025-011', 'KET', 'Devlet Hastanesi', 2, 'Hastane Cad.', 'sahada', 'acil', 1, 45),
('KET-2025-012', 'KET', 'İlkokul Müdürlüğü', 3, 'Okul Sok.', 'tamamlandi', 'normal', 2, 100),
('TES-2025-001', 'Tesis', 'Balıkçı Barınağı', 4, 'Liman', 'onay_bekliyor', 'dusuk', NULL, 15),
('KET-2025-013', 'KET', 'AVM Yönetimi', 2, 'Atatürk Blv.', 'askida', 'normal', NULL, 30),
('TES-2025-002', 'Tesis', 'Sanayi Sitesi', 2, 'Sanayi Mah.', 'sahada', 'yuksek', 3, 35);

-- VERİ PAKETLERİ (test verisi - GPS koordinatlı)
INSERT INTO veri_paketleri (paket_tipi, durum, personel_id, ekip_id, proje_id, bolge_id, latitude, longitude, adres_metni, foto_sayisi, notlar, olusturma_tarihi) VALUES
('direk_montaj', 'tamamlandi', 1, 1, 1, 2, 41.5680, 35.9020, 'Bafra Sanayi Mah. Direk No:12', 4, 'YB-2025-001 direk montaj çalışması', datetime('now', '-2 hours')),
('kablo_cekimi', 'tamamlandi', 2, 1, 5, 2, 41.5650, 35.8970, 'Bafra Hastane Cad. Hat güzergahı', 6, 'KET-2025-011 kablo çekimi tamamlandı', datetime('now', '-5 hours')),
('ariza_tespit', 'tamamlandi', 4, 2, 3, 3, 41.2050, 36.4200, 'Alaçam Çarşı Mah. arızalı direk', 3, 'Kopan kol tespiti yapıldı', datetime('now', '-1 day')),
('direk_montaj', 'tamamlandi', 5, 2, 3, 3, 41.1980, 36.4150, 'Alaçam merkez direk değişimi', 5, 'Eski beton direk sökülüp yenisi kondu', datetime('now', '-1 day', '+3 hours')),
('tesis_kontrol', 'tamamlandi', 7, 3, 9, 2, 41.3520, 36.6350, '19 Mayıs Sanayi Sitesi trafo kontrolü', 8, 'Trafo ve pano kontrolü yapıldı', datetime('now', '-3 hours')),
('hat_kontrol', 'tamamlandi', 7, 3, 9, 2, 41.3480, 36.6300, '19 Mayıs Sanayi Sitesi hat güzergahı', 3, 'Havai hat kontrol görüntüleri', datetime('now', '-6 hours')),
('diger', 'devam_ediyor', 1, 1, 1, 2, 41.5700, 35.9050, 'Bafra Sanayi Mah. devam eden çalışma', 2, 'Devam eden montaj', datetime('now', '-30 minutes')),
('ariza_tespit', 'tamamlandi', 10, 3, NULL, 4, 41.3600, 36.6400, 'Yakakent sahil bölgesi arıza tespiti', 4, 'Fırtına sonrası hasar tespiti', datetime('now', '-2 days'));

-- ═══════════════════════════════════════════════════
-- İZİN TANIMLARI
-- ═══════════════════════════════════════════════════

-- Proje Yönetimi
INSERT OR IGNORE INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('projeler', 'okuma',    'Projeler', 'Okuma',    'Proje listesi ve detay görüntüleme'),
  ('projeler', 'yazma',    'Projeler', 'Yazma',    'Proje oluşturma ve düzenleme'),
  ('projeler', 'silme',    'Projeler', 'Silme',    'Proje silme'),
  ('projeler', 'onaylama', 'Projeler', 'Onaylama', 'Proje durumu onaylama');

-- Döngü / Yaşam Döngüsü
INSERT OR IGNORE INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('dongu', 'okuma',    'Yaşam Döngüsü', 'Okuma',    'Proje aşamalarını görüntüleme'),
  ('dongu', 'yazma',    'Yaşam Döngüsü', 'Yazma',    'Aşama başlatma/tamamlama/tarih güncelleme'),
  ('dongu', 'sablon',   'Yaşam Döngüsü', 'Şablon Yönetimi', 'Döngü şablonu oluşturma/düzenleme');

-- Ekipler
INSERT OR IGNORE INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('ekipler', 'okuma',  'Ekipler', 'Okuma',  'Ekip listesi ve detay görüntüleme'),
  ('ekipler', 'yazma',  'Ekipler', 'Yazma',  'Ekip oluşturma ve düzenleme'),
  ('ekipler', 'silme',  'Ekipler', 'Silme',  'Ekip silme');

-- Personel
INSERT OR IGNORE INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('personel', 'okuma',  'Personel', 'Okuma',  'Personel listesi ve detay görüntüleme'),
  ('personel', 'yazma',  'Personel', 'Yazma',  'Personel ekleme ve düzenleme'),
  ('personel', 'silme',  'Personel', 'Silme',  'Personel silme/pasifleştirme');

-- Veri Paketleri
INSERT OR IGNORE INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('veri_paketi', 'okuma',    'Veri Paketleri', 'Okuma',    'Veri paketi listeleme/detay'),
  ('veri_paketi', 'yazma',    'Veri Paketleri', 'Yazma',    'Veri paketi oluşturma ve dosya ekleme'),
  ('veri_paketi', 'silme',    'Veri Paketleri', 'Silme',    'Veri paketi silme'),
  ('veri_paketi', 'onaylama', 'Veri Paketleri', 'Onaylama', 'Veri paketi onaylama/reddetme');

-- Dosyalar
INSERT OR IGNORE INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('dosyalar', 'okuma',    'Dosyalar', 'Okuma',    'Dosya listeleme, indirme, önizleme'),
  ('dosyalar', 'yazma',    'Dosyalar', 'Yazma',    'Dosya yükleme ve metadata düzenleme'),
  ('dosyalar', 'silme',    'Dosyalar', 'Silme',    'Dosya silme');

-- Saha Harita
INSERT OR IGNORE INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('saha_harita', 'okuma',  'Saha Harita', 'Okuma',  'Haritayı görüntüleme'),
  ('saha_harita', 'yazma',  'Saha Harita', 'Yazma',  'Konum güncelleme, marker düzenleme');

-- Saha Mesaj
INSERT OR IGNORE INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('saha_mesaj', 'okuma',    'Saha Mesaj', 'Okuma',    'Mesaj geçmişini görüntüleme'),
  ('saha_mesaj', 'yazma',    'Saha Mesaj', 'Yazma',    'Mesaj gönderme'),
  ('saha_mesaj', 'onaylama', 'Saha Mesaj', 'Onaylama', 'Parse sonuçlarını onaylama/düzeltme');

-- Malzeme / Depo
INSERT OR IGNORE INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('malzeme', 'okuma',    'Malzeme/Depo', 'Okuma',    'Stok ve malzeme listesi görüntüleme'),
  ('malzeme', 'yazma',    'Malzeme/Depo', 'Yazma',    'Stok giriş/çıkış, malzeme tanımlama'),
  ('malzeme', 'silme',    'Malzeme/Depo', 'Silme',    'Malzeme silme'),
  ('malzeme', 'talep',    'Malzeme/Depo', 'Talep',    'Malzeme talep oluşturma'),
  ('malzeme', 'onaylama', 'Malzeme/Depo', 'Onaylama', 'Malzeme talep onaylama');

-- Finansal
INSERT OR IGNORE INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('finansal', 'okuma',  'Finansal', 'Okuma',  'Hak ediş, maliyet, fatura görüntüleme'),
  ('finansal', 'yazma',  'Finansal', 'Yazma',  'Hak ediş/maliyet/fatura oluşturma/düzenleme'),
  ('finansal', 'silme',  'Finansal', 'Silme',  'Finansal kayıt silme'),
  ('finansal', 'onaylama','Finansal', 'Onaylama','Hak ediş onaylama');

-- İSG
INSERT OR IGNORE INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('isg', 'okuma',  'İSG', 'Okuma',  'İSG denetim ve kontrol listesi görüntüleme'),
  ('isg', 'yazma',  'İSG', 'Yazma',  'Denetim oluşturma, kontrol listesi doldurma'),
  ('isg', 'silme',  'İSG', 'Silme',  'İSG kayıt silme'),
  ('isg', 'rapor',  'İSG', 'Raporlama', 'İSG raporu oluşturma');

-- Raporlar
INSERT OR IGNORE INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('raporlar', 'genel',    'Raporlar', 'Genel',    'Genel raporları görüntüleme'),
  ('raporlar', 'mali',     'Raporlar', 'Mali',     'Mali raporları görüntüleme'),
  ('raporlar', 'isg',      'Raporlar', 'İSG',      'İSG raporlarını görüntüleme'),
  ('raporlar', 'depo',     'Raporlar', 'Depo',     'Depo/malzeme raporlarını görüntüleme');

-- Ayarlar
INSERT OR IGNORE INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('ayarlar', 'genel',      'Ayarlar', 'Genel',      'Genel ayarlar (firma bilgileri)'),
  ('ayarlar', 'ai',         'Ayarlar', 'AI Ayarları', 'AI ayarları'),
  ('ayarlar', 'dongu',      'Ayarlar', 'Döngü Şablon','Döngü şablon yönetimi'),
  ('ayarlar', 'roller',     'Ayarlar', 'Rol Yönetimi','Rol oluşturma ve izin atama'),
  ('ayarlar', 'kullanicilar','Ayarlar', 'Kullanıcılar','Kullanıcı oluşturma ve rol atama');

-- ═══════════════════════════════════════════════════
-- VARSAYILAN DEPARTMANLAR
-- ═══════════════════════════════════════════════════
INSERT OR IGNORE INTO departmanlar (departman_adi, departman_kodu, aciklama, renk, sira) VALUES
  ('İdari',             'idari',            'Yönetim, muhasebe, satın alma',              '#dc2626', 1),
  ('Saha-Operasyon',    'saha_operasyon',   'Ekipler, işçiler',                           '#2563eb', 2),
  ('Lojistik-Destek',   'lojistik_destek',  'Aşçı, temizlikçi, şoför',                   '#f59e0b', 3),
  ('Teknik-Ofis',       'teknik_ofis',      'Mühendisler, teknikerler, uzmanlar',         '#10b981', 4);

INSERT OR IGNORE INTO departman_birimleri (departman_id, birim_adi, birim_kodu, sira) VALUES
  ((SELECT id FROM departmanlar WHERE departman_kodu='idari'), 'Genel Müdür',      'genel_mudur',    1),
  ((SELECT id FROM departmanlar WHERE departman_kodu='idari'), 'Koordinatör',      'koordinator',    2),
  ((SELECT id FROM departmanlar WHERE departman_kodu='idari'), 'Muhasebe',         'muhasebe',       3),
  ((SELECT id FROM departmanlar WHERE departman_kodu='idari'), 'Satın Alma',       'satin_alma',     4),
  ((SELECT id FROM departmanlar WHERE departman_kodu='saha_operasyon'), 'Ekipler',  'ekipler',       1),
  ((SELECT id FROM departmanlar WHERE departman_kodu='saha_operasyon'), 'İşçiler',  'isciler',       2),
  ((SELECT id FROM departmanlar WHERE departman_kodu='lojistik_destek'), 'Aşçı',     'asci',         1),
  ((SELECT id FROM departmanlar WHERE departman_kodu='lojistik_destek'), 'Temizlikçi','temizlikci',   2),
  ((SELECT id FROM departmanlar WHERE departman_kodu='lojistik_destek'), 'Şoför',    'sofor',        3),
  ((SELECT id FROM departmanlar WHERE departman_kodu='teknik_ofis'), 'Mühendisler',  'muhendisler',   1),
  ((SELECT id FROM departmanlar WHERE departman_kodu='teknik_ofis'), 'Teknikerler',  'teknikerler',   2),
  ((SELECT id FROM departmanlar WHERE departman_kodu='teknik_ofis'), 'Uzmanlar',     'uzmanlar',      3);

-- ═══════════════════════════════════════════════════
-- VARSAYILAN ROLLER (departman bazlı)
-- ═══════════════════════════════════════════════════
INSERT OR IGNORE INTO roller (rol_adi, rol_kodu, aciklama, renk, ikon, seviye, sistem_rolu, departman_id) VALUES
  ('Genel Müdür',       'genel_mudur',       'Tüm yetkilere sahip, firma sahibi',       '#dc2626', '', 100, 1, (SELECT id FROM departmanlar WHERE departman_kodu='idari')),
  ('Koordinatör',       'koordinator',       'Günlük operasyon yönetimi',                '#2563eb', '', 90,  1, (SELECT id FROM departmanlar WHERE departman_kodu='idari')),
  ('Sistem Yöneticisi', 'sistem_yoneticisi', 'Sistem yönetimi, teknik altyapı',         '#f59e0b', '', 80,  1, NULL),
  ('Muhasebeci',        'muhasebeci',        'Hak ediş, maliyet ve finansal işlemler',   '#84cc16', '', 50,  1, (SELECT id FROM departmanlar WHERE departman_kodu='idari')),
  ('Satın Alma',        'satin_alma',        'Malzeme tedariki ve sipariş yönetimi',     '#0ea5e9', '', 50,  0, (SELECT id FROM departmanlar WHERE departman_kodu='idari')),
  ('Saha Mühendisi',    'saha_muhendis',     'Sahada teknik kontrol ve denetim',         '#10b981', '', 70,  1, (SELECT id FROM departmanlar WHERE departman_kodu='saha_operasyon')),
  ('Ekip Başı',         'ekip_basi',         'Saha ekip yönetimi',                       '#8b5cf6', '', 60,  1, (SELECT id FROM departmanlar WHERE departman_kodu='saha_operasyon')),
  ('İşçi',              'isci',              'Saha işçisi',                               '#6b7280', '', 30,  0, (SELECT id FROM departmanlar WHERE departman_kodu='saha_operasyon')),
  ('Operatör',          'operator',          'Araç ve makine operatörü',                  '#14b8a6', '', 40,  0, (SELECT id FROM departmanlar WHERE departman_kodu='saha_operasyon')),
  ('Aşçı',              'asci',              'Yemek hizmetleri',                          '#f59e0b', '', 20,  0, (SELECT id FROM departmanlar WHERE departman_kodu='lojistik_destek')),
  ('Temizlikçi',        'temizlikci',        'Temizlik hizmetleri',                       '#f59e0b', '', 20,  0, (SELECT id FROM departmanlar WHERE departman_kodu='lojistik_destek')),
  ('Şoför',             'sofor',             'Araç kullanma, nakliye',                    '#f59e0b', '', 30,  0, (SELECT id FROM departmanlar WHERE departman_kodu='lojistik_destek')),
  ('Mühendis',          'muhendis',          'Proje tasarımı ve teknik işler',            '#10b981', '', 70,  1, (SELECT id FROM departmanlar WHERE departman_kodu='teknik_ofis')),
  ('Tekniker',          'tekniker',          'Teknik destek, ölçüm, denetim',             '#10b981', '', 55,  0, (SELECT id FROM departmanlar WHERE departman_kodu='teknik_ofis')),
  ('İSG Uzmanı',        'isg_uzmani',        'İş sağlığı ve güvenliği denetimi',         '#f43f5e', '', 50,  1, (SELECT id FROM departmanlar WHERE departman_kodu='teknik_ofis')),
  ('Depocu',            'depocu',            'Malzeme ve stok yönetimi',                  '#0ea5e9', '', 50,  1, (SELECT id FROM departmanlar WHERE departman_kodu='lojistik_destek'));

-- ─── DÖNGÜ ŞABLONLARI ────────────────────────────────
INSERT INTO dongu_sablonlari (sablon_adi, sablon_kodu, aciklama, varsayilan)
VALUES ('KET Döngüsü', 'KET', 'Küçük Ek Tesis projeleri yaşam döngüsü', 1);

INSERT INTO dongu_sablon_asamalari (sablon_id, sira, asama_adi, asama_kodu, renk, ikon, tahmini_gun) VALUES
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='KET'), 1, 'Yer Teslimi',              'yer_teslimi',       '#6366f1', '📍', 5),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='KET'), 2, 'Proje Aşaması',            'proje',             '#8b5cf6', '📐', 15),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='KET'), 3, 'Malzeme Talep',             'malzeme_talep',     '#0ea5e9', '📦', 10),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='KET'), 4, 'Yapım',                     'yapim',             '#f59e0b', '🔧', 30),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='KET'), 5, 'CBS',                       'cbs',               '#10b981', '🗺️', 5),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='KET'), 6, 'Hak Ediş',                  'hak_edis',          '#3b82f6', '💰', 10),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='KET'), 7, 'Geçici Kabul',              'gecici_kabul',      '#14b8a6', '✅', 15),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='KET'), 8, 'Geçici Kabul Eksikleri',    'gk_eksikleri',      '#f43f5e', '🔴', 20);

INSERT INTO dongu_sablonlari (sablon_adi, sablon_kodu, aciklama, varsayilan)
VALUES ('YB Döngüsü', 'YB', 'Yeni Bağlantı / Yapı Bağlantı projeleri yaşam döngüsü', 1);

INSERT INTO dongu_sablon_asamalari (sablon_id, sira, asama_adi, asama_kodu, renk, ikon, tahmini_gun) VALUES
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='YB'), 1, 'Yer Teslimi',          'yer_teslimi',     '#6366f1', '📍', 3),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='YB'), 2, 'Proje',                'proje',           '#8b5cf6', '📐', 10),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='YB'), 3, 'Malzeme Temin',        'malzeme_temin',   '#0ea5e9', '📦', 7),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='YB'), 4, 'Yapım',                'yapim',           '#f59e0b', '🔧', 15),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='YB'), 5, 'CBS Kayıt',            'cbs',             '#10b981', '🗺️', 3),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='YB'), 6, 'Geçici Kabul',         'gecici_kabul',    '#14b8a6', '✅', 10);

-- ═══════════════════════════════════════════════════
-- POZİSYON TANIMLARI
-- ═══════════════════════════════════════════════════
INSERT OR IGNORE INTO pozisyonlar (kod, ad, seviye, kategori, aciklama, varsayilan_sistem_rolu) VALUES
('firma_sahibi',    'Firma Sahibi / Genel Müdür',  1, 'yonetim',      'Firma sahibi veya genel müdür. Tüm yetkilere sahip.', 'koordinator'),
('teknik_mudur',    'Teknik Müdür',                 1, 'yonetim',      'Tüm teknik operasyonların sorumlusu.', 'koordinator'),
('idari_mudur',     'İdari / Mali Müdür',           1, 'yonetim',      'Muhasebe, finans, insan kaynakları ve idari işler.', 'koordinator'),
('koordinator',     'Bölge Koordinatörü',           2, 'koordinasyon', 'Birden fazla ilçe/bölgedeki projeleri koordine eder.', 'koordinator'),
('isg_uzmani',      'İSG Uzmanı',                   2, 'koordinasyon', 'Tüm sahalarda iş sağlığı ve güvenliği denetimi.', 'muhendis'),
('satin_alma',      'Satınalma Sorumlusu',           2, 'koordinasyon', 'Malzeme tedariki, fiyat araştırması, sipariş yönetimi.', 'depocu'),
('saha_muhendisi',  'Saha Mühendisi',               3, 'teknik',       'Projelerin sahada teknik takibi. Ekip yönetimi.', 'muhendis'),
('proje_muhendisi', 'Proje Mühendisi',              3, 'teknik',       'Proje tasarımı, DXF çizim, metraj hesabı.', 'muhendis'),
('buro_muhendisi',  'Büro Mühendisi',               3, 'teknik',       'Hakediş hazırlama, evrak takibi, arşiv yönetimi.', 'muhendis'),
('tekniker',        'Tekniker',                      3, 'teknik',       'Teknik destek, ölçüm, denetim yardımı.', 'tekniker'),
('ekip_basi',       'Ekip Başı',                     4, 'saha',         'Bir saha ekibinin şefi. Günlük iş dağılımı.', 'ekip'),
('usta',            'Usta',                          4, 'saha',         'Uzman işçi — kablo çekme, direk dikme, trafo montajı.', 'ekip'),
('operator',        'Şoför / Araç Operatörü',        4, 'saha',         'Araç kullanma, sepetli/vinç operasyonu.', 'ekip'),
('isci',            'İşçi',                          4, 'saha',         'Genel saha işçisi.', 'ekip'),
('depocu',          'Depocu',                        5, 'destek',       'Malzeme deposu yönetimi. Giriş/çıkış/stok takibi.', 'depocu'),
('buro_personeli',  'Büro Personeli',                5, 'destek',       'Genel büro işleri, telefon, arşiv.', 'izleyici'),
('guvenlik',        'Güvenlik',                      5, 'destek',       'Depo/şantiye güvenliği.', 'izleyici');

-- ═══════════════════════════════════════════════════
-- GÖREV TANIMLARI — Proje Bazlı
-- ═══════════════════════════════════════════════════
INSERT OR IGNORE INTO gorev_tanimlari (kod, ad, kategori, aciklama, sorumluluklar, gerekli_belgeler, gerekli_pozisyonlar, min_seviye, max_ayni_anda, zorunlu_proje) VALUES
('santiye_sefi', 'Şantiye Şefi', 'proje_bazli',
 'Sahada günlük yönetimden sorumlu kişi.',
 '["Günlük iş dağılımı","İSG tedbirlerinin uygulanması","Ekip performans takibi","Günlük ilerleme raporu","Malzeme ihtiyaç bildirimi"]',
 '["ETIP"]', '["saha_muhendisi","tekniker","ekip_basi"]', 3, 1, 1),

('proje_sorumlusu', 'Proje Sorumlusu', 'proje_bazli',
 'Projenin başından sonuna kadar tüm sürecin sahibi.',
 '["Proje planlaması","Kaynak planlaması","İlerleme takibi","Sorun çözümü","Kurum koordinasyonu"]',
 '["ETIP"]', '["koordinator","saha_muhendisi"]', 2, 1, 1),

('proje_tasarimci', 'Proje Tasarımcısı', 'proje_bazli',
 'Projenin teknik çizimlerini hazırlar.',
 '["DXF proje çizimi","Metraj hesabı","Malzeme listesi çıkarma","Teknik şartname kontrolü"]',
 '["ETIP"]', '["proje_muhendisi","saha_muhendisi"]', 3, 0, 1),

('kesif_sorumlusu', 'Keşif Sorumlusu', 'proje_bazli',
 'Yer teslimi ve keşif aşamasında sahayı inceler.',
 '["Saha incelemesi","Yer teslim tutanağı hazırlama","Mevcut hat durumu tespiti","Keşif raporu"]',
 NULL, '["koordinator","saha_muhendisi","tekniker"]', 2, 0, 1),

('kabul_sorumlusu', 'Kabul Sorumlusu', 'proje_bazli',
 'Geçici ve kesin kabul süreçlerini yönetir.',
 '["Kabul dosyası hazırlama","Test ve ölçümler","Eksiklik listesi takibi","YEDAŞ koordinasyonu"]',
 '["ETIP"]', '["saha_muhendisi","buro_muhendisi"]', 3, 1, 1),

('hakedis_hazirlayici', 'Hakediş Hazırlayıcısı', 'proje_bazli',
 'Proje hakediş dosyasını hazırlar.',
 '["Metraj hesabı","Hakediş dosyası düzenleme","Birim fiyat kontrolü","İmalat kaydı"]',
 NULL, '["buro_muhendisi","proje_muhendisi","saha_muhendisi"]', 3, 0, 1),

('topraklama_sorumlu', 'Topraklama Sorumlusu', 'proje_bazli',
 'Direk ve tesis topraklama ölçümlerini yapar.',
 '["Topraklama direnci ölçümü","Ölçüm kayıtları","Standart dışı değerlerin raporlanması"]',
 NULL, '["saha_muhendisi","tekniker","ekip_basi"]', 3, 0, 1),

('kalite_kontrol', 'Kalite Kontrol', 'proje_bazli',
 'İşçilik ve malzeme kalitesini denetler.',
 '["İşçilik kalite denetimi","Malzeme uygunluk kontrolü","Uygunsuzluk raporu"]',
 NULL, '["saha_muhendisi","tekniker"]', 3, 0, 1),

('malzeme_takip', 'Malzeme Takip', 'proje_bazli',
 'Projeye özel malzeme ihtiyacı ve sarf takibi.',
 '["Malzeme ihtiyaç listesi","Sevkiyat koordinasyonu","Sarf takibi","Fazla/eksik raporu"]',
 NULL, '["saha_muhendisi","tekniker","ekip_basi","depocu"]', 3, 0, 1),

('taseron_koordinator', 'Taşeron Koordinatör', 'proje_bazli',
 'Alt yüklenici/taşeron ekiplerin projede koordinasyonu.',
 '["Taşeron iş dağılımı","İş teslim kontrolü","İSG uyumluluk takibi"]',
 NULL, '["koordinator","saha_muhendisi"]', 2, 0, 1);

-- ═══════════════════════════════════════════════════
-- GÖREV TANIMLARI — Firma Geneli
-- ═══════════════════════════════════════════════════
INSERT OR IGNORE INTO gorev_tanimlari (kod, ad, kategori, aciklama, sorumluluklar, gerekli_belgeler, gerekli_pozisyonlar, min_seviye, max_ayni_anda, zorunlu_proje) VALUES
('isg_sorumlusu', 'İSG Sorumlusu', 'firma_geneli',
 'Tüm sahalarda iş sağlığı ve güvenliği denetimi.',
 '["Risk değerlendirmesi","İSG eğitim planlaması","Kaza raporları","KKD takibi"]',
 '["ISG_B","ISG_C"]', '["isg_uzmani","koordinator","saha_muhendisi"]', 2, 0, 0),

('periyodik_kontrol', 'Periyodik Kontrol Uzmanı', 'firma_geneli',
 'Elektrik tesislerinin periyodik kontrollerini yapar.',
 '["Topraklama kontrolü","Trafo kontrolü","Kontrol raporu düzenleme"]',
 '["ETIP","PERIYODIK_KONTROL"]', '["saha_muhendisi","tekniker"]', 3, 0, 0),

('depo_yoneticisi', 'Depo Yöneticisi', 'firma_geneli',
 'Tüm malzeme depolarının yönetimi.',
 '["Stok sayımı","Giriş/çıkış kayıtları","Minimum stok uyarıları","Yıllık envanter"]',
 NULL, '["depocu","satin_alma"]', 4, 0, 0),

('arac_sorumlusu', 'Araç Sorumlusu', 'firma_geneli',
 'Firma araçlarının bakım, muayene ve kullanım takibi.',
 '["Araç bakım takvimi","Muayene hatırlatmaları","Yakıt takibi","Sigorta takibi"]',
 NULL, '["operator","buro_personeli"]', 4, 0, 0),

('egitim_sorumlusu', 'Eğitim Sorumlusu', 'firma_geneli',
 'Personel eğitim ihtiyaçlarının belirlenmesi ve takibi.',
 '["Eğitim ihtiyaç analizi","Eğitim takvimi","Sertifika yenileme uyarıları"]',
 NULL, '["koordinator","isg_uzmani"]', 2, 0, 0),

('arsiv_sorumlusu', 'Arşiv Sorumlusu', 'firma_geneli',
 'Fiziksel ve dijital arşiv yönetimi.',
 '["Dosya sınıflandırma","Dijital arşiv bakımı","Saklama süresi takibi"]',
 NULL, '["buro_muhendisi","buro_personeli"]', 3, 0, 0),

('kurum_irtibat', 'Kurum İrtibat', 'firma_geneli',
 'YEDAŞ/TEDAŞ ve diğer kurumlarla resmi iletişim.',
 '["Proje onay başvuruları","Kabul randevu takibi","Resmi yazışmalar"]',
 NULL, '["koordinator","buro_muhendisi"]', 2, 0, 0),

('bilgi_islem', 'Bilgi İşlem Sorumlusu', 'firma_geneli',
 'ElektraTrack ve diğer yazılım/donanım sistemlerinin bakımı.',
 '["Sistem yedekleme","Kullanıcı hesap yönetimi","Donanım bakımı"]',
 NULL, '["koordinator","tekniker"]', 2, 0, 0);

-- ═══════════════════════════════════════════════════
-- GÖREV TANIMLARI — Geçici / Dönemsel
-- ═══════════════════════════════════════════════════
INSERT OR IGNORE INTO gorev_tanimlari (kod, ad, kategori, aciklama, sorumluluklar, gerekli_belgeler, gerekli_pozisyonlar, min_seviye, max_ayni_anda, zorunlu_proje) VALUES
('nobetci', 'Nöbetçi', 'gecici',
 'Hafta sonu / gece arıza müdahale nöbeti.',
 '["Arıza çağrılarına cevap","Acil müdahale koordinasyonu","Nöbet raporu"]',
 NULL, '["saha_muhendisi","tekniker","ekip_basi"]', 3, 0, 0),

('ihale_hazirlama', 'İhale Dosya Hazırlama', 'gecici',
 'Belirli bir ihale için teklif dosyası hazırlama.',
 '["İhale şartnamesi inceleme","Maliyet hesabı","Teklif dosyası düzenleme"]',
 NULL, '["koordinator","buro_muhendisi","proje_muhendisi"]', 2, 0, 0),

('denetim_eslik', 'Denetim Eşlikçi', 'gecici',
 'YEDAŞ veya resmi kurum denetiminde firmayı temsil eder.',
 '["Denetçilere eşlik","İstenen belgelerin sunumu","Saha gösterimi"]',
 '["ETIP"]', '["koordinator","saha_muhendisi"]', 2, 0, 0),

('envanter_sayim', 'Envanter Sayım Sorumlusu', 'gecici',
 'Dönemsel envanter sayımı.',
 '["Fiziksel sayım","Sistem ile karşılaştırma","Fark raporu"]',
 NULL, '["depocu","buro_personeli","tekniker"]', 4, 0, 0),

('ozel_gorev', 'Özel Görev', 'gecici',
 'Önceden tanımlanmamış, açıklama ile belirtilen görev.',
 NULL, NULL, NULL, 5, 0, 0);

-- ═══════════════════════════════════════════════════
-- BELGE TÜRLERİ
-- ═══════════════════════════════════════════════════
INSERT OR IGNORE INTO belge_turleri (kod, ad, kategori, yenileme_suresi_ay, zorunlu, aciklama) VALUES
('ETIP',               'ETİP Belgesi',                    'mesleki',  36,   0, 'Elektrik Tesislerinde İşletme ve Proje belgesi'),
('EKAT',               'EKAT Belgesi',                    'mesleki',  60,   0, 'Elektrikle ilgili fen adamları çalışma belgesi'),
('ISG_A',              'İSG-A Sertifikası',               'isg',      NULL, 0, 'A sınıfı iş güvenliği uzmanlığı'),
('ISG_B',              'İSG-B Sertifikası',               'isg',      NULL, 0, 'B sınıfı iş güvenliği uzmanlığı'),
('ISG_C',              'İSG-C Sertifikası',               'isg',      NULL, 0, 'C sınıfı iş güvenliği uzmanlığı'),
('PERIYODIK_KONTROL',  'Periyodik Kontrol Belgesi',       'mesleki',  NULL, 0, 'Periyodik kontrol uzmanı yetki belgesi'),
('MESLEKI_YETERLILIK', 'MYK Belgesi',                     'mesleki',  60,   0, 'Mesleki Yeterlilik Kurumu belgesi'),
('ILKYARDIM',          'İlk Yardım Sertifikası',          'isg',      36,   0, 'Temel ilk yardım eğitimi sertifikası'),
('EHLIYET_B',          'B Sınıfı Ehliyet',                'ehliyet',  120,  0, 'Binek araç ehliyeti'),
('EHLIYET_C',          'C Sınıfı Ehliyet',                'ehliyet',  60,   0, 'Ticari araç ehliyeti'),
('SRC',                'SRC Belgesi',                      'ehliyet',  60,   0, 'Mesleki yeterlilik belgesi (sürücü)'),
('FORKLIFT',           'Forklift Operatör Belgesi',        'ehliyet',  60,   0, 'Forklift kullanım belgesi'),
('SEPETLI',            'Sepetli Araç Operatör Belgesi',    'ehliyet',  36,   0, 'Sepetli araç kullanım belgesi'),
('YUKSEKTE_CALISMA',   'Yüksekte Çalışma Eğitimi',        'isg',      12,   0, 'Yüksekte çalışma güvenliği eğitimi'),
('ENERJI_ALTINDA',     'Enerji Altında Çalışma Eğitimi',   'isg',      12,   0, 'Enerji altında çalışma güvenliği eğitimi'),
('ISG_TEMEL',          'İSG Temel Eğitimi (16 saat)',      'isg',      12,   1, 'Tüm çalışanlar için zorunlu İSG eğitimi'),
('SGK',                'SGK İşe Giriş Bildirgesi',         'diger',    NULL, 1, 'SGK işe giriş bildirimi'),
('SAGLIK_RAPORU',      'Sağlık Raporu',                    'diger',    12,   1, 'İşe giriş ve periyodik sağlık raporu'),
('DIPLOMA',            'Diploma / Mezuniyet Belgesi',      'diger',    NULL, 0, 'En son mezuniyet belgesi');

-- ═══════════════════════════════════════════════════
-- YETKİNLİK TANIMLARI
-- ═══════════════════════════════════════════════════
INSERT OR IGNORE INTO yetkinlik_tanimlari (kod, ad, kategori, aciklama) VALUES
('ag_montaj',        'AG Hat Montajı',                 'teknik',   'Alçak gerilim hat çekimi ve montaj'),
('og_montaj',        'OG Hat Montajı',                 'teknik',   'Orta gerilim hat çekimi ve montaj'),
('trafo_montaj',     'Trafo Montajı',                  'teknik',   'Dağıtım trafosu montaj ve bağlantı'),
('direk_dikme',      'Direk Dikme',                    'teknik',   'Beton/ahşap/çelik direk dikimi'),
('kablo_eki',        'Kablo Eki ve Başlığı',           'teknik',   'OG/AG kablo eki ve başlık yapımı'),
('topraklama',       'Topraklama Tesisatı',            'teknik',   'Topraklama montajı ve ölçümü'),
('sayac_montaj',     'Sayaç Montajı',                  'teknik',   'Elektrik sayacı montaj ve programlama'),
('pano_montaj',      'Pano Montajı',                   'teknik',   'AG/OG pano montajı ve kablajı'),
('aydinlatma',       'Aydınlatma Sistemi',             'teknik',   'Sokak ve tesis aydınlatma montajı'),
('jenerator',        'Jeneratör Bakım/Montaj',         'teknik',   'Jeneratör montajı, bakımı, test'),
('olcum_alet',       'Ölçüm Aletleri Kullanımı',      'teknik',   'Topraklama ölçer, izolasyon ölçer vb.'),
('autocad',          'AutoCAD / DXF',                   'yazilim',  'Proje çizimi ve okuma'),
('metraj',           'Metraj Hesabı',                   'idari',    'İmalat miktarı hesaplama'),
('hakedis',          'Hakediş Hazırlama',               'idari',    'Hakediş dosyası düzenleme'),
('teknik_sartname',  'Teknik Şartname Okuma',           'idari',    'Şartname analizi ve uyumluluk'),
('excel_ileri',      'İleri Excel',                      'yazilim',  'Formül, pivot, makro'),
('resmi_yazi',       'Resmi Yazışma',                    'idari',    'Kurum yazışma formatı ve prosedürleri'),
('sepetli_kullanim', 'Sepetli Araç Kullanımı',          'teknik',   'Sepetli platformlu araç operasyonu'),
('vinc_kullanim',    'Vinç Kullanımı',                   'teknik',   'Mobil vinç operasyonu'),
('agir_vasita',      'Ağır Vasıta Kullanımı',            'teknik',   'Kamyon, TIR kullanımı');
