// BAKIM tipi işin yaşam döngüsünü YB ile aynı yapar.
//
// İşlem:
//   1) is_tipi_fazlari (BAKIM ve YB için aynı 7 faz var — değişmez, atlanır)
//   2) faz_adimlari: BAKIM faz'larındaki tüm adımlar silinir, YB faz'larındaki
//      adımlar BAKIM'a kopyalanır (faz_kodu eşleştirmesi)
//   3) proje_adimlari: BAKIM tipi projelerin (mevcut) adımları yeniden oluşturulur.
//      Eski adımların DURUM bilgisi (tamamlandi/devam_ediyor/baslangic_tarihi vb.)
//      adim_kodu eşleşmesi ile korunmaya çalışılır.
//
// Kullanım:
//   node server/scripts/sync-bakim-yasam-dongusu.js          (dry-run)
//   node server/scripts/sync-bakim-yasam-dongusu.js --apply  (uygula)

const path = require('path');
const Database = require('better-sqlite3');
const APPLY = process.argv.includes('--apply');
const DB_PATH = path.resolve(__dirname, '../../data/tenants/cakmakgrup/elektratrack.db');

const KAYNAK_KOD = 'YB';
const HEDEF_KOD = 'BAKIM';

const db = new Database(DB_PATH);

const kaynak = db.prepare('SELECT id, kod, ad FROM is_tipleri WHERE kod = ?').get(KAYNAK_KOD);
const hedef = db.prepare('SELECT id, kod, ad FROM is_tipleri WHERE kod = ?').get(HEDEF_KOD);
if (!kaynak || !hedef) { console.error('Kaynak/hedef iş tipi bulunamadı.'); process.exit(1); }
console.log(`Kaynak: id=${kaynak.id} (${kaynak.kod} - ${kaynak.ad})`);
console.log(`Hedef:  id=${hedef.id} (${hedef.kod} - ${hedef.ad})`);

const kaynakFazlar = db.prepare('SELECT id, faz_kodu, faz_adi, sira FROM is_tipi_fazlari WHERE is_tipi_id = ? ORDER BY sira').all(kaynak.id);
const hedefFazlar  = db.prepare('SELECT id, faz_kodu, faz_adi, sira FROM is_tipi_fazlari WHERE is_tipi_id = ? ORDER BY sira').all(hedef.id);
console.log(`\nKaynak fazlar (${kaynakFazlar.length}):`, kaynakFazlar.map(f => f.faz_kodu).join(', '));
console.log(`Hedef fazlar (${hedefFazlar.length}):`, hedefFazlar.map(f => f.faz_kodu).join(', '));

// faz_kodu → hedef faz_id
const hedefFazMap = new Map(hedefFazlar.map(f => [f.faz_kodu, f]));
const eksikFaz = kaynakFazlar.filter(f => !hedefFazMap.has(f.faz_kodu));
if (eksikFaz.length) {
  console.warn(`! Hedefte eksik fazlar: ${eksikFaz.map(f => f.faz_kodu).join(', ')}`);
}

const kaynakAdimlar = db.prepare(`
  SELECT fa.faz_id, fa.sira, fa.adim_kodu, fa.adim_adi, fa.ikon, fa.aciklama, fa.tahmini_gun, fa.komponent_tipi,
         f.faz_kodu
  FROM faz_adimlari fa JOIN is_tipi_fazlari f ON fa.faz_id = f.id
  WHERE f.is_tipi_id = ?
  ORDER BY f.sira, fa.sira
`).all(kaynak.id);
const hedefAdimlarEski = db.prepare(`
  SELECT fa.id, fa.faz_id, fa.adim_kodu, fa.adim_adi FROM faz_adimlari fa
  JOIN is_tipi_fazlari f ON fa.faz_id = f.id WHERE f.is_tipi_id = ?
`).all(hedef.id);

console.log(`\nfaz_adimlari değişiklik:`);
console.log(`  hedeften silinecek:      ${hedefAdimlarEski.length}`);
console.log(`  hedefe kopyalanacak:     ${kaynakAdimlar.length}`);

const projeler = db.prepare('SELECT id, proje_no, musteri_adi FROM projeler WHERE is_tipi_id = ?').all(hedef.id);
const projeAdimSayi = db.prepare(`
  SELECT COUNT(*) c FROM proje_adimlari pa
  JOIN projeler p ON pa.proje_id = p.id WHERE p.is_tipi_id = ?
`).get(hedef.id).c;
console.log(`\nproje_adimlari değişiklik:`);
console.log(`  Etkilenecek proje sayısı: ${projeler.length}`);
console.log(`  Eski adım kayıtları:      ${projeAdimSayi}`);
projeler.forEach(p => console.log(`    - #${p.id} ${p.proje_no} (${p.musteri_adi})`));

if (!APPLY) {
  console.log('\n[DRY-RUN] --apply ile çalıştırarak uygulayın.');
  db.close();
  return;
}

