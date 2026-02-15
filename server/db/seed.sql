UPDATE firma_ayarlari SET deger = 'Örnek Elektrik Müteahhitlik Ltd.' WHERE anahtar = 'firma_adi';
UPDATE firma_ayarlari SET deger = 'Samsun' WHERE anahtar = 'firma_il';
UPDATE firma_ayarlari SET deger = 'YEDAŞ' WHERE anahtar = 'dagitim_sirketi';

INSERT INTO bolgeler (bolge_adi, bolge_tipi, ust_bolge_id, sira) VALUES ('Samsun', 'il', NULL, 1);
INSERT INTO bolgeler (bolge_adi, bolge_tipi, ust_bolge_id, sira) VALUES ('Bafra', 'ilce', 1, 1), ('Alaçam', 'ilce', 1, 2), ('Yakakent', 'ilce', 1, 3), ('19 Mayıs', 'ilce', 1, 4);

INSERT INTO personel (ad_soyad, telefon, gorev) VALUES
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
  ('ayarlar', 'telegram',   'Ayarlar', 'Telegram/AI', 'Telegram bot ve AI ayarları'),
  ('ayarlar', 'dongu',      'Ayarlar', 'Döngü Şablon','Döngü şablon yönetimi'),
  ('ayarlar', 'roller',     'Ayarlar', 'Rol Yönetimi','Rol oluşturma ve izin atama'),
  ('ayarlar', 'kullanicilar','Ayarlar', 'Kullanıcılar','Kullanıcı oluşturma ve rol atama');

-- ═══════════════════════════════════════════════════
-- VARSAYILAN ROLLER
-- ═══════════════════════════════════════════════════
INSERT OR IGNORE INTO roller (rol_adi, rol_kodu, aciklama, renk, ikon, seviye, sistem_rolu) VALUES
  ('Patron',          'patron',       'Tüm yetkilere sahip, firma sahibi',           '#dc2626', '👑', 100, 1),
  ('Koordinatör',     'koordinator',  'Günlük operasyon yönetimi',                    '#2563eb', '📋', 90,  1),
  ('Şantiye Şefi',   'santiye_sefi', 'Şantiye bazlı proje ve ekip yönetimi',         '#f59e0b', '🏗️', 80,  1),
  ('Saha Mühendisi',  'saha_muhendis','Sahada teknik kontrol ve denetim',             '#10b981', '🔍', 70,  1),
  ('Ekip Başı',       'ekip_basi',   'Saha ekip yönetimi, veri paketi gönderimi',     '#8b5cf6', '👷', 60,  1),
  ('Depocu',          'depocu',      'Malzeme ve stok yönetimi',                      '#0ea5e9', '📦', 50,  1),
  ('İSG Uzmanı',      'isg_uzmani',  'İş sağlığı ve güvenliği denetimi',             '#f43f5e', '🛡️', 50,  1),
  ('Muhasebeci',      'muhasebeci',  'Hak ediş, maliyet ve finansal işlemler',        '#84cc16', '💰', 50,  1),
  ('Sürveyan',        'surveyan',    'Saha kontrolü ve yapım denetimi',               '#14b8a6', '📏', 55,  0),
  ('Taşeron',         'taseron',     'Dış firma — sadece kendi işi',                   '#6b7280', '🤝', 30,  0);

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
