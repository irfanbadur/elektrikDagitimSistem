const router = require('express').Router();
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');

// GET / - list daily reports with filters
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { tarih, ekip_id } = req.query;
    let sql = `SELECT gr.*, e.ekip_adi, p.proje_no, b.bolge_adi
      FROM gunluk_rapor gr
      LEFT JOIN ekipler e ON gr.ekip_id = e.id
      LEFT JOIN projeler p ON gr.proje_id = p.id
      LEFT JOIN bolgeler b ON gr.bolge_id = b.id
      WHERE 1=1`;
    const params = [];
    if (tarih) { sql += ' AND gr.tarih = ?'; params.push(tarih); }
    if (ekip_id) { sql += ' AND gr.ekip_id = ?'; params.push(ekip_id); }
    sql += ' ORDER BY gr.tarih DESC, gr.ekip_id LIMIT 200';
    const raporlar = db.prepare(sql).all(...params);
    basarili(res, raporlar);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /ozet
router.get('/ozet', (req, res) => {
  try {
    const db = getDb();
    const { tarih_baslangic, tarih_bitis } = req.query;
    let sql = `SELECT e.ekip_adi, COUNT(*) as gun_sayisi, SUM(gr.kisi_sayisi) as toplam_kisi
      FROM gunluk_rapor gr LEFT JOIN ekipler e ON gr.ekip_id = e.id WHERE 1=1`;
    const params = [];
    if (tarih_baslangic) { sql += ' AND gr.tarih >= ?'; params.push(tarih_baslangic); }
    if (tarih_bitis) { sql += ' AND gr.tarih <= ?'; params.push(tarih_bitis); }
    sql += ' GROUP BY gr.ekip_id ORDER BY e.ekip_adi';
    const ozet = db.prepare(sql).all(...params);
    basarili(res, ozet);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /takvim/:ay (format: 2025-06)
router.get('/takvim/:ay', (req, res) => {
  try {
    const db = getDb();
    const ay = req.params.ay; // "2025-06"
    const raporlar = db.prepare(`
      SELECT gr.tarih, gr.ekip_id, e.ekip_adi, gr.kisi_sayisi, gr.yapilan_is
      FROM gunluk_rapor gr LEFT JOIN ekipler e ON gr.ekip_id = e.id
      WHERE gr.tarih LIKE ? ORDER BY gr.tarih, gr.ekip_id
    `).all(ay + '%');
    basarili(res, raporlar);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const rapor = db.prepare(`
      SELECT gr.*, e.ekip_adi, p.proje_no, b.bolge_adi
      FROM gunluk_rapor gr
      LEFT JOIN ekipler e ON gr.ekip_id = e.id
      LEFT JOIN projeler p ON gr.proje_id = p.id
      LEFT JOIN bolgeler b ON gr.bolge_id = b.id
      WHERE gr.id = ?
    `).get(req.params.id);
    if (!rapor) return hata(res, 'Rapor bulunamadı', 404);
    basarili(res, rapor);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { tarih, ekip_id, proje_id, bolge_id, kisi_sayisi, calisan_listesi, baslama_saati, bitis_saati, yapilan_is, is_kategorisi, hava_durumu, enerji_kesintisi, kesinti_detay, arac_km_baslangic, arac_km_bitis, kaynak, notlar } = req.body;
    if (!ekip_id) return hata(res, 'Ekip zorunludur');
    if (!yapilan_is) return hata(res, 'Yapılan iş açıklaması zorunludur');
    const result = db.prepare('INSERT INTO gunluk_rapor (tarih, ekip_id, proje_id, bolge_id, kisi_sayisi, calisan_listesi, baslama_saati, bitis_saati, yapilan_is, is_kategorisi, hava_durumu, enerji_kesintisi, kesinti_detay, arac_km_baslangic, arac_km_bitis, kaynak, notlar) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(tarih || new Date().toISOString().slice(0,10), ekip_id, proje_id||null, bolge_id||null, kisi_sayisi||0, calisan_listesi, baslama_saati, bitis_saati, yapilan_is, is_kategorisi, hava_durumu, enerji_kesintisi?1:0, kesinti_detay, arac_km_baslangic, arac_km_bitis, kaynak||'web', notlar);
    const yeni = db.prepare('SELECT * FROM gunluk_rapor WHERE id = ?').get(result.lastInsertRowid);
    aktiviteLogla('puantaj', 'olusturma', yeni.id, `Günlük rapor: Ekip ${ekip_id}, ${tarih || 'bugün'}`);
    basarili(res, yeni, 201);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return hata(res, 'Bu ekip için bu tarih ve projede zaten rapor var');
    hata(res, err.message, 500);
  }
});

// PUT /:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { tarih, ekip_id, proje_id, bolge_id, kisi_sayisi, calisan_listesi, baslama_saati, bitis_saati, yapilan_is, is_kategorisi, hava_durumu, enerji_kesintisi, kesinti_detay, arac_km_baslangic, arac_km_bitis, notlar } = req.body;
    db.prepare('UPDATE gunluk_rapor SET tarih=?, ekip_id=?, proje_id=?, bolge_id=?, kisi_sayisi=?, calisan_listesi=?, baslama_saati=?, bitis_saati=?, yapilan_is=?, is_kategorisi=?, hava_durumu=?, enerji_kesintisi=?, kesinti_detay=?, arac_km_baslangic=?, arac_km_bitis=?, notlar=? WHERE id=?').run(tarih, ekip_id, proje_id||null, bolge_id||null, kisi_sayisi, calisan_listesi, baslama_saati, bitis_saati, yapilan_is, is_kategorisi, hava_durumu, enerji_kesintisi?1:0, kesinti_detay, arac_km_baslangic, arac_km_bitis, notlar, req.params.id);
    const guncellenen = db.prepare('SELECT * FROM gunluk_rapor WHERE id = ?').get(req.params.id);
    aktiviteLogla('puantaj', 'guncelleme', guncellenen.id, `Rapor güncellendi`);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
