/**
 * Hak Ediş Krokisi adımındaki eski versiyon dosyaları sil:
 * DB kaydı + uploads/ kopyası + doc/hakediş/KROKİLER kaynak dosyası.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.resolve(__dirname, '../../data/tenants/cakmakgrup/elektratrack.db');
const UPLOADS_ROOT = path.resolve(__dirname, '../../data/tenants/cakmakgrup/uploads');
const KROKI_DIR = path.resolve(__dirname, '../../doc/hakediş/KROKİLER');

const ESKI_DOSYALAR = [
  'Kerim Bircan.dxf',
  'Dereköy KET.dxf',
  'Esat Civelek.dxf',
  'Metin Değirmenci.dxf',
];

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

let dbSil = 0, uploadSil = 0, kaynakSil = 0;
for (const orj of ESKI_DOSYALAR) {
  const kayit = db.prepare(`
    SELECT d.id, d.dosya_yolu, p.proje_no FROM dosyalar d
    JOIN proje_adimlari pa ON pa.id = d.proje_adim_id
    JOIN projeler p ON p.id = d.proje_id
    WHERE pa.faz_kodu='hak_edis' AND pa.adim_kodu='hak_edis_krokisi'
      AND d.kaynak='doc-import' AND d.orijinal_adi = ? AND d.durum='aktif' LIMIT 1
  `).get(orj);

  if (kayit) {
    // upload dosyası sil
    const tamYol = path.join(UPLOADS_ROOT, kayit.dosya_yolu);
    if (fs.existsSync(tamYol)) { fs.unlinkSync(tamYol); uploadSil++; }
    // DB kaydı sil
    db.prepare('DELETE FROM dosyalar WHERE id = ?').run(kayit.id);
    dbSil++;
    console.log(`  ✓ DB+upload silindi: ${kayit.proje_no} ← ${orj}`);
  } else {
    console.log(`  - DB'de yok: ${orj}`);
  }

  // Kaynak (doc/) dosyası sil
  const kaynak = path.join(KROKI_DIR, orj);
  if (fs.existsSync(kaynak)) {
    fs.unlinkSync(kaynak);
    kaynakSil++;
    console.log(`  ✓ kaynak silindi: ${orj}`);
  }
}

console.log(`\nSilinen — DB: ${dbSil}, upload: ${uploadSil}, kaynak: ${kaynakSil}`);
