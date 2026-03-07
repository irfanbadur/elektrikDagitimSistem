const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/elektratrack.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const SEED_PATH = path.join(__dirname, 'seed.sql');

let db;

function getDb() {
  if (!db) {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function addColumnIfNotExists(database, table, column, type) {
  const columns = database.pragma(`table_info(${table})`);
  const exists = columns.some(c => c.name === column);
  if (!exists) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    console.log(`✅ ${table}.${column} sütunu eklendi`);
  }
}

function renameColumnIfNeeded(database, table, oldName, newName) {
  try {
    const columns = database.pragma(`table_info(${table})`);
    const hasOld = columns.some(c => c.name === oldName);
    const hasNew = columns.some(c => c.name === newName);
    if (hasOld && !hasNew) {
      database.exec(`ALTER TABLE ${table} RENAME COLUMN ${oldName} TO ${newName}`);
      console.log(`✅ ${table}.${oldName} → ${newName} olarak yeniden adlandırıldı`);
    }
  } catch (err) {
    // Tablo henüz yoksa veya kolon yoksa sessizce atla
  }
}

function runMigrations(database) {
  // Ekipler tablosuna konum alanları
  addColumnIfNotExists(database, 'ekipler', 'son_latitude', 'REAL');
  addColumnIfNotExists(database, 'ekipler', 'son_longitude', 'REAL');
  addColumnIfNotExists(database, 'ekipler', 'son_konum_zamani', 'DATETIME');
  addColumnIfNotExists(database, 'ekipler', 'son_konum_kaynagi', 'TEXT');
  addColumnIfNotExists(database, 'ekipler', 'varsayilan_is_tipi_id', 'INTEGER');

  // Medya tablosuna keşif bağlantısı
  addColumnIfNotExists(database, 'medya', 'kesif_id', 'INTEGER');

  // Veri paketleri tablosuna yeni alanlar (evrensel dosya sistemi)
  addColumnIfNotExists(database, 'veri_paketleri', 'konum_adi', 'TEXT');
  addColumnIfNotExists(database, 'veri_paketleri', 'dosya_sayisi', 'INTEGER DEFAULT 0');
  addColumnIfNotExists(database, 'veri_paketleri', 'fotograf_sayisi', 'INTEGER DEFAULT 0');
  addColumnIfNotExists(database, 'veri_paketleri', 'belge_sayisi', 'INTEGER DEFAULT 0');
  addColumnIfNotExists(database, 'veri_paketleri', 'baslik', 'TEXT');
  addColumnIfNotExists(database, 'veri_paketleri', 'etiketler', 'TEXT');
  addColumnIfNotExists(database, 'veri_paketleri', 'ai_islemler', 'TEXT');
  addColumnIfNotExists(database, 'veri_paketleri', 'kaynak', "TEXT DEFAULT 'web'");
  addColumnIfNotExists(database, 'veri_paketleri', 'onaylayan_id', 'INTEGER');
  addColumnIfNotExists(database, 'veri_paketleri', 'onay_tarihi', 'DATETIME');
  addColumnIfNotExists(database, 'veri_paketleri', 'onay_notu', 'TEXT');
  addColumnIfNotExists(database, 'veri_paketleri', 'guncelleme_tarihi', 'DATETIME');

  // Projeler tablosuna döngü alanları
  addColumnIfNotExists(database, 'projeler', 'dongu_sablon_id', 'INTEGER');
  addColumnIfNotExists(database, 'projeler', 'aktif_asama_id', 'INTEGER');

  // Veri paketleri ve dosyalar tablosuna aşama bağlantısı
  addColumnIfNotExists(database, 'veri_paketleri', 'proje_asama_id', 'INTEGER');
  addColumnIfNotExists(database, 'dosyalar', 'proje_asama_id', 'INTEGER');

  // Migration sonrası indexler
  database.exec('CREATE INDEX IF NOT EXISTS idx_paket_asama ON veri_paketleri(proje_asama_id)');
  database.exec('CREATE INDEX IF NOT EXISTS idx_dosya_asama ON dosyalar(proje_asama_id)');

  // Dosyalar v2: alan bazlı evrensel dosya sistemi
  addColumnIfNotExists(database, 'dosyalar', 'alan', "TEXT DEFAULT 'proje'");
  addColumnIfNotExists(database, 'dosyalar', 'alt_alan', 'TEXT');
  addColumnIfNotExists(database, 'dosyalar', 'iliskili_kaynak_tipi', 'TEXT');
  addColumnIfNotExists(database, 'dosyalar', 'iliskili_kaynak_id', 'INTEGER');

  database.exec('CREATE INDEX IF NOT EXISTS idx_dosya_alan ON dosyalar(alan)');
  database.exec('CREATE INDEX IF NOT EXISTS idx_dosya_alt_alan ON dosyalar(alan, alt_alan)');
  database.exec('CREATE INDEX IF NOT EXISTS idx_dosya_iliskili ON dosyalar(iliskili_kaynak_tipi, iliskili_kaynak_id)');

  // AI Sohbet medya desteği — ai_mesajlar tablosuna konum/dosya sütunları
  addColumnIfNotExists(database, 'ai_mesajlar', 'dosya_ids', 'TEXT');
  addColumnIfNotExists(database, 'ai_mesajlar', 'konum_lat', 'REAL');
  addColumnIfNotExists(database, 'ai_mesajlar', 'konum_lon', 'REAL');
  addColumnIfNotExists(database, 'ai_mesajlar', 'konum_dogruluk', 'REAL');

  // Personel-Görev Yönetimi: kullanıcılar tablosuna pozisyon ve kişisel bilgi alanları
  addColumnIfNotExists(database, 'kullanicilar', 'pozisyon_id', 'INTEGER REFERENCES pozisyonlar(id)');
  addColumnIfNotExists(database, 'kullanicilar', 'ust_kullanici_id', 'INTEGER REFERENCES kullanicilar(id)');
  addColumnIfNotExists(database, 'kullanicilar', 'tc_kimlik', 'TEXT');
  addColumnIfNotExists(database, 'kullanicilar', 'dogum_tarihi', 'DATE');
  addColumnIfNotExists(database, 'kullanicilar', 'ise_giris_tarihi', 'DATE');
  addColumnIfNotExists(database, 'kullanicilar', 'kan_grubu', 'TEXT');
  addColumnIfNotExists(database, 'kullanicilar', 'acil_kisi', 'TEXT');
  addColumnIfNotExists(database, 'kullanicilar', 'acil_telefon', 'TEXT');
  addColumnIfNotExists(database, 'kullanicilar', 'adres', 'TEXT');
  addColumnIfNotExists(database, 'kullanicilar', 'notlar', 'TEXT');
  addColumnIfNotExists(database, 'kullanicilar', 'sifre_acik', 'TEXT');

  // Projeler tablosuna faz sistemi alanları
  addColumnIfNotExists(database, 'projeler', 'is_tipi_id', 'INTEGER');
  addColumnIfNotExists(database, 'projeler', 'aktif_adim_id', 'INTEGER');

  // Veri paketleri ve dosyalar tablosuna adım bağlantısı
  addColumnIfNotExists(database, 'veri_paketleri', 'proje_adim_id', 'INTEGER');
  addColumnIfNotExists(database, 'dosyalar', 'proje_adim_id', 'INTEGER');

  // Departman sistemi: roller tablosuna departman_id ve birim_id
  addColumnIfNotExists(database, 'roller', 'departman_id', 'INTEGER REFERENCES departmanlar(id)');
  addColumnIfNotExists(database, 'roller', 'birim_id', 'INTEGER REFERENCES departman_birimleri(id)');

  // sorumlu_pozisyon_id → sorumlu_rol_id migration
  renameColumnIfNeeded(database, 'is_tipi_fazlari', 'sorumlu_pozisyon_id', 'sorumlu_rol_id');
  renameColumnIfNeeded(database, 'proje_adimlari', 'sorumlu_pozisyon_id', 'sorumlu_rol_id');

  // Rol kod/isim güncellemeleri: patron → genel_mudur, santiye_sefi → sistem_yoneticisi
  try {
    database.prepare("UPDATE roller SET rol_adi = 'Genel Müdür', rol_kodu = 'genel_mudur' WHERE rol_kodu = 'patron'").run();
    database.prepare("UPDATE roller SET rol_adi = 'Sistem Yöneticisi', rol_kodu = 'sistem_yoneticisi', aciklama = 'Sistem yönetimi, teknik altyapı ve kullanıcı yönetimi', ikon = '⚙️' WHERE rol_kodu = 'santiye_sefi'").run();

    // Koordinatör ve Sistem Yöneticisi'ne tüm izinleri ver (Genel Müdür gibi)
    const tumIzinler = database.prepare('SELECT id FROM izinler').all();
    const koordinatorRol = database.prepare("SELECT id FROM roller WHERE rol_kodu = 'koordinator'").get();
    const sistemYoneticisiRol = database.prepare("SELECT id FROM roller WHERE rol_kodu = 'sistem_yoneticisi'").get();

    for (const rol of [koordinatorRol, sistemYoneticisiRol]) {
      if (!rol) continue;
      for (const izin of tumIzinler) {
        database.prepare('INSERT OR IGNORE INTO rol_izinleri (rol_id, izin_id, veri_kapsami) VALUES (?, ?, ?)').run(rol.id, izin.id, 'tum');
      }
      // Eski kısıtlı izinleri 'tum' kapsamına güncelle
      database.prepare("UPDATE rol_izinleri SET veri_kapsami = 'tum' WHERE rol_id = ? AND veri_kapsami != 'tum'").run(rol.id);
    }
  } catch (err) {
    // İlk kurulumda roller tablosu henüz yoksa sessizce atla
  }
}

function migrateDonguDosyalariToVeriPaketi(database) {
  try {
    // proje_adim_id olan ama veri_paketi_id olmayan dosyaları bul
    const yetimDosyalar = database.prepare(`
      SELECT d.id, d.proje_id, d.proje_adim_id, d.olusturma_tarihi,
        pa.adim_kodu, pa.adim_adi
      FROM dosyalar d
      LEFT JOIN proje_adimlari pa ON d.proje_adim_id = pa.id
      WHERE d.proje_adim_id IS NOT NULL
        AND (d.veri_paketi_id IS NULL OR d.veri_paketi_id = 0)
        AND d.durum = 'aktif'
    `).all();

    if (yetimDosyalar.length === 0) return;

    // Her dosya için bir veri paketi oluştur ve bağla
    const paketOlustur = database.prepare(`
      INSERT INTO veri_paketleri (paket_tipi, proje_id, proje_adim_id, kaynak, durum, tamamlanma_zamani, olusturma_tarihi)
      VALUES (?, ?, ?, 'web', 'tamamlandi', datetime('now'), ?)
    `);
    const dosyaGuncelle = database.prepare('UPDATE dosyalar SET veri_paketi_id = ? WHERE id = ?');

    const transaction = database.transaction(() => {
      for (const d of yetimDosyalar) {
        const paketTipi = d.adim_kodu || 'genel';
        const r = paketOlustur.run(paketTipi, d.proje_id, d.proje_adim_id, d.olusturma_tarihi);
        dosyaGuncelle.run(r.lastInsertRowid, d.id);
      }
    });
    transaction();

    console.log(`✅ ${yetimDosyalar.length} döngü dosyası veri paketine dönüştürüldü`);
  } catch (err) {
    console.error('Döngü dosya migration hatası:', err.message);
  }
}

function initDatabase() {
  const database = getDb();
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  database.exec(schema);

  runMigrations(database);
  migrateDonguDosyalariToVeriPaketi(database);

  const count = database.prepare('SELECT COUNT(*) as c FROM personel').get();
  if (count.c === 0) {
    const seed = fs.readFileSync(SEED_PATH, 'utf8');
    database.exec(seed);
    console.log('Örnek veri yüklendi.');
  }

  // RBAC seed: rol izinleri ve ilk kullanıcı
  try {
    const { seedRolIzinleri, seedIlkKullanici } = require('./seedRolIzinleri');
    seedRolIzinleri();
    seedIlkKullanici();
  } catch (err) {
    console.error('RBAC seed hatası:', err.message);
  }

  // Pozisyon/görev/belge/yetkinlik seed verisi
  try {
    const pozSayi = database.prepare('SELECT COUNT(*) as c FROM pozisyonlar').get();
    if (pozSayi.c === 0) {
      console.log('Pozisyon/görev/belge/yetkinlik seed verisi yükleniyor...');
      const seedSql = fs.readFileSync(SEED_PATH, 'utf8');
      // Seed SQL'i satır satır çalıştır — mevcut verilerden kaynaklanan UNIQUE hatalarını atla
      const statements = seedSql.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        try {
          database.exec(stmt + ';');
        } catch (e) {
          // UNIQUE constraint veya INSERT hatası — sessizce atla
        }
      }
      const yeniPozSayi = database.prepare('SELECT COUNT(*) as c FROM pozisyonlar').get();
      if (yeniPozSayi.c > 0) {
        console.log(`✅ ${yeniPozSayi.c} pozisyon seed edildi`);
      }
    }
  } catch (err) {
    // Pozisyonlar tablosu henüz yoksa veya başka bir hata - sessizce atla
  }

  // İş Tipleri + Faz/Adım seed verisi
  seedIsTipleri(database);

  // Fazlardaki eksik sorumlu_rol_id'leri doldur (pozisyonlar sonradan seed edildiyse)
  fixFazSorumluRol(database);

  // Mevcut verileri yeni faz sistemine taşı
  migrateToFazSistemi(database);

  // Proje durumlarını aktif adıma göre senkronize et
  fixProjeDurumlari(database);
}

