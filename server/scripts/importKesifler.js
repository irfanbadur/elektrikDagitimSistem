/**
 * Samsun_Bati_Ket.xlsx'ten proje keşiflerini import et
 * Kullanım: node --max-old-space-size=2048 server/scripts/importKesifler.js
 */
const path = require('path');
const XLSX = require('xlsx');
const { getDb, initDatabase } = require('../db/database');

initDatabase();
const db = getDb();

console.log('=== Proje Keşif Import ===\n');

// 1. Excel'i oku
console.log('1. Excel dosyası okunuyor...');
const wb = XLSX.readFile(path.join(__dirname, '../../doc/malzeme/Samsun_Bati_Ket.xlsx'));
const ws = wb.Sheets[wb.SheetNames[0]];
const range = XLSX.utils.decode_range(ws['!ref']);

const cell = (r, c) => ws[XLSX.utils.encode_cell({ r, c })]?.v || null;

// 2. Sol taraftaki malzeme listesini oku — kapsayıcı tespit, demontaj filtresi
console.log('2. Malzeme listesi okunuyor...');
const malzemeSatirlari = [];
for (let r = 4; r <= range.e.r; r++) {
  const filtre = cell(r, 0); // A sütunu
  // Demontaj satırlarını atla (1756. satırdan sonrası)
  if (filtre && String(filtre).toUpperCase().includes('DEMONTAJ')) break;

  const poz = cell(r, 1); // B
  const malzemeKodu = cell(r, 3); // D
  const cinsi = cell(r, 5); // F
  const olcu = cell(r, 6); // G
  const agirlik = cell(r, 7); // H
  if (!poz) continue;

  // Kapsayıcı tespit: ölçü yok VEYA (ölçü=kg ve ağırlık yok → toplam kg satırı)
  const isKapsayici = !olcu || (String(olcu).toLowerCase() === 'kg' && !agirlik);

  malzemeSatirlari.push({
    r,
    excelSatir: r + 1, // 1-based satır numarası
    poz: String(poz),
    malzemeKodu: malzemeKodu ? String(malzemeKodu) : null,
    cinsi: cinsi ? String(cinsi) : '',
    olcu: olcu ? String(olcu) : '',
    agirlik: agirlik || null,
    kapsayici: isKapsayici,
  });
}
console.log(`   ${malzemeSatirlari.length} malzeme satırı (demontaj hariç), ${malzemeSatirlari.filter(m => m.kapsayici).length} kapsayıcı.\n`);

// 3. Projeleri bul (8 sütun aralıklarla, col 30'dan başlayarak)
console.log('3. Projeler taranıyor...');
const projeler = [];
for (let c = 30; c < range.e.c; c += 8) {
  const adi = cell(0, c + 4); // Row 1, 5. sütun: proje adı
  const cbsId = cell(1, c); // Row 2, 1. sütun: CBS ID
  if (!adi && !cbsId) continue;
  // Boş şablon projelerini atla (CBS undefined ve adi sadece sayı)
  if (!cbsId && (!adi || !isNaN(adi))) continue;
  projeler.push({ col: c, adi: adi ? String(adi) : '', cbsId: cbsId ? String(cbsId) : null });
}
console.log(`   ${projeler.length} proje bulundu.\n`);

// 4. DB'deki projeleri eşleştir
console.log('4. Projeler eşleştiriliyor...');
const dbProjeler = db.prepare('SELECT id, proje_no, musteri_adi, cbs_id FROM projeler WHERE proje_tipi = ?').all('KET');

const kullanilan = new Set(); // Aynı projeye çift eşleşme önle

function projeEslestir(excelProje) {
  if (!excelProje.adi || excelProje.adi.length < 3) return null;
  const norm = excelProje.adi.toUpperCase().replace(/KET\s*PROJE(Sİ)?/gi, '').replace(/\s+/g, ' ').trim();
  const kelimeler = norm.split(' ').filter(w => w.length >= 3);
  if (kelimeler.length === 0) return null;

  // Proje adı kelime eşleştirme — en çok eşleşen
  let enIyi = null, enIyiSkor = 0;
  for (const p of dbProjeler) {
    if (kullanilan.has(p.id)) continue;
    if (!p.musteri_adi) continue;
    const dbNorm = p.musteri_adi.toUpperCase().replace(/KET\s*PROJE(Sİ)?/gi, '').replace(/\s+/g, ' ').trim();
    const skor = kelimeler.filter(w => dbNorm.includes(w)).length;
    if (skor > enIyiSkor && skor >= Math.ceil(kelimeler.length * 0.5)) {
      enIyi = p;
      enIyiSkor = skor;
    }
  }
  if (enIyi) { kullanilan.add(enIyi.id); return enIyi; }
  return null;
}

