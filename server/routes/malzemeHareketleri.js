const router = require('express').Router();
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');

// GET / - list movements with filters
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { tarih_baslangic, tarih_bitis, ekip_id, malzeme_id } = req.query;
    let sql = `SELECT mh.*, m.malzeme_adi, m.malzeme_kodu, m.birim, e.ekip_adi, p.proje_no
      FROM malzeme_hareketleri mh
      LEFT JOIN malzemeler m ON mh.malzeme_id = m.id
      LEFT JOIN ekipler e ON mh.ekip_id = e.id
      LEFT JOIN projeler p ON mh.proje_id = p.id
      WHERE 1=1`;
    const params = [];
    if (tarih_baslangic) { sql += ' AND mh.tarih >= ?'; params.push(tarih_baslangic); }
    if (tarih_bitis) { sql += ' AND mh.tarih <= ?'; params.push(tarih_bitis + ' 23:59:59'); }
    if (ekip_id) { sql += ' AND mh.ekip_id = ?'; params.push(ekip_id); }
    if (malzeme_id) { sql += ' AND mh.malzeme_id = ?'; params.push(malzeme_id); }
    sql += ' ORDER BY mh.tarih DESC LIMIT 200';
    const hareketler = db.prepare(sql).all(...params);
    basarili(res, hareketler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /ozet
router.get('/ozet', (req, res) => {
  try {
    const db = getDb();
    const { tarih_baslangic, tarih_bitis } = req.query;
    let sql = `SELECT m.malzeme_adi, m.birim, mh.hareket_tipi, SUM(mh.miktar) as toplam
      FROM malzeme_hareketleri mh
      LEFT JOIN malzemeler m ON mh.malzeme_id = m.id WHERE 1=1`;
    const params = [];
    if (tarih_baslangic) { sql += ' AND mh.tarih >= ?'; params.push(tarih_baslangic); }
    if (tarih_bitis) { sql += ' AND mh.tarih <= ?'; params.push(tarih_bitis + ' 23:59:59'); }
    sql += ' GROUP BY mh.malzeme_id, mh.hareket_tipi ORDER BY m.malzeme_adi';
    const ozet = db.prepare(sql).all(...params);
    basarili(res, ozet);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST / - new movement (triggers auto-update stock)
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { malzeme_id, miktar, hareket_tipi, ekip_id, proje_id, teslim_alan, teslim_eden, kaynak, belge_no, notlar } = req.body;
    if (!malzeme_id || !miktar || !hareket_tipi) return hata(res, 'Malzeme, miktar ve hareket tipi zorunludur');
    if (miktar <= 0) return hata(res, 'Miktar 0\'dan büyük olmalıdır');
    // Check stock for cikis
    if (hareket_tipi === 'cikis') {
      const malzeme = db.prepare('SELECT stok_miktari FROM malzemeler WHERE id = ?').get(malzeme_id);
      if (malzeme && malzeme.stok_miktari < miktar) {
        return hata(res, `Yetersiz stok. Mevcut: ${malzeme.stok_miktari}`);
      }
    }
    const result = db.prepare('INSERT INTO malzeme_hareketleri (malzeme_id, miktar, hareket_tipi, ekip_id, proje_id, teslim_alan, teslim_eden, kaynak, belge_no, notlar) VALUES (?,?,?,?,?,?,?,?,?,?)').run(malzeme_id, miktar, hareket_tipi, ekip_id||null, proje_id||null, teslim_alan, teslim_eden, kaynak||'web', belge_no, notlar);
    const yeni = db.prepare(`SELECT mh.*, m.malzeme_adi FROM malzeme_hareketleri mh LEFT JOIN malzemeler m ON mh.malzeme_id = m.id WHERE mh.id = ?`).get(result.lastInsertRowid);
    aktiviteLogla('malzeme', 'hareket', yeni.id, `${yeni.malzeme_adi}: ${hareket_tipi} ${miktar}`);
    basarili(res, yeni, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
