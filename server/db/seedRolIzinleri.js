const { getDb } = require('./database');
const bcrypt = require('bcrypt');

function seedTemelVeriler() {
  const db = getDb();

  // İzin tanımları yoksa ekle
  const izinSayisi = db.prepare('SELECT COUNT(*) as sayi FROM izinler').get().sayi;
  if (izinSayisi === 0) {
    const izinSQL = `
      INSERT OR IGNORE INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
        ('projeler', 'okuma',    'Projeler', 'Okuma',    'Proje listesi ve detay görüntüleme'),
        ('projeler', 'yazma',    'Projeler', 'Yazma',    'Proje oluşturma ve düzenleme'),
        ('projeler', 'silme',    'Projeler', 'Silme',    'Proje silme'),
        ('projeler', 'onaylama', 'Projeler', 'Onaylama', 'Proje durumu onaylama'),
        ('dongu', 'okuma',    'Yaşam Döngüsü', 'Okuma',    'Proje aşamalarını görüntüleme'),
        ('dongu', 'yazma',    'Yaşam Döngüsü', 'Yazma',    'Aşama başlatma/tamamlama/tarih güncelleme'),
        ('dongu', 'sablon',   'Yaşam Döngüsü', 'Şablon Yönetimi', 'Döngü şablonu oluşturma/düzenleme'),
        ('ekipler', 'okuma',  'Ekipler', 'Okuma',  'Ekip listesi ve detay görüntüleme'),
        ('ekipler', 'yazma',  'Ekipler', 'Yazma',  'Ekip oluşturma ve düzenleme'),
        ('ekipler', 'silme',  'Ekipler', 'Silme',  'Ekip silme'),
        ('personel', 'okuma',  'Personel', 'Okuma',  'Personel listesi ve detay görüntüleme'),
        ('personel', 'yazma',  'Personel', 'Yazma',  'Personel ekleme ve düzenleme'),
        ('personel', 'silme',  'Personel', 'Silme',  'Personel silme/pasifleştirme'),
        ('veri_paketi', 'okuma',    'Veri Paketleri', 'Okuma',    'Veri paketi listeleme/detay'),
        ('veri_paketi', 'yazma',    'Veri Paketleri', 'Yazma',    'Veri paketi oluşturma ve dosya ekleme'),
        ('veri_paketi', 'silme',    'Veri Paketleri', 'Silme',    'Veri paketi silme'),
        ('veri_paketi', 'onaylama', 'Veri Paketleri', 'Onaylama', 'Veri paketi onaylama/reddetme'),
        ('dosyalar', 'okuma',    'Dosyalar', 'Okuma',    'Dosya listeleme, indirme, önizleme'),
        ('dosyalar', 'yazma',    'Dosyalar', 'Yazma',    'Dosya yükleme ve metadata düzenleme'),
        ('dosyalar', 'silme',    'Dosyalar', 'Silme',    'Dosya silme'),
        ('saha_harita', 'okuma',  'Saha Harita', 'Okuma',  'Haritayı görüntüleme'),
        ('saha_harita', 'yazma',  'Saha Harita', 'Yazma',  'Konum güncelleme, marker düzenleme'),
        ('saha_mesaj', 'okuma',    'Saha Mesaj', 'Okuma',    'Mesaj geçmişini görüntüleme'),
        ('saha_mesaj', 'yazma',    'Saha Mesaj', 'Yazma',    'Mesaj gönderme'),
        ('saha_mesaj', 'onaylama', 'Saha Mesaj', 'Onaylama', 'Parse sonuçlarını onaylama/düzeltme'),
        ('malzeme', 'okuma',    'Malzeme/Depo', 'Okuma',    'Stok ve malzeme listesi görüntüleme'),
        ('malzeme', 'yazma',    'Malzeme/Depo', 'Yazma',    'Stok giriş/çıkış, malzeme tanımlama'),
        ('malzeme', 'silme',    'Malzeme/Depo', 'Silme',    'Malzeme silme'),
        ('malzeme', 'talep',    'Malzeme/Depo', 'Talep',    'Malzeme talep oluşturma'),
        ('malzeme', 'onaylama', 'Malzeme/Depo', 'Onaylama', 'Malzeme talep onaylama'),
        ('finansal', 'okuma',  'Finansal', 'Okuma',  'Hak ediş, maliyet, fatura görüntüleme'),
        ('finansal', 'yazma',  'Finansal', 'Yazma',  'Hak ediş/maliyet/fatura oluşturma/düzenleme'),
        ('finansal', 'silme',  'Finansal', 'Silme',  'Finansal kayıt silme'),
        ('finansal', 'onaylama','Finansal', 'Onaylama','Hak ediş onaylama'),
        ('isg', 'okuma',  'İSG', 'Okuma',  'İSG denetim ve kontrol listesi görüntüleme'),
        ('isg', 'yazma',  'İSG', 'Yazma',  'Denetim oluşturma, kontrol listesi doldurma'),
        ('isg', 'silme',  'İSG', 'Silme',  'İSG kayıt silme'),
        ('isg', 'rapor',  'İSG', 'Raporlama', 'İSG raporu oluşturma'),
        ('raporlar', 'genel',    'Raporlar', 'Genel',    'Genel raporları görüntüleme'),
        ('raporlar', 'mali',     'Raporlar', 'Mali',     'Mali raporları görüntüleme'),
        ('raporlar', 'isg',      'Raporlar', 'İSG',      'İSG raporlarını görüntüleme'),
        ('raporlar', 'depo',     'Raporlar', 'Depo',     'Depo/malzeme raporlarını görüntüleme'),
        ('ayarlar', 'genel',      'Ayarlar', 'Genel',      'Genel ayarlar (firma bilgileri)'),
        ('ayarlar', 'ai',         'Ayarlar', 'AI Ayarları', 'AI ayarları'),
        ('ayarlar', 'dongu',      'Ayarlar', 'Döngü Şablon','Döngü şablon yönetimi'),
        ('ayarlar', 'roller',     'Ayarlar', 'Rol Yönetimi','Rol oluşturma ve izin atama'),
        ('ayarlar', 'kullanicilar','Ayarlar', 'Kullanıcılar','Kullanıcı oluşturma ve rol atama');
    `;
    db.exec(izinSQL);
    console.log('  İzin tanımları eklendi');
  }

  // Roller seed.sql'den geliyor (departman bazlı), burada tekrar eklemeye gerek yok
}

