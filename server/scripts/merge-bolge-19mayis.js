// "19 Mayıs" bölgesini "Ondokuzmayıs" bölgesine birleştir.
//   - projeler / gunluk_rapor / veri_paketleri / enerji_kesintileri tablolarında
//     bolge_id=5 (19 Mayıs) → bolge_id=20 (Ondokuzmayıs)
//   - bolgeler tablosundan id=5 silinir.
//
// Kullanım:
//   node server/scripts/merge-bolge-19mayis.js          (dry-run)
//   node server/scripts/merge-bolge-19mayis.js --apply  (uygula)

const path = require('path');
const Database = require('better-sqlite3');
const APPLY = process.argv.includes('--apply');
const DB_PATH = path.resolve(__dirname, '../../data/tenants/cakmakgrup/elektratrack.db');

const ESKI_AD = '19 Mayıs';
const YENI_AD = 'Ondokuzmayıs';

const db = new Database(DB_PATH);
const eski = db.prepare('SELECT id FROM bolgeler WHERE bolge_adi = ?').get(ESKI_AD);
const yeni = db.prepare('SELECT id FROM bolgeler WHERE bolge_adi = ?').get(YENI_AD);
if (!eski) { console.error(`'${ESKI_AD}' bölgesi bulunamadı.`); process.exit(1); }
if (!yeni) { console.error(`'${YENI_AD}' bölgesi bulunamadı.`); process.exit(1); }
console.log(`Birleştirme: id=${eski.id} (${ESKI_AD}) → id=${yeni.id} (${YENI_AD})`);

// (tablo, kolon) çiftleri — bolgeler.id'ye referans veren tüm yerler
const REFERANSLAR = [
  ['projeler',           'bolge_id'],
  ['gunluk_rapor',       'bolge_id'],
  ['veri_paketleri',     'bolge_id'],
  ['enerji_kesintileri', 'bolge_id'],
  ['ekipler',            'varsayilan_bolge_id'],
  ['bolgeler',           'ust_bolge_id'],  // self-ref
];
for (const [t, k] of REFERANSLAR) {
  const sayi = db.prepare(`SELECT COUNT(*) c FROM ${t} WHERE ${k} = ?`).get(eski.id).c;
  console.log(`  ${(t + '.' + k).padEnd(34)} ${sayi} satır taşınacak`);
}

if (!APPLY) {
  console.log('\n[DRY-RUN] --apply ile çalıştırarak uygulayın.');
  db.close();
  return;
}

const tx = db.transaction(() => {
  for (const [t, k] of REFERANSLAR) {
    const r = db.prepare(`UPDATE ${t} SET ${k} = ? WHERE ${k} = ?`).run(yeni.id, eski.id);
    if (r.changes > 0) console.log(`  ${t}.${k}: ${r.changes} satır güncellendi`);
  }
  const r2 = db.prepare('DELETE FROM bolgeler WHERE id = ?').run(eski.id);
  console.log(`  bolgeler: id=${eski.id} silindi (${r2.changes})`);
});
tx();
console.log(`\n✓ '${ESKI_AD}' → '${YENI_AD}' birleştirme tamam.`);
db.close();
