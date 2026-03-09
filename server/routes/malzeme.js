const router = require('express').Router();
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');

// GET / - all materials
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const malzemeler = db.prepare('SELECT * FROM malzemeler ORDER BY kategori, malzeme_adi').all();
    basarili(res, malzemeler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /kritik - materials below critical level
router.get('/kritik', (req, res) => {
  try {
    const db = getDb();
    const kritik = db.prepare('SELECT * FROM malzemeler WHERE stok_miktari <= kritik_seviye ORDER BY (stok_miktari - kritik_seviye) ASC').all();
    basarili(res, kritik);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const malzeme = db.prepare('SELECT * FROM malzemeler WHERE id = ?').get(req.params.id);
    if (!malzeme) return hata(res, 'Malzeme bulunamadı', 404);
    malzeme.hareketler = db.prepare(`
      SELECT mh.*, e.ekip_adi, p.proje_no,
        kd.depo_adi as kaynak_depo_adi, hd.depo_adi as hedef_depo_adi
      FROM malzeme_hareketleri mh
      LEFT JOIN ekipler e ON mh.ekip_id = e.id
      LEFT JOIN projeler p ON mh.proje_id = p.id
      LEFT JOIN depolar kd ON mh.kaynak_depo_id = kd.id
      LEFT JOIN depolar hd ON mh.hedef_depo_id = hd.id
      WHERE mh.malzeme_id = ?
      ORDER BY mh.tarih DESC LIMIT 50
    `).all(req.params.id);
    // Depo bazlı stok dağılımı
    malzeme.depo_stok = db.prepare(`
      SELECT ds.*, d.depo_adi, d.depo_tipi
      FROM depo_stok ds
      JOIN depolar d ON ds.depo_id = d.id
      WHERE ds.malzeme_id = ? AND d.aktif = 1
      ORDER BY d.depo_tipi = 'ana_depo' DESC, d.depo_adi
    `).all(req.params.id);
    basarili(res, malzeme);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { malzeme_kodu, malzeme_adi, kategori, birim, stok_miktari, kritik_seviye, birim_fiyat, depo_konumu, notlar } = req.body;
    if (!malzeme_adi) return hata(res, 'Malzeme adı zorunludur');
    if (!birim) return hata(res, 'Birim zorunludur');
    const result = db.prepare('INSERT INTO malzemeler (malzeme_kodu, malzeme_adi, kategori, birim, stok_miktari, kritik_seviye, birim_fiyat, depo_konumu, notlar) VALUES (?,?,?,?,?,?,?,?,?)').run(malzeme_kodu, malzeme_adi, kategori, birim, stok_miktari||0, kritik_seviye||0, birim_fiyat||0, depo_konumu, notlar);
    const yeni = db.prepare('SELECT * FROM malzemeler WHERE id = ?').get(result.lastInsertRowid);

    // Ana depoya başlangıç stoğu ekle
    if (stok_miktari && stok_miktari > 0) {
      const anaDepo = db.prepare("SELECT id FROM depolar WHERE depo_tipi = 'ana_depo' LIMIT 1").get();
      if (anaDepo) {
        db.prepare('INSERT OR REPLACE INTO depo_stok (depo_id, malzeme_id, miktar, kritik_seviye) VALUES (?,?,?,?)').run(anaDepo.id, yeni.id, stok_miktari, kritik_seviye||0);
      }
    }

    aktiviteLogla('malzeme', 'olusturma', yeni.id, `Yeni malzeme: ${malzeme_adi}`);
    basarili(res, yeni, 201);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return hata(res, 'Bu malzeme kodu zaten kullanımda');
    hata(res, err.message, 500);
  }
});

// PUT /:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { malzeme_kodu, malzeme_adi, kategori, birim, stok_miktari, kritik_seviye, birim_fiyat, depo_konumu, notlar } = req.body;
    db.prepare('UPDATE malzemeler SET malzeme_kodu=?, malzeme_adi=?, kategori=?, birim=?, stok_miktari=?, kritik_seviye=?, birim_fiyat=?, depo_konumu=?, notlar=?, guncelleme_tarihi=CURRENT_TIMESTAMP WHERE id=?').run(malzeme_kodu, malzeme_adi, kategori, birim, stok_miktari, kritik_seviye, birim_fiyat, depo_konumu, notlar, req.params.id);
    const guncellenen = db.prepare('SELECT * FROM malzemeler WHERE id = ?').get(req.params.id);
    aktiviteLogla('malzeme', 'guncelleme', guncellenen.id, `Malzeme güncellendi: ${malzeme_adi}`);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
