const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { getDb } = require('../db/database');
const { authMiddleware, izinGerekli } = require('../middleware/auth');
const yetkilendirmeService = require('../services/yetkilendirmeService');

router.use(authMiddleware);

// ═══════════════════════════════════════════════
// ROL YÖNETİMİ
// ═══════════════════════════════════════════════

// GET /api/yonetim/roller
router.get('/roller',
  izinGerekli('ayarlar', 'roller'),
  (req, res) => {
    try {
      const db = getDb();
      const roller = db.prepare(`
        SELECT r.*, d.departman_adi, d.departman_kodu
        FROM roller r
        LEFT JOIN departmanlar d ON r.departman_id = d.id
        WHERE r.durum = 'aktif'
        ORDER BY d.sira, r.seviye DESC
      `).all();

      const stmt = db.prepare(`
        SELECT i.id as izin_id, i.modul, i.aksiyon, i.modul_etiketi, i.aksiyon_etiketi, ri.veri_kapsami
        FROM rol_izinleri ri
        JOIN izinler i ON ri.izin_id = i.id
        WHERE ri.rol_id = ?
        ORDER BY i.modul, i.aksiyon
      `);

      const kullaniciStmt = db.prepare(`
        SELECT k.id, k.ad_soyad
        FROM kullanici_rolleri kr
        JOIN kullanicilar k ON kr.kullanici_id = k.id
        WHERE kr.rol_id = ? AND k.durum = 'aktif'
        ORDER BY k.ad_soyad
      `);

      const sonuc = roller.map(r => {
        const kullanicilar = kullaniciStmt.all(r.id);
        return {
          ...r,
          izinler: stmt.all(r.id),
          kullanici_sayisi: kullanicilar.length,
          kullanicilar,
        };
      });

      res.json({ success: true, data: sonuc });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// GET /api/yonetim/izinler
router.get('/izinler',
  izinGerekli('ayarlar', 'roller'),
  (req, res) => {
    try {
      const db = getDb();
      const izinler = db.prepare('SELECT * FROM izinler ORDER BY modul, aksiyon').all();

      const gruplu = {};
      for (const izin of izinler) {
        if (!gruplu[izin.modul]) {
          gruplu[izin.modul] = { modul: izin.modul, modul_etiketi: izin.modul_etiketi, izinler: [] };
        }
        gruplu[izin.modul].izinler.push({
          id: izin.id,
          aksiyon: izin.aksiyon,
          aksiyon_etiketi: izin.aksiyon_etiketi,
          aciklama: izin.aciklama,
        });
      }

      res.json({ success: true, data: Object.values(gruplu) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// POST /api/yonetim/roller
router.post('/roller',
  izinGerekli('ayarlar', 'roller'),
  (req, res) => {
    try {
      const db = getDb();
      const { rol_adi, rol_kodu, aciklama, renk, ikon, seviye, izinler, departman_id, birim_id } = req.body;

      if (!rol_adi || !rol_kodu) {
        return res.status(400).json({ success: false, error: 'Rol adı ve kodu zorunludur' });
      }

      const cagiranSeviye = yetkilendirmeService.enYuksekSeviye(req.kullanici.id);
      if ((seviye || 50) >= cagiranSeviye) {
        return res.status(403).json({ success: false, error: 'Kendinizden yüksek seviyeli rol oluşturulamaz' });
      }

      const result = db.prepare(`
        INSERT INTO roller (rol_adi, rol_kodu, aciklama, renk, ikon, seviye, departman_id, birim_id, olusturan_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(rol_adi, rol_kodu, aciklama, renk || '#6b7280', ikon || '', seviye || 50, departman_id || null, birim_id || null, req.kullanici.id);

      const rolId = result.lastInsertRowid;

      if (izinler && izinler.length > 0) {
        const stmt = db.prepare('INSERT INTO rol_izinleri (rol_id, izin_id, veri_kapsami) VALUES (?, ?, ?)');
        for (const izin of izinler) {
          stmt.run(rolId, izin.izin_id, izin.veri_kapsami || 'tum');
        }
      }

      res.json({ success: true, data: { id: rolId } });
    } catch (error) {
      if (error.message.includes('UNIQUE')) {
        return res.status(400).json({ success: false, error: 'Bu rol kodu zaten kullanılıyor' });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// PUT /api/yonetim/roller/:id
router.put('/roller/:id',
  izinGerekli('ayarlar', 'roller'),
  (req, res) => {
    try {
      const db = getDb();
      const rolId = parseInt(req.params.id);
      const { rol_adi, aciklama, renk, ikon, seviye, izinler, departman_id, birim_id } = req.body;

      const rol = db.prepare('SELECT * FROM roller WHERE id = ?').get(rolId);
      if (!rol) return res.status(404).json({ success: false, error: 'Rol bulunamadı' });

      db.prepare(`
        UPDATE roller SET
          rol_adi = COALESCE(?, rol_adi),
          aciklama = COALESCE(?, aciklama),
          renk = COALESCE(?, renk),
          ikon = COALESCE(?, ikon),
          seviye = COALESCE(?, seviye),
          departman_id = ?,
          birim_id = ?,
          guncelleme_tarihi = datetime('now')
        WHERE id = ?
      `).run(rol_adi, aciklama, renk, ikon, seviye, departman_id !== undefined ? departman_id : rol.departman_id, birim_id !== undefined ? birim_id : rol.birim_id, rolId);

      if (izinler) {
        db.prepare('DELETE FROM rol_izinleri WHERE rol_id = ?').run(rolId);
        const stmt = db.prepare('INSERT INTO rol_izinleri (rol_id, izin_id, veri_kapsami) VALUES (?, ?, ?)');
        for (const izin of izinler) {
          stmt.run(rolId, izin.izin_id, izin.veri_kapsami || 'tum');
        }
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// DELETE /api/yonetim/roller/:id
router.delete('/roller/:id',
  izinGerekli('ayarlar', 'roller'),
  (req, res) => {
    try {
      const db = getDb();
      const rol = db.prepare('SELECT * FROM roller WHERE id = ?').get(req.params.id);

      if (!rol) return res.status(404).json({ success: false, error: 'Rol bulunamadı' });
      if (rol.sistem_rolu) return res.status(403).json({ success: false, error: 'Sistem rolü silinemez' });

      const kullaniciSayisi = db.prepare('SELECT COUNT(*) as s FROM kullanici_rolleri WHERE rol_id = ?').get(rol.id).s;
      if (kullaniciSayisi > 0) {
        return res.status(400).json({ success: false, error: `Bu role ${kullaniciSayisi} kullanıcı atanmış. Önce rol atamasını kaldırın.` });
      }

      db.prepare("UPDATE roller SET durum = 'pasif' WHERE id = ?").run(rol.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════
// KULLANICI YÖNETİMİ
// ═══════════════════════════════════════════════

// GET /api/yonetim/kullanicilar
router.get('/kullanicilar',
  izinGerekli('ayarlar', 'kullanicilar'),
  (req, res) => {
    try {
      const db = getDb();
      const kullanicilar = db.prepare(`
        SELECT
          k.id, k.kullanici_adi, k.ad_soyad, k.email, k.telefon,
          k.durum, k.son_giris, k.olusturma_tarihi, k.sifre_acik,
          p.ad_soyad as personel_adi,
          e.ekip_adi, e.ekip_kodu
        FROM kullanicilar k
        LEFT JOIN personel p ON k.personel_id = p.id
        LEFT JOIN ekipler e ON k.ekip_id = e.id
        WHERE k.durum != 'silindi'
        ORDER BY k.ad_soyad
      `).all();

      const rolStmt = db.prepare(`
        SELECT r.id, r.rol_adi, r.rol_kodu, r.ikon, r.renk
        FROM roller r
        JOIN kullanici_rolleri kr ON r.id = kr.rol_id
        WHERE kr.kullanici_id = ?
      `);

      const sonuc = kullanicilar.map(k => ({
        ...k,
        roller: rolStmt.all(k.id),
      }));

      res.json({ success: true, data: sonuc });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// POST /api/yonetim/kullanicilar
router.post('/kullanicilar',
  izinGerekli('ayarlar', 'kullanicilar'),
  async (req, res) => {
    try {
      const db = getDb();
      const { kullanici_adi, sifre, ad_soyad, email, telefon, personel_id, ekip_id, rol_idler } = req.body;

      if (!kullanici_adi || !sifre || !ad_soyad) {
        return res.status(400).json({ success: false, error: 'Kullanıcı adı, şifre ve ad soyad zorunludur' });
      }

      const sifreHash = await bcrypt.hash(sifre, 10);

      const result = db.prepare(`
        INSERT INTO kullanicilar (kullanici_adi, sifre_hash, sifre_acik, ad_soyad, email, telefon, personel_id, ekip_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(kullanici_adi, sifreHash, sifre, ad_soyad, email, telefon, personel_id || null, ekip_id || null);

      const kullaniciId = result.lastInsertRowid;

      if (rol_idler && rol_idler.length > 0) {
        const stmt = db.prepare('INSERT INTO kullanici_rolleri (kullanici_id, rol_id, atayan_id) VALUES (?, ?, ?)');
        for (const rolId of rol_idler) {
          stmt.run(kullaniciId, rolId, req.kullanici.id);
        }
      }

      res.json({ success: true, data: { id: kullaniciId } });
    } catch (error) {
      if (error.message.includes('UNIQUE')) {
        return res.status(400).json({ success: false, error: 'Bu kullanıcı adı zaten kullanılıyor' });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// PUT /api/yonetim/kullanicilar/:id
router.put('/kullanicilar/:id',
  izinGerekli('ayarlar', 'kullanicilar'),
  async (req, res) => {
    try {
      const db = getDb();
      const kullaniciId = parseInt(req.params.id);
      const { ad_soyad, email, telefon, personel_id, ekip_id, durum, sifre } = req.body;

      const kullanici = db.prepare('SELECT * FROM kullanicilar WHERE id = ?').get(kullaniciId);
      if (!kullanici) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });

      const updates = [];
      const params = [];

      if (ad_soyad) { updates.push('ad_soyad = ?'); params.push(ad_soyad); }
      if (email !== undefined) { updates.push('email = ?'); params.push(email); }
      if (telefon !== undefined) { updates.push('telefon = ?'); params.push(telefon); }
      if (personel_id !== undefined) { updates.push('personel_id = ?'); params.push(personel_id || null); }
      if (ekip_id !== undefined) { updates.push('ekip_id = ?'); params.push(ekip_id || null); }
      if (durum) { updates.push('durum = ?'); params.push(durum); }
      if (sifre) {
        const sifreHash = await bcrypt.hash(sifre, 10);
        updates.push('sifre_hash = ?');
        params.push(sifreHash);
        updates.push('sifre_acik = ?');
        params.push(sifre);
      }

      if (updates.length > 0) {
        updates.push("guncelleme_tarihi = datetime('now')");
        params.push(kullaniciId);
        db.prepare(`UPDATE kullanicilar SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// PUT /api/yonetim/kullanicilar/:id/roller
router.put('/kullanicilar/:id/roller',
  izinGerekli('ayarlar', 'kullanicilar'),
  (req, res) => {
    try {
      const db = getDb();
      const kullaniciId = parseInt(req.params.id);
      const { rol_idler, roller } = req.body;
      const rolListesi = rol_idler || roller || [];

      db.prepare('DELETE FROM kullanici_rolleri WHERE kullanici_id = ?').run(kullaniciId);

      if (rolListesi.length > 0) {
        const stmt = db.prepare('INSERT INTO kullanici_rolleri (kullanici_id, rol_id, atayan_id) VALUES (?, ?, ?)');
        for (const rolId of rolListesi) {
          stmt.run(kullaniciId, rolId, req.kullanici.id);
        }
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

module.exports = router;
