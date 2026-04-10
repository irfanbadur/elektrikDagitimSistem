const router = require('express').Router();
const { getDb } = require('../db/database');
const { basarili, hata } = require('../utils/helpers');

// GET /api/saha/ekipler — Tüm ekiplerin konum + özet bilgisi
router.get('/ekipler', (req, res) => {
  try {
    const db = getDb();

    const ekipler = db.prepare(`
      SELECT
        e.id,
        e.ekip_adi,
        e.ekip_kodu,
        e.durum,
        e.son_latitude,
        e.son_longitude,
        e.son_konum_zamani,
        e.son_konum_kaynagi,

        (SELECT COUNT(*) FROM personel p
         WHERE p.ekip_id = e.id AND p.aktif = 1
        ) AS personel_sayisi,

        (SELECT p.ad_soyad FROM personel p
         WHERE p.ekip_id = e.id AND p.gorev = 'ekip_basi' AND p.aktif = 1
         LIMIT 1
        ) AS ekip_basi_adi,

        (SELECT COUNT(DISTINCT g.proje_id) FROM gorevler g
         WHERE g.ekip_id = e.id AND g.durum IN ('atandi', 'devam_ediyor')
        ) AS aktif_proje_sayisi,

        (SELECT COUNT(*) FROM veri_paketleri vp
         WHERE vp.ekip_id = e.id
         AND date(vp.olusturma_tarihi) = date('now')
        ) AS bugun_paket_sayisi

      FROM ekipler e
      WHERE e.durum = 'aktif'
      ORDER BY e.ekip_kodu
    `).all();

    basarili(res, ekipler, 200);
  } catch (error) {
    console.error('Saha ekipler hatası:', error);
    hata(res, error.message, 500);
  }
});

// GET /api/saha/ekipler/:id — Tek ekibin detaylı kartı
router.get('/ekipler/:id', (req, res) => {
  try {
    const db = getDb();
    const ekipId = req.params.id;

    const ekip = db.prepare(`
      SELECT e.*
      FROM ekipler e
      WHERE e.id = ?
    `).get(ekipId);

    if (!ekip) {
      return hata(res, 'Ekip bulunamadı', 404);
    }

    const personeller = db.prepare(`
      SELECT id, ad_soyad, gorev, telefon, aktif
      FROM personel
      WHERE ekip_id = ? AND aktif = 1
      ORDER BY gorev DESC, ad_soyad
    `).all(ekipId);

    const aktifGorevler = db.prepare(`
      SELECT
        g.id, g.gorev_basligi, g.durum, g.oncelik,
        p.proje_no, p.musteri_adi AS proje_adi
      FROM gorevler g
      LEFT JOIN projeler p ON g.proje_id = p.id
      WHERE g.ekip_id = ? AND g.durum IN ('atandi', 'devam_ediyor')
      ORDER BY g.oncelik DESC
    `).all(ekipId);

    const aktifProjeler = db.prepare(`
      SELECT
        p.id, p.proje_no, p.musteri_adi AS proje_adi, p.proje_tipi, p.durum,
        p.oncelik, p.tamamlanma_yuzdesi, p.mahalle,
        b.bolge_adi
      FROM projeler p
      LEFT JOIN bolgeler b ON p.bolge_id = b.id
      WHERE p.ekip_id = ? AND p.durum NOT IN ('tamamlandi', 'askida')
      ORDER BY p.oncelik DESC
    `).all(ekipId);

    const bugunOzet = db.prepare(`
      SELECT
        COUNT(*) as paket_sayisi,
        SUM(foto_sayisi) as toplam_foto
      FROM veri_paketleri
      WHERE ekip_id = ? AND date(olusturma_tarihi) = date('now')
    `).get(ekipId);

    const sonPaketler = db.prepare(`
      SELECT id, paket_no, paket_tipi, foto_sayisi, durum,
             olusturma_tarihi, notlar
      FROM veri_paketleri
      WHERE ekip_id = ?
      ORDER BY olusturma_tarihi DESC
      LIMIT 5
    `).all(ekipId);

    basarili(res, {
      ...ekip,
      personeller,
      aktifGorevler,
      aktifProjeler,
      bugunOzet: {
        paket_sayisi: bugunOzet?.paket_sayisi || 0,
        toplam_foto: bugunOzet?.toplam_foto || 0
      },
      sonPaketler
    });
  } catch (error) {
    console.error('Saha ekip detay hatası:', error);
    hata(res, error.message, 500);
  }
});

// PUT /api/saha/ekipler/:id/konum — Ekip konumunu güncelle
router.put('/ekipler/:id/konum', (req, res) => {
  try {
    const db = getDb();
    const { lat, lng, kaynak } = req.body;

    if (!lat || !lng) {
      return hata(res, 'lat ve lng gerekli', 400);
    }

    db.prepare(`
      UPDATE ekipler SET
        son_latitude = ?,
        son_longitude = ?,
        son_konum_zamani = datetime('now'),
        son_konum_kaynagi = ?
      WHERE id = ?
    `).run(lat, lng, kaynak || 'manuel', req.params.id);

    basarili(res, { message: 'Konum güncellendi' });
  } catch (error) {
    hata(res, error.message, 500);
  }
});

