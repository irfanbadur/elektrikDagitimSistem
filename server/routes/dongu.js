const express = require('express');
const router = express.Router();
const donguService = require('../services/donguService');

// ═══════════════════════════════════════════════
// ŞABLON ENDPOINT'LERİ
// ═══════════════════════════════════════════════

// GET /api/dongu/sablon
router.get('/sablon', (req, res) => {
  try {
    const sablonlar = donguService.sablonlariListele();
    res.json({ success: true, data: sablonlar });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dongu/sablon/:id
router.get('/sablon/:id', (req, res) => {
  try {
    const sablon = donguService.sablonGetir(parseInt(req.params.id));
    if (!sablon) return res.status(404).json({ success: false, error: 'Şablon bulunamadı' });
    res.json({ success: true, data: sablon });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/dongu/sablon
router.post('/sablon', (req, res) => {
  try {
    const sablon = donguService.sablonOlustur(req.body);
    res.json({ success: true, data: sablon });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/dongu/sablon/:id
router.put('/sablon/:id', (req, res) => {
  try {
    const sablon = donguService.sablonGuncelle(parseInt(req.params.id), req.body);
    res.json({ success: true, data: sablon });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════
// PROJE AŞAMA ENDPOINT'LERİ
// ═══════════════════════════════════════════════

// POST /api/dongu/proje/:projeId/ata
router.post('/proje/:projeId/ata', (req, res) => {
  try {
    const asamalar = donguService.projeDonguAta(
      parseInt(req.params.projeId),
      parseInt(req.body.sablon_id)
    );
    res.json({ success: true, data: asamalar });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/dongu/proje/:projeId
router.delete('/proje/:projeId', (req, res) => {
  try {
    donguService.projeDonguSil(parseInt(req.params.projeId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dongu/proje/:projeId
router.get('/proje/:projeId', (req, res) => {
  try {
    const asamalar = donguService.projeAsamalariGetir(parseInt(req.params.projeId));
    res.json({ success: true, data: asamalar });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dongu/proje/:projeId/ilerleme
router.get('/proje/:projeId/ilerleme', (req, res) => {
  try {
    const ilerleme = donguService.projeIlerleme(parseInt(req.params.projeId));
    res.json({ success: true, data: ilerleme });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/dongu/asama/:id/baslat
router.put('/asama/:id/baslat', (req, res) => {
  try {
    const sonuc = donguService.asamaBaslat(parseInt(req.params.id), req.body);
    res.json({ success: true, data: sonuc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/dongu/asama/:id/tamamla
router.put('/asama/:id/tamamla', (req, res) => {
  try {
    const sonuc = donguService.asamaTamamla(parseInt(req.params.id), req.body);
    res.json({ success: true, data: sonuc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/dongu/asama/:id/atla
router.put('/asama/:id/atla', (req, res) => {
  try {
    donguService.asamaAtla(parseInt(req.params.id), req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/dongu/asama/:id/tarih
router.put('/asama/:id/tarih', (req, res) => {
  try {
    donguService.asamaTarihGuncelle(parseInt(req.params.id), req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