function fixFazSorumluRol(database) {
  try {
    const rolSayi = database.prepare('SELECT COUNT(*) as c FROM roller').get();
    if (rolSayi.c === 0) return;

    // Faz kodlarına göre varsayılan sorumlu rol eşleştir
    const fazRolMap = {
      baslama: 'saha_muhendis',
      teknik_hazirlik: 'saha_muhendis',
      planlama: 'koordinator',
      uygulama: 'saha_muhendis',
      hak_edis: 'koordinator',
      kabul: 'koordinator',
      tamamlanma: 'koordinator',
    };

    // NULL olanları veya yanlış eşleşmiş olanları düzelt
    const stmt = database.prepare(
      'UPDATE is_tipi_fazlari SET sorumlu_rol_id = ? WHERE faz_kodu = ?'
    );

    let guncellenen = 0;
    for (const [fazKodu, rolKodu] of Object.entries(fazRolMap)) {
      const rol = database.prepare('SELECT id FROM roller WHERE rol_kodu = ?').get(rolKodu);
      if (rol) {
        const r = stmt.run(rol.id, fazKodu);
        guncellenen += r.changes;
      }
    }

    if (guncellenen > 0) {
      console.log(`✅ ${guncellenen} faz sorumlu rolü güncellendi`);
    }
  } catch (err) {
    // Sessizce atla
  }
}

