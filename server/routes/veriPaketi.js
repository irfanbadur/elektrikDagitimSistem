const express = require('express');
const router = express.Router();
const multer = require('multer');
const veriPaketiService = require('../services/veriPaketiService');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// POST /api/veri-paketi — Yeni paket oluştur
router.post('/', (req, res) => {
  try {
    const paket = veriPaketiService.olustur(req.body);
    res.json({ success: true, data: paket });
  } catch (error) {
    console.error('Paket oluşturma hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/veri-paketi — Paketleri listele
router.get('/', (req, res) => {
  try {
    const paketler = veriPaketiService.listele({
      projeId: req.query.proje_id,
      ekipId: req.query.ekip_id,
      paketTipi: req.query.paket_tipi,
      durum: req.query.durum,
      projeDurum: req.query.proje_durum,
      dosyaKategori: req.query.dosya_kategori,
      siralama: req.query.siralama,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
    });
    res.json({ success: true, data: paketler });
  } catch (error) {
    console.error('Paket listeleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/veri-paketi/:id — Paket detay (dosyalar dahil)
router.get('/:id', (req, res) => {
  try {
    const paket = veriPaketiService.getirDetayli(parseInt(req.params.id));
    if (!paket) return res.status(404).json({ success: false, error: 'Paket bulunamadı' });
    res.json({ success: true, data: paket });
  } catch (error) {
    console.error('Paket detay hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/veri-paketi/:id/dosya — Pakete dosya ekle
router.post('/:id/dosya', upload.single('dosya'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Dosya seçilmedi' });
    }
    const sonuc = await veriPaketiService.dosyaEkle(
      parseInt(req.params.id),
      req.file.buffer,
      {
        orijinalAdi: req.file.originalname,
        baslik: req.body.baslik || null,
        notlar: req.body.notlar || null,
        etiketler: req.body.etiketler ? JSON.parse(req.body.etiketler) : [],
        latitude: req.body.latitude ? parseFloat(req.body.latitude) : null,
        longitude: req.body.longitude ? parseFloat(req.body.longitude) : null,
      }
    );
    res.json({ success: true, data: sonuc });
  } catch (error) {
    console.error('Pakete dosya ekleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/veri-paketi/:id/not — Pakete not ekle
router.put('/:id/not', (req, res) => {
  try {
    veriPaketiService.notEkle(parseInt(req.params.id), req.body.not);
    res.json({ success: true });
  } catch (error) {
    console.error('Paket not ekleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/veri-paketi/:id/tamamla — Paketi tamamla
router.put('/:id/tamamla', (req, res) => {
  try {
    veriPaketiService.tamamla(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error('Paket tamamlama hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/veri-paketi/:id/onayla — Koordinatör onay/red
router.put('/:id/onayla', (req, res) => {
  try {
    veriPaketiService.onayla(parseInt(req.params.id), req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Paket onay hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
