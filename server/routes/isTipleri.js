const express = require('express');
const router = express.Router();
const fazService = require('../services/fazService');

// GET /api/is-tipleri
router.get('/', (req, res) => {
  try {
    const tipler = fazService.isTipleriniListele();
    res.json({ success: true, data: tipler });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/is-tipleri/:id
router.get('/:id', (req, res) => {
  try {
    const tip = fazService.isTipiGetir(parseInt(req.params.id));
    if (!tip) return res.status(404).json({ success: false, error: 'İş tipi bulunamadı' });
    res.json({ success: true, data: tip });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/is-tipleri
router.post('/', (req, res) => {
  try {
    const tip = fazService.isTipiOlustur(req.body);
    res.json({ success: true, data: tip });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/is-tipleri/:id
router.put('/:id', (req, res) => {
  try {
    const tip = fazService.isTipiTopluKaydet(parseInt(req.params.id), req.body);
    res.json({ success: true, data: tip });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/is-tipleri/:id
router.delete('/:id', (req, res) => {
  try {
    fazService.isTipiSil(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
