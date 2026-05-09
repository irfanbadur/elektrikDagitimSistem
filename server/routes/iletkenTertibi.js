// İletken tertibi expand endpoint
// GET /api/iletken-tertibi/expand?tertibi=4P+R&mesafe=23
//
// Açık hat (4P+R, 5xR, 1xP, 3A+R/P) ve OG (3xSW, 1/0, 3x266, 3x477) tertiplerini
// katalog kayıtlarına genişletir. Her alt kalemde m, kg, fiyat, poz bilgisi döner.

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { tertibiParseTekil, acikHatExpand, ogExpand, kgKmParse } = require('../services/iletkenTertibi');

// childBul'un sadeleştirilmiş versiyonu — iletken cinsleri için
// Pansy/Rose/Aster: malzeme_cinsi LIKE 'PANSY%' altında poz_birlesik 85.209.12xx
// SWALLOW: 85.209.13xx
function ileketkenChildBul(db, cins) {
  if (!cins) return null;
  const SUTUN = `poz_birlesik, malzeme_cinsi, olcu, agirlik, malzeme_birim_fiyat, montaj_birim_fiyat, demontajdan_montaj_fiyat, demontaj_birim_fiyat`;
  // Önce malzeme_cinsi prefix
  const enIyi = (rows) => {
    if (!rows.length) return null;
    return rows.find(r => Number(r.malzeme_birim_fiyat) > 0 || Number(r.montaj_birim_fiyat) > 0) || rows[0];
  };

  // SWALLOW/PIGEON/RAVEN/HAWK — adıyla başlayan iletken (tertibat takımı değil)
  // poz_birlesik 85.209.13xx altındaki "X AWG ..." formatı
  const ad = String(cins).toUpperCase();
  if (['SWALLOW','PIGEON','RAVEN','HAWK','PARTRIDGE'].includes(ad)) {
    const r = enIyi(db.prepare(
      `SELECT ${SUTUN} FROM depo_malzeme_katalogu
       WHERE poz_birlesik LIKE '85.209.13%' AND malzeme_cinsi LIKE ? COLLATE NOCASE
       ORDER BY (malzeme_birim_fiyat > 0 OR montaj_birim_fiyat > 0) DESC LIMIT 5`
    ).all(`${ad}%`));
    if (r) return r;
  }

  if (['PANSY','ROSE','ASTER'].includes(ad)) {
    const r = enIyi(db.prepare(
      `SELECT ${SUTUN} FROM depo_malzeme_katalogu
       WHERE poz_birlesik LIKE '85.209.12%' AND malzeme_cinsi LIKE ? COLLATE NOCASE
       ORDER BY (malzeme_birim_fiyat > 0 OR montaj_birim_fiyat > 0) DESC LIMIT 5`
    ).all(`${ad}%`));
    if (r) return r;
  }

  // 1/0, 266, 477 — kesit bazlı OG iletken kayıtları
  if (/^(1\/0|266|477)$/.test(cins)) {
    const r = enIyi(db.prepare(
      `SELECT ${SUTUN} FROM depo_malzeme_katalogu
       WHERE malzeme_cinsi LIKE ? COLLATE NOCASE
       ORDER BY (malzeme_birim_fiyat > 0 OR montaj_birim_fiyat > 0) DESC LIMIT 5`
    ).all(`%${cins}%`));
    if (r) return r;
  }

  return null;
}

router.get('/expand', (req, res) => {
  const tertibi = String(req.query.tertibi || '').trim();
  const mesafe = Number(req.query.mesafe) || 0;
  const durum = String(req.query.durum || 'Yeni'); // fiyat seçimi için

  if (!tertibi) return res.status(400).json({ success: false, error: 'tertibi gerekli' });

  const t = tertibiParseTekil(tertibi);
  if (!t) {
    return res.json({ success: true, data: { tip: 'bilinmeyen', kalemler: [], raw: tertibi } });
  }

  let kalemler = [];
  if (t.tip === 'ag-acik') kalemler = acikHatExpand(t, mesafe);
  else if (t.tip === 'og') kalemler = ogExpand(t, mesafe);
  else if (t.tip === 'ag-kablo-aer') {
    return res.json({ success: true, data: { tip: 'ag-kablo-aer', kalemler: [], raw: tertibi } });
  }

  const db = getDb();
  const sonuc = kalemler.map(k => {
    const child = ileketkenChildBul(db, k.cins);
    let kgPerKm = 0;
    let fiyat = 0;
    let katalogAdi = null;
    let poz = null;
    if (child) {
      kgPerKm = kgKmParse(child.malzeme_cinsi) || 0;
      katalogAdi = (child.malzeme_cinsi || '').trim().replace(/\s+/g, ' ');
      poz = child.poz_birlesik;
      // Fiyat — durum'a göre
      if (durum === 'DMM') fiyat = Number(child.demontajdan_montaj_fiyat) || 0;
      else if (durum === 'Demontaj') fiyat = Number(child.demontaj_birim_fiyat) || 0;
      else fiyat = (Number(child.malzeme_birim_fiyat) || 0) + (Number(child.montaj_birim_fiyat) || 0);
    }
    const kg = kgPerKm > 0 ? (k.mesafe * kgPerKm) / 1000 : 0;
    return {
      cins: k.cins,
      katalog_adi: katalogAdi,
      poz,
      mesafe: k.mesafe,
      kg,
      kg_per_km: kgPerKm,
      carpan: k.carpan,
      sokak: !!k.sokak,
      fiyat,
      tutar: kg > 0 ? kg * fiyat : 0,
    };
  });

  res.json({
    success: true,
    data: {
      tip: t.tip,
      raw: tertibi,
      sokakSecenekleri: t.sokakSecenekleri || null,
      kalemler: sonuc,
      toplam_tutar: sonuc.reduce((s, k) => s + k.tutar, 0),
    },
  });
});

module.exports = router;