function seedIsTipleri(database) {
  try {
    const sayi = database.prepare('SELECT COUNT(*) as c FROM is_tipleri').get();
    if (sayi.c > 0) return; // Zaten seed edilmiş

    console.log('İş tipleri ve varsayılan fazlar seed ediliyor...');

    // calisan_proje_tipleri'nden iş tiplerini al
    const tipAyar = database.prepare("SELECT deger FROM firma_ayarlari WHERE anahtar = 'calisan_proje_tipleri'").get();
    const tiplerStr = tipAyar?.deger || 'YB,KET,Tesis';
    const tipler = tiplerStr.split(',').map(t => t.trim()).filter(Boolean);

    const tipInsert = database.prepare(`
      INSERT INTO is_tipleri (kod, ad, sira) VALUES (?, ?, ?)
    `);

    for (let i = 0; i < tipler.length; i++) {
      tipInsert.run(tipler[i].toUpperCase(), tipler[i], i + 1);
    }

    // Rol ID'lerini bul
    const getRolId = (kod) => {
      const rol = database.prepare('SELECT id FROM roller WHERE rol_kodu = ?').get(kod);
      return rol?.id || null;
    };

    // Varsayılan 7 faz ve adımları — tüm iş tipleri için
    const varsayilanFazlar = [
      {
        sira: 1, faz_adi: 'Başlama', faz_kodu: 'baslama', ikon: '🚀', renk: '#6366f1',
        sorumlu: 'saha_muhendis', tahmini_gun: 5,
        adimlar: [
          { adim_adi: 'Krokinin hazırlanması', adim_kodu: 'kroki', tahmini_gun: 2 },
          { adim_adi: 'Koordinatların alınması', adim_kodu: 'koordinat', tahmini_gun: 3 },
        ]
      },
      {
        sira: 2, faz_adi: 'Teknik Hazırlık-Tasarım', faz_kodu: 'teknik_hazirlik', ikon: '📐', renk: '#8b5cf6',
        sorumlu: 'saha_muhendis', tahmini_gun: 15,
        adimlar: [
          { adim_adi: 'Proje', adim_kodu: 'proje', tahmini_gun: 7 },
          { adim_adi: 'Keşif', adim_kodu: 'kesif', tahmini_gun: 3 },
          { adim_adi: 'Malzeme listesi', adim_kodu: 'malzeme_listesi', tahmini_gun: 5 },
        ]
      },
      {
        sira: 3, faz_adi: 'Planlama', faz_kodu: 'planlama', ikon: '📋', renk: '#0ea5e9',
        sorumlu: 'koordinator', tahmini_gun: 10,
        adimlar: [
          { adim_adi: 'Malzeme Talep', adim_kodu: 'malzeme_talep', tahmini_gun: 3 },
          { adim_adi: 'İş programı', adim_kodu: 'is_programi', tahmini_gun: 3 },
          { adim_adi: 'Tutanaklar', adim_kodu: 'tutanaklar', tahmini_gun: 4 },
        ]
      },
      {
        sira: 4, faz_adi: 'Uygulama', faz_kodu: 'uygulama', ikon: '🔧', renk: '#f59e0b',
        sorumlu: 'saha_muhendis', tahmini_gun: 30,
        adimlar: [
          { adim_adi: 'Yapım', adim_kodu: 'yapim', tahmini_gun: 30 },
        ]
      },
      {
        sira: 5, faz_adi: 'Hak Ediş', faz_kodu: 'hak_edis', ikon: '💰', renk: '#3b82f6',
        sorumlu: 'koordinator', tahmini_gun: 15,
        adimlar: [
          { adim_adi: 'Metraj', adim_kodu: 'metraj', tahmini_gun: 5 },
          { adim_adi: 'Hesap', adim_kodu: 'hesap', tahmini_gun: 5 },
          { adim_adi: 'Kurum Şablon', adim_kodu: 'kurum_sablon', tahmini_gun: 5 },
        ]
      },
      {
        sira: 6, faz_adi: 'Kabul', faz_kodu: 'kabul', ikon: '✅', renk: '#14b8a6',
        sorumlu: 'koordinator', tahmini_gun: 30,
        adimlar: [
          { adim_adi: 'Tutanaklar', adim_kodu: 'kabul_tutanaklar', tahmini_gun: 5 },
          { adim_adi: 'Geçici Kabul', adim_kodu: 'gecici_kabul', tahmini_gun: 10 },
          { adim_adi: 'Eksiklerin giderilmesi', adim_kodu: 'eksik_giderim', tahmini_gun: 7 },
          { adim_adi: 'GK tamamlama', adim_kodu: 'gk_tamamlama', tahmini_gun: 5 },
          { adim_adi: 'Teminatlar', adim_kodu: 'teminatlar', tahmini_gun: 3 },
        ]
      },
      {
        sira: 7, faz_adi: 'Tamamlanma', faz_kodu: 'tamamlanma', ikon: '🏁', renk: '#10b981',
        sorumlu: 'koordinator', tahmini_gun: 10,
        adimlar: [
          { adim_adi: 'Kesin Kabul', adim_kodu: 'kesin_kabul', tahmini_gun: 10 },
        ]
      },
    ];

    const fazInsert = database.prepare(`
      INSERT INTO is_tipi_fazlari (is_tipi_id, sira, faz_adi, faz_kodu, ikon, renk, sorumlu_rol_id, tahmini_gun)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const adimInsert = database.prepare(`
      INSERT INTO faz_adimlari (faz_id, sira, adim_adi, adim_kodu, tahmini_gun)
      VALUES (?, ?, ?, ?, ?)
    `);

    const tumTipler = database.prepare('SELECT id FROM is_tipleri').all();

    for (const tip of tumTipler) {
      for (const faz of varsayilanFazlar) {
        const rolId = getRolId(faz.sorumlu);
        const fazResult = fazInsert.run(tip.id, faz.sira, faz.faz_adi, faz.faz_kodu, faz.ikon, faz.renk, rolId, faz.tahmini_gun);
        const fazId = fazResult.lastInsertRowid;

        for (let a = 0; a < faz.adimlar.length; a++) {
          const adim = faz.adimlar[a];
          adimInsert.run(fazId, a + 1, adim.adim_adi, adim.adim_kodu, adim.tahmini_gun);
        }
      }
    }

    console.log(`✅ ${tumTipler.length} iş tipi için varsayılan fazlar oluşturuldu`);
  } catch (err) {
    console.error('İş tipleri seed hatası:', err.message);
  }
}

function migrateToFazSistemi(database) {
  try {
    // Mevcut proje_asamalari varsa ve proje_adimlari boşsa, taşıma yap
    const asamaSayi = database.prepare('SELECT COUNT(*) as c FROM proje_asamalari').get();
    const adimSayi = database.prepare('SELECT COUNT(*) as c FROM proje_adimlari').get();

    if (asamaSayi.c === 0 || adimSayi.c > 0) return; // Taşınacak veri yok veya zaten taşınmış

    console.log('Mevcut proje aşamaları yeni faz sistemine taşınıyor...');

    // Her proje aşamasını 1 adımlı faz olarak taşı
    const asamalar = database.prepare(`
      SELECT pa.*, p.proje_tipi FROM proje_asamalari pa
      JOIN projeler p ON pa.proje_id = p.id
      ORDER BY pa.proje_id, pa.sira
    `).all();

    const adimInsert = database.prepare(`
      INSERT INTO proje_adimlari (
        proje_id, sira_global, faz_sira, adim_sira,
        faz_adi, faz_kodu, adim_adi, adim_kodu,
        renk, ikon, durum, baslangic_tarihi, bitis_tarihi,
        planlanan_baslangic, planlanan_bitis, tahmini_gun,
        notlar, tamamlanma_notu, baslatan_id, tamamlayan_id
      ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const a of asamalar) {
      try {
        adimInsert.run(
          a.proje_id, a.sira, a.sira,
          a.asama_adi, a.asama_kodu, a.asama_adi, a.asama_kodu,
          a.renk, a.ikon, a.durum, a.baslangic_tarihi, a.bitis_tarihi,
          a.planlanan_baslangic, a.planlanan_bitis, a.tahmini_gun,
          a.notlar, a.tamamlanma_notu, a.baslatan_id, a.tamamlayan_id
        );
      } catch (e) {
        // Duplicate key hatası olabilir, sessizce atla
      }
    }

    // Projelerin is_tipi_id ve aktif_adim_id'sini güncelle
    const projeler = database.prepare('SELECT id, proje_tipi, aktif_asama_id FROM projeler').all();
    for (const p of projeler) {
      // İş tipi eşle
      const isTipi = database.prepare('SELECT id FROM is_tipleri WHERE UPPER(kod) = UPPER(?)').get(p.proje_tipi);
      if (isTipi) {
        database.prepare('UPDATE projeler SET is_tipi_id = ? WHERE id = ?').run(isTipi.id, p.id);
      }

      // Aktif adım eşle (eski aktif_asama_id'den)
      if (p.aktif_asama_id) {
        const eskiAsama = database.prepare('SELECT sira FROM proje_asamalari WHERE id = ?').get(p.aktif_asama_id);
        if (eskiAsama) {
          const yeniAdim = database.prepare('SELECT id FROM proje_adimlari WHERE proje_id = ? AND sira_global = ?').get(p.id, eskiAsama.sira);
          if (yeniAdim) {
            database.prepare('UPDATE projeler SET aktif_adim_id = ? WHERE id = ?').run(yeniAdim.id, p.id);
          }
        }
      }
    }

    // Veri paketleri ve dosyalar aşama bağlantısını taşı
    const paketler = database.prepare('SELECT id, proje_asama_id FROM veri_paketleri WHERE proje_asama_id IS NOT NULL').all();
    for (const pk of paketler) {
      const eskiAsama = database.prepare('SELECT proje_id, sira FROM proje_asamalari WHERE id = ?').get(pk.proje_asama_id);
      if (eskiAsama) {
        const yeniAdim = database.prepare('SELECT id FROM proje_adimlari WHERE proje_id = ? AND sira_global = ?').get(eskiAsama.proje_id, eskiAsama.sira);
        if (yeniAdim) {
          database.prepare('UPDATE veri_paketleri SET proje_adim_id = ? WHERE id = ?').run(yeniAdim.id, pk.id);
        }
      }
    }

    console.log(`✅ ${asamalar.length} aşama yeni faz sistemine taşındı`);
  } catch (err) {
    console.error('Faz sistemi migration hatası:', err.message);
  }
}

function fixProjeDurumlari(database) {
  try {
    const projeler = database.prepare(`
      SELECT p.id, p.durum, pad.faz_kodu
      FROM projeler p
      JOIN proje_adimlari pad ON p.aktif_adim_id = pad.id
      WHERE p.aktif_adim_id IS NOT NULL AND p.durum != pad.faz_kodu
    `).all();

    if (projeler.length === 0) return;

    const stmt = database.prepare('UPDATE projeler SET durum = ? WHERE id = ?');
    for (const p of projeler) {
      stmt.run(p.faz_kodu, p.id);
    }
    console.log(`✅ ${projeler.length} proje durumu aktif adıma göre senkronize edildi`);
  } catch (err) {
    // Tablo yoksa veya kolon eksikse sessizce atla
  }
}

module.exports = { getDb, initDatabase };
