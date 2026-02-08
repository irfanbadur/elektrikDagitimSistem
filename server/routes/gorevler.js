const router = require('express').Router();
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');

// GET /
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { durum, ekip_id, personel_id } = req.query;
    let sql = `SELECT g.*, e.ekip_adi, p.proje_no, per.ad_soyad as atanan_adi
      FROM gorevler g
      LEFT JOIN ekipler e ON g.ekip_id = e.id
      LEFT JOIN projeler p ON g.proje_id = p.id
      LEFT JOIN personel per ON g.atanan_personel_id = per.id
      WHERE 1=1`;
    const params = [];
    if (durum) { sql += ' AND g.durum = ?'; params.push(durum); }
    if (ekip_id) { sql += ' AND g.ekip_id = ?'; params.push(ekip_id); }
    if (personel_id) { sql += ' AND g.atanan_personel_id = ?'; params.push(personel_id); }
    sql += ' ORDER BY g.olusturma_tarihi DESC';
    const gorevler = db.prepare(sql).all(...params);
    basarili(res, gorevler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /takvim
router.get('/takvim', (req, res) => {
  try {
    const db = getDb();
    const gorevler = db.prepare(`
      SELECT g.*, e.ekip_adi, per.ad_soyad as atanan_adi
      FROM gorevler g
      LEFT JOIN ekipler e ON g.ekip_id = e.id
      LEFT JOIN personel per ON g.atanan_personel_id = per.id
      WHERE g.son_tarih IS NOT NULL AND g.durum NOT IN ('tamamlandi', 'iptal')
      ORDER BY g.son_tarih
    `).all();
    basarili(res, gorevler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const gorev = db.prepare(`
      SELECT g.*, e.ekip_adi, p.proje_no, per.ad_soyad as atanan_adi
      FROM gorevler g
      LEFT JOIN ekipler e ON g.ekip_id = e.id
      LEFT JOIN projeler p ON g.proje_id = p.id
      LEFT JOIN personel per ON g.atanan_personel_id = per.id
      WHERE g.id = ?
    `).get(req.params.id);
    if (!gorev) return hata(res, 'Görev bulunamadı', 404);
    basarili(res, gorev);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { gorev_basligi, aciklama, gorev_tipi, proje_id, ekip_id, atanan_personel_id, oncelik, son_tarih, notlar } = req.body;
    if (!gorev_basligi) return hata(res, 'Görev başlığı zorunludur');
    const result = db.prepare('INSERT INTO gorevler (gorev_basligi, aciklama, gorev_tipi, proje_id, ekip_id, atanan_personel_id, oncelik, son_tarih, notlar) VALUES (?,?,?,?,?,?,?,?,?)').run(gorev_basligi, aciklama, gorev_tipi, proje_id||null, ekip_id||null, atanan_personel_id||null, oncelik||'normal', son_tarih, notlar);
    const yeni = db.prepare('SELECT * FROM gorevler WHERE id = ?').get(result.lastInsertRowid);
    aktiviteLogla('gorev', 'olusturma', yeni.id, `Yeni görev: ${gorev_basligi}`);
    basarili(res, yeni, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PUT /:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { gorev_basligi, aciklama, gorev_tipi, proje_id, ekip_id, atanan_personel_id, oncelik, durum, son_tarih, tamamlanma_tarihi, notlar } = req.body;
    db.prepare('UPDATE gorevler SET gorev_basligi=?, aciklama=?, gorev_tipi=?, proje_id=?, ekip_id=?, atanan_personel_id=?, oncelik=?, durum=?, son_tarih=?, tamamlanma_tarihi=?, notlar=?, guncelleme_tarihi=CURRENT_TIMESTAMP WHERE id=?').run(gorev_basligi, aciklama, gorev_tipi, proje_id||null, ekip_id||null, atanan_personel_id||null, oncelik, durum, son_tarih, tamamlanma_tarihi, notlar, req.params.id);
    const guncellenen = db.prepare('SELECT * FROM gorevler WHERE id = ?').get(req.params.id);
    aktiviteLogla('gorev', 'guncelleme', guncellenen.id, `Görev güncellendi: ${gorev_basligi}`);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PATCH /:id/durum
router.patch('/:id/durum', (req, res) => {
  try {
    const db = getDb();
    const { durum } = req.body;
    if (!durum) return hata(res, 'Durum zorunludur');
    const gorev = db.prepare('SELECT * FROM gorevler WHERE id = ?').get(req.params.id);
    if (!gorev) return hata(res, 'Görev bulunamadı', 404);
    let extra = '';
    if (durum === 'tamamlandi') extra = ", tamamlanma_tarihi = date('now')";
    db.prepare(`UPDATE gorevler SET durum = ?${extra}, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?`).run(durum, req.params.id);
    const guncellenen = db.prepare('SELECT * FROM gorevler WHERE id = ?').get(req.params.id);
    aktiviteLogla('gorev', 'durum_degisikligi', guncellenen.id, `${gorev.gorev_basligi}: ${gorev.durum} → ${durum}`);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
