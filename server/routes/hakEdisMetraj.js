const router = require('express').Router();
const { getDb } = require('../db/database');
const { basarili, hata } = require('../utils/helpers');

// GET /:projeId — Şebeke metraj listesi
router.get('/:projeId', (req, res) => {
  try {
    const db = getDb();
    const satirlar = db.prepare(
      'SELECT * FROM hak_edis_metraj WHERE proje_id = ? ORDER BY sira, id'
    ).all(parseInt(req.params.projeId));
    basarili(res, satirlar);
  } catch (err) { hata(res, err.message, 500); }
});

// GET /:projeId/ozet — Özet bilgileri
router.get('/:projeId/ozet', (req, res) => {
  try {
    const db = getDb();
    const ozet = db.prepare(`
      SELECT
        COUNT(*) as toplam_satir,
        SUM(ara_mesafe) as toplam_mesafe,
        COUNT(CASE WHEN nokta_durum = 'Yeni' THEN 1 END) as yeni_nokta,
        COUNT(CASE WHEN nokta_durum = 'Mevcut' THEN 1 END) as mevcut_nokta,
        COUNT(CASE WHEN nokta_durum = 'Demontaj' THEN 1 END) as demontaj_nokta
      FROM hak_edis_metraj WHERE proje_id = ?
    `).get(parseInt(req.params.projeId));
    basarili(res, ozet);
  } catch (err) { hata(res, err.message, 500); }
});