function seedRolIzinleri() {
  const db = getDb();

  // Önce temel verileri (izinler, roller) oluştur
  seedTemelVeriler();

  // Eğer izin atamaları zaten varsa tekrar çalıştırma
  const mevcutAtama = db.prepare('SELECT COUNT(*) as sayi FROM rol_izinleri').get();
  if (mevcutAtama.sayi > 0) return;

  function izinId(modul, aksiyon) {
    const row = db.prepare('SELECT id FROM izinler WHERE modul = ? AND aksiyon = ?').get(modul, aksiyon);
    return row?.id;
  }

  function rolId(kod) {
    const row = db.prepare('SELECT id FROM roller WHERE rol_kodu = ?').get(kod);
    return row?.id;
  }

  function ata(rolKodu, modul, aksiyon, kapsam = 'tum') {
    const rId = rolId(rolKodu);
    const iId = izinId(modul, aksiyon);
    if (rId && iId) {
      db.prepare('INSERT OR IGNORE INTO rol_izinleri (rol_id, izin_id, veri_kapsami) VALUES (?, ?, ?)').run(rId, iId, kapsam);
    }
  }

  // ─── GENEL MÜDÜR — HER ŞEY ──────────────────────────
  const tumIzinlerList = db.prepare('SELECT id FROM izinler').all();
  const pId = rolId('genel_mudur');
  if (pId) {
    for (const izin of tumIzinlerList) {
      db.prepare('INSERT OR IGNORE INTO rol_izinleri (rol_id, izin_id, veri_kapsami) VALUES (?, ?, ?)').run(pId, izin.id, 'tum');
    }
  }

  // ─── KOORDİNATÖR — HER ŞEY ─────────────────────
  const kId = rolId('koordinator');
  if (kId) {
    for (const izin of tumIzinlerList) {
      db.prepare('INSERT OR IGNORE INTO rol_izinleri (rol_id, izin_id, veri_kapsami) VALUES (?, ?, ?)').run(kId, izin.id, 'tum');
    }
  }

  // ─── SİSTEM YÖNETİCİSİ — HER ŞEY ─────
  const sId = rolId('sistem_yoneticisi');
  if (sId) {
    for (const izin of tumIzinlerList) {
      db.prepare('INSERT OR IGNORE INTO rol_izinleri (rol_id, izin_id, veri_kapsami) VALUES (?, ?, ?)').run(sId, izin.id, 'tum');
    }
  }

  // ─── SAHA MÜHENDİSİ ────────────────────────────
  ata('saha_muhendis', 'projeler', 'okuma');
  ata('saha_muhendis', 'dongu', 'okuma');
  ata('saha_muhendis', 'ekipler', 'okuma');
  ata('saha_muhendis', 'personel', 'okuma');
  ata('saha_muhendis', 'veri_paketi', 'okuma');
  ata('saha_muhendis', 'veri_paketi', 'yazma');
  ata('saha_muhendis', 'dosyalar', 'okuma');
  ata('saha_muhendis', 'dosyalar', 'yazma');
  ata('saha_muhendis', 'saha_harita', 'okuma');
  ata('saha_muhendis', 'saha_mesaj', 'okuma');
  ata('saha_muhendis', 'saha_mesaj', 'yazma');
  ata('saha_muhendis', 'malzeme', 'okuma');
  ata('saha_muhendis', 'malzeme', 'talep');
  ata('saha_muhendis', 'isg', 'okuma');
  ata('saha_muhendis', 'raporlar', 'genel');

  // ─── EKİP BAŞI ──────────────────────────────────
  ata('ekip_basi', 'projeler', 'okuma', 'kendi_ekip');
  ata('ekip_basi', 'dongu', 'okuma', 'kendi_ekip');
  ata('ekip_basi', 'ekipler', 'okuma', 'kendi_ekip');
  ata('ekip_basi', 'personel', 'okuma', 'kendi_ekip');
  ata('ekip_basi', 'veri_paketi', 'yazma', 'kendi_ekip');
  ata('ekip_basi', 'veri_paketi', 'okuma', 'kendi_ekip');
  ata('ekip_basi', 'dosyalar', 'yazma', 'kendi_ekip');
  ata('ekip_basi', 'dosyalar', 'okuma', 'kendi_ekip');
  ata('ekip_basi', 'saha_harita', 'okuma', 'kendi_ekip');
  ata('ekip_basi', 'saha_mesaj', 'yazma', 'kendi_ekip');
  ata('ekip_basi', 'malzeme', 'talep', 'kendi_ekip');
  ata('ekip_basi', 'malzeme', 'okuma', 'kendi_ekip');

  // ─── DEPOCU ─────────────────────────────────────
  ata('depocu', 'malzeme', 'okuma');
  ata('depocu', 'malzeme', 'yazma');
  ata('depocu', 'malzeme', 'silme');
  ata('depocu', 'malzeme', 'onaylama');
  ata('depocu', 'dosyalar', 'okuma', 'kendi');
  ata('depocu', 'dosyalar', 'yazma', 'kendi');
  ata('depocu', 'raporlar', 'depo');

  // ─── İSG UZMANI ─────────────────────────────────
  ata('isg_uzmani', 'isg', 'okuma');
  ata('isg_uzmani', 'isg', 'yazma');
  ata('isg_uzmani', 'isg', 'silme');
  ata('isg_uzmani', 'isg', 'rapor');
  ata('isg_uzmani', 'personel', 'okuma');
  ata('isg_uzmani', 'projeler', 'okuma');
  ata('isg_uzmani', 'dosyalar', 'okuma');
  ata('isg_uzmani', 'dosyalar', 'yazma');
  ata('isg_uzmani', 'saha_harita', 'okuma');
  ata('isg_uzmani', 'raporlar', 'isg');

  // ─── MUHASEBECİ ─────────────────────────────────
  ata('muhasebeci', 'finansal', 'okuma');
  ata('muhasebeci', 'finansal', 'yazma');
  ata('muhasebeci', 'finansal', 'silme');
  ata('muhasebeci', 'finansal', 'onaylama');
  ata('muhasebeci', 'projeler', 'okuma');
  ata('muhasebeci', 'personel', 'okuma');
  ata('muhasebeci', 'malzeme', 'okuma');
  ata('muhasebeci', 'dosyalar', 'okuma');
  ata('muhasebeci', 'raporlar', 'mali');

  // ─── SÜRVEYAN ───────────────────────────────────
  ata('surveyan', 'projeler', 'okuma', 'kendi_santiye');
  ata('surveyan', 'dongu', 'okuma', 'kendi_santiye');
  ata('surveyan', 'ekipler', 'okuma', 'kendi_santiye');
  ata('surveyan', 'veri_paketi', 'okuma', 'kendi_santiye');
  ata('surveyan', 'veri_paketi', 'yazma', 'kendi_santiye');
  ata('surveyan', 'dosyalar', 'okuma', 'kendi_santiye');
  ata('surveyan', 'dosyalar', 'yazma', 'kendi_santiye');
  ata('surveyan', 'saha_harita', 'okuma');
  ata('surveyan', 'saha_mesaj', 'yazma', 'kendi');
  ata('surveyan', 'malzeme', 'okuma');

  // ─── TAŞERON ────────────────────────────────────
  ata('taseron', 'projeler', 'okuma', 'kendi');
  ata('taseron', 'veri_paketi', 'yazma', 'kendi');
  ata('taseron', 'veri_paketi', 'okuma', 'kendi');
  ata('taseron', 'dosyalar', 'yazma', 'kendi');
  ata('taseron', 'dosyalar', 'okuma', 'kendi');
  ata('taseron', 'saha_mesaj', 'yazma', 'kendi');

  console.log('  Rol izinleri seed edildi');
}