// GET /api/saha/veri-paketleri — Konumlu veri paketleri
// Filtre: ?proje_id=&ekip_id=&tarih_baslangic=&tarih_bitis=
router.get('/veri-paketleri', (req, res) => {
  try {
    const db = getDb();
    const { proje_id, ekip_id, tarih_baslangic, tarih_bitis } = req.query;

    let where = ['vp.latitude IS NOT NULL', 'vp.longitude IS NOT NULL'];
    let params = [];

    if (proje_id) {
      where.push('vp.proje_id = ?');
      params.push(proje_id);
    }
    if (ekip_id) {
      where.push('vp.ekip_id = ?');
      params.push(ekip_id);
    }
    if (tarih_baslangic) {
      where.push('date(vp.olusturma_tarihi) >= date(?)');
      params.push(tarih_baslangic);
    }
    if (tarih_bitis) {
      where.push('date(vp.olusturma_tarihi) <= date(?)');
      params.push(tarih_bitis);
    }

    const paketler = db.prepare(`
      SELECT
        vp.id,
        vp.paket_no,
        vp.paket_tipi,
        vp.latitude,
        vp.longitude,
        vp.foto_sayisi,
        vp.durum,
        vp.notlar,
        vp.olusturma_tarihi,
        p.proje_no,
        p.musteri_adi AS proje_adi,
        e.ekip_adi,
        e.ekip_kodu,
        pr.ad_soyad AS personel_adi
      FROM veri_paketleri vp
      LEFT JOIN projeler p ON vp.proje_id = p.id
      LEFT JOIN ekipler e ON vp.ekip_id = e.id
      LEFT JOIN personel pr ON vp.personel_id = pr.id
      WHERE ${where.join(' AND ')}
      ORDER BY vp.olusturma_tarihi DESC
      LIMIT 200
    `).all(...params);

    basarili(res, paketler);
  } catch (error) {
    console.error('Saha veri paketleri hatasi:', error);
    hata(res, error.message, 500);
  }
});

// GET /api/saha/veri-paketleri/:id — Tek paketin detayi
router.get('/veri-paketleri/:id', (req, res) => {
  try {
    const db = getDb();
    const paketId = req.params.id;

    const paket = db.prepare(`
      SELECT
        vp.*,
        p.proje_no, p.musteri_adi AS proje_adi,
        e.ekip_adi, e.ekip_kodu,
        pr.ad_soyad AS personel_adi
      FROM veri_paketleri vp
      LEFT JOIN projeler p ON vp.proje_id = p.id
      LEFT JOIN ekipler e ON vp.ekip_id = e.id
      LEFT JOIN personel pr ON vp.personel_id = pr.id
      WHERE vp.id = ?
    `).get(paketId);

    if (!paket) {
      return hata(res, 'Veri paketi bulunamadi', 404);
    }

    const medyalar = db.prepare(`
      SELECT id, dosya_adi, dosya_tipi, dosya_boyutu,
             genislik, yukseklik, latitude, longitude,
             aciklama, yukleme_tarihi
      FROM medya
      WHERE veri_paketi_id = ?
      ORDER BY yukleme_tarihi
    `).all(paketId);

    basarili(res, { ...paket, medyalar });
  } catch (error) {
    hata(res, error.message, 500);
  }
});

// POST /api/saha/veri-paketleri/konum-hesapla — Konumu olmayan paketlere medyadan koordinat ata
router.post('/veri-paketleri/konum-hesapla', (req, res) => {
  try {
    const db = getDb();

    // Konumu olmayan tüm veri paketlerini bul
    const konumsuzPaketler = db.prepare(`
      SELECT id FROM veri_paketleri
      WHERE latitude IS NULL OR longitude IS NULL
    `).all();

    let guncellenen = 0;
    for (const paket of konumsuzPaketler) {
      const medyaWithGps = db.prepare(`
        SELECT latitude, longitude FROM medya
        WHERE veri_paketi_id = ? AND latitude IS NOT NULL AND longitude IS NOT NULL
        ORDER BY yukleme_tarihi ASC
        LIMIT 1
      `).get(paket.id);

      if (medyaWithGps) {
        db.prepare(`
          UPDATE veri_paketleri SET latitude = ?, longitude = ? WHERE id = ?
        `).run(medyaWithGps.latitude, medyaWithGps.longitude, paket.id);
        guncellenen++;
      }
    }

    basarili(res, {
      message: `${guncellenen} paketin konumu medyadan hesaplandı`,
      toplam_konumsuz: konumsuzPaketler.length,
      guncellenen
    });
  } catch (error) {
    console.error('Konum hesaplama hatası:', error);
    hata(res, error.message, 500);
  }
});

// GET /api/saha/proje-cizimleri — Projelerin Yeni Durum DXF dosyalarını listele
router.get('/proje-cizimleri', (req, res) => {
  try {
    const db = getDb();
    // Sadece "Yeni Durum Proje" adımındaki DXF dosyaları
    const projeler = db.prepare(`
      SELECT p.id, p.proje_no, p.proje_tipi, p.musteri_adi, p.mahalle, p.durum,
        d.id as dosya_id, d.orijinal_adi as dosya_adi
      FROM projeler p
      JOIN proje_adimlari pa ON pa.proje_id = p.id AND pa.adim_kodu = 'yeni_durum_proje'
      JOIN dosyalar d ON d.proje_adim_id = pa.id AND d.durum = 'aktif'
        AND (d.dosya_adi LIKE '%.dxf' OR d.orijinal_adi LIKE '%.dxf')
      WHERE p.durum != 'tamamlandi'
      ORDER BY p.olusturma_tarihi DESC
    `).all();
    basarili(res, projeler);
  } catch (error) {
    hata(res, error.message, 500);
  }
});

module.exports = router;