const tx = db.transaction(() => {
  // 1) Mevcut BAKIM projelerinin adım durumlarını adim_kodu ile sakla
  const eskiProjeAdimlari = db.prepare(`
    SELECT pa.* FROM proje_adimlari pa JOIN projeler p ON pa.proje_id = p.id
    WHERE p.is_tipi_id = ?
  `).all(hedef.id);
  // proje_id + adim_kodu → durum bilgisi
  const eskiDurumMap = new Map();
  for (const r of eskiProjeAdimlari) {
    eskiDurumMap.set(`${r.proje_id}|${r.adim_kodu}`, r);
  }

  // 2) BAKIM proje_adimlari sil
  const silProje = db.prepare(`
    DELETE FROM proje_adimlari WHERE proje_id IN (SELECT id FROM projeler WHERE is_tipi_id = ?)
  `).run(hedef.id);
  console.log(`  proje_adimlari sil: ${silProje.changes}`);

  // 3) BAKIM faz_adimlari sil
  const silFaz = db.prepare(`
    DELETE FROM faz_adimlari WHERE faz_id IN (SELECT id FROM is_tipi_fazlari WHERE is_tipi_id = ?)
  `).run(hedef.id);
  console.log(`  faz_adimlari sil:   ${silFaz.changes}`);

  // 4) YB adımlarını BAKIM'a kopyala (faz_kodu eşleştirme)
  const fazKaynakIdMap = new Map(kaynakFazlar.map(f => [f.faz_kodu, f.id]));
  const insFaz = db.prepare(`
    INSERT INTO faz_adimlari (faz_id, sira, adim_adi, adim_kodu, ikon, aciklama, tahmini_gun, komponent_tipi)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let eklenenFaz = 0;
  for (const a of kaynakAdimlar) {
    const hedefFaz = hedefFazMap.get(a.faz_kodu);
    if (!hedefFaz) { console.warn(`  ! YB faz "${a.faz_kodu}" BAKIM'da yok, ${a.adim_kodu} atlandı`); continue; }
    insFaz.run(hedefFaz.id, a.sira, a.adim_adi, a.adim_kodu, a.ikon, a.aciklama, a.tahmini_gun, a.komponent_tipi);
    eklenenFaz++;
  }
  console.log(`  faz_adimlari ekle:  ${eklenenFaz}`);

  // 5) BAKIM projelerinin proje_adimlari'nı yeniden oluştur
  // Yeni hedef adımları (faz_adimlari + faz bilgisi)
  const yeniAdimlar = db.prepare(`
    SELECT fa.id AS adim_tanim_id, fa.faz_id, fa.sira AS adim_sira,
           fa.adim_kodu, fa.adim_adi, fa.ikon, fa.tahmini_gun, fa.komponent_tipi,
           f.id AS faz_tanim_id, f.faz_kodu, f.faz_adi, f.sira AS faz_sira
    FROM faz_adimlari fa
    JOIN is_tipi_fazlari f ON fa.faz_id = f.id
    WHERE f.is_tipi_id = ?
    ORDER BY f.sira, fa.sira
  `).all(hedef.id);

  const insProje = db.prepare(`
    INSERT INTO proje_adimlari (
      proje_id, faz_tanim_id, adim_tanim_id, sira_global, faz_sira, adim_sira,
      faz_adi, faz_kodu, adim_adi, adim_kodu, ikon, tahmini_gun, durum,
      baslangic_tarihi, bitis_tarihi, planlanan_baslangic, planlanan_bitis,
      notlar, tamamlanma_notu, baslatan_id, tamamlayan_id, sorumlu_rol_id, sorumlu_kullanici_id,
      komponent_tipi, meta_veri
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let eklenenProje = 0, korunanDurum = 0;
  for (const p of projeler) {
    let sira_global = 0;
    for (const a of yeniAdimlar) {
      sira_global++;
      const eski = eskiDurumMap.get(`${p.id}|${a.adim_kodu}`);
      const durum = eski?.durum || 'beklemede';
      if (eski?.durum && eski.durum !== 'beklemede') korunanDurum++;
      insProje.run(
        p.id, a.faz_tanim_id, a.adim_tanim_id, sira_global, a.faz_sira, a.adim_sira,
        a.faz_adi, a.faz_kodu, a.adim_adi, a.adim_kodu, a.ikon || null, a.tahmini_gun || null, durum,
        eski?.baslangic_tarihi || null, eski?.bitis_tarihi || null,
        eski?.planlanan_baslangic || null, eski?.planlanan_bitis || null,
        eski?.notlar || null, eski?.tamamlanma_notu || null,
        eski?.baslatan_id || null, eski?.tamamlayan_id || null,
        eski?.sorumlu_rol_id || null, eski?.sorumlu_kullanici_id || null,
        a.komponent_tipi || null, eski?.meta_veri || null
      );
      eklenenProje++;
    }
  }
  console.log(`  proje_adimlari ekle: ${eklenenProje} (${korunanDurum} adım durumu korundu)`);
});

tx();
console.log(`\n✓ BAKIM yaşam döngüsü YB ile senkronize edildi.`);
db.close();
