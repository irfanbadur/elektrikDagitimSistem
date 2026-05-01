// Proje-Keşif sekmesinde kullanılan direk-bazlı metraj listesi.
// hak_edis_metraj ile aynı şema/davranış; sadece tablo adı farklı.
// Yeni Durum DXF'inden direk tarayarak keşif listesi oluşturur.
const router = require('express').Router();
const { getDb } = require('../db/database');
const { basarili, hata } = require('../utils/helpers');

const TABLO = 'proje_kesif_metraj';

// GET /:projeId — Liste
router.get('/:projeId', (req, res) => {
  try {
    const db = getDb();
    const satirlar = db.prepare(
      `SELECT * FROM ${TABLO} WHERE proje_id = ?
       ORDER BY SUBSTR(nokta1, 1, 1), CAST(SUBSTR(nokta1, 2) AS INTEGER), id`
    ).all(parseInt(req.params.projeId));
    basarili(res, satirlar);
  } catch (err) { hata(res, err.message, 500); }
});

// GET /:projeId/malzeme-ozeti — Direk + malzeme + iletken agrega + katalog fiyatlarıyla zenginleştirilmiş
router.get('/:projeId/malzeme-ozeti', (req, res) => {
  try {
    const { malzemeOzetiUret } = require('../services/metrajOzetService');
    const ozet = malzemeOzetiUret(TABLO, parseInt(req.params.projeId));
    basarili(res, ozet);
  } catch (err) { hata(res, err.message, 500); }
});

// GET /:projeId/ozet — Özet
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
      FROM ${TABLO} WHERE proje_id = ?
    `).get(parseInt(req.params.projeId));
    basarili(res, ozet);
  } catch (err) { hata(res, err.message, 500); }
});

// POST /:projeId — Yeni satır
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
      kaynak, kaynak_direk_x, kaynak_direk_y, notlar, sprite_veri,
    } = req.body;

    const maxSira = db.prepare(`SELECT COALESCE(MAX(sira), 0) as m FROM ${TABLO} WHERE proje_id = ?`).get(projeId);

    const result = db.prepare(`
      INSERT INTO ${TABLO} (
        proje_id, sira, nokta1, nokta2, nokta_durum,
        direk_tur, direk_tip, traversler,
        ara_mesafe, ag_iletken_durum, og_iletken_durum,
        ag_iletken, og_iletken,
        yeni_iletken, dmm_iletken,
        kaynak, kaynak_direk_x, kaynak_direk_y, notlar, sprite_veri
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projeId, maxSira.m + 1,
      nokta1 || null, nokta2 || null, nokta_durum || null,
      direk_tur || null, direk_tip || null,
      traversler ? (typeof traversler === 'string' ? traversler : JSON.stringify(traversler)) : null,
      ara_mesafe || 0, ag_iletken_durum || null, og_iletken_durum || null,
      ag_iletken || null, og_iletken || null,
      yeni_iletken ? (typeof yeni_iletken === 'string' ? yeni_iletken : JSON.stringify(yeni_iletken)) : null,
      dmm_iletken ? (typeof dmm_iletken === 'string' ? dmm_iletken : JSON.stringify(dmm_iletken)) : null,
      kaynak || 'manuel', kaynak_direk_x || null, kaynak_direk_y || null, notlar || null,
      sprite_veri ? (typeof sprite_veri === 'string' ? sprite_veri : JSON.stringify(sprite_veri)) : null
    );

    const yeni = db.prepare(`SELECT * FROM ${TABLO} WHERE id = ?`).get(result.lastInsertRowid);
    basarili(res, yeni);
  } catch (err) { hata(res, err.message, 500); }
});

