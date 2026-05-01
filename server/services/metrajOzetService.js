// Direk-bazlı metraj listesinden agrega özet üretir.
// Parent-child katalog ilişkisi:
//   - Direk_tip "10I" katalogda malzeme_cinsi='10I', poz_birlesik='85.105.1901.2', agirlik=205kg
//   - Parent poz='85.105.1901' ('Şehir içi AG ve OG Müşterek Şebeke Direkleri için'),
//     birim='kg', montaj_birim_fiyat=68.23 ₺/kg
//   - Çocukların adetleri × agirlik = parent'ın toplam kg miktarı
//   - Toplam tutar = parent.miktar(kg) × parent.fiyat(₺/kg)
const { getDb } = require('../db/database');

// Direk tipini katalog formatına normalize et: G- önekini at, (P) parantezi sil,
// apostrofları çift tırnağa çevir
function direkTipNormalize(tip) {
  if (!tip) return '';
  return String(tip)
    .replace(/^G-/i, '')
    .replace(/\(P\)/gi, '')
    .replace(/'+/g, '"')   // bir veya daha fazla apostrof → "
    .trim();
}

// "miktar|kisaIsim|adi|gorunur" ya da eski format
function malzemeNotuParse(line) {
  const parts = line.split('|');
  if (parts.length >= 3) return { miktar: Number(parts[0]) || 1, adi: parts[2] };
  if (parts.length === 2) return { miktar: Number(parts[0]) || 1, adi: parts[1] };
  const m = line.match(/^(\d+)x\s*(.+)$/);
  if (m) return { miktar: Number(m[1]), adi: m[2] };
  return { miktar: 1, adi: line };
}
function iletkenNotuParse(line) {
  const raw = line.replace(/^Iletken:\s*/i, '');
  const parts = raw.split('|');
  return { tip: parts[0] || raw, mesafe: parts[1] ? Number(parts[1]) : 0 };
}

// Katalogda malzeme_cinsi üzerinden child kaydı bul (en iyi eşleşme).
// Tam eşleşme → parantezsiz prefix → ilk 2 kelime sırasıyla denenir.
// Birden fazla satırı varsa fiyat/agirlik dolu olanı tercih et.
function childBul(db, ad) {
  if (!ad) return null;

  const adaylariSec = (sql, params) => db.prepare(sql).all(...params);
  const enIyi = (rows) => {
    if (!rows.length) return null;
    // Önce malzeme_birim_fiyat>0 || agirlik IS NOT NULL olanı seç
    const dolu = rows.find(r => Number(r.malzeme_birim_fiyat) > 0 || Number(r.montaj_birim_fiyat) > 0 || r.agirlik != null);
    return dolu || rows[0];
  };

  const SUTUNLAR = `id, poz_birlesik, malzeme_kodu, malzeme_cinsi, olcu, agirlik, malzeme_birim_fiyat, montaj_birim_fiyat`;

  // 1) Tam eşleşme
  let r = enIyi(adaylariSec(
    `SELECT ${SUTUNLAR} FROM depo_malzeme_katalogu WHERE malzeme_cinsi = ? COLLATE NOCASE`, [ad]
  ));
  if (r) return r;

  // 2) Direk-tipi normalize ile dene (apostrof → çift tırnak, G- önek vb.)
  const norm = direkTipNormalize(ad);
  if (norm && norm !== ad) {
    r = enIyi(adaylariSec(
      `SELECT ${SUTUNLAR} FROM depo_malzeme_katalogu WHERE malzeme_cinsi = ? COLLATE NOCASE`, [norm]
    ));
    if (r) return r;
  }

  // 3) Parantezsiz prefix
  const cikarParans = ad.replace(/\([^)]*\)/g, '').trim();
  if (cikarParans.length >= 3) {
    r = enIyi(adaylariSec(
      `SELECT ${SUTUNLAR} FROM depo_malzeme_katalogu WHERE malzeme_cinsi LIKE ? COLLATE NOCASE
       ORDER BY LENGTH(malzeme_cinsi) ASC LIMIT 5`, [cikarParans + '%']
    ));
    if (r) return r;
  }

  // 4) İlk 2 kelime
  const kelimeler = ad.split(/\s+/).filter(w => w.length >= 2);
  if (kelimeler.length >= 2) {
    const oncu = kelimeler.slice(0, 2).join(' ');
    r = enIyi(adaylariSec(
      `SELECT ${SUTUNLAR} FROM depo_malzeme_katalogu WHERE malzeme_cinsi LIKE ? COLLATE NOCASE
       ORDER BY LENGTH(malzeme_cinsi) ASC LIMIT 5`, [oncu + '%']
    ));
    if (r) return r;
  }
  return null;
}

