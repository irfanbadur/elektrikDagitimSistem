// HSTA (Harici Sigortalı Topraklı Ayırıcı) malzeme grubunu oluşturur.
// Takım kalemleri:
//   - AYIRICI HRC SİG. TOP. 36KV 630A 16KA/S (1 Ad) — kod 5100136599
//   - 95 mm2 Galvanizli Örgülü Çelik İletken ve gömülmesi (20 m) — topraklama
//   - 2 m Uzunluğunda Galvanizli 65 X 65 X 7 Köşebent (1 Ad)
//   - 36 KV VHD 35 (20 mm/kV) Normal Tip (6 Ad) — OG izolatör
//   - B 95 (6 Ad) — izolatör demiri
//
// İdempotent: çağrı tekrar edilirse grup ve kalemler silinip yeniden yazılır.
const Database = require('better-sqlite3');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../');
const DB_PATH = path.join(ROOT, 'data/tenants/cakmakgrup/elektratrack.db');

const db = new Database(DB_PATH);

const GRUP_AD = 'HSTA';
const GRUP_ACIKLAMA = 'Harici Sigortalı Topraklı Ayırıcı (takım)';

const KALEMLER = [
  {
    sira: 0,
    malzeme_adi: '36 KV    630 A  12.5 KA',
    malzeme_kodu: '5100136599',
    miktar: 1,
    birim: 'Ad',
    kisa_isim: 'Ayırıcı 36KV 630A',
  },
  {
    sira: 1,
    malzeme_adi: '95 mm2 Galvanizli Örgülü Çelik İletken ve gömülmesi',
    malzeme_kodu: null,
    miktar: 20,
    birim: 'm',
    kisa_isim: '95mm2 topraklama',
  },
  {
    sira: 2,
    malzeme_adi: '2 m Uzunluğunda Galvanizli 65 X 65 X 7 Köşebent ',
    malzeme_kodu: null,
    miktar: 1,
    birim: 'Ad',
    kisa_isim: 'Köşebent 65x65x7',
  },
  {
    sira: 3,
    malzeme_adi: '36 KV VHD 35 (20 mm/kV)   Normal Tip',
    malzeme_kodu: null,
    miktar: 6,
    birim: 'Ad',
    kisa_isim: 'VHD 35 Normal',
  },
  {
    sira: 4,
    malzeme_adi: 'B   95 ',
    malzeme_kodu: null,
    miktar: 6,
    birim: 'Ad',
    kisa_isim: 'B 95',
  },
];

const tx = db.transaction(() => {
  // Aynı isimde grup varsa sil (kalemler ON DELETE CASCADE ile silinir, yoksa manuel)
  const mevcut = db.prepare('SELECT id FROM malzeme_gruplari WHERE UPPER(kisa_ad) = UPPER(?)').get(GRUP_AD);
  if (mevcut) {
    db.prepare('DELETE FROM malzeme_grup_kalemleri WHERE grup_id = ?').run(mevcut.id);
    db.prepare('DELETE FROM malzeme_gruplari WHERE id = ?').run(mevcut.id);
    console.log(`  Eski HSTA grubu (id=${mevcut.id}) silindi.`);
  }

  // Yeni grubu ekle
  const r = db.prepare(
    'INSERT INTO malzeme_gruplari (kisa_ad, aciklama) VALUES (?, ?)'
  ).run(GRUP_AD, GRUP_ACIKLAMA);
  const grupId = r.lastInsertRowid;
  console.log(`✓ HSTA grubu eklendi (id=${grupId})`);

  const ins = db.prepare(`
    INSERT INTO malzeme_grup_kalemleri (grup_id, malzeme_adi, malzeme_kodu, miktar, birim, kisa_isim, sira)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const k of KALEMLER) {
    ins.run(grupId, k.malzeme_adi, k.malzeme_kodu, k.miktar, k.birim, k.kisa_isim, k.sira);
    console.log(`  + ${k.miktar} ${k.birim.padEnd(3)} ${k.malzeme_adi}`);
  }
});

tx();
console.log('\n✓ HSTA grubu seed tamamlandı.');
db.close();
