const express = require('express');
const router = express.Router();
const multer = require('multer');
const dosyaService = require('../services/dosyaService');
const { getDb } = require('../db/database');

// Multer — bellek tamponu (dosyayı RAM'de tut, dosyaService kaydetsin)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // Maks 50MB
});

// ─── ALAN BAZLI İSTATİSTİK (v2) ───────────────────────
// GET /api/dosya/istatistik/alan
router.get('/istatistik/alan', (req, res) => {
  try {
    const db = getDb();
    const istatistik = db.prepare(`
      SELECT
        alan,
        alt_alan,
        COUNT(*) as dosya_sayisi,
        SUM(dosya_boyutu) as toplam_boyut
      FROM dosyalar
      WHERE durum = 'aktif'
      GROUP BY alan, alt_alan
      ORDER BY alan, alt_alan
    `).all();

    res.json({ success: true, data: istatistik });
  } catch (error) {
    console.error('Alan istatistik hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── SÜRESİ DOLAN BELGELER RAPORU (v2) ────────────────
// GET /api/dosya/suresi-dolan?gun=30
router.get('/suresi-dolan', (req, res) => {
  try {
    const db = getDb();
    const gun = parseInt(req.query.gun) || 30;
    const hedefTarih = new Date();
    hedefTarih.setDate(hedefTarih.getDate() + gun);
    const hedefStr = hedefTarih.toISOString().slice(0, 10);

    const dosyalar = db.prepare(`
      SELECT d.*,
        json_extract(d.ozel_alanlar, '$.gecerlilik_bitis') as gecerlilik_bitis,
        json_extract(d.ozel_alanlar, '$.muayene_bitis') as muayene_bitis,
        json_extract(d.ozel_alanlar, '$.kalibrasyon_bitis') as kalibrasyon_bitis,
        json_extract(d.ozel_alanlar, '$.sigorta_bitis') as sigorta_bitis
      FROM dosyalar d
      WHERE d.durum = 'aktif'
        AND (
          (json_extract(d.ozel_alanlar, '$.gecerlilik_bitis') IS NOT NULL
           AND json_extract(d.ozel_alanlar, '$.gecerlilik_bitis') <= ?)
          OR
          (json_extract(d.ozel_alanlar, '$.muayene_bitis') IS NOT NULL
           AND json_extract(d.ozel_alanlar, '$.muayene_bitis') <= ?)
          OR
          (json_extract(d.ozel_alanlar, '$.kalibrasyon_bitis') IS NOT NULL
           AND json_extract(d.ozel_alanlar, '$.kalibrasyon_bitis') <= ?)
          OR
          (json_extract(d.ozel_alanlar, '$.sigorta_bitis') IS NOT NULL
           AND json_extract(d.ozel_alanlar, '$.sigorta_bitis') <= ?)
        )
      ORDER BY COALESCE(
        json_extract(d.ozel_alanlar, '$.gecerlilik_bitis'),
        json_extract(d.ozel_alanlar, '$.muayene_bitis'),
        json_extract(d.ozel_alanlar, '$.kalibrasyon_bitis'),
        json_extract(d.ozel_alanlar, '$.sigorta_bitis')
      ) ASC
    `).all(hedefStr, hedefStr, hedefStr, hedefStr);

    res.json({ success: true, data: dosyalar });
  } catch (error) {
    console.error('Süresi dolan belgeler hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── ALAN BAZLI DOSYA LİSTELEME (v2) ─────────────────
// GET /api/dosya/alan/:alan
router.get('/alan/:alan', (req, res) => {
  try {
    const dosyalar = dosyaService.dosyalariGetir({
      alan: req.params.alan,
      altAlan: req.query.alt_alan,
      iliskiliKaynakTipi: req.query.kaynak_tipi,
      iliskiliKaynakId: req.query.kaynak_id ? parseInt(req.query.kaynak_id) : null,
      kategori: req.query.kategori,
      etiket: req.query.etiket,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
    });

    // Proje alanında: sanal klasörler ekle
    if (req.params.alan === 'proje') {
      const db = require('../db/database').getDb();
      const altAlanQuery = req.query.alt_alan || '';
      const mevcutAltAlanlar = new Set(dosyalar.map(d => (d.alt_alan || '').split('/')[0]).filter(Boolean));

      if (!altAlanQuery) {
        // Kök seviye: iş tipi klasörleri
        const isTipleri = db.prepare('SELECT kod FROM is_tipleri WHERE aktif = 1').all();
        for (const tip of isTipleri) {
          if (!mevcutAltAlanlar.has(tip.kod)) {
            dosyalar.push({
              id: null, dosya_adi: null, orijinal_adi: null,
              dosya_yolu: `projeler/${tip.kod}/.klasor`,
              alt_alan: `${tip.kod}/placeholder`,
              kategori: null, dosya_boyutu: 0, _sanal: true,
            });
          }
        }
      } else {
        // İş tipi klasörü içinde: o tipteki projelerin klasörleri
        const parcalar = altAlanQuery.split('/');
        const isTipiKodu = parcalar[0];
        if (parcalar.length === 1) {
          // İş tipi kök seviyesi - projeleri listele
          const projeler = db.prepare('SELECT proje_no FROM projeler WHERE UPPER(proje_tipi) = UPPER(?)').all(isTipiKodu);
          const mevcutProjeYollar = new Set(
            dosyalar.map(d => {
              const aa = (d.alt_alan || '');
              if (aa.startsWith(isTipiKodu + '/')) {
                return aa.split('/')[1];
              }
              return null;
            }).filter(Boolean)
          );
          for (const p of projeler) {
            if (!mevcutProjeYollar.has(p.proje_no)) {
              dosyalar.push({
                id: null, dosya_adi: null, orijinal_adi: null,
                dosya_yolu: `projeler/${isTipiKodu}/${p.proje_no}/.klasor`,
                alt_alan: `${isTipiKodu}/${p.proje_no}/placeholder`,
                kategori: null, dosya_boyutu: 0, _sanal: true,
              });
            }
          }
        }
      }
    }

    res.json({ success: true, data: dosyalar });
  } catch (error) {
    console.error('Alan dosya listeleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── PROJE DOSYA İSTATİSTİĞİ ─────────────────────────
// GET /api/dosya/istatistik/proje/:projeId
// Bu route :id'den önce tanımlanmalı
router.get('/istatistik/proje/:projeId', (req, res) => {
  try {
    const istatistik = dosyaService.projeIstatistik(parseInt(req.params.projeId));
    res.json({ success: true, data: istatistik });
  } catch (error) {
    console.error('İstatistik hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── ADIM BAZLI DOSYA LİSTELEME ─────────────────────
// GET /api/dosya/adim/:adimId
router.get('/adim/:adimId', (req, res) => {
  try {
    const db = getDb();
    const dosyalar = db.prepare(`
      SELECT id, dosya_adi, orijinal_adi, thumbnail_yolu, kategori, mime_tipi, dosya_boyutu, olusturma_tarihi
      FROM dosyalar
      WHERE proje_adim_id = ? AND durum = 'aktif'
      ORDER BY olusturma_tarihi DESC
    `).all(parseInt(req.params.adimId));
    res.json({ success: true, data: dosyalar });
  } catch (error) {
    console.error('Adım dosya listeleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── DOSYA YÜKLEME ────────────────────────────────────
// POST /api/dosya/yukle — Tekli dosya yükleme
router.post('/yukle', upload.single('dosya'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Dosya seçilmedi' });
    }

    const projeId = req.body.proje_id ? parseInt(req.body.proje_id) : null;
    const projeAdimId = req.body.proje_adim_id ? parseInt(req.body.proje_adim_id) : null;
    let veriPaketiId = req.body.veri_paketi_id ? parseInt(req.body.veri_paketi_id) : null;

    // Döngü adımından yüklenen dosyalar için otomatik veri paketi oluştur
    if (projeAdimId && !veriPaketiId && projeId) {
      const veriPaketiService = require('../services/veriPaketiService');
      const db = require('../db/database').getDb();

      // Adım bilgisini al (paket_tipi olarak adim_kodu kullanılacak)
      const adim = db.prepare('SELECT adim_kodu, adim_adi FROM proje_adimlari WHERE id = ?').get(projeAdimId);
      const paketTipi = adim?.adim_kodu || 'genel';

      const paket = veriPaketiService.olustur({
        paketTipi,
        projeId,
        notlar: null,
        kaynak: req.body.kaynak || 'web',
      });
      veriPaketiId = paket.id;

      // proje_adim_id'yi pakete de bağla
      db.prepare('UPDATE veri_paketleri SET proje_adim_id = ? WHERE id = ?').run(projeAdimId, veriPaketiId);
    }

    // proje_no ve proje_tipi gönderilmediyse proje_id'den çek
    let projeNo = req.body.proje_no || null;
    let projeTipi = req.body.proje_tipi || null;
    if (projeId && (!projeNo || !projeTipi)) {
      const db = require('../db/database').getDb();
      const proje = db.prepare('SELECT proje_no, proje_tipi FROM projeler WHERE id = ?').get(projeId);
      if (proje) {
        if (!projeNo) projeNo = proje.proje_no;
        if (!projeTipi) projeTipi = proje.proje_tipi;
      }
    }

    // Adım bazlı yükleme: mevcut dosya sayısı ve adım adını al
    let adimAdi = null;
    let adimDosyaSayisi = 0;
    if (projeAdimId) {
      const db2 = require('../db/database').getDb();
      const adim = db2.prepare('SELECT adim_adi FROM proje_adimlari WHERE id = ?').get(projeAdimId);
      if (adim) adimAdi = adim.adim_adi;
      adimDosyaSayisi = db2.prepare("SELECT COUNT(*) as c FROM dosyalar WHERE proje_adim_id = ? AND durum = 'aktif'").get(projeAdimId)?.c || 0;
    }

    const sonuc = await dosyaService.dosyaYukle(req.file.buffer, {
      orijinalAdi: req.file.originalname,
      // v2 alan bazlı parametreler
      alan: req.body.alan || (projeId ? 'proje' : null),
      altAlan: req.body.alt_alan || null,
      adimAdi,
      adimDosyaSayisi,
      iliskiliKaynakTipi: req.body.iliskili_kaynak_tipi || null,
      iliskiliKaynakId: req.body.iliskili_kaynak_id ? parseInt(req.body.iliskili_kaynak_id) : null,
      personelKodu: req.body.personel_kodu || null,
      ekipmanKodu: req.body.ekipman_kodu || null,
      ihaleNo: req.body.ihale_no || null,
      kurumAdi: req.body.kurum_adi || null,
      ozelAlanlar: req.body.ozel_alanlar ? JSON.parse(req.body.ozel_alanlar) : null,
      // mevcut parametreler
      projeNo,
      projeTipi,
      projeId,
      ekipId: req.body.ekip_id ? parseInt(req.body.ekip_id) : null,
      ekipKodu: req.body.ekip_kodu || null,
      yukleyenId: req.body.yukleyen_id ? parseInt(req.body.yukleyen_id) : null,
      veriPaketiId,
      baslik: req.body.baslik || null,
      notlar: req.body.notlar || null,
      etiketler: req.body.etiketler ? JSON.parse(req.body.etiketler) : [],
      latitude: req.body.latitude ? parseFloat(req.body.latitude) : null,
      longitude: req.body.longitude ? parseFloat(req.body.longitude) : null,
      konumAdi: req.body.konum_adi || null,
      kaynak: req.body.kaynak || 'web',
      projeAdimId,
    });

    // Otomatik oluşturulan paketi tamamla
    if (projeAdimId && !req.body.veri_paketi_id && veriPaketiId) {
      const veriPaketiService = require('../services/veriPaketiService');
      veriPaketiService.tamamla(veriPaketiId);
    }

    res.json({ success: true, data: sonuc });
  } catch (error) {
    console.error('Dosya yükleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/dosya/toplu-yukle — Çoklu dosya yükleme
router.post('/toplu-yukle', upload.array('dosyalar', 20), async (req, res) => {
  try {
    const sonuclar = [];
    for (const file of req.files) {
      const sonuc = await dosyaService.dosyaYukle(file.buffer, {
        orijinalAdi: file.originalname,
        // v2 alan bazlı parametreler
        alan: req.body.alan || null,
        altAlan: req.body.alt_alan || null,
        iliskiliKaynakTipi: req.body.iliskili_kaynak_tipi || null,
        iliskiliKaynakId: req.body.iliskili_kaynak_id ? parseInt(req.body.iliskili_kaynak_id) : null,
        personelKodu: req.body.personel_kodu || null,
        ekipmanKodu: req.body.ekipman_kodu || null,
        ihaleNo: req.body.ihale_no || null,
        kurumAdi: req.body.kurum_adi || null,
        ozelAlanlar: req.body.ozel_alanlar ? JSON.parse(req.body.ozel_alanlar) : null,
        // mevcut parametreler
        projeNo: req.body.proje_no || null,
        projeId: req.body.proje_id ? parseInt(req.body.proje_id) : null,
        ekipId: req.body.ekip_id ? parseInt(req.body.ekip_id) : null,
        ekipKodu: req.body.ekip_kodu || null,
        yukleyenId: req.body.yukleyen_id ? parseInt(req.body.yukleyen_id) : null,
        veriPaketiId: req.body.veri_paketi_id ? parseInt(req.body.veri_paketi_id) : null,
        baslik: req.body.baslik || null,
        notlar: req.body.notlar || null,
        etiketler: req.body.etiketler ? JSON.parse(req.body.etiketler) : [],
        kaynak: req.body.kaynak || 'web',
        projeAdimId: req.body.proje_adim_id ? parseInt(req.body.proje_adim_id) : null,
      });
      sonuclar.push(sonuc);
    }
    res.json({ success: true, data: sonuclar });
  } catch (error) {
    console.error('Toplu yükleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── DOSYA LİSTELEME / SORGULAMA ─────────────────────
// GET /api/dosya — Dosyaları filtreli listele
router.get('/', (req, res) => {
  try {
    const dosyalar = dosyaService.dosyalariGetir({
      // v2 alan filtreleri
      alan: req.query.alan,
      altAlan: req.query.alt_alan,
      iliskiliKaynakTipi: req.query.kaynak_tipi,
      iliskiliKaynakId: req.query.kaynak_id ? parseInt(req.query.kaynak_id) : null,
      // mevcut filtreler
      projeId: req.query.proje_id,
      ekipId: req.query.ekip_id,
      veriPaketiId: req.query.veri_paketi_id,
      kategori: req.query.kategori,
      etiket: req.query.etiket,
      kaynak: req.query.kaynak,
      durum: req.query.durum || 'aktif',
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
    });
    res.json({ success: true, data: dosyalar });
  } catch (error) {
    console.error('Dosya listeleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dosya/:id — Tek dosya detayı
router.get('/:id', (req, res) => {
  try {
    const dosya = dosyaService.dosyaGetir(parseInt(req.params.id));
    if (!dosya) return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });
    res.json({ success: true, data: dosya });
  } catch (error) {
    console.error('Dosya detay hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dosya/:id/indir — Dosyayı indir
router.get('/:id/indir', (req, res) => {
  try {
    const dosya = dosyaService.dosyaGetir(parseInt(req.params.id));
    if (!dosya) return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });

    const tamYol = dosyaService.dosyaYoluCozumle(dosya.dosya_yolu);
    res.download(tamYol, dosya.orijinal_adi || dosya.dosya_adi);
  } catch (error) {
    console.error('Dosya indirme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dosya/:id/thumb — Thumbnail göster
router.get('/:id/thumb', (req, res) => {
  try {
    const dosya = dosyaService.dosyaGetir(parseInt(req.params.id));
    if (!dosya || !dosya.thumbnail_yolu) {
      return res.status(404).json({ success: false, error: 'Thumbnail yok' });
    }
    const tamYol = dosyaService.dosyaYoluCozumle(dosya.thumbnail_yolu);
    res.sendFile(tamYol);
  } catch (error) {
    console.error('Thumbnail hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dosya/:id/dosya — Dosya içeriğini sun (inline)
router.get('/:id/dosya', (req, res) => {
  try {
    const dosya = dosyaService.dosyaGetir(parseInt(req.params.id));
    if (!dosya) return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });

    const tamYol = dosyaService.dosyaYoluCozumle(dosya.dosya_yolu);
    res.setHeader('Content-Type', dosya.mime_tipi || 'application/octet-stream');
    res.sendFile(tamYol);
  } catch (error) {
    console.error('Dosya sunma hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── DOSYA GÜNCELLEME ─────────────────────────────────
// PUT /api/dosya/:id — Metadata güncelle
router.put('/:id', (req, res) => {
  try {
    dosyaService.dosyaGuncelle(parseInt(req.params.id), {
      baslik: req.body.baslik,
      notlar: req.body.notlar,
      etiketler: req.body.etiketler,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      konumAdi: req.body.konum_adi,
      projeId: req.body.proje_id,
      veriPaketiId: req.body.veri_paketi_id,
      // v2 alanları
      alan: req.body.alan,
      altAlan: req.body.alt_alan,
      iliskiliKaynakTipi: req.body.iliskili_kaynak_tipi,
      iliskiliKaynakId: req.body.iliskili_kaynak_id,
      ozelAlanlar: req.body.ozel_alanlar,
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Dosya güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/dosya/toplu-sil — Toplu dosya silme
router.post('/toplu-sil', (req, res) => {
  try {
    const { ids, fiziksel } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids dizisi zorunludur' });
    }
    let silinen = 0;
    for (const id of ids) {
      try {
        dosyaService.dosyaSil(parseInt(id), fiziksel === true);
        silinen++;
      } catch (e) {
        console.error(`Dosya ${id} silme hatası:`, e);
      }
    }
    res.json({ success: true, data: { silinen } });
  } catch (error) {
    console.error('Toplu silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/dosya/klasor-sil — Klasör silme (alan + alt_alan prefix)
router.post('/klasor-sil', (req, res) => {
  try {
    const { alan, alt_alan, fiziksel } = req.body;
    if (!alan || !alt_alan) return res.status(400).json({ success: false, error: 'alan ve alt_alan zorunludur' });
    const silinen = dosyaService.klasorSil(alan, alt_alan, fiziksel === true);
    res.json({ success: true, data: { silinen } });
  } catch (error) {
    console.error('Klasör silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/dosya/:id — Dosya silme
router.delete('/:id', (req, res) => {
  try {
    const fiziksel = req.body?.fiziksel === true || req.query.fiziksel === 'true';
    dosyaService.dosyaSil(parseInt(req.params.id), fiziksel);
    res.json({ success: true });
  } catch (error) {
    console.error('Dosya silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
