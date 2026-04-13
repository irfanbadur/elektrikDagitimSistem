const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { AsyncLocalStorage } = require('async_hooks');

const DB_BASE = path.join(__dirname, '../../data/tenants');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const SEED_PATH = path.join(__dirname, 'seed.sql');

// ─── Tenant Yönetimi ───────────────────────────
const tenantStorage = new AsyncLocalStorage();
const dbCache = new Map();

// Bilinen tenant'lar (JSON dosyasından veya hardcoded)
const TENANTS = {
  cakmakgrup: { name: 'Çakmak Grup', active: true },
};

function setCurrentTenant(slug) {
  // Script'ler için (AsyncLocalStorage dışında)
  tenantStorage.enterWith({ tenantSlug: slug });
}

function getCurrentTenantSlug() {
  const store = tenantStorage.getStore();
  if (store?.tenantSlug) return store.tenantSlug;
  // Fallback: DEFAULT_TENANT env
  return process.env.DEFAULT_TENANT || null;
}

function getDb() {
  const slug = getCurrentTenantSlug();
  if (!slug) throw new Error('Tenant belirlenemedi — request context yok');

  if (dbCache.has(slug)) return dbCache.get(slug);

  const dbPath = path.join(DB_BASE, slug, 'elektratrack.db');
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  dbCache.set(slug, db);
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

  // Projeler: teslim eden/alan alanları
  addColumnIfNotExists(database, 'projeler', 'teslim_eden', 'TEXT');
  addColumnIfNotExists(database, 'projeler', 'teslim_alan_id', 'INTEGER');

  // Projeler: YB (Yeni Bağlantı) ve genel yer teslim alanları
  addColumnIfNotExists(database, 'projeler', 'basvuru_no', 'TEXT');
  addColumnIfNotExists(database, 'projeler', 'il', 'TEXT');
  addColumnIfNotExists(database, 'projeler', 'ilce', 'TEXT');
  addColumnIfNotExists(database, 'projeler', 'ada_parsel', 'TEXT');
  addColumnIfNotExists(database, 'projeler', 'telefon', 'TEXT');
  addColumnIfNotExists(database, 'projeler', 'tesis', 'TEXT');
  addColumnIfNotExists(database, 'projeler', 'abone_kablosu', 'TEXT');
  addColumnIfNotExists(database, 'projeler', 'abone_kablosu_metre', 'REAL');
  addColumnIfNotExists(database, 'projeler', 'enerji_alinan_direk_no', 'TEXT');
  addColumnIfNotExists(database, 'projeler', 'kesinti_ihtiyaci', 'INTEGER');
  addColumnIfNotExists(database, 'projeler', 'izinler', 'TEXT');

  // Projeler: yer teslim tutanağı dosya referansı
  addColumnIfNotExists(database, 'projeler', 'yer_teslim_dosya_id', 'INTEGER REFERENCES dosyalar(id)');

  // Projeler: dış kişi (teslim eden) referansı
  addColumnIfNotExists(database, 'projeler', 'teslim_eden_id', 'INTEGER REFERENCES dis_kisiler(id)');

  // Projeler: Excel import alanları
  addColumnIfNotExists(database, 'projeler', 'yil', 'INTEGER');
  addColumnIfNotExists(database, 'projeler', 'ihale_no', 'TEXT');
  addColumnIfNotExists(database, 'projeler', 'ihale_adi', 'TEXT');
  addColumnIfNotExists(database, 'projeler', 'yuklenici', 'TEXT');
  addColumnIfNotExists(database, 'projeler', 'tur', 'TEXT');
  addColumnIfNotExists(database, 'projeler', 'cbs_id', 'TEXT');
  addColumnIfNotExists(database, 'projeler', 'cbs_durum', 'TEXT');
  addColumnIfNotExists(database, 'projeler', 'is_durumu', 'TEXT');
  addColumnIfNotExists(database, 'projeler', 'demontaj_teslim_durumu', 'TEXT');
  addColumnIfNotExists(database, 'projeler', 'sozlesme_kesfi', 'REAL');
  addColumnIfNotExists(database, 'projeler', 'kesif_tutari', 'REAL');
  addColumnIfNotExists(database, 'projeler', 'hakedis_miktari', 'REAL');
  addColumnIfNotExists(database, 'projeler', 'hakedis_yuzdesi', 'REAL');
  addColumnIfNotExists(database, 'projeler', 'ilerleme_miktari', 'REAL');
  addColumnIfNotExists(database, 'projeler', 'ilerleme_yuzdesi', 'REAL');
  addColumnIfNotExists(database, 'projeler', 'proje_onay_durumu', 'TEXT');
  addColumnIfNotExists(database, 'projeler', 'is_grubu', 'TEXT');
  addColumnIfNotExists(database, 'projeler', 'proje_baslangic_tarihi', 'DATE');
  addColumnIfNotExists(database, 'projeler', 'enerjilenme_tarihi', 'DATE');
  addColumnIfNotExists(database, 'projeler', 'pyp', 'TEXT');

  // Malzeme kataloğu yeni alanlar
  addColumnIfNotExists(database, 'depo_malzeme_katalogu', 'eski_poz', 'TEXT');
  addColumnIfNotExists(database, 'depo_malzeme_katalogu', 'malzeme_birim_fiyat', 'REAL DEFAULT 0');
  addColumnIfNotExists(database, 'depo_malzeme_katalogu', 'montaj_birim_fiyat', 'REAL DEFAULT 0');
  addColumnIfNotExists(database, 'depo_malzeme_katalogu', 'demontaj_birim_fiyat', 'REAL DEFAULT 0');
  addColumnIfNotExists(database, 'depo_malzeme_katalogu', 'demontajdan_montaj_fiyat', 'REAL DEFAULT 0');
  addColumnIfNotExists(database, 'depo_malzeme_katalogu', 'malzeme_sap_fiyat', 'REAL DEFAULT 0');
  addColumnIfNotExists(database, 'depo_malzeme_katalogu', 'filtre', 'TEXT');
  addColumnIfNotExists(database, 'depo_malzeme_katalogu', 'agirlik', 'REAL');

  // Departman sistemi: roller tablosuna departman_id ve birim_id
  addColumnIfNotExists(database, 'roller', 'departman_id', 'INTEGER REFERENCES departmanlar(id)');
  addColumnIfNotExists(database, 'roller', 'birim_id', 'INTEGER REFERENCES departman_birimleri(id)');

  // Adım komponent tipleri (dosya_yukleme, koordinat, kesinti)
  addColumnIfNotExists(database, 'faz_adimlari', 'komponent_tipi', "TEXT DEFAULT 'dosya_yukleme'");
  addColumnIfNotExists(database, 'proje_adimlari', 'komponent_tipi', "TEXT DEFAULT 'dosya_yukleme'");
  addColumnIfNotExists(database, 'proje_adimlari', 'meta_veri', "TEXT DEFAULT '{}'");

  // İş tipleri tablosuna varsayılan depo
  addColumnIfNotExists(database, 'is_tipleri', 'depo_id', 'INTEGER REFERENCES depolar(id)');

  // Bonolar tablosuna irsaliye alanları
  addColumnIfNotExists(database, 'bonolar', 'irsaliye_no', 'TEXT');
  addColumnIfNotExists(database, 'bonolar', 'irsaliye_tarihi', 'DATE');
  addColumnIfNotExists(database, 'bonolar', 'tedarikci_firma', 'TEXT');

  // Bono kalemleri tablosuna irsaliye miktar ve kaynak alanları
  addColumnIfNotExists(database, 'bono_kalemleri', 'miktar_bono', 'REAL DEFAULT 0');
  addColumnIfNotExists(database, 'bono_kalemleri', 'miktar_irsaliye', 'REAL DEFAULT 0');
  addColumnIfNotExists(database, 'bono_kalemleri', 'kaynak', "TEXT DEFAULT 'bono'");

  // ═══════════════════════════════════════════════════
  // Hareket Sistemi — stok hareketlerini işlem bazlı yönetim
  // ═══════════════════════════════════════════════════
  database.exec(`
    CREATE TABLE IF NOT EXISTS hareketler (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hareket_tipi TEXT NOT NULL CHECK(hareket_tipi IN ('giris','cikis','transfer','iade','fire','sayim')),
      kaynak TEXT DEFAULT 'manuel' CHECK(kaynak IN ('evrak','manuel','proje','transfer')),
      durum TEXT DEFAULT 'aktif' CHECK(durum IN ('aktif','iptal')),
      proje_id INTEGER REFERENCES projeler(id),
      kaynak_depo_id INTEGER REFERENCES depolar(id),
      hedef_depo_id INTEGER REFERENCES depolar(id),
      ekip_id INTEGER REFERENCES ekipler(id),
      teslim_alan TEXT,
      teslim_eden TEXT,
      belge_no TEXT,
      aciklama TEXT,
      tarih DATE NOT NULL,
      iptal_referans_id INTEGER REFERENCES hareketler(id),
      iptal_nedeni TEXT,
      olusturan_id INTEGER REFERENCES kullanicilar(id),
      olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  database.exec('CREATE INDEX IF NOT EXISTS idx_hareketler_tarih ON hareketler(tarih)');
  database.exec('CREATE INDEX IF NOT EXISTS idx_hareketler_tipi ON hareketler(hareket_tipi)');
  database.exec('CREATE INDEX IF NOT EXISTS idx_hareketler_proje ON hareketler(proje_id)');
  database.exec('CREATE INDEX IF NOT EXISTS idx_hareketler_durum ON hareketler(durum)');

  database.exec(`
    CREATE TABLE IF NOT EXISTS hareket_kalemleri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hareket_id INTEGER NOT NULL REFERENCES hareketler(id) ON DELETE CASCADE,
      sira_no INTEGER DEFAULT 1,
      malzeme_id INTEGER REFERENCES malzemeler(id),
      malzeme_kodu TEXT,
      poz_no TEXT,
      malzeme_adi TEXT NOT NULL,
      malzeme_cinsi TEXT,
      malzeme_tanimi_sap TEXT,
      birim TEXT DEFAULT 'Ad',
      miktar REAL NOT NULL DEFAULT 0,
      miktar_bono REAL DEFAULT 0,
      miktar_irsaliye REAL DEFAULT 0,
      birim_fiyat REAL DEFAULT 0,
      proje_kesif_id INTEGER REFERENCES proje_kesif(id),
      notlar TEXT,
      olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  database.exec('CREATE INDEX IF NOT EXISTS idx_hareket_kalemleri_hareket ON hareket_kalemleri(hareket_id)');
  database.exec('CREATE INDEX IF NOT EXISTS idx_hareket_kalemleri_malzeme ON hareket_kalemleri(malzeme_id)');

  database.exec(`
    CREATE TABLE IF NOT EXISTS hareket_dokumanlari (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hareket_id INTEGER NOT NULL REFERENCES hareketler(id) ON DELETE CASCADE,
      dosya_id INTEGER REFERENCES dosyalar(id),
      dosya_tipi TEXT DEFAULT 'belge' CHECK(dosya_tipi IN ('bono','irsaliye','fatura','tutanak','belge','diger')),
      orijinal_adi TEXT,
      olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  database.exec('CREATE INDEX IF NOT EXISTS idx_hareket_dokumanlari_hareket ON hareket_dokumanlari(hareket_id)');

  database.exec(`
    CREATE TABLE IF NOT EXISTS hareket_meta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hareket_id INTEGER NOT NULL REFERENCES hareketler(id) ON DELETE CASCADE,
      meta_tipi TEXT NOT NULL,
      veri TEXT NOT NULL
    )
  `);
  database.exec('CREATE INDEX IF NOT EXISTS idx_hareket_meta_hareket ON hareket_meta(hareket_id)');

  // Depo bazlı stok yönetimi: malzeme_hareketleri tablosuna depo alanları
  addColumnIfNotExists(database, 'malzeme_hareketleri', 'kaynak_depo_id', 'INTEGER');
  addColumnIfNotExists(database, 'malzeme_hareketleri', 'hedef_depo_id', 'INTEGER');
  database.exec('CREATE INDEX IF NOT EXISTS idx_malzeme_hareketleri_kaynak_depo ON malzeme_hareketleri(kaynak_depo_id)');
  database.exec('CREATE INDEX IF NOT EXISTS idx_malzeme_hareketleri_hedef_depo ON malzeme_hareketleri(hedef_depo_id)');

  // Varsayılan Ana Depo kaydı oluştur
  try {
    const depoSayi = database.prepare('SELECT COUNT(*) as c FROM depolar').get();
    if (depoSayi.c === 0) {
      database.prepare("INSERT INTO depolar (depo_adi, depo_tipi, sorumlu) VALUES ('Ana Depo', 'ana_depo', 'Depo Sorumlusu')").run();
      console.log('✅ Varsayılan Ana Depo oluşturuldu');
    }
  } catch (err) {
    // Tablo henüz yoksa sessizce atla
  }

  // Kullanıcı katalog eşleştirme hafızası
  database.exec(`
    CREATE TABLE IF NOT EXISTS kullanici_eslestirme (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      excel_adi TEXT NOT NULL,
      excel_adi_norm TEXT NOT NULL,
      katalog_id INTEGER,
      malzeme_kodu TEXT,
      poz_birlesik TEXT,
      malzeme_cinsi TEXT,
      malzeme_tanimi_sap TEXT,
      olcu TEXT,
      kullanim_sayisi INTEGER DEFAULT 1,
      olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
      guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  database.exec('CREATE INDEX IF NOT EXISTS idx_kullanici_eslestirme_norm ON kullanici_eslestirme(excel_adi_norm)');

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

function migrateExistingTeslimEden(database) {
  try {
    const projeler = database.prepare(
      `SELECT id, teslim_eden FROM projeler WHERE teslim_eden IS NOT NULL AND teslim_eden != '' AND teslim_eden_id IS NULL`
    ).all();
    if (projeler.length === 0) return;

    const findKisi = database.prepare('SELECT id FROM dis_kisiler WHERE ad_soyad = ? COLLATE NOCASE AND aktif = 1');
    const insertKisi = database.prepare('INSERT INTO dis_kisiler (ad_soyad) VALUES (?)');
    const updateProje = database.prepare('UPDATE projeler SET teslim_eden_id = ? WHERE id = ?');

    const kisiCache = new Map();
    const transaction = database.transaction(() => {
      for (const p of projeler) {
        const ad = p.teslim_eden.trim();
        if (!ad) continue;
        let kisiId = kisiCache.get(ad.toLowerCase());
        if (!kisiId) {
          const existing = findKisi.get(ad);
          if (existing) {
            kisiId = existing.id;
          } else {
            kisiId = insertKisi.run(ad).lastInsertRowid;
          }
          kisiCache.set(ad.toLowerCase(), kisiId);
        }
        updateProje.run(kisiId, p.id);
      }
    });
    transaction();
    console.log(`✅ ${projeler.length} proje teslim eden → dis_kisiler taşındı`);
  } catch (err) {
    // Tablo yoksa veya migration zaten yapılmışsa sessizce atla
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

function migrateAltAlanFlat(database) {
  try {
    const dosyalar = database.prepare(`
      SELECT d.id, d.alt_alan, p.proje_tipi, p.proje_no
      FROM dosyalar d
      JOIN projeler p ON d.proje_id = p.id
      WHERE d.alan = 'proje' AND d.durum = 'aktif'
        AND d.alt_alan IS NOT NULL
    `).all();

    let guncellenen = 0;
    const stmt = database.prepare('UPDATE dosyalar SET alt_alan = ? WHERE id = ?');
    for (const d of dosyalar) {
      if (!d.proje_tipi || !d.proje_no) continue;
      const hedefAltAlan = `${d.proje_tipi.toUpperCase()}/${d.proje_no}`;
      if (d.alt_alan !== hedefAltAlan) {
        stmt.run(hedefAltAlan, d.id);
        guncellenen++;
      }
    }
    if (guncellenen > 0) {
      console.log(`✅ ${guncellenen} dosyanın alt_alan'ı düzeltildi (düz proje yapısı)`);
    }
  } catch (err) {
    // Sessizce atla
  }
}

function initDatabase() {
  // Tüm tenant'lar için DB başlat
  for (const slug of Object.keys(TENANTS)) {
    if (!TENANTS[slug].active) continue;
    setCurrentTenant(slug);
    console.log(`[DB] Tenant başlatılıyor: ${slug}`);
    _initSingleDb();
  }
}

function _initSingleDb() {
  const database = getDb();
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  database.exec(schema);

  runMigrations(database);
  migrateExistingTeslimEden(database);
  migrateDonguDosyalariToVeriPaketi(database);
  migrateAltAlanFlat(database);

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

module.exports = { getDb, initDatabase, tenantStorage, setCurrentTenant, getCurrentTenantSlug, TENANTS };