function seedIlkKullanici() {
  const db = getDb();

  const mevcut = db.prepare('SELECT COUNT(*) as sayi FROM kullanicilar').get();
  if (mevcut.sayi > 0) {
    // Kullanıcı var ama rolü yoksa sistem yöneticisi rolü ata
    const rolAtamasi = db.prepare('SELECT COUNT(*) as sayi FROM kullanici_rolleri').get();
    if (rolAtamasi.sayi === 0) {
      const ilkKullanici = db.prepare('SELECT id FROM kullanicilar LIMIT 1').get();
      const syRol = db.prepare("SELECT id FROM roller WHERE rol_kodu = 'sistem_yoneticisi'").get();
      if (ilkKullanici && syRol) {
        db.prepare('INSERT OR IGNORE INTO kullanici_rolleri (kullanici_id, rol_id) VALUES (?, ?)').run(ilkKullanici.id, syRol.id);
      }
    }
    return;
  }

  const sifreHash = bcrypt.hashSync('admin123', 10);

  const result = db.prepare(`
    INSERT INTO kullanicilar (kullanici_adi, sifre_hash, ad_soyad, email)
    VALUES ('admin', ?, 'Sistem Yöneticisi', 'admin@firma.com')
  `).run(sifreHash);

  const syRol = db.prepare("SELECT id FROM roller WHERE rol_kodu = 'sistem_yoneticisi'").get();
  if (syRol) {
    db.prepare('INSERT INTO kullanici_rolleri (kullanici_id, rol_id) VALUES (?, ?)').run(result.lastInsertRowid, syRol.id);
  }

  console.log('  İlk kullanıcı oluşturuldu: admin / admin123');
}

module.exports = { seedRolIzinleri, seedIlkKullanici };
