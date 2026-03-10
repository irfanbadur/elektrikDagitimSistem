const router = require('express').Router();
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');

// GET /:projeId - kroki keşif listesi
router.get('/:projeId', (req, res) => {
  try {
    const db = getDb();
    const kesifler = db.prepare(`
      SELECT * FROM proje_kroki_kesif WHERE proje_id = ? ORDER BY id
    `).all(req.params.projeId);
    basarili(res, kesifler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /:projeId/ozet - kroki keşif özet
router.get('/:projeId/ozet', (req, res) => {
  try {
    const db = getDb();
    const ozet = db.prepare(`
      SELECT
        COUNT(*) as toplam_kalem,
        SUM(miktar) as toplam_miktar,
        SUM(miktar * birim_fiyat) as toplam_tutar,
        SUM(CASE WHEN durum = 'planli' THEN 1 ELSE 0 END) as planli_kalem,
        SUM(CASE WHEN durum = 'depoda_var' THEN 1 ELSE 0 END) as depoda_var_kalem,
        SUM(CASE WHEN durum = 'alindi' THEN 1 ELSE 0 END) as alinan_kalem
      FROM proje_kroki_kesif WHERE proje_id = ?
    `).get(req.params.projeId);
    basarili(res, ozet);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /:projeId/karsilastir - kroki keşif vs proje keşif karşılaştırması
router.get('/:projeId/karsilastir', (req, res) => {
  try {
    const db = getDb();
    const krokiKesif = db.prepare('SELECT * FROM proje_kroki_kesif WHERE proje_id = ? ORDER BY id').all(req.params.projeId);
    const projeKesif = db.prepare('SELECT * FROM proje_kesif WHERE proje_id = ? ORDER BY id').all(req.params.projeId);

    // malzeme_kodu bazlı eşleştir, yoksa malzeme_adi bazlı
    const karsilastirma = [];
    const eslesmisProjeIds = new Set();

    for (const kroki of krokiKesif) {
      let eslesme = null;
      if (kroki.malzeme_kodu) {
        eslesme = projeKesif.find(p => p.malzeme_kodu === kroki.malzeme_kodu && !eslesmisProjeIds.has(p.id));
      }
      if (!eslesme && kroki.malzeme_adi) {
        const norm = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const kNorm = norm(kroki.malzeme_adi);
        eslesme = projeKesif.find(p => norm(p.malzeme_adi) === kNorm && !eslesmisProjeIds.has(p.id));
      }

      if (eslesme) {
        eslesmisProjeIds.add(eslesme.id);
        karsilastirma.push({
          malzeme_kodu: kroki.malzeme_kodu || eslesme.malzeme_kodu,
          malzeme_adi: kroki.malzeme_adi,
          birim: kroki.birim,
          kroki_miktar: kroki.miktar,
          proje_miktar: eslesme.miktar,
          fark: (eslesme.miktar || 0) - (kroki.miktar || 0),
          durum: 'eslesti',
        });
      } else {
        karsilastirma.push({
          malzeme_kodu: kroki.malzeme_kodu,
          malzeme_adi: kroki.malzeme_adi,
          birim: kroki.birim,
          kroki_miktar: kroki.miktar,
          proje_miktar: 0,
          fark: -(kroki.miktar || 0),
          durum: 'sadece_kroki',
        });
      }
    }

    // Proje keşifte olup krokide olmayan
    for (const proje of projeKesif) {
      if (!eslesmisProjeIds.has(proje.id)) {
        karsilastirma.push({
          malzeme_kodu: proje.malzeme_kodu,
          malzeme_adi: proje.malzeme_adi,
          birim: proje.birim,
          kroki_miktar: 0,
          proje_miktar: proje.miktar,
          fark: proje.miktar || 0,
          durum: 'sadece_proje',
        });
      }
    }

    basarili(res, {
      karsilastirma,
      kroki_toplam: krokiKesif.length,
      proje_toplam: projeKesif.length,
      eslesen: eslesmisProjeIds.size,
    });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /:projeId - tekli ekleme
router.post('/:projeId', (req, res) => {
  try {
    const db = getDb();
    const { malzeme_kodu, poz_no, malzeme_adi, birim, miktar, birim_fiyat, notlar } = req.body;
    if (!malzeme_adi) return hata(res, 'Malzeme adi zorunludur');

    const result = db.prepare(`
      INSERT INTO proje_kroki_kesif (proje_id, malzeme_kodu, poz_no, malzeme_adi, birim, miktar, birim_fiyat, notlar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.projeId, malzeme_kodu, poz_no, malzeme_adi, birim || 'Ad', miktar || 0, birim_fiyat || 0, notlar);

    const yeni = db.prepare('SELECT * FROM proje_kroki_kesif WHERE id = ?').get(result.lastInsertRowid);
    basarili(res, yeni, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /:projeId/toplu - toplu ekleme (proje oluşturulurken direk listesinden)
router.post('/:projeId/toplu', (req, res) => {
  try {
    const db = getDb();
    const { kalemler } = req.body;
    if (!kalemler || !kalemler.length) return hata(res, 'Kalem listesi bos');

    const stmt = db.prepare(`
      INSERT INTO proje_kroki_kesif (proje_id, malzeme_kodu, poz_no, malzeme_adi, birim, miktar, birim_fiyat, notlar, kaynak)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      for (const k of kalemler) {
        stmt.run(
          req.params.projeId,
          k.malzeme_kodu || null,
          k.poz_no || null,
          k.malzeme_adi,
          k.birim || 'Ad',
          k.miktar || 1,
          k.birim_fiyat || 0,
          k.notlar || null,
          k.kaynak || 'kroki'
        );
      }
    });
    transaction();

    aktiviteLogla('proje_kroki_kesif', 'toplu_ekleme', req.params.projeId, `${kalemler.length} kalem eklendi`);
    basarili(res, { eklenen: kalemler.length }, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PUT /:projeId/:id - güncelle
router.put('/:projeId/:id', (req, res) => {
  try {
    const db = getDb();
    const { malzeme_kodu, poz_no, malzeme_adi, birim, miktar, birim_fiyat, durum, notlar } = req.body;

    db.prepare(`
      UPDATE proje_kroki_kesif SET malzeme_kodu=?, poz_no=?, malzeme_adi=?, birim=?, miktar=?, birim_fiyat=?, durum=?, notlar=?, guncelleme_tarihi=CURRENT_TIMESTAMP
      WHERE id=? AND proje_id=?
    `).run(malzeme_kodu, poz_no, malzeme_adi, birim, miktar, birim_fiyat, durum, notlar, req.params.id, req.params.projeId);

    const guncellenen = db.prepare('SELECT * FROM proje_kroki_kesif WHERE id = ?').get(req.params.id);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// DELETE /:projeId/:id - sil
router.delete('/:projeId/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM proje_kroki_kesif WHERE id = ? AND proje_id = ?').run(req.params.id, req.params.projeId);
    basarili(res, { silindi: true });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
