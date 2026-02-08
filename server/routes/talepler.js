const router = require('express').Router();
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');

// GET / - list with filters
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { durum, tip } = req.query;
    let sql = `SELECT t.*, e.ekip_adi, p.proje_no, per.ad_soyad as talep_eden_adi
      FROM talepler t
      LEFT JOIN ekipler e ON t.ekip_id = e.id
      LEFT JOIN projeler p ON t.proje_id = p.id
      LEFT JOIN personel per ON t.talep_eden_id = per.id
      WHERE 1=1`;
    const params = [];
    if (durum) { sql += ' AND t.durum = ?'; params.push(durum); }
    if (tip) { sql += ' AND t.talep_tipi = ?'; params.push(tip); }
    sql += ' ORDER BY t.olusturma_tarihi DESC';
    const talepler = db.prepare(sql).all(...params);
    basarili(res, talepler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /bekleyen - pending requests only
router.get('/bekleyen', (req, res) => {
  try {
    const db = getDb();
    const talepler = db.prepare(`
      SELECT t.*, e.ekip_adi FROM talepler t
      LEFT JOIN ekipler e ON t.ekip_id = e.id
      WHERE t.durum = 'beklemede'
      ORDER BY CASE t.oncelik WHEN 'acil' THEN 1 WHEN 'yuksek' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END, t.olusturma_tarihi ASC
    `).all();
    basarili(res, talepler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const talep = db.prepare(`
      SELECT t.*, e.ekip_adi, p.proje_no, per.ad_soyad as talep_eden_adi
      FROM talepler t
      LEFT JOIN ekipler e ON t.ekip_id = e.id
      LEFT JOIN projeler p ON t.proje_id = p.id
      LEFT JOIN personel per ON t.talep_eden_id = per.id
      WHERE t.id = ?
    `).get(req.params.id);
    if (!talep) return hata(res, 'Talep bulunamadı', 404);
    basarili(res, talep);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { ekip_id, proje_id, talep_eden_id, talep_tipi, aciklama, talep_detay, oncelik, kaynak } = req.body;
    if (!talep_tipi || !aciklama) return hata(res, 'Talep tipi ve açıklama zorunludur');
    const result = db.prepare('INSERT INTO talepler (ekip_id, proje_id, talep_eden_id, talep_tipi, aciklama, talep_detay, oncelik, kaynak) VALUES (?,?,?,?,?,?,?,?)').run(ekip_id||null, proje_id||null, talep_eden_id||null, talep_tipi, aciklama, talep_detay, oncelik||'normal', kaynak||'web');
    const yeni = db.prepare('SELECT * FROM talepler WHERE id = ?').get(result.lastInsertRowid);
    aktiviteLogla('talep', 'olusturma', yeni.id, `Yeni talep: ${talep_tipi} - ${aciklama.substring(0, 50)}`);
    basarili(res, yeni, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PUT /:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { ekip_id, proje_id, talep_eden_id, talep_tipi, aciklama, talep_detay, oncelik, atanan_kisi, cozum_aciklama } = req.body;
    db.prepare('UPDATE talepler SET ekip_id=?, proje_id=?, talep_eden_id=?, talep_tipi=?, aciklama=?, talep_detay=?, oncelik=?, atanan_kisi=?, cozum_aciklama=?, guncelleme_tarihi=CURRENT_TIMESTAMP WHERE id=?').run(ekip_id||null, proje_id||null, talep_eden_id||null, talep_tipi, aciklama, talep_detay, oncelik, atanan_kisi, cozum_aciklama, req.params.id);
    const guncellenen = db.prepare('SELECT * FROM talepler WHERE id = ?').get(req.params.id);
    aktiviteLogla('talep', 'guncelleme', guncellenen.id, `Talep güncellendi: ${guncellenen.talep_no}`);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PATCH /:id/durum
router.patch('/:id/durum', (req, res) => {
  try {
    const db = getDb();
    const { durum, cozum_aciklama, atanan_kisi } = req.body;
    if (!durum) return hata(res, 'Durum zorunludur');
    const talep = db.prepare('SELECT * FROM talepler WHERE id = ?').get(req.params.id);
    if (!talep) return hata(res, 'Talep bulunamadı', 404);
    let sql = 'UPDATE talepler SET durum = ?, guncelleme_tarihi = CURRENT_TIMESTAMP';
    const params = [durum];
    if (cozum_aciklama) { sql += ', cozum_aciklama = ?'; params.push(cozum_aciklama); }
    if (atanan_kisi) { sql += ', atanan_kisi = ?'; params.push(atanan_kisi); }
    if (durum === 'tamamlandi' || durum === 'reddedildi') { sql += ', cozum_tarihi = CURRENT_TIMESTAMP'; }
    sql += ' WHERE id = ?';
    params.push(req.params.id);
    db.prepare(sql).run(...params);
    const guncellenen = db.prepare('SELECT * FROM talepler WHERE id = ?').get(req.params.id);
    aktiviteLogla('talep', 'durum_degisikligi', guncellenen.id, `${guncellenen.talep_no}: ${talep.durum} → ${durum}`);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