// 5. Keşifleri import et
console.log('5. Keşifler import ediliyor...\n');

const insertKesif = db.prepare(`
  INSERT INTO proje_kesif (proje_id, malzeme_kodu, poz_no, malzeme_adi, birim, miktar, ilerleme, birim_fiyat, durum, okunan_deger, excel_satir, kapsayici, birim_agirlik)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'planli', ?, ?, ?, ?)
`);

// Malzeme katalogdan fiyat çekme
const katalogFiyat = db.prepare(`
  SELECT malzeme_birim_fiyat, montaj_birim_fiyat FROM depo_malzeme_katalogu
  WHERE poz_birlesik = ? LIMIT 1
`);

let toplamKesif = 0, eslesenProje = 0, eslesmeyenProje = 0;

const importAll = db.transaction(() => {
  for (const proje of projeler) {
    const dbProje = projeEslestir(proje);
    if (!dbProje) {
      eslesmeyenProje++;
      console.log(`   ❌ Eşleşmedi: "${proje.adi}" (CBS: ${proje.cbsId})`);
      continue;
    }
    eslesenProje++;

    // Bu projenin mevcut keşiflerini sil
    db.prepare('DELETE FROM proje_kesif WHERE proje_id = ?').run(dbProje.id);

    // AF sütunu (c+1): YER TESLİMİ, AG (c+2): İLERLEME
    // Önce hangi satırlarda veri var tespit et
    const veriOlanSatirlar = new Set();
    for (const m of malzemeSatirlari) {
      const miktar = cell(m.r, proje.col + 1);
      const ilerleme = cell(m.r, proje.col + 2);
      if ((miktar && typeof miktar === 'number' && miktar > 0) ||
          (ilerleme && typeof ilerleme === 'number' && ilerleme > 0)) {
        veriOlanSatirlar.add(m.r);
      }
    }

    // Alt satır eklendiğinde kapsayıcı üst satırları da ekle
    const eklenenPozlar = new Set();
    let projeKesifSayisi = 0;

    for (const m of malzemeSatirlari) {
      const miktar = cell(m.r, proje.col + 1);
      const ilerleme = cell(m.r, proje.col + 2);
      const hasMiktar = miktar && typeof miktar === 'number' && miktar > 0;
      const hasIlerleme = ilerleme && typeof ilerleme === 'number' && ilerleme > 0;

      if (m.kapsayici) {
        // Kapsayıcı satır: altındaki herhangi bir alt satırda veri varsa ekle
        const pozPrefix = m.poz;
        const altSatirVar = malzemeSatirlari.some(alt =>
          !alt.kapsayici && alt.poz.startsWith(pozPrefix) && alt.poz !== pozPrefix && veriOlanSatirlar.has(alt.r)
        );
        // Kapsayıcının kendisinde de veri olabilir (kg toplam)
        if (!altSatirVar && !hasMiktar && !hasIlerleme) continue;
      } else {
        // Normal satır: veri yoksa atla
        if (!hasMiktar && !hasIlerleme) continue;
      }

      if (eklenenPozlar.has(m.poz)) continue; // Duplikat engelle
      eklenenPozlar.add(m.poz);

      const fiyat = katalogFiyat.get(m.poz);
      const birimFiyat = (fiyat?.malzeme_birim_fiyat || 0) + (fiyat?.montaj_birim_fiyat || 0);

      insertKesif.run(
        dbProje.id,
        m.malzemeKodu,
        m.poz,
        m.cinsi,
        m.kapsayici ? (m.olcu || 'kg') : (m.olcu || 'Ad'),
        hasMiktar ? miktar : 0,
        hasIlerleme ? ilerleme : 0,
        birimFiyat,
        m.poz, // okunan_deger
        m.excelSatir,
        m.kapsayici ? 1 : 0,
        m.agirlik || 0
      );
      projeKesifSayisi++;
    }

    if (projeKesifSayisi > 0) {
      toplamKesif += projeKesifSayisi;
      console.log(`   ✅ ${dbProje.proje_no}: ${projeKesifSayisi} malzeme (${proje.adi.substring(0, 35)})`);
    }
  }
});

importAll();

console.log(`\n=== Tamamlandı ===`);
console.log(`Eşleşen proje: ${eslesenProje}`);
console.log(`Eşleşmeyen: ${eslesmeyenProje}`);
console.log(`Toplam keşif kalemi: ${toplamKesif}`);
console.log(`DB keşif toplam: ${db.prepare('SELECT COUNT(*) as c FROM proje_kesif').get().c}`);
