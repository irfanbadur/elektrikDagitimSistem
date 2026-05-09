/**
 * CBS altlık adımını eksik iş tiplerine ve eksik projelere ekler.
 *  - İş tipi fazlarında: cbs_altlik adımı yoksa, "teknik_hazirlik" fazına KET'teki şablonla ekle
 *  - Projelerde: cbs_altlik adımı yoksa, doğru faz tanımı ile proje_adimlari'na ekle
 *
 * Çalıştırma:
 *   node scripts/fix-cbs-altlik.js          (uygula)
 *   node scripts/fix-cbs-altlik.js --dry-run (sadece liste)
 */
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.resolve(__dirname, '../../data/tenants/cakmakgrup/elektratrack.db');
const DRY_RUN = process.argv.includes('--dry-run');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// 1) KET'teki cbs_altlik adımını şablon olarak al
const sablon = db.prepare(`
  SELECT fa.* FROM faz_adimlari fa
  JOIN is_tipi_fazlari itf ON itf.id = fa.faz_id
  JOIN is_tipleri it ON it.id = itf.is_tipi_id
  WHERE it.kod = 'KET' AND fa.adim_kodu = 'cbs_altlik'
  LIMIT 1
`).get();
if (!sablon) {
  console.error('KET iş tipinde cbs_altlik şablonu bulunamadı, devam edemiyorum.');
  process.exit(1);
}
console.log('Şablon:', sablon);

// 2) Eksik iş tiplerinde teknik_hazirlik fazına ekle
const eksikIsTipleri = db.prepare(`
  SELECT it.id, it.kod, it.ad, itf.id as faz_id, itf.faz_adi, itf.sira as faz_sira
  FROM is_tipleri it
  JOIN is_tipi_fazlari itf ON itf.is_tipi_id = it.id
  WHERE it.aktif = 1
    AND itf.faz_kodu = 'teknik_hazirlik'
    AND NOT EXISTS (
      SELECT 1 FROM faz_adimlari fa WHERE fa.faz_id = itf.id AND fa.adim_kodu = 'cbs_altlik'
    )
`).all();

console.log(`\nEksik iş tipi sayısı: ${eksikIsTipleri.length}`);
let isTipiEklenen = 0;
for (const t of eksikIsTipleri) {
  console.log(`  ${DRY_RUN ? '[DRY] ' : ''}${t.kod} → '${t.faz_adi}' fazına cbs_altlik ekleniyor (sira=${sablon.sira}, mevcut adımlar +1 kaydırılır)`);
  if (DRY_RUN) { isTipiEklenen++; continue; }
  // Mevcut sira >= sablon.sira olan adımları geçici büyük sayıya kaydır, sonra +1 yap
  // SQLite UNIQUE constraint nedeniyle iki aşamalı update gerek.
  const tx = db.transaction(() => {
    db.prepare(`UPDATE faz_adimlari SET sira = sira + 1000 WHERE faz_id = ? AND sira >= ?`)
      .run(t.faz_id, sablon.sira);
    db.prepare(`UPDATE faz_adimlari SET sira = sira - 1000 + 1 WHERE faz_id = ? AND sira >= ?`)
      .run(t.faz_id, 1000 + sablon.sira);
    db.prepare(`
      INSERT INTO faz_adimlari (faz_id, sira, adim_adi, adim_kodu, ikon, aciklama, tahmini_gun, komponent_tipi)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      t.faz_id, sablon.sira, sablon.adim_adi, sablon.adim_kodu,
      sablon.ikon, sablon.aciklama, sablon.tahmini_gun, sablon.komponent_tipi
    );
  });
  tx();
  isTipiEklenen++;
}

// 3) Eksik projelere proje_adimlari'na cbs_altlik ekle
const eksikProjeler = db.prepare(`
  SELECT p.id, p.proje_no, p.musteri_adi, p.is_tipi_id, it.kod as tip_kod
  FROM projeler p
  LEFT JOIN is_tipleri it ON it.id = p.is_tipi_id
  WHERE NOT EXISTS (
    SELECT 1 FROM proje_adimlari pa WHERE pa.proje_id = p.id AND pa.adim_kodu = 'cbs_altlik'
  )
`).all();

console.log(`\nEksik proje sayısı: ${eksikProjeler.length}`);
let projeEklenen = 0;
for (const p of eksikProjeler) {
  // Bu projenin teknik_hazirlik fazını bul (proje_adimlari'nda)
  const fazAdimi = db.prepare(`
    SELECT * FROM proje_adimlari
    WHERE proje_id = ? AND faz_kodu = 'teknik_hazirlik'
    ORDER BY sira_global ASC LIMIT 1
  `).get(p.id);
  if (!fazAdimi) {
    console.log(`  ⚠ ${p.proje_no} (${p.tip_kod}): teknik_hazirlik fazı yok, atlandı`);
    continue;
  }
  // Yeni adım için sira_global = teknik_hazirlik fazının ilk adımının sira_global'ından küçük
  // (CBS altlık genellikle ilk adım) — ama mevcut sıralamayı bozmamak için ilk adımdan -1 al
  const yeniSiraGlobal = (fazAdimi.sira_global || 0) - 0.5;

  // is_tipi_faz'i bul
  const itf = db.prepare(`
    SELECT id FROM is_tipi_fazlari WHERE is_tipi_id = ? AND faz_kodu = 'teknik_hazirlik' LIMIT 1
  `).get(p.is_tipi_id);
  // faz_adim'i bul
  const fa = itf ? db.prepare(`
    SELECT id, sira FROM faz_adimlari WHERE faz_id = ? AND adim_kodu = 'cbs_altlik' LIMIT 1
  `).get(itf.id) : null;

  if (DRY_RUN) {
    console.log(`  [DRY] ${p.proje_no} (${p.tip_kod}) → CBS altlık eklenecek (sira_global=${yeniSiraGlobal})`);
    projeEklenen++;
    continue;
  }

  db.prepare(`
    INSERT INTO proje_adimlari (
      proje_id, faz_tanim_id, adim_tanim_id, sira_global, faz_sira, adim_sira,
      faz_adi, faz_kodu, adim_adi, adim_kodu, ikon, durum, tahmini_gun, komponent_tipi
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    p.id,
    itf?.id || fazAdimi.faz_tanim_id,
    fa?.id || null,
    yeniSiraGlobal,
    fazAdimi.faz_sira,
    fa?.sira || sablon.sira,
    fazAdimi.faz_adi,
    'teknik_hazirlik',
    sablon.adim_adi,
    'cbs_altlik',
    sablon.ikon,
    'bekliyor',
    sablon.tahmini_gun,
    sablon.komponent_tipi
  );
  console.log(`  ✓ ${p.proje_no} (${p.tip_kod}) → CBS altlık eklendi`);
  projeEklenen++;
}

console.log(`\n${DRY_RUN ? '(DRY)' : ''} ÖZET:`);
console.log(`  İş tiplerine eklenen: ${isTipiEklenen}`);
console.log(`  Projelere eklenen: ${projeEklenen}`);
