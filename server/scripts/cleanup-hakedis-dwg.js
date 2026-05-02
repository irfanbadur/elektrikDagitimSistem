/**
 * Hak Ediş Krokisi adımına 'doc-import' kaynağıyla yüklenmiş .dwg dosyalarını
 * DB'den ve uploads klasöründen siler. Önizlemede açılamadığı için artık DXF
 * kullanıyoruz.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.resolve(__dirname, '../../data/tenants/cakmakgrup/elektratrack.db');
const UPLOADS_ROOT = path.resolve(__dirname, '../../data/tenants/cakmakgrup/uploads');
const DRY_RUN = process.argv.includes('--dry-run');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const kayitlar = db.prepare(`
  SELECT d.id, d.dosya_adi, d.dosya_yolu, d.orijinal_adi, p.proje_no, p.musteri_adi
  FROM dosyalar d
  JOIN proje_adimlari pa ON pa.id = d.proje_adim_id
  JOIN projeler p ON p.id = d.proje_id
  WHERE pa.faz_kodu = 'hak_edis'
    AND pa.adim_kodu = 'hak_edis_krokisi'
    AND d.kaynak = 'doc-import'
    AND d.durum = 'aktif'
    AND LOWER(d.dosya_adi) LIKE '%.dwg'
`).all();

console.log(`Silinecek kayıt: ${kayitlar.length}\n`);

let silinen = 0, eksik = 0;
for (const k of kayitlar) {
  const tamYol = path.join(UPLOADS_ROOT, k.dosya_yolu);
  console.log(`  ${DRY_RUN ? '[DRY] ' : ''}${k.proje_no.padEnd(20)} ← ${k.orijinal_adi}`);

  if (DRY_RUN) continue;

  // Fiziksel dosya sil
  try {
    if (fs.existsSync(tamYol)) {
      fs.unlinkSync(tamYol);
    } else {
      eksik++;
    }
  } catch (err) {
    console.error(`    ✗ dosya sil hatası: ${err.message}`);
  }

  // DB kaydı sil
  db.prepare('DELETE FROM dosyalar WHERE id = ?').run(k.id);
  silinen++;
}

console.log(`\n${DRY_RUN ? '(DRY)' : ''} Silinen DB kaydı: ${silinen} | fiziksel dosya yok: ${eksik}`);