// POST /:projeId/toplu — Toplu satır (DXF aktarımı)
router.post('/:projeId/toplu', (req, res) => {
  try {
    const db = getDb();
    const projeId = parseInt(req.params.projeId);
    const { satirlar } = req.body;
    if (!satirlar?.length) return hata(res, 'Satır listesi boş', 400);

    let maxSira = db.prepare(`SELECT COALESCE(MAX(sira), 0) as m FROM ${TABLO} WHERE proje_id = ?`).get(projeId).m;

    const stmt = db.prepare(`
      INSERT INTO ${TABLO} (
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
      yeni_iletken, dmm_iletken, notlar, sprite_veri,
    } = req.body;

    db.prepare(`
      UPDATE ${TABLO} SET
        nokta1 = COALESCE(?, nokta1), nokta2 = COALESCE(?, nokta2), nokta_durum = COALESCE(?, nokta_durum),
        direk_tur = COALESCE(?, direk_tur), direk_tip = COALESCE(?, direk_tip), traversler = COALESCE(?, traversler),
        ara_mesafe = COALESCE(?, ara_mesafe), ag_iletken_durum = COALESCE(?, ag_iletken_durum), og_iletken_durum = COALESCE(?, og_iletken_durum),
        ag_iletken = COALESCE(?, ag_iletken), og_iletken = COALESCE(?, og_iletken),
        yeni_iletken = COALESCE(?, yeni_iletken), dmm_iletken = COALESCE(?, dmm_iletken), notlar = COALESCE(?, notlar),
        sprite_veri = COALESCE(?, sprite_veri),
        guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(
      nokta1 || null, nokta2 || null, nokta_durum || null,
      direk_tur || null, direk_tip || null,
      traversler ? (typeof traversler === 'string' ? traversler : JSON.stringify(traversler)) : null,
      ara_mesafe || null, ag_iletken_durum || null, og_iletken_durum || null,
      ag_iletken || null, og_iletken || null,
      yeni_iletken ? (typeof yeni_iletken === 'string' ? yeni_iletken : JSON.stringify(yeni_iletken)) : null,
      dmm_iletken ? (typeof dmm_iletken === 'string' ? dmm_iletken : JSON.stringify(dmm_iletken)) : null,
      notlar || null,
      sprite_veri ? (typeof sprite_veri === 'string' ? sprite_veri : JSON.stringify(sprite_veri)) : null,
      id
    );

    const guncellenmis = db.prepare(`SELECT * FROM ${TABLO} WHERE id = ?`).get(id);
    basarili(res, guncellenmis);
  } catch (err) { hata(res, err.message, 500); }
});

// DELETE /:projeId/:id — Satır sil
router.delete('/:projeId/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare(`DELETE FROM ${TABLO} WHERE id = ? AND proje_id = ?`)
      .run(parseInt(req.params.id), parseInt(req.params.projeId));
    basarili(res, { silindi: true });
  } catch (err) { hata(res, err.message, 500); }
});

// PATCH /:projeId/sprite-konum — Sprite konumu (sürükleme sonrası)
router.patch('/:projeId/sprite-konum', (req, res) => {
  try {
    const db = getDb();
    const { nokta1, x, y } = req.body;
    if (!nokta1) return hata(res, 'nokta1 gerekli', 400);
    const satir = db.prepare(
      `SELECT id, sprite_veri FROM ${TABLO} WHERE proje_id = ? AND nokta1 = ? ORDER BY id DESC LIMIT 1`
    ).get(parseInt(req.params.projeId), nokta1);
    if (!satir) return hata(res, 'Metraj kaydı bulunamadı', 404);
    const sv = satir.sprite_veri ? JSON.parse(satir.sprite_veri) : {};
    sv.x = x; sv.y = y;
    db.prepare(`UPDATE ${TABLO} SET sprite_veri = ?, guncelleme_tarihi = datetime('now') WHERE id = ?`)
      .run(JSON.stringify(sv), satir.id);
    basarili(res, { id: satir.id });
  } catch (err) { hata(res, err.message, 500); }
});

// DELETE /:projeId — Tüm satırlar
router.delete('/:projeId', (req, res) => {
  try {
    const db = getDb();
    const r = db.prepare(`DELETE FROM ${TABLO} WHERE proje_id = ?`)
      .run(parseInt(req.params.projeId));
    basarili(res, { silinen: r.changes });
  } catch (err) { hata(res, err.message, 500); }
});

module.exports = router;
