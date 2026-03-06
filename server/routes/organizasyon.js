const express = require('express');
const router = express.Router();
const servis = require('../services/personelGorevService');

// ═══════════════════════════════════════════
// ORGANİZASYON AĞACI
// ═══════════════════════════════════════════

router.get('/agac', (req, res) => {
  try {
    const agac = servis.organizasyonAgaci();
    res.json(agac);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
// ÜNVANLAR (roller tablosundan basit liste)
// ═══════════════════════════════════════════

router.get('/unvanlar', (req, res) => {
  try {
    const { getDb } = require('../db/database');
    const db = getDb();
    const roller = db.prepare("SELECT id, rol_adi, rol_kodu, ikon, renk, seviye FROM roller WHERE durum = 'aktif' ORDER BY seviye DESC").all();
    res.json(roller);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
// POZİSYONLAR
// ═══════════════════════════════════════════

router.get('/pozisyonlar', (req, res) => {
  try {
    res.json(servis.pozisyonlar());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/pozisyonlar', (req, res) => {
  try {
    const { kod, ad, seviye, kategori, aciklama, varsayilan_sistem_rolu } = req.body;
    if (!kod || !ad || !seviye || !kategori) {
      return res.status(400).json({ error: 'kod, ad, seviye ve kategori zorunludur' });
    }
    const sonuc = servis.pozisyonEkle({ kod, ad, seviye, kategori, aciklama, varsayilanSistemRolu: varsayilan_sistem_rolu });
    res.status(201).json(sonuc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
// PERSONEL (kullanıcı listesi, pozisyon JOIN)
// ═══════════════════════════════════════════

router.get('/personel', (req, res) => {
  try {
    res.json(servis.personelListesi());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/personel/:id', (req, res) => {
  try {
    const kullanici = servis.kullaniciDetay(parseInt(req.params.id));
    if (!kullanici) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    res.json(kullanici);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /personel — Yeni kullanıcı (personel) oluştur
router.post('/personel', async (req, res) => {
  try {
    const { getDb } = require('../db/database');
    const db = getDb();
    const {
      ad_soyad, telefon, email, rol_id, ekip_id, pozisyon_id, ust_kullanici_id,
      gorev, tc_kimlik, dogum_tarihi, ise_giris_tarihi, kan_grubu,
      acil_kisi, acil_telefon, adres, notlar
    } = req.body;

    if (!ad_soyad) return res.status(400).json({ error: 'ad_soyad zorunludur' });

    // Kullanıcı adı oluştur (ad_soyad'dan)
    const baseUsername = ad_soyad.toLowerCase()
      .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ö/g, 'o')
      .replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ı/g, 'i')
      .replace(/İ/g, 'i').replace(/Ş/g, 's').replace(/Ç/g, 'c')
      .replace(/Ö/g, 'o').replace(/Ü/g, 'u').replace(/Ğ/g, 'g')
      .replace(/[^a-z0-9]/g, '').slice(0, 20);

    let kullanici_adi = baseUsername;
    let sayac = 1;
    while (db.prepare('SELECT id FROM kullanicilar WHERE kullanici_adi = ?').get(kullanici_adi)) {
      kullanici_adi = `${baseUsername}${sayac}`;
      sayac++;
    }

    // Varsayılan şifre hash (bcrypt "1234")
    const bcrypt = require('bcrypt');
    const sifre_hash = await bcrypt.hash('1234', 10);

    // rol_id veya pozisyon_id — kullanici_rolleri tablosuna yazılacak
    const rolId = rol_id || pozisyon_id || null;
    const varsayilanSifre = '1234';

    const sonuc = db.prepare(`
      INSERT INTO kullanicilar (kullanici_adi, sifre_hash, sifre_acik, ad_soyad, email, telefon, ekip_id,
        ust_kullanici_id, tc_kimlik, dogum_tarihi, ise_giris_tarihi,
        kan_grubu, acil_kisi, acil_telefon, adres, notlar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      kullanici_adi, sifre_hash, varsayilanSifre, ad_soyad,
      email || null, telefon || null, ekip_id || null,
      ust_kullanici_id || null,
      tc_kimlik || null, dogum_tarihi || null, ise_giris_tarihi || null,
      kan_grubu || null, acil_kisi || null, acil_telefon || null,
      adres || null, notlar || null
    );

    const yeniId = sonuc.lastInsertRowid;

    // Rol ataması (ünvan)
    if (rolId) {
      db.prepare('INSERT OR IGNORE INTO kullanici_rolleri (kullanici_id, rol_id) VALUES (?, ?)').run(yeniId, rolId);
    }

    const yeni = servis.kullaniciDetay(yeniId);
    res.status(201).json(yeni);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/personel/:id', (req, res) => {
  try {
    const db = require('../db/database').getDb();
    db.prepare("UPDATE kullanicilar SET durum = 'pasif', guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?")
      .run(parseInt(req.params.id));
    res.json({ basarili: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/personel/:id', (req, res) => {
  try {
    servis.kullaniciGuncelle(parseInt(req.params.id), req.body);
    const guncellenmis = servis.kullaniciDetay(parseInt(req.params.id));
    res.json(guncellenmis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/personel/:id/gorevler', (req, res) => {
  try {
    res.json(servis.kisininGorevleri(parseInt(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/personel/:id/belgeler', (req, res) => {
  try {
    res.json(servis.kisiBelgeOzeti(parseInt(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/personel/:id/yetkinlikler', (req, res) => {
  try {
    res.json(servis.kisiYetkinlikleri(parseInt(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/personel/:id/alt-personel', (req, res) => {
  try {
    res.json(servis.altPersonel(parseInt(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/personel/:id/ust-zincir', (req, res) => {
  try {
    res.json(servis.ustZincir(parseInt(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
// GÖREVLER
// ═══════════════════════════════════════════

router.get('/gorevler/tanimlar', (req, res) => {
  try {
    res.json(servis.gorevTanimlari());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/gorevler/ata', (req, res) => {
  try {
    const { kullanici_id, gorev_tanim_id, proje_id, baslangic_tarihi, atama_notu, atayan_id, ozel_aciklama } = req.body;
    if (!kullanici_id || !gorev_tanim_id || !baslangic_tarihi) {
      return res.status(400).json({ error: 'kullanici_id, gorev_tanim_id ve baslangic_tarihi zorunludur' });
    }
    const sonuc = servis.gorevAta({
      kullaniciId: kullanici_id,
      gorevTanimId: gorev_tanim_id,
      projeId: proje_id,
      baslangicTarihi: baslangic_tarihi,
      atamaNotu: atama_notu,
      atayanId: atayan_id,
      ozelAciklama: ozel_aciklama,
    });
    res.status(201).json(sonuc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/gorevler/:id/sonlandir', (req, res) => {
  try {
    servis.gorevSonlandir(parseInt(req.params.id), req.body.bitis_tarihi);
    res.json({ basarili: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/gorevler/proje/:projeId', (req, res) => {
  try {
    res.json(servis.projeninGorevleri(parseInt(req.params.projeId)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/gorevler/kodu/:kod', (req, res) => {
  try {
    const projeId = req.query.proje_id ? parseInt(req.query.proje_id) : null;
    res.json(servis.gorevdekiKisiler(req.params.kod, projeId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/gorevler/proje/:projeId/kontrol', (req, res) => {
  try {
    res.json(servis.projeZorunluGorevKontrol(parseInt(req.params.projeId)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
// İŞ GÖREVLERİ MATRİSİ
// ═══════════════════════════════════════════

router.get('/is-gorevleri', (req, res) => {
  try {
    res.json(servis.tumIsGorevleri());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/is-gorevleri/ata', (req, res) => {
  try {
    const { kullanici_id, is_tipi, gorev_tipi, gecici, notlar, atayan_id } = req.body;
    if (!kullanici_id || !is_tipi || !gorev_tipi) {
      return res.status(400).json({ error: 'kullanici_id, is_tipi ve gorev_tipi zorunludur' });
    }
    const sonuc = servis.isGorevAta({
      kullaniciId: kullanici_id,
      isTipi: is_tipi,
      gorevTipi: gorev_tipi,
      gecici: gecici || false,
      notlar,
      atayanId: atayan_id,
    });
    res.status(201).json(sonuc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/is-gorevleri/:id', (req, res) => {
  try {
    servis.isGorevSil(parseInt(req.params.id));
    res.json({ basarili: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
// BELGELER
// ═══════════════════════════════════════════

router.get('/belgeler/turler', (req, res) => {
  try {
    res.json(servis.belgeTurleri());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/belgeler', (req, res) => {
  try {
    const { kullanici_id, belge_turu_id, belge_tipi, belge_no, veren_kurum, baslangic_tarihi, bitis_tarihi, notlar } = req.body;
    if (!kullanici_id || !belge_turu_id || !belge_tipi) {
      return res.status(400).json({ error: 'kullanici_id, belge_turu_id ve belge_tipi zorunludur' });
    }
    const sonuc = servis.belgeEkle({
      kullaniciId: kullanici_id,
      belgeTuruId: belge_turu_id,
      belgeTipi: belge_tipi,
      belgeNo: belge_no,
      verenKurum: veren_kurum,
      baslangicTarihi: baslangic_tarihi,
      bitisTarihi: bitis_tarihi,
      notlar,
    });
    res.status(201).json(sonuc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/belgeler/:id', (req, res) => {
  try {
    servis.belgeGuncelle(parseInt(req.params.id), req.body);
    res.json({ basarili: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/belgeler/:id', (req, res) => {
  try {
    servis.belgeSil(parseInt(req.params.id));
    res.json({ basarili: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/belgeler/suresi-dolacak', (req, res) => {
  try {
    const gun = req.query.gun ? parseInt(req.query.gun) : 30;
    res.json(servis.suresiDolacakBelgeler(gun));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/belgeler/suresi-dolmus', (req, res) => {
  try {
    res.json(servis.suresiDolmusBelgeler());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/belgeler/eksik-zorunlu', (req, res) => {
  try {
    res.json(servis.eksikZorunluBelgeler());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
// YETKİNLİKLER
// ═══════════════════════════════════════════

router.get('/yetkinlikler/tanimlar', (req, res) => {
  try {
    res.json(servis.yetkinlikTanimlari());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/yetkinlikler', (req, res) => {
  try {
    const { kullanici_id, yetkinlik_id, seviye, notlar, degerlendiren_id } = req.body;
    if (!kullanici_id || !yetkinlik_id || !seviye) {
      return res.status(400).json({ error: 'kullanici_id, yetkinlik_id ve seviye zorunludur' });
    }
    const sonuc = servis.yetkinlikEkleGuncelle({
      kullaniciId: kullanici_id,
      yetkinlikId: yetkinlik_id,
      seviye,
      notlar,
      degerlendirenId: degerlendiren_id,
    });
    res.json(sonuc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/yetkinlikler/ara', (req, res) => {
  try {
    const { kod, seviye } = req.query;
    if (!kod) return res.status(400).json({ error: 'kod parametresi zorunludur' });
    res.json(servis.yetkinligeGoreAra(kod, seviye || 'baslangic'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
