const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');
const { JWT_SECRET, authMiddleware } = require('../middleware/auth');
const yetkilendirmeService = require('../services/yetkilendirmeService');

// ─── LOGIN ────────────────────────────────────────
router.post('/giris', async (req, res) => {
  try {
    const db = getDb();
    const { kullanici_adi, sifre } = req.body;

    if (!kullanici_adi || !sifre) {
      return res.status(400).json({ success: false, error: 'Kullanıcı adı ve şifre zorunludur' });
    }

    const kullanici = db.prepare(
      "SELECT * FROM kullanicilar WHERE kullanici_adi = ? AND durum = 'aktif'"
    ).get(kullanici_adi);

    if (!kullanici) {
      return res.status(401).json({ success: false, error: 'Geçersiz kullanıcı adı veya şifre' });
    }

    const sifreGecerli = await bcrypt.compare(sifre, kullanici.sifre_hash);
    if (!sifreGecerli) {
      db.prepare('UPDATE kullanicilar SET basarisiz_giris_sayisi = basarisiz_giris_sayisi + 1 WHERE id = ?')
        .run(kullanici.id);
      return res.status(401).json({ success: false, error: 'Geçersiz kullanıcı adı veya şifre' });
    }

    // Başarılı giriş
    db.prepare("UPDATE kullanicilar SET son_giris = datetime('now'), basarisiz_giris_sayisi = 0 WHERE id = ?")
      .run(kullanici.id);

    const roller = yetkilendirmeService.kullaniciRolleri(kullanici.id);
    const izinHaritasi = yetkilendirmeService.izinHaritasi(kullanici.id);

    const token = jwt.sign(
      {
        id: kullanici.id,
        kullanici_adi: kullanici.kullanici_adi,
        ad_soyad: kullanici.ad_soyad,
        ekip_id: kullanici.ekip_id,
        personel_id: kullanici.personel_id,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      data: {
        token,
        kullanici: {
          id: kullanici.id,
          kullanici_adi: kullanici.kullanici_adi,
          ad_soyad: kullanici.ad_soyad,
          email: kullanici.email,
          avatar_yolu: kullanici.avatar_yolu,
          roller: roller.map(r => ({ id: r.id, adi: r.rol_adi, kodu: r.rol_kodu, ikon: r.ikon, renk: r.renk })),
          izinler: izinHaritasi,
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── PROFİL ──────────────────────────────────────
router.get('/profil', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const kullanici = db.prepare('SELECT * FROM kullanicilar WHERE id = ?').get(req.kullanici.id);
    if (!kullanici) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    }

    const roller = yetkilendirmeService.kullaniciRolleri(req.kullanici.id);
    const izinHaritasi = yetkilendirmeService.izinHaritasi(req.kullanici.id);

    res.json({
      success: true,
      data: {
        kullanici: {
          id: kullanici.id,
          kullanici_adi: kullanici.kullanici_adi,
          ad_soyad: kullanici.ad_soyad,
          email: kullanici.email,
          telefon: kullanici.telefon,
          avatar_yolu: kullanici.avatar_yolu,
          roller: roller.map(r => ({ id: r.id, adi: r.rol_adi, kodu: r.rol_kodu, ikon: r.ikon, renk: r.renk })),
          izinler: izinHaritasi,
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── ŞİFRE DEĞİŞTİRME ────────────────────────────
router.put('/sifre-degistir', authMiddleware, async (req, res) => {
  try {
    const { mevcut_sifre, yeni_sifre } = req.body;
    if (!mevcut_sifre || !yeni_sifre) {
      return res.status(400).json({ success: false, error: 'Mevcut ve yeni şifre zorunludur' });
    }
    if (yeni_sifre.length < 6) {
      return res.status(400).json({ success: false, error: 'Yeni şifre en az 6 karakter olmalıdır' });
    }

    const db = getDb();
    const kullanici = db.prepare('SELECT sifre_hash FROM kullanicilar WHERE id = ?').get(req.kullanici.id);
    const gecerli = await bcrypt.compare(mevcut_sifre, kullanici.sifre_hash);
    if (!gecerli) {
      return res.status(400).json({ success: false, error: 'Mevcut şifre yanlış' });
    }

    const yeniHash = await bcrypt.hash(yeni_sifre, 10);
    db.prepare("UPDATE kullanicilar SET sifre_hash = ?, guncelleme_tarihi = datetime('now') WHERE id = ?")
      .run(yeniHash, req.kullanici.id);

    res.json({ success: true, data: { message: 'Şifre başarıyla değiştirildi' } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
