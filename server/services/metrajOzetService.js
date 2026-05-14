// Direk-bazlı metraj listesinden agrega özet üretir.
// Parent-child katalog ilişkisi:
//   - Direk_tip "10I" katalogda malzeme_cinsi='10I', poz_birlesik='85.105.1901.2', agirlik=205kg
//   - Parent poz='85.105.1901' ('Şehir içi AG ve OG Müşterek Şebeke Direkleri için'),
//     birim='kg', montaj_birim_fiyat=68.23 ₺/kg
//   - Çocukların adetleri × agirlik = parent'ın toplam kg miktarı
//   - Toplam tutar = parent.miktar(kg) × parent.fiyat(₺/kg)
const { getDb } = require('../db/database');
const { tertibiParseTekil, acikHatExpand, ogExpand, kgKmParse } = require('./iletkenTertibi');

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
  const tipHam = parts[0] || raw;
  // Parantezler durum gösterir: "[X]" → DMM, "(X)" → Mevcut
  let durumFromParens = null;
  if (/^\[.*\]$/.test(tipHam)) durumFromParens = 'DMM';
  else if (/^\(.*\)$/.test(tipHam)) durumFromParens = 'Mevcut';
  const tip = tipHam.replace(/^[\[\(]|[\]\)]$/g, '').trim();
  return {
    tip,
    mesafe: parts[1] ? Number(parts[1]) : 0,
    durum: parts[4] || durumFromParens || null,
  };
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

  // 1b) AER kablo özel arama — "3x35/16+50_AER", "3X35/16+50 AER" gibi formatlar
  //   Katalog malzeme_cinsi: "3 X 35 / 16 + 50 mm^2" (boşluklu, mm^2 eki, parent poz=85.209.15xx AER kabloları)
  //   Katalog malzeme_tanimi_sap: bazılarında dolu, çoğunda boş
  const aerMatch = String(ad).match(/(\d+)\s*[xX]\s*(\d+)\s*\/\s*(\d+)\s*\+\s*(\d+)[^A-Za-z]*AER/i);
  if (aerMatch) {
    const [, adetStr, fazStr, notrStr, sokakStr] = aerMatch;
    const adet = parseInt(adetStr, 10), faz = parseInt(fazStr, 10), notr = parseInt(notrStr, 10), sokak = parseInt(sokakStr, 10);

    // 1) Cins pattern: "3 X 35 / 16 + 50" formatı (boşluklu) — parent poz 85.209.15xx altında ara
    const cinsLike = `${adet} X ${faz} / ${notr} + ${sokak}%`;
    r = enIyi(adaylariSec(
      `SELECT ${SUTUNLAR} FROM depo_malzeme_katalogu
       WHERE poz_birlesik LIKE '85.209.15%' AND malzeme_cinsi LIKE ? COLLATE NOCASE
       ORDER BY (malzeme_birim_fiyat > 0 OR montaj_birim_fiyat > 0) DESC LIMIT 5`,
      [cinsLike]
    ));
    if (r) return r;

    // 2) SAP pattern: "3x35/1x16/50" — bazı kayıtlarda var
    const sapPat = `%${adet}x${faz}/1x${notr}/${sokak}%AER%`;
    r = enIyi(adaylariSec(
      `SELECT ${SUTUNLAR} FROM depo_malzeme_katalogu
       WHERE malzeme_tanimi_sap LIKE ? COLLATE NOCASE
       ORDER BY (malzeme_birim_fiyat > 0 OR montaj_birim_fiyat > 0) DESC LIMIT 5`,
      [sapPat]
    ));
    if (r) return r;

    // 3) Esnek: parent 85.209.15xx altında, 4 sayı ardışık geçenler
    const esnekPat = `%${faz}%${notr}%${sokak}%`;
    r = enIyi(adaylariSec(
      `SELECT ${SUTUNLAR} FROM depo_malzeme_katalogu
       WHERE poz_birlesik LIKE '85.209.15%' AND malzeme_cinsi LIKE ? COLLATE NOCASE
       ORDER BY (malzeme_birim_fiyat > 0 OR montaj_birim_fiyat > 0) DESC, LENGTH(malzeme_cinsi) ASC LIMIT 5`,
      [esnekPat]
    ));
    if (r) {
      // Doğrula: cins'te 3 sayı da geçiyor mu
      const cins = String(r.malzeme_cinsi || '');
      const wb = (n) => new RegExp(`\\b${n}\\b`).test(cins);
      if (wb(faz) && wb(notr) && wb(sokak)) return r;
    }
  }

  // 2) Direk-tipi normalize ile dene (apostrof → çift tırnak, G- önek vb.)
  const norm = direkTipNormalize(ad);
  if (norm && norm !== ad) {
    r = enIyi(adaylariSec(
      `SELECT ${SUTUNLAR} FROM depo_malzeme_katalogu WHERE malzeme_cinsi = ? COLLATE NOCASE`, [norm]
    ));
    if (r) return r;
  }

  // 2b) Tire ↔ boşluk varyasyonları — katalog tutarsız: "6,5U 80" boşluklu, "6,5U-100" tireli
  // Hem "6,5U-80" → "6,5U 80" hem "6,5U 100" → "6,5U-100" denenir
  const variants = new Set();
  if (/[-\s]/.test(ad)) {
    variants.add(ad.replace(/[-\s]+/g, ' ').trim());
    variants.add(ad.replace(/[-\s]+/g, '-').trim());
    variants.add(ad.replace(/-/g, ' ').trim());
    variants.add(ad.replace(/\s+/g, '-').trim());
  }
  variants.delete(ad);
  for (const v of variants) {
    if (!v) continue;
    r = enIyi(adaylariSec(
      `SELECT ${SUTUNLAR} FROM depo_malzeme_katalogu WHERE malzeme_cinsi = ? COLLATE NOCASE`, [v]
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

// Türkçe normalize (KORUMA / Koruma / koruma → KORUMA)
function trUst(s) {
  return String(s || '')
    .replace(/ı/g, 'I').replace(/İ/g, 'I')
    .replace(/ğ/g, 'G').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'U').replace(/Ü/g, 'U')
    .replace(/ş/g, 'S').replace(/Ş/g, 'S')
    .replace(/ö/g, 'O').replace(/Ö/g, 'O')
    .replace(/ç/g, 'C').replace(/Ç/g, 'C')
    .toUpperCase().trim();
}

// Malzeme grupları haritası: kısa_ad (normalize) → kalem listesi
// Her grup birden çok katalog kalemine patlatılır (örn. "MAKARA" → 1 ad
// Makara İzolator + 1 ad Özengi Demiri + 1 ad Halkalı Saplama + …)
function grupHaritasiHaz(db) {
  const gruplar = db.prepare('SELECT id, kisa_ad FROM malzeme_gruplari').all();
  const map = new Map();
  for (const g of gruplar) {
    const kalemler = db.prepare(
      `SELECT malzeme_adi, malzeme_kodu, miktar, birim FROM malzeme_grup_kalemleri WHERE grup_id = ? ORDER BY sira`
    ).all(g.id);
    map.set(trUst(g.kisa_ad), { kisa_ad: g.kisa_ad, kalemler });
  }
  return map;
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

// Direk durumuna göre fiyat seçimi (Yeni: malzeme+montaj, DMM: demontajdan_montaj, Demontaj: demontaj)
function fiyatSec(katalog, durum) {
  if (!katalog) return 0;
  if (durum === 'DMM') return Number(katalog.demontajdan_montaj_fiyat) || 0;
  if (durum === 'Demontaj') return Number(katalog.demontaj_birim_fiyat) || 0;
  // Yeni (varsayılan)
  return (Number(katalog.malzeme_birim_fiyat) || 0) + (Number(katalog.montaj_birim_fiyat) || 0);
}

// İletken tipi OG mu? (SWALLOW/PIGEON/RAVEN/HAWK/PARTRIDGE)
function isOgIletken(tip) {
  return /SW|SWALLOW|PIGEON|RAVEN|HAWK|PARTRIDGE/i.test(String(tip || ''));
}

// Ana fonksiyon
function malzemeOzetiUret(tabloAdi, projeId) {
  const db = getDb();
  const satirlar = db.prepare(
    `SELECT direk_tip, ag_iletken, og_iletken, ag_iletken_durum, og_iletken_durum,
            ara_mesafe, notlar, nokta_durum
     FROM ${tabloAdi} WHERE proje_id = ?`
  ).all(projeId);
  const ilerlemeMap = ilerlemeMapHaz(db, projeId);
  const malzemeGrupMap = grupHaritasiHaz(db);

  // 1) Ham agrega — direk ve iletken durumları AYRI değerlendirilir.
  //   Direkler ve direk-bağımlı malzemeler: nokta_durum kullanılır
  //   İletkenler:                            ag_iletken_durum / og_iletken_durum (tipine göre)
  //   Mevcut durumlu kalemler özete katılmaz; Yeni / DMM / Demontaj ayrı agrega.
  const direkler = new Map();
  const malzemeler = new Map();
  const iletkenler = new Map();
  for (const s of satirlar) {
    const direkDur = s.nokta_durum || 'Yeni';
    // Direk + direk-bağımlı malzemeler
    if (direkDur !== 'Mevcut') {
      if (s.direk_tip) {
        const k = `${s.direk_tip}||${direkDur}`;
        direkler.set(k, (direkler.get(k) || 0) + 1);
      }
      if (s.notlar) {
        for (const line of s.notlar.split('\n').filter(Boolean)) {
          if (/^Iletken:/i.test(line)) continue; // iletken'i ayrı ele al
          const { adi, miktar } = malzemeNotuParse(line);
          if (!adi) continue;
          const grup = malzemeGrupMap.get(trUst(adi));
          if (grup && grup.kalemler.length > 0) {
            for (const k of grup.kalemler) {
              const ad = k.malzeme_adi;
              const m = (Number(k.miktar) || 1) * miktar;
              const key = `${ad}||${direkDur}`;
              malzemeler.set(key, (malzemeler.get(key) || 0) + m);
            }
          } else {
            const key = `${adi}||${direkDur}`;
            malzemeler.set(key, (malzemeler.get(key) || 0) + miktar);
          }
        }
      }
    }
    // İletkenler — satır-bazlı durum (notlar parts[4]) varsa onu kullan,
    // yoksa direğin ag/og iletken durum sütunundan düş.
    //
    // Açık hat tertibi (4P+R, 4xR, 1xP, 3A+R/P) ve OG (3xSW/1/0/266/477) genişletilir:
    //   "4P+R" 23m → PANSY 92m + ROSE 23m
    //   "3xSW" 100m → SWALLOW 300m
    //   "3A+R/P" 23m → ASTER 69m + ROSE 23m (sokak default R)
    if (s.notlar) {
      for (const line of s.notlar.split('\n').filter(Boolean)) {
        if (!/^Iletken:/i.test(line)) continue;
        const { tip, mesafe, durum: satirDurum } = iletkenNotuParse(line);
        if (!tip || !mesafe) continue;
        const fallbackDur = isOgIletken(tip)
          ? (s.og_iletken_durum || 'Yeni')
          : (s.ag_iletken_durum || 'Yeni');
        const iletkenDur = satirDurum || fallbackDur;
        if (iletkenDur === 'Mevcut') continue; // Mevcut iletkenler özete katılmaz

        const t = tertibiParseTekil(tip);
        if (t && t.tip === 'ag-acik') {
          // Pansy/Rose/Aster ayrı kalemler
          for (const k of acikHatExpand(t, mesafe)) {
            const key = `${k.cins}||${iletkenDur}`;
            iletkenler.set(key, (iletkenler.get(key) || 0) + k.mesafe);
          }
        } else if (t && t.tip === 'og') {
          // 3× SWALLOW vb.
          for (const k of ogExpand(t, mesafe)) {
            const key = `${k.cins}||${iletkenDur}`;
            iletkenler.set(key, (iletkenler.get(key) || 0) + k.mesafe);
          }
        } else {
          // Bilinmeyen veya AER kablo — eski mantık (tip||durum bazlı)
          const key = `${tip}||${iletkenDur}`;
          iletkenler.set(key, (iletkenler.get(key) || 0) + mesafe);
        }
      }
    }
  }

  // 2) Her ham kalemi katalogda eşle
  const haziraza = []; // { kategori, adi, miktar, durum, child, parent }
  const ekle = (kategori, adi, miktar, durum) => {
    let child = childBul(db, adi);
    // İletken kayıtlarında olcu='kg' ve agirlik null — malzeme_cinsi'ndeki "(N Kg/Km)"
    // değerini kg/m'ye çevir ki "metre × agirlik = kg" formülü doğru çalışsın.
    if (child && kategori === 'iletken' && !(Number(child.agirlik) > 0)) {
      const kgKm = kgKmParse(child.malzeme_cinsi);
      if (kgKm) child = { ...child, agirlik: kgKm / 1000 }; // kg/m
    }
    let parent = null;
    if (child) parent = parentBul(db, child.poz_birlesik);
    haziraza.push({ kategori, adi, miktar, durum, child, parent });
  };
  for (const [k, adet] of direkler) {
    const [tip, dur] = k.split('||');
    ekle('direk', tip, adet, dur);
  }
  for (const [k, mt] of malzemeler) {
    const [adi, dur] = k.split('||');
    ekle('malzeme', adi, mt, dur);
  }
  for (const [k, mes] of iletkenler) {
    const [tip, dur] = k.split('||');
    ekle('iletken', tip, mes, dur);
  }

  // 3) Parent + durum'a göre grupla — aynı child + farklı durum ayrı satır
  const grupMap = new Map(); // "parent_poz||durum" → { parent, durum, cocuklar, cocukIdx }
  const bagimsiz = [];
  for (const h of haziraza) {
    if (h.parent && h.child) {
      const key = `${h.parent.poz_birlesik}||${h.durum}`;
      const g = grupMap.get(key) || { parent: h.parent, durum: h.durum, cocuklar: [], cocukIdx: new Map() };
      const childPoz = h.child.poz_birlesik;
      const mevcutIdx = g.cocukIdx.get(childPoz);
      if (mevcutIdx != null) {
        g.cocuklar[mevcutIdx].miktar += h.miktar;
      } else {
        g.cocukIdx.set(childPoz, g.cocuklar.length);
        g.cocuklar.push(h);
      }
      grupMap.set(key, g);
    } else {
      bagimsiz.push(h);
    }
  }

  // 4) Sonuç biçimle — durum bilgisi her satıra eklenir, fiyat durum'a göre seçilir
  const sonuc = { gruplar: [], bagimsiz: [], genel_toplam: 0, genel_ilerleme_tutar: 0 };

  for (const [, g] of grupMap) {
    const parentFiyat = fiyatSec(g.parent, g.durum);
    let toplamMiktar = 0;
    let toplamIlerlemeMiktar = 0;
    const cocukSatirlari = g.cocuklar.map(c => {
      const agirlik = Number(c.child.agirlik) || 0;
      const altToplam = c.miktar * agirlik;
      toplamMiktar += altToplam;
      const ilerleme = ilerlemeMap.get(c.child.poz_birlesik) || 0;
      const altIlerlemeMiktar = ilerleme * agirlik;
      toplamIlerlemeMiktar += altIlerlemeMiktar;
      // İletkenlerde child.olcu='kg' ama "miktar" alanı metre olarak tutuluyor
      // (alt_toplam_miktar = kg). UI'da satır birimini "m" göster.
      const cinsBirim = (c.child.olcu || '').toLowerCase();
      const birim = (c.kategori === 'iletken' && cinsBirim === 'kg')
        ? 'm'
        : (c.child.olcu || (c.kategori === 'iletken' ? 'm' : 'Ad'));
      return {
        adi: c.adi,
        kategori: c.kategori,
        durum: c.durum,
        miktar: c.miktar,
        birim,
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
      durum: g.durum,
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
  // Önce poz, sonra durum sıralaması (Yeni → DMM → Demontaj)
  const durumSira = { 'Yeni': 1, 'DMM': 2, 'Demontaj': 3 };
  sonuc.gruplar.sort((a, b) => {
    const cp = (a.poz || '').localeCompare(b.poz || '');
    if (cp !== 0) return cp;
    return (durumSira[a.durum] || 99) - (durumSira[b.durum] || 99);
  });

  for (const b of bagimsiz) {
    let birim = b.kategori === 'iletken' ? 'm' : 'Ad';
    let fiyat = 0;
    let poz = null;
    if (b.child) {
      const cinsBirim = (b.child.olcu || '').toLowerCase();
      // İletkende katalog kg ama satır metre — UI gösterimi 'm'
      birim = (b.kategori === 'iletken' && cinsBirim === 'kg')
        ? 'm'
        : (b.child.olcu || birim);
      fiyat = fiyatSec(b.child, b.durum);
      poz = b.child.poz_birlesik;
    }
    // Iletkende metreyi kg'a çevir (agirlik kg/m); diğer kategorilerde miktar olduğu gibi
    const agirlikIlt = b.kategori === 'iletken' ? Number(b.child?.agirlik) || 0 : 0;
    const fiyatlanaMiktar = agirlikIlt > 0 ? b.miktar * agirlikIlt : b.miktar;
    const toplam = fiyatlanaMiktar * fiyat;
    const ilerleme = poz ? (ilerlemeMap.get(poz) || 0) : 0;
    const ilerlemeTutar = (agirlikIlt > 0 ? ilerleme * agirlikIlt : ilerleme) * fiyat;
    sonuc.bagimsiz.push({
      adi: b.adi,
      kategori: b.kategori,
      durum: b.durum,
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
  sonuc.bagimsiz.sort((a, b) => {
    const ca = a.adi.localeCompare(b.adi);
    if (ca !== 0) return ca;
    return (durumSira[a.durum] || 99) - (durumSira[b.durum] || 99);
  });

  return sonuc;
}

// ════════════════════════════════════════════════════════════
// Direk-bazlı tutar hesabı: her satır için "direk + envanterler + iletken"
// toplam tutarını döndürür. Malzeme grupları (KORUMA/HSTA vb.) patlatılır,
// açık hat tertipleri (4P+R) Pansy/Rose'a expand edilir, iletkenlerde
// kg/m dönüşümü uygulanır.
// ════════════════════════════════════════════════════════════
function direkBaslicaTutarlariUret(tabloAdi, projeId) {
  const db = getDb();
  const satirlar = db.prepare(
    `SELECT id, sira, nokta1, direk_tip, ag_iletken, og_iletken,
            ag_iletken_durum, og_iletken_durum,
            ara_mesafe, notlar, nokta_durum
     FROM ${tabloAdi} WHERE proje_id = ? ORDER BY sira`
  ).all(projeId);
  const malzemeGrupMap = grupHaritasiHaz(db);

  // Tek bir kalem (kategori bazlı) için tutar hesaplar.
  // İletkenlerde kg/km dönüşümü, parent agirlik mantığı korunur.
  const kalemTutar = (adi, miktar, durum, kategori) => {
    if (!adi || !miktar) return 0;
    let child = childBul(db, adi);
    if (!child) return 0;
    if (kategori === 'iletken' && (child.olcu || '').toLowerCase() === 'kg' && !(Number(child.agirlik) > 0)) {
      const kgKm = kgKmParse(child.malzeme_cinsi);
      if (kgKm) child = { ...child, agirlik: kgKm / 1000 };
    }
    const parent = parentBul(db, child.poz_birlesik);
    const fiyatKaynagi = parent || child;
    const fiyat = fiyatSec(fiyatKaynagi, durum);
    const agirlik = Number(child.agirlik) || 0;
    const fiyatlanaMiktar = agirlik > 0 ? miktar * agirlik : miktar;
    return fiyatlanaMiktar * fiyat;
  };

  const sonuc = [];
  for (const s of satirlar) {
    let tutar = 0;
    const direkDur = s.nokta_durum || 'Yeni';

    if (direkDur !== 'Mevcut') {
      // Direk
      if (s.direk_tip) tutar += kalemTutar(s.direk_tip, 1, direkDur, 'direk');
      // Notlardaki malzemeler (gruplar patlatılır)
      if (s.notlar) {
        for (const line of s.notlar.split('\n').filter(Boolean)) {
          if (/^Iletken:/i.test(line)) continue;
          const { adi, miktar } = malzemeNotuParse(line);
          if (!adi) continue;
          const grup = malzemeGrupMap.get(trUst(adi));
          if (grup && grup.kalemler.length > 0) {
            for (const k of grup.kalemler) {
              const m = (Number(k.miktar) || 1) * miktar;
              tutar += kalemTutar(k.malzeme_adi, m, direkDur, 'malzeme');
            }
          } else {
            tutar += kalemTutar(adi, miktar, direkDur, 'malzeme');
          }
        }
      }
    }

    // İletkenler — kendi durumlarıyla
    if (s.notlar) {
      for (const line of s.notlar.split('\n').filter(Boolean)) {
        if (!/^Iletken:/i.test(line)) continue;
        const { tip, mesafe, durum: satirDurum } = iletkenNotuParse(line);
        if (!tip || !mesafe) continue;
        const fallbackDur = isOgIletken(tip)
          ? (s.og_iletken_durum || 'Yeni')
          : (s.ag_iletken_durum || 'Yeni');
        const iletkenDur = satirDurum || fallbackDur;
        if (iletkenDur === 'Mevcut') continue;

        const t = tertibiParseTekil(tip);
        if (t && t.tip === 'ag-acik') {
          for (const k of acikHatExpand(t, mesafe)) {
            tutar += kalemTutar(k.cins, k.mesafe, iletkenDur, 'iletken');
          }
        } else if (t && t.tip === 'og') {
          for (const k of ogExpand(t, mesafe)) {
            tutar += kalemTutar(k.cins, k.mesafe, iletkenDur, 'iletken');
          }
        } else {
          tutar += kalemTutar(tip, mesafe, iletkenDur, 'iletken');
        }
      }
    }

    sonuc.push({
      id: s.id,
      sira: s.sira,
      nokta1: s.nokta1,
      direk_tip: s.direk_tip,
      nokta_durum: direkDur,
      tutar: Math.round(tutar * 100) / 100,
    });
  }
  return sonuc;
}

module.exports = { malzemeOzetiUret, direkBaslicaTutarlariUret };
