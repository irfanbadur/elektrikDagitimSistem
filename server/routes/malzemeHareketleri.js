const router = require('express').Router();
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');

// GET / - list movements with filters
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { tarih_baslangic, tarih_bitis, ekip_id, malzeme_id, depo_id, hareket_tipi } = req.query;
    let sql = `SELECT mh.*, m.malzeme_adi, m.malzeme_kodu, m.birim, e.ekip_adi, p.proje_no,
      kd.depo_adi as kaynak_depo_adi, hd.depo_adi as hedef_depo_adi
      FROM malzeme_hareketleri mh
      LEFT JOIN malzemeler m ON mh.malzeme_id = m.id
      LEFT JOIN ekipler e ON mh.ekip_id = e.id
      LEFT JOIN projeler p ON mh.proje_id = p.id
      LEFT JOIN depolar kd ON mh.kaynak_depo_id = kd.id
      LEFT JOIN depolar hd ON mh.hedef_depo_id = hd.id
      WHERE 1=1`;
    const params = [];
    if (tarih_baslangic) { sql += ' AND mh.tarih >= ?'; params.push(tarih_baslangic); }
    if (tarih_bitis) { sql += ' AND mh.tarih <= ?'; params.push(tarih_bitis + ' 23:59:59'); }
    if (ekip_id) { sql += ' AND mh.ekip_id = ?'; params.push(ekip_id); }
    if (malzeme_id) { sql += ' AND mh.malzeme_id = ?'; params.push(malzeme_id); }
    if (depo_id) { sql += ' AND (mh.kaynak_depo_id = ? OR mh.hedef_depo_id = ?)'; params.push(depo_id, depo_id); }
    if (hareket_tipi) { sql += ' AND mh.hareket_tipi = ?'; params.push(hareket_tipi); }
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

// POST / - new movement (with depo-based stock management)
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { malzeme_id, miktar, hareket_tipi, kaynak_depo_id, hedef_depo_id, ekip_id, proje_id, teslim_alan, teslim_eden, kaynak, belge_no, notlar } = req.body;
    if (!malzeme_id || !miktar || !hareket_tipi) return hata(res, 'Malzeme, miktar ve hareket tipi zorunludur');
    if (miktar <= 0) return hata(res, 'Miktar 0\'dan büyük olmalıdır');

    // Depo bazlı stok kontrolü
    if (hareket_tipi === 'cikis' || hareket_tipi === 'transfer') {
      const kaynakId = kaynak_depo_id;
      if (kaynakId) {
        const depoStok = db.prepare('SELECT miktar FROM depo_stok WHERE depo_id = ? AND malzeme_id = ?').get(kaynakId, malzeme_id);
        const mevcutMiktar = depoStok?.miktar || 0;
        if (mevcutMiktar < miktar) {
          const depo = db.prepare('SELECT depo_adi FROM depolar WHERE id = ?').get(kaynakId);
          return hata(res, `${depo?.depo_adi || 'Depo'}'da yetersiz stok. Mevcut: ${mevcutMiktar}`);
        }
      } else {
        // Eski uyumluluk: genel stok kontrolü
        const malzeme = db.prepare('SELECT stok_miktari FROM malzemeler WHERE id = ?').get(malzeme_id);
        if (malzeme && malzeme.stok_miktari < miktar) {
          return hata(res, `Yetersiz stok. Mevcut: ${malzeme.stok_miktari}`);
        }
      }
    }

    // Hareketi kaydet
    const result = db.prepare(
      'INSERT INTO malzeme_hareketleri (malzeme_id, miktar, hareket_tipi, kaynak_depo_id, hedef_depo_id, ekip_id, proje_id, teslim_alan, teslim_eden, kaynak, belge_no, notlar) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
    ).run(malzeme_id, miktar, hareket_tipi, kaynak_depo_id||null, hedef_depo_id||null, ekip_id||null, proje_id||null, teslim_alan, teslim_eden, kaynak||'web', belge_no, notlar);

    // Depo stoklarını güncelle
    if (kaynak_depo_id && (hareket_tipi === 'cikis' || hareket_tipi === 'transfer' || hareket_tipi === 'fire')) {
      upsertDepoStok(db, kaynak_depo_id, malzeme_id, -miktar);
    }
    if (hedef_depo_id && (hareket_tipi === 'giris' || hareket_tipi === 'transfer' || hareket_tipi === 'iade')) {
      upsertDepoStok(db, hedef_depo_id, malzeme_id, miktar);
    }

    const yeni = db.prepare(`
      SELECT mh.*, m.malzeme_adi,
        kd.depo_adi as kaynak_depo_adi, hd.depo_adi as hedef_depo_adi
      FROM malzeme_hareketleri mh
      LEFT JOIN malzemeler m ON mh.malzeme_id = m.id
      LEFT JOIN depolar kd ON mh.kaynak_depo_id = kd.id
      LEFT JOIN depolar hd ON mh.hedef_depo_id = hd.id
      WHERE mh.id = ?
    `).get(result.lastInsertRowid);
    aktiviteLogla('malzeme', 'hareket', yeni.id, `${yeni.malzeme_adi}: ${hareket_tipi} ${miktar}`);
    basarili(res, yeni, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// Depo stok satırını güncelle veya oluştur
function upsertDepoStok(db, depoId, malzemeId, miktarDegisim) {
  const mevcut = db.prepare('SELECT id, miktar FROM depo_stok WHERE depo_id = ? AND malzeme_id = ?').get(depoId, malzemeId);
  if (mevcut) {
    db.prepare('UPDATE depo_stok SET miktar = MAX(0, miktar + ?), guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?').run(miktarDegisim, mevcut.id);
  } else {
    db.prepare('INSERT INTO depo_stok (depo_id, malzeme_id, miktar) VALUES (?,?,?)').run(depoId, malzemeId, Math.max(0, miktarDegisim));
  }
}

module.exports = router;