// Child'ın parent'ını bul: poz_birlesik segment kısaltılarak ara,
// fiyatı (malzeme veya montaj) > 0 olan ilk parent'ı döndür.
function parentBul(db, childPoz) {
  if (!childPoz) return null;
  const parcalar = childPoz.split('.');
  for (let i = parcalar.length - 1; i >= 2; i--) {
    const parentPoz = parcalar.slice(0, i).join('.');
    if (parentPoz === childPoz) continue; // self
    const adaylar = db.prepare(
      `SELECT poz_birlesik, malzeme_cinsi, olcu, malzeme_birim_fiyat, montaj_birim_fiyat
       FROM depo_malzeme_katalogu WHERE poz_birlesik = ?`
    ).all(parentPoz);
    if (!adaylar.length) continue;
    // Fiyatı dolu olan kaydı seç
    const dolu = adaylar.find(p => Number(p.malzeme_birim_fiyat) > 0 || Number(p.montaj_birim_fiyat) > 0);
    if (dolu) return dolu;
  }
  return null;
}

// proje_kesif tablosundan ilerleme değerlerini poz_no üzerinden eşleştir
// (Excel-truth sync sonucunda doldurulmuş olur)
function ilerlemeMapHaz(db, projeId) {
  const rows = db.prepare(
    `SELECT poz_no, ilerleme FROM proje_kesif WHERE proje_id = ? AND poz_no IS NOT NULL`
  ).all(projeId);
  const m = new Map();
  for (const r of rows) {
    if (r.poz_no) m.set(r.poz_no, Number(r.ilerleme) || 0);
  }
  return m;
}

