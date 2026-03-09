const router = require('express').Router();
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');

// GET / - tüm bonolar
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const bonolar = db.prepare(`
      SELECT b.*,
        COUNT(bk.id) as kalem_sayisi,
        SUM(bk.miktar) as toplam_miktar,
        COUNT(DISTINCT bk.proje_id) as proje_sayisi
      FROM bonolar b
      LEFT JOIN bono_kalemleri bk ON bk.bono_id = b.id
      GROUP BY b.id
      ORDER BY b.bono_tarihi DESC
    `).all();
    basarili(res, bonolar);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /:id - bono detay (kalemler dahil)
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const bono = db.prepare('SELECT * FROM bonolar WHERE id = ?').get(req.params.id);
    if (!bono) return hata(res, 'Bono bulunamadi', 404);

    bono.kalemler = db.prepare(`
      SELECT bk.*, p.proje_no
      FROM bono_kalemleri bk
      LEFT JOIN projeler p ON bk.proje_id = p.id
      ORDER BY bk.id
    `).all();

    basarili(res, bono);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST / - yeni bono oluştur (kalemlerle birlikte)
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { bono_no, bono_tarihi, kurum, teslim_alan, aciklama, kalemler } = req.body;
    if (!bono_no) return hata(res, 'Bono no zorunludur');
    if (!bono_tarihi) return hata(res, 'Bono tarihi zorunludur');

    const transaction = db.transaction(() => {
      // Bono oluştur
      const result = db.prepare(`
        INSERT INTO bonolar (bono_no, bono_tarihi, kurum, teslim_alan, aciklama)
        VALUES (?, ?, ?, ?, ?)
      `).run(bono_no, bono_tarihi, kurum || 'EDAS', teslim_alan, aciklama);

      const bonoId = result.lastInsertRowid;

      // Kalemleri ekle
      if (kalemler && kalemler.length > 0) {
        const kalemStmt = db.prepare(`
          INSERT INTO bono_kalemleri (bono_id, malzeme_kodu, poz_no, malzeme_adi, birim, miktar, proje_id, proje_kesif_id, notlar)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const k of kalemler) {
          kalemStmt.run(bonoId, k.malzeme_kodu, k.poz_no, k.malzeme_adi, k.birim || 'Ad', k.miktar || 0, k.proje_id || null, k.proje_kesif_id || null, k.notlar);

          // Ana Depo stoğuna ekle
          if (k.miktar > 0) {
            const malzeme = db.prepare('SELECT id FROM malzemeler WHERE malzeme_kodu = ?').get(k.malzeme_kodu);
            if (malzeme) {
              const anaDepo = db.prepare("SELECT id FROM depolar WHERE depo_tipi = 'ana_depo' LIMIT 1").get();
              if (anaDepo) {
                const mevcutStok = db.prepare('SELECT miktar FROM depo_stok WHERE depo_id = ? AND malzeme_id = ?').get(anaDepo.id, malzeme.id);
                if (mevcutStok) {
                  db.prepare('UPDATE depo_stok SET miktar = miktar + ?, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE depo_id = ? AND malzeme_id = ?').run(k.miktar, anaDepo.id, malzeme.id);
                } else {
                  db.prepare('INSERT INTO depo_stok (depo_id, malzeme_id, miktar) VALUES (?, ?, ?)').run(anaDepo.id, malzeme.id, k.miktar);
                }
                // malzemeler tablosundaki stok da güncelle
                db.prepare('UPDATE malzemeler SET stok_miktari = stok_miktari + ? WHERE id = ?').run(k.miktar, malzeme.id);
              }
            }
          }

          // Proje keşif durumunu güncelle
          if (k.proje_kesif_id) {
            db.prepare("UPDATE proje_kesif SET durum = 'alindi', guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?").run(k.proje_kesif_id);
          }
        }
      }

      const bono = db.prepare('SELECT * FROM bonolar WHERE id = ?').get(bonoId);
      aktiviteLogla('bono', 'olusturma', bonoId, `Bono: ${bono_no} - ${kalemler?.length || 0} kalem`);
      return bono;
    });

    const bono = transaction();
    basarili(res, bono, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PUT /:id - bono güncelle
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { bono_no, bono_tarihi, kurum, teslim_alan, aciklama } = req.body;

    db.prepare(`
      UPDATE bonolar SET bono_no=?, bono_tarihi=?, kurum=?, teslim_alan=?, aciklama=?, guncelleme_tarihi=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(bono_no, bono_tarihi, kurum, teslim_alan, aciklama, req.params.id);

    const guncellenen = db.prepare('SELECT * FROM bonolar WHERE id = ?').get(req.params.id);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /:id/kalem - bonoya kalem ekle
router.post('/:id/kalem', (req, res) => {
  try {
    const db = getDb();
    const { malzeme_kodu, poz_no, malzeme_adi, birim, miktar, proje_id, proje_kesif_id, notlar } = req.body;
    if (!malzeme_adi) return hata(res, 'Malzeme adi zorunludur');

    const result = db.prepare(`
      INSERT INTO bono_kalemleri (bono_id, malzeme_kodu, poz_no, malzeme_adi, birim, miktar, proje_id, proje_kesif_id, notlar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, malzeme_kodu, poz_no, malzeme_adi, birim || 'Ad', miktar || 0, proje_id || null, proje_kesif_id || null, notlar);

    const yeni = db.prepare('SELECT * FROM bono_kalemleri WHERE id = ?').get(result.lastInsertRowid);
    basarili(res, yeni, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// DELETE /:id/kalem/:kalemId - bono kalemi sil
router.delete('/:id/kalem/:kalemId', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM bono_kalemleri WHERE id = ? AND bono_id = ?').run(req.params.kalemId, req.params.id);
    basarili(res, { silindi: true });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
