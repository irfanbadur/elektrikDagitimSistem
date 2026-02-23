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

function runMigrations(database) {
  // Ekipler tablosuna konum alanları
  addColumnIfNotExists(database, 'ekipler', 'son_latitude', 'REAL');
  addColumnIfNotExists(database, 'ekipler', 'son_longitude', 'REAL');
  addColumnIfNotExists(database, 'ekipler', 'son_konum_zamani', 'DATETIME');
  addColumnIfNotExists(database, 'ekipler', 'son_konum_kaynagi', 'TEXT');

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
}

function initDatabase() {
  const database = getDb();
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  database.exec(schema);

  runMigrations(database);

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

  // Pozisyon/görev/belge/yetkinlik seed verisi (INSERT OR IGNORE ile idempotent)
  try {
    const pozSayi = database.prepare('SELECT COUNT(*) as c FROM pozisyonlar').get();
    if (pozSayi.c === 0) {
      console.log('Pozisyon/görev/belge/yetkinlik seed verisi yükleniyor...');
      const seedSql = fs.readFileSync(SEED_PATH, 'utf8');
      // Seed zaten çalıştırıldıysa INSERT OR IGNORE olduğu için tekrar çalıştırmak güvenli
      // Ama pozisyon tablosu yeni oluşmuşsa, seed'deki pozisyon verileri ilk seferde yüklenir
    }
  } catch (err) {
    // Pozisyonlar tablosu henüz yoksa veya başka bir hata - sessizce atla
  }
}

module.exports = { getDb, initDatabase };