// POST /:projeId — Yeni satır ekle
router.post('/:projeId', (req, res) => {
  try {
    const db = getDb();
    const projeId = parseInt(req.params.projeId);
    const {
      nokta1, nokta2, nokta_durum,
      direk_tur, direk_tip, traversler,
      ara_mesafe, ag_iletken_durum, og_iletken_durum,
      ag_iletken, og_iletken,
      yeni_iletken, dmm_iletken,
      kaynak, kaynak_direk_x, kaynak_direk_y, notlar,
    } = req.body;

    // Sıra numarası
    const maxSira = db.prepare('SELECT COALESCE(MAX(sira), 0) as m FROM hak_edis_metraj WHERE proje_id = ?').get(projeId);

    const result = db.prepare(`
      INSERT INTO hak_edis_metraj (
        proje_id, sira, nokta1, nokta2, nokta_durum,
        direk_tur, direk_tip, traversler,
        ara_mesafe, ag_iletken_durum, og_iletken_durum,
        ag_iletken, og_iletken,
        yeni_iletken, dmm_iletken,
        kaynak, kaynak_direk_x, kaynak_direk_y, notlar
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projeId, maxSira.m + 1,
      nokta1 || null, nokta2 || null, nokta_durum || null,
      direk_tur || null, direk_tip || null,
      traversler ? (typeof traversler === 'string' ? traversler : JSON.stringify(traversler)) : null,
      ara_mesafe || 0, ag_iletken_durum || null, og_iletken_durum || null,
      ag_iletken || null, og_iletken || null,
      yeni_iletken ? (typeof yeni_iletken === 'string' ? yeni_iletken : JSON.stringify(yeni_iletken)) : null,
      dmm_iletken ? (typeof dmm_iletken === 'string' ? dmm_iletken : JSON.stringify(dmm_iletken)) : null,
      kaynak || 'manuel', kaynak_direk_x || null, kaynak_direk_y || null, notlar || null
    );

    const yeni = db.prepare('SELECT * FROM hak_edis_metraj WHERE id = ?').get(result.lastInsertRowid);
    basarili(res, yeni);
  } catch (err) { hata(res, err.message, 500); }
});

// POST /:projeId/toplu — Toplu satır ekle (DXF'ten aktarım)
router.post('/:projeId/toplu', (req, res) => {
  try {
    const db = getDb();
    const projeId = parseInt(req.params.projeId);
    const { satirlar } = req.body;
    if (!satirlar?.length) return hata(res, 'Satır listesi boş', 400);

    let maxSira = db.prepare('SELECT COALESCE(MAX(sira), 0) as m FROM hak_edis_metraj WHERE proje_id = ?').get(projeId).m;

    const stmt = db.prepare(`
      INSERT INTO hak_edis_metraj (
        proje_id, sira, nokta1, nokta2, nokta_durum,
        direk_tur, direk_tip, traversler,
        ara_mesafe, ag_iletken_durum, og_iletken_durum,
        ag_iletken, og_iletken,
        yeni_iletken, dmm_iletken,
        kaynak, kaynak_direk_x, kaynak_direk_y, notlar
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const eklenen = [];
    const transaction = db.transaction(() => {
      for (const s of satirlar) {
        maxSira++;
        const r = stmt.run(
          projeId, maxSira,
          s.nokta1 || null, s.nokta2 || null, s.nokta_durum || null,
          s.direk_tur || null, s.direk_tip || null,
          s.traversler ? JSON.stringify(s.traversler) : null,
          s.ara_mesafe || 0, s.ag_iletken_durum || null, s.og_iletken_durum || null,
          s.ag_iletken || null, s.og_iletken || null,
          s.yeni_iletken ? JSON.stringify(s.yeni_iletken) : null,
          s.dmm_iletken ? JSON.stringify(s.dmm_iletken) : null,
          s.kaynak || 'kroki', s.kaynak_direk_x || null, s.kaynak_direk_y || null, s.notlar || null
        );
        eklenen.push(r.lastInsertRowid);
      }
    });
    transaction();

    basarili(res, { eklenen_sayi: eklenen.length, idler: eklenen });
  } catch (err) { hata(res, err.message, 500); }
});

// PUT /:projeId/:id — Satır güncelle
router.put('/:projeId/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const {
      nokta1, nokta2, nokta_durum,
      direk_tur, direk_tip, traversler,
      ara_mesafe, ag_iletken_durum, og_iletken_durum,
      ag_iletken, og_iletken,
      yeni_iletken, dmm_iletken, notlar,
    } = req.body;

    db.prepare(`
      UPDATE hak_edis_metraj SET
        nokta1 = ?, nokta2 = ?, nokta_durum = ?,
        direk_tur = ?, direk_tip = ?, traversler = ?,
        ara_mesafe = ?, ag_iletken_durum = ?, og_iletken_durum = ?,
        ag_iletken = ?, og_iletken = ?,
        yeni_iletken = ?, dmm_iletken = ?, notlar = ?,
        guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(
      nokta1 || null, nokta2 || null, nokta_durum || null,
      direk_tur || null, direk_tip || null,
      traversler ? (typeof traversler === 'string' ? traversler : JSON.stringify(traversler)) : null,
      ara_mesafe || 0, ag_iletken_durum || null, og_iletken_durum || null,
      ag_iletken || null, og_iletken || null,
      yeni_iletken ? (typeof yeni_iletken === 'string' ? yeni_iletken : JSON.stringify(yeni_iletken)) : null,
      dmm_iletken ? (typeof dmm_iletken === 'string' ? dmm_iletken : JSON.stringify(dmm_iletken)) : null,
      notlar || null, id
    );

    const guncellenmis = db.prepare('SELECT * FROM hak_edis_metraj WHERE id = ?').get(id);
    basarili(res, guncellenmis);
  } catch (err) { hata(res, err.message, 500); }
});

// DELETE /:projeId/:id — Satır sil
router.delete('/:projeId/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM hak_edis_metraj WHERE id = ? AND proje_id = ?')
      .run(parseInt(req.params.id), parseInt(req.params.projeId));
    basarili(res, { silindi: true });
  } catch (err) { hata(res, err.message, 500); }
});

// DELETE /:projeId — Tüm satırları sil
router.delete('/:projeId', (req, res) => {
  try {
    const db = getDb();
    const r = db.prepare('DELETE FROM hak_edis_metraj WHERE proje_id = ?')
      .run(parseInt(req.params.projeId));
    basarili(res, { silinen: r.changes });
  } catch (err) { hata(res, err.message, 500); }
});

module.exports = router;