// Ana fonksiyon
function malzemeOzetiUret(tabloAdi, projeId) {
  const db = getDb();
  const satirlar = db.prepare(
    `SELECT direk_tip, ag_iletken, og_iletken, ara_mesafe, notlar FROM ${tabloAdi} WHERE proje_id = ?`
  ).all(projeId);
  const ilerlemeMap = ilerlemeMapHaz(db, projeId);

  // 1) Ham agrega
  const direkler = new Map();    // tip → adet
  const malzemeler = new Map();  // adi → miktar
  const iletkenler = new Map();  // tip → mesafe
  for (const s of satirlar) {
    if (s.direk_tip) {
      direkler.set(s.direk_tip, (direkler.get(s.direk_tip) || 0) + 1);
    }
    if (s.notlar) {
      for (const line of s.notlar.split('\n').filter(Boolean)) {
        if (/^Iletken:/i.test(line)) {
          const { tip, mesafe } = iletkenNotuParse(line);
          if (tip) iletkenler.set(tip, (iletkenler.get(tip) || 0) + mesafe);
        } else {
          const { adi, miktar } = malzemeNotuParse(line);
          if (adi) malzemeler.set(adi, (malzemeler.get(adi) || 0) + miktar);
        }
      }
    }
  }

  // 2) Her ham kalemi katalogda eşle
  const haziraza = []; // { kategori, adi, miktar, child, parent }
  const ekle = (kategori, adi, miktar) => {
    const child = childBul(db, adi);
    let parent = null;
    if (child) parent = parentBul(db, child.poz_birlesik);
    haziraza.push({ kategori, adi, miktar, child, parent });
  };
  for (const [tip, adet] of direkler) ekle('direk', tip, adet);
  for (const [adi, mt] of malzemeler) ekle('malzeme', adi, mt);
  for (const [tip, mes] of iletkenler) ekle('iletken', tip, mes);

  // 3) Parent'a göre grupla. Parent'ı olmayan kalemler bağımsız listeye gider.
  const grupMap = new Map(); // parent_poz → { parent, cocuklar: [] }
  const bagimsiz = [];
  for (const h of haziraza) {
    if (h.parent && h.child) {
      const key = h.parent.poz_birlesik;
      const g = grupMap.get(key) || { parent: h.parent, cocuklar: [] };
      g.cocuklar.push(h);
      grupMap.set(key, g);
    } else {
      bagimsiz.push(h);
    }
  }

  // 4) Sonuç biçimle
  const sonuc = { gruplar: [], bagimsiz: [], genel_toplam: 0, genel_ilerleme_tutar: 0 };

  for (const [, g] of grupMap) {
    const parentFiyat = (Number(g.parent.malzeme_birim_fiyat) || 0) + (Number(g.parent.montaj_birim_fiyat) || 0);
    let toplamMiktar = 0;
    let toplamIlerlemeMiktar = 0;
    const cocukSatirlari = g.cocuklar.map(c => {
      const agirlik = Number(c.child.agirlik) || 0;
      const altToplam = c.miktar * agirlik;
      toplamMiktar += altToplam;
      // ilerleme: child'ın poz'una göre proje_kesif tablosundan
      const ilerleme = ilerlemeMap.get(c.child.poz_birlesik) || 0;
      const altIlerlemeMiktar = ilerleme * agirlik;
      toplamIlerlemeMiktar += altIlerlemeMiktar;
      return {
        adi: c.adi,
        kategori: c.kategori,
        miktar: c.miktar,
        birim: c.child.olcu || (c.kategori === 'iletken' ? 'm' : 'Ad'),
        agirlik,
        alt_toplam_miktar: altToplam,
        ilerleme,
        alt_ilerleme_miktar: altIlerlemeMiktar,
        poz: c.child.poz_birlesik,
      };
    });
    cocukSatirlari.sort((a, b) => a.adi.localeCompare(b.adi));
    const toplamTutar = toplamMiktar * parentFiyat;
    const ilerlemeTutar = toplamIlerlemeMiktar * parentFiyat;
    sonuc.gruplar.push({
      poz: g.parent.poz_birlesik,
      adi: g.parent.malzeme_cinsi,
      birim: g.parent.olcu || 'kg',
      birim_fiyat: parentFiyat,
      toplam_miktar: toplamMiktar,
      toplam_tutar: toplamTutar,
      ilerleme_miktar: toplamIlerlemeMiktar,
      ilerleme_tutar: ilerlemeTutar,
      cocuklar: cocukSatirlari,
    });
    sonuc.genel_toplam += toplamTutar;
    sonuc.genel_ilerleme_tutar += ilerlemeTutar;
  }
  sonuc.gruplar.sort((a, b) => (a.poz || '').localeCompare(b.poz || ''));

  for (const b of bagimsiz) {
    let birim = b.kategori === 'iletken' ? 'm' : 'Ad';
    let fiyat = 0;
    let poz = null;
    if (b.child) {
      birim = b.child.olcu || birim;
      fiyat = (Number(b.child.malzeme_birim_fiyat) || 0) + (Number(b.child.montaj_birim_fiyat) || 0);
      poz = b.child.poz_birlesik;
    }
    const toplam = b.miktar * fiyat;
    const ilerleme = poz ? (ilerlemeMap.get(poz) || 0) : 0;
    const ilerlemeTutar = ilerleme * fiyat;
    sonuc.bagimsiz.push({
      adi: b.adi,
      kategori: b.kategori,
      miktar: b.miktar,
      birim,
      birim_fiyat: fiyat,
      toplam_tutar: toplam,
      ilerleme,
      ilerleme_tutar: ilerlemeTutar,
      poz,
      katalog_eslesmedi: !b.child,
    });
    sonuc.genel_toplam += toplam;
    sonuc.genel_ilerleme_tutar += ilerlemeTutar;
  }
  sonuc.bagimsiz.sort((a, b) => a.adi.localeCompare(b.adi));

  return sonuc;
}

module.exports = { malzemeOzetiUret };
