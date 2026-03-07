const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authMiddleware, izinGerekli } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/departmanlar
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const departmanlar = db.prepare('SELECT * FROM departmanlar WHERE aktif = 1 ORDER BY sira, departman_adi').all();
    const birimler = db.prepare('SELECT * FROM departman_birimleri WHERE aktif = 1 ORDER BY sira, birim_adi').all();

    const sonuc = departmanlar.map(d => ({
      ...d,
      birimler: birimler.filter(b => b.departman_id === d.id),
    }));

    res.json({ success: true, data: sonuc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/departmanlar
router.post('/',
  izinGerekli('ayarlar', 'genel'),
  (req, res) => {
    try {
      const db = getDb();
      const { departman_adi, departman_kodu, aciklama, renk } = req.body;

      if (!departman_adi || !departman_kodu) {
        return res.status(400).json({ success: false, error: 'Departman adı ve kodu zorunludur' });
      }

      const result = db.prepare(
        'INSERT INTO departmanlar (departman_adi, departman_kodu, aciklama, renk, sira) VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sira),0)+1 FROM departmanlar))'
      ).run(departman_adi, departman_kodu, aciklama || null, renk || '#6b7280');

      res.json({ success: true, data: { id: result.lastInsertRowid } });
    } catch (error) {
      if (error.message.includes('UNIQUE')) {
        return res.status(400).json({ success: false, error: 'Bu departman kodu zaten kullanılıyor' });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// PUT /api/departmanlar/:id
router.put('/:id',
  izinGerekli('ayarlar', 'genel'),
  (req, res) => {
    try {
      const db = getDb();
      const { departman_adi, aciklama, renk } = req.body;
      db.prepare('UPDATE departmanlar SET departman_adi = COALESCE(?, departman_adi), aciklama = ?, renk = COALESCE(?, renk) WHERE id = ?')
        .run(departman_adi, aciklama, renk, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// DELETE /api/departmanlar/:id
router.delete('/:id',
  izinGerekli('ayarlar', 'genel'),
  (req, res) => {
    try {
      const db = getDb();
      const rolSayisi = db.prepare('SELECT COUNT(*) as s FROM roller WHERE departman_id = ? AND durum = ?').get(req.params.id, 'aktif').s;
      if (rolSayisi > 0) {
        return res.status(400).json({ success: false, error: `Bu departmanda ${rolSayisi} aktif rol var. Önce rolleri kaldırın.` });
      }
      db.prepare('UPDATE departmanlar SET aktif = 0 WHERE id = ?').run(req.params.id);
      db.prepare('UPDATE departman_birimleri SET aktif = 0 WHERE departman_id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// POST /api/departmanlar/:id/birimler
router.post('/:id/birimler',
  izinGerekli('ayarlar', 'genel'),
  (req, res) => {
    try {
      const db = getDb();
      const { birim_adi, birim_kodu, aciklama } = req.body;
      if (!birim_adi || !birim_kodu) {
        return res.status(400).json({ success: false, error: 'Birim adı ve kodu zorunludur' });
      }
      const result = db.prepare(
        'INSERT INTO departman_birimleri (departman_id, birim_adi, birim_kodu, aciklama, sira) VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sira),0)+1 FROM departman_birimleri WHERE departman_id = ?))'
      ).run(req.params.id, birim_adi, birim_kodu, aciklama || null, req.params.id);
      res.json({ success: true, data: { id: result.lastInsertRowid } });
    } catch (error) {
      if (error.message.includes('UNIQUE')) {
        return res.status(400).json({ success: false, error: 'Bu birim kodu bu departmanda zaten var' });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// DELETE /api/departmanlar/birimler/:birimId
router.delete('/birimler/:birimId',
  izinGerekli('ayarlar', 'genel'),
  (req, res) => {
    try {
      const db = getDb();
      db.prepare('UPDATE departman_birimleri SET aktif = 0 WHERE id = ?').run(req.params.birimId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

module.exports = router;
