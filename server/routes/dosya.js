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

    // ── Yeni Durum Proje'ye DXF yüklendiğinde Keşif ve Metraj adımlarına kopyala ──
    if (projeAdimId && projeId && req.file.originalname?.toLowerCase().endsWith('.dxf')) {
      const db = require('../db/database').getDb();
      const adim = db.prepare('SELECT adim_kodu FROM proje_adimlari WHERE id = ?').get(projeAdimId);
      if (adim?.adim_kodu === 'yeni_durum_proje') {
        const fs = require('fs');
        const path = require('path');
        const hedefAdimlar = db.prepare(
          `SELECT id, adim_kodu, adim_adi FROM proje_adimlari WHERE proje_id = ? AND adim_kodu IN ('kesif', 'metraj')`
        ).all(projeId);

        for (const hedef of hedefAdimlar) {
          try {
            // Orijinal dosyayı kopyala
            const kaynakYol = dosyaService.dosyaYoluCozumle(sonuc.dosya_yolu);
            const hedefAdi = `${projeNo || 'proje'}_${hedef.adim_adi.replace(/\s+/g, '-')}.dxf`;
            const hedefGorYol = sonuc.dosya_yolu.replace(/[^/]+$/, `../${hedef.adim_adi.replace(/\s+/g, '_')}/${hedefAdi}`).replace(/\.\.\//g, '');
            // Basitleştirilmiş yol
            const parcalar = sonuc.dosya_yolu.split('/');
            parcalar.pop(); // dosya adını çıkar
            const hedefKlasor = parcalar.join('/').replace(/\/[^/]+$/, `/${hedef.adim_adi.replace(/\s+/g, '_')}`);
            const goreceliYol = `${hedefKlasor}/${hedefAdi}`;
            const hedefTamYol = dosyaService.dosyaYoluCozumle(goreceliYol);

            fs.mkdirSync(path.dirname(hedefTamYol), { recursive: true });
            fs.copyFileSync(kaynakYol, hedefTamYol);

            // Önceki dosyayı pasife çek
            db.prepare(`UPDATE dosyalar SET durum = 'silindi' WHERE proje_adim_id = ? AND dosya_adi LIKE '%.dxf' AND durum = 'aktif'`).run(hedef.id);

            // DB kaydı oluştur
            db.prepare(`
              INSERT INTO dosyalar (dosya_adi, orijinal_adi, dosya_yolu, dosya_boyutu, mime_tipi, kategori,
                alan, proje_id, proje_adim_id, durum, olusturma_tarihi)
              VALUES (?, ?, ?, ?, 'application/dxf', 'cizim', 'proje', ?, ?, 'aktif', datetime('now'))
            `).run(hedefAdi, hedefAdi, goreceliYol, sonuc.dosya_boyutu || 0, projeId, hedef.id);
          } catch (kopyaErr) { console.error(`DXF kopyalama hatası (${hedef.adim_kodu}):`, kopyaErr.message); }
        }
      }
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

// POST /api/dosya/klasor-olustur — Yeni klasör oluştur (placeholder kayıt ile)
router.post('/klasor-olustur', (req, res) => {
  try {
    const db = getDb();
    const { alan, alt_alan, klasor_adi } = req.body;
    if (!alan || !klasor_adi) return res.status(400).json({ success: false, error: 'alan ve klasor_adi zorunludur' });

    const yeniAltAlan = alt_alan ? `${alt_alan}/${klasor_adi}` : klasor_adi;

    // Aynı yolda klasör var mı kontrol
    const mevcut = db.prepare(`SELECT COUNT(*) as c FROM dosyalar WHERE alan = ? AND alt_alan LIKE ? AND durum = 'aktif'`).get(alan, `${yeniAltAlan}%`);
    if (mevcut.c > 0) return res.status(409).json({ success: false, error: 'Bu klasör zaten mevcut' });

    // Placeholder dosya kaydı oluştur (klasörü temsil eder)
    db.prepare(`
      INSERT INTO dosyalar (dosya_adi, orijinal_adi, dosya_yolu, dosya_boyutu, mime_tipi, kategori,
        alan, alt_alan, durum, olusturma_tarihi)
      VALUES (?, ?, '', 0, 'inode/directory', 'klasor', ?, ?, 'aktif', datetime('now'))
    `).run(`_klasor_${klasor_adi}`, klasor_adi, alan, yeniAltAlan);

    res.json({ success: true, data: { alan, alt_alan: yeniAltAlan } });
  } catch (error) {
    console.error('Klasör oluşturma hatası:', error);
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

// GET /:id/dxf-elemanlar — DXF'ten direkler ve diğer öğeleri çıkar
router.get('/:id/dxf-elemanlar', (req, res) => {
  try {
    const dosya = dosyaService.dosyaGetir(parseInt(req.params.id));
    if (!dosya) return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });
    const tamYol = dosyaService.dosyaYoluCozumle(dosya.dosya_yolu);
    const fs = require('fs');
    const content = fs.readFileSync(tamYol, 'utf-8');
    const lines = content.split('\n');

    // TEXT entity'lerini parse et — group code pairs
    const elemanlar = [];
    let inText = false, entity = {};
    for (let i = 0; i < lines.length - 1; i += 2) {
      const code = parseInt(lines[i].trim());
      const val = lines[i+1].trim();

      if (code === 0) {
        // Önceki entity'yi kaydet
        if (inText && entity.text && entity.x !== undefined) elemanlar.push(entity);
        inText = val === 'TEXT';
        entity = inText ? { tip: 'TEXT' } : {};
        continue;
      }
      if (!inText) continue;

      switch (code) {
        case 7: entity.stil = val; break;       // Style name
        case 1: entity.text = val; break;        // Text content
        case 10: entity.x = parseFloat(val); break;  // X
        case 20: entity.y = parseFloat(val); break;  // Y
        case 40: entity.yukseklik = parseFloat(val); break;
        case 8: entity.katman = val; break;      // Layer
      }
    }
    if (inText && entity.text && entity.x !== undefined) elemanlar.push(entity);

    // LINE entity'lerini parse et — hat çizgileri
    const hatCizgileri = [];
    let inLine = false, lineEnt = {};
    for (let i = 0; i < lines.length - 1; i += 2) {
      const code = parseInt(lines[i].trim());
      const val = lines[i+1].trim();
      if (code === 0) {
        if (inLine && lineEnt.x1 !== undefined && lineEnt.x2 !== undefined) hatCizgileri.push(lineEnt);
        inLine = val === 'LINE';
        lineEnt = inLine ? {} : {};
        continue;
      }
      if (!inLine) continue;
      if (code === 10) lineEnt.x1 = parseFloat(val);
      if (code === 20) lineEnt.y1 = parseFloat(val);
      if (code === 11) lineEnt.x2 = parseFloat(val);
      if (code === 21) lineEnt.y2 = parseFloat(val);
      if (code === 8) lineEnt.katman = val;
    }
    if (inLine && lineEnt.x1 !== undefined && lineEnt.x2 !== undefined) hatCizgileri.push(lineEnt);

    // Direk stilindeki elemanları ayır
    const SEMBOL_MAP = { 'E': 'Direk', 'C': 'Armatür', '4': 'Koruma Topraklama', '5': 'İşletme Topraklama', 'A': 'Ağaç Direk', '2': 'Beton Direk' };
    const direkler = elemanlar.filter(e => e.stil === 'Direk').map(e => ({
      ...e, sembolAdi: SEMBOL_MAP[e.text] || e.text
    }));
    // Normal textler (etiketler — direk adları vb.)
    const etiketler = elemanlar.filter(e => e.stil !== 'Direk' && e.text);

    // Direk numarası pattern: A01, B02, C10 vb. (harf + rakam)
    const NUMARA_RE = /^[A-Z]\d{1,3}$/i;
    // Direk tipi pattern: G-10I, G-K1, G-12I(P) vb.
    const TIP_RE = /^G-/i;
    // İletken pattern: 3x70, AER, ROSE, PANSY, SWALLOW vb.
    const ILETKEN_RE = /(\d+x\d+|AER|ROSE|PANSY|ASTER|SWALLOW|RAVEN|PIGEON|HAWK|SW\b)/i;

    // Direk + yakınındaki etiketleri eşleştir — EN YAKIN olanı seç
    const sonuc = direkler.map(d => {
      let numara = null, numaraMesafe = Infinity;
      let tip = null, tipMesafe = Infinity;
      let enYakinEtiket = null, enYakinMesafe = Infinity;
      const iletkenler = []; // yakındaki iletken text'leri

      for (const et of etiketler) {
        const dx = (et.x||0) - (d.x||0), dy = (et.y||0) - (d.y||0);
        const mesafe = Math.sqrt(dx*dx + dy*dy);
        if (mesafe > 25) continue;
        // Direk numarası (A01, B02...) — en yakın olanı seç
        if (NUMARA_RE.test(et.text) && mesafe < numaraMesafe) {
          numara = et.text;
          numaraMesafe = mesafe;
        }
        // Direk tipi (G-10I, G-K1...) — en yakın olanı seç
        if (TIP_RE.test(et.text) && mesafe < tipMesafe) {
          tip = et.text;
          tipMesafe = mesafe;
        }
        // İletken text'leri (3x70+95 AER, ROSE vb.)
        if (ILETKEN_RE.test(et.text)) {
          iletkenler.push({ text: et.text, mesafe: Math.round(mesafe * 10) / 10 });
        }
        // En yakın genel etiket
        if (mesafe < enYakinMesafe) {
          enYakinMesafe = mesafe;
          enYakinEtiket = et;
        }
      }
      return {
        sembol: d.text,
        sembolAdi: d.sembolAdi,
        x: d.x, y: d.y,
        katman: d.katman,
        yukseklik: enYakinEtiket?.yukseklik || d.yukseklik || 2,
        numara: numara || null,
        tip: tip || null,
        etiket: enYakinEtiket?.text || null,
        iletkenler: iletkenler.length ? iletkenler : [],
      };
    });

    // ── LINE bazlı hat bağlantı tespiti ──
    const iletkenTextleri = etiketler.filter(et => ILETKEN_RE.test(et.text));
    const mesafeTextleri = etiketler.filter(et => /^\d+\.?\d*$/.test(et.text) && parseFloat(et.text) >= 5 && parseFloat(et.text) < 500);

    // Ana direkler (E, A, 2 sembolü, benzersiz numara)
    const anaDigitMap = new Map();
    for (const d of sonuc) {
      if (!d.numara || !['E', 'A', '2'].includes(d.sembol)) continue;
      if (!anaDigitMap.has(d.numara)) anaDigitMap.set(d.numara, d);
    }
    const anaDirekler = [...anaDigitMap.values()];
    const ESIK = 8; // direk-line ucu eşleşme eşiği

    // Her LINE'ın uçlarını en yakın direklere eşle
    const hatlar = new Map();
    for (const ln of hatCizgileri) {
      let d1 = null, d1m = Infinity, d2 = null, d2m = Infinity;
      for (const d of anaDirekler) {
        const m1 = Math.sqrt((d.x - ln.x1) ** 2 + (d.y - ln.y1) ** 2);
        const m2 = Math.sqrt((d.x - ln.x2) ** 2 + (d.y - ln.y2) ** 2);
        if (m1 < d1m) { d1 = d; d1m = m1; }
        if (m2 < d2m) { d2 = d; d2m = m2; }
      }
      if (!d1 || !d2 || d1.numara === d2.numara) continue;
      if (d1m > ESIK && d2m > ESIK) continue;

      const lineMesafe = Math.round(Math.sqrt((ln.x2 - ln.x1) ** 2 + (ln.y2 - ln.y1) ** 2) * 10) / 10;
      const ortaX = (ln.x1 + ln.x2) / 2, ortaY = (ln.y1 + ln.y2) / 2;

      // LINE üzerindeki iletken text
      let enYakinIt = null, enYakinItM = Infinity;
      for (const it of iletkenTextleri) {
        const m = Math.sqrt((it.x - ortaX) ** 2 + (it.y - ortaY) ** 2);
        if (m < lineMesafe * 0.6 && m < enYakinItM) { enYakinIt = it; enYakinItM = m; }
      }

      // LINE üzerindeki mesafe text
      let enYakinMt = null, enYakinMtM = Infinity;
      for (const mt of mesafeTextleri) {
        const m = Math.sqrt((mt.x - ortaX) ** 2 + (mt.y - ortaY) ** 2);
        if (m < lineMesafe * 0.6 && m < enYakinMtM) { enYakinMt = mt; enYakinMtM = m; }
      }

      const iletkenText = enYakinIt?.text || '';
      let hatDurum = 'Yeni';
      if (/^\(/.test(iletkenText)) hatDurum = 'Mevcut';
      else if (/^\[/.test(iletkenText)) hatDurum = 'DMM';

      const mesafe = enYakinMt ? parseFloat(enYakinMt.text) : lineMesafe;
      const skor = d1m + d2m;
      const key1 = `${d1.numara}→${d2.numara}`, key2 = `${d2.numara}→${d1.numara}`;
      const veri = { iletken: iletkenText || null, hatDurum, mesafe, _skor: skor };

      if (!hatlar.has(key1) || skor < hatlar.get(key1)._skor) {
        hatlar.set(key1, veri); hatlar.set(key2, veri);
      }
    }

    // Komşu bilgilerini oluştur
    for (const d of sonuc) {
      if (!d.numara) continue;
      const numVal = parseInt(d.numara.slice(1)) || 0;
      const komsular = anaDirekler
        .filter(k => k.numara !== d.numara && k.numara[0] === d.numara[0])
        .map(k => {
          const key = `${d.numara}→${k.numara}`;
          const hat = hatlar.get(key);
          const kusMesafe = Math.round(Math.sqrt((k.x - d.x) ** 2 + (k.y - d.y) ** 2) * 10) / 10;
          const kNumVal = parseInt(k.numara.slice(1)) || 0;
          return {
            numara: k.numara,
            mesafe: hat?.mesafe || kusMesafe,
            iletken: hat?.iletken || null,
            hatDurum: hat?.hatDurum || 'Yeni',
            yon: kNumVal < numVal ? 'gelen' : 'giden',
          };
        })
        .filter(k => k.iletken || k.mesafe < 100)
        .sort((a, b) => a.mesafe - b.mesafe)
        .slice(0, 4);
      d.komsular = komsular;
    }


    res.json({ success: true, data: { elemanlar: sonuc, toplamDirek: direkler.length, toplamEtiket: etiketler.length } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /:id/dxf-harita — DXF çizim verilerini WGS84 koordinatlarına çevirip harita için döndür
router.get('/:id/dxf-harita', (req, res) => {
  try {
    const proj4 = require('proj4');
    const fs = require('fs');
    const dosya = dosyaService.dosyaGetir(parseInt(req.params.id));
    if (!dosya) return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });
    const tamYol = dosyaService.dosyaYoluCozumle(dosya.dosya_yolu);
    const content = fs.readFileSync(tamYol, 'latin1');
    const lines = content.split(/\r?\n/);

    // TUREF/ITRF96 TM36 (Türkiye Transverse Mercator) → WGS84
    // YEDAŞ bölgesi: central meridian 36°, false easting 500000
    const turefTM36 = '+proj=tmerc +lat_0=0 +lon_0=36 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs';
    const wgs84 = '+proj=longlat +datum=WGS84 +no_defs';
    const toWGS84 = (x, y) => {
      // TM36 koordinat aralığı doğrulaması (block tanımlarını atla)
      if (x < 100000 || x > 900000 || y < 3500000 || y > 5000000) return null;
      try { const [lng, lat] = proj4(turefTM36, wgs84, [x, y]); return { lat, lng }; }
      catch { return null; }
    };

    // Entity'leri parse et
    const cizgiler = []; // LINE entity'leri → polyline olarak
    const polylineler = []; // LWPOLYLINE entity'leri
    const noktalar = []; // TEXT (direkler, etiketler)

    let entityType = null, entity = {};
    let lwVertices = []; // LWPOLYLINE köşe noktaları

    for (let i = 0; i < lines.length - 1; i += 2) {
      const code = parseInt(lines[i].trim());
      const val = lines[i + 1]?.trim();

      if (code === 0) {
        // Önceki entity'yi kaydet
        if (entityType === 'LINE' && entity.x1 !== undefined) {
          const p1 = toWGS84(entity.x1, entity.y1);
          const p2 = toWGS84(entity.x2, entity.y2);
          if (p1 && p2) cizgiler.push({ tip: 'line', katman: entity.katman || '0', noktalar: [[p1.lat, p1.lng], [p2.lat, p2.lng]] });
        }
        if (entityType === 'LWPOLYLINE' && lwVertices.length >= 2) {
          const coords = lwVertices.map(v => toWGS84(v.x, v.y)).filter(Boolean);
          if (coords.length >= 2) polylineler.push({ tip: 'polyline', katman: entity.katman || '0', kapali: entity.kapali, noktalar: coords.map(c => [c.lat, c.lng]) });
        }
        if (entityType === 'TEXT' && entity.text && entity.x !== undefined) {
          // Sembol TEXT'leri (B_CAD font, Direk stili) atla — tek karakter semboller
          if (entity.stil !== 'Direk' || entity.text.length > 2) {
            const p = toWGS84(entity.x, entity.y);
            if (p) noktalar.push({ tip: 'text', text: entity.text, katman: entity.katman || '0', stil: entity.stil, lat: p.lat, lng: p.lng });
          }
        }

        entityType = val;
        entity = {};
        lwVertices = [];
        continue;
      }

      // LINE
      if (entityType === 'LINE') {
        if (code === 8) entity.katman = val;
        else if (code === 10) entity.x1 = parseFloat(val);
        else if (code === 20) entity.y1 = parseFloat(val);
        else if (code === 11) entity.x2 = parseFloat(val);
        else if (code === 21) entity.y2 = parseFloat(val);
      }
      // LWPOLYLINE
      if (entityType === 'LWPOLYLINE') {
        if (code === 8) entity.katman = val;
        else if (code === 70) entity.kapali = (parseInt(val) & 1) === 1;
        else if (code === 10) lwVertices.push({ x: parseFloat(val) });
        else if (code === 20 && lwVertices.length > 0) lwVertices[lwVertices.length - 1].y = parseFloat(val);
      }
      // TEXT (direkler, etiketler)
      if (entityType === 'TEXT') {
        if (code === 8) entity.katman = val;
        else if (code === 7) entity.stil = val;
        else if (code === 1) entity.text = val;
        else if (code === 10) entity.x = parseFloat(val);
        else if (code === 20) entity.y = parseFloat(val);
      }
    }

    // DXF bounds hesapla (UTM → WGS84)
    const allX = [], allY = [];
    cizgiler.forEach(c => c.noktalar.forEach(p => { allX.push(p[1]); allY.push(p[0]); }));
    polylineler.forEach(c => c.noktalar.forEach(p => { allX.push(p[1]); allY.push(p[0]); }));
    noktalar.forEach(n => { allX.push(n.lng); allY.push(n.lat); });
    const bounds = allX.length > 0 ? {
      southWest: [Math.min(...allY), Math.min(...allX)],
      northEast: [Math.max(...allY), Math.max(...allX)],
    } : null;

    res.json({
      success: true,
      data: {
        bounds,
        cizgiler: [...cizgiler, ...polylineler],
        noktalar,
        toplam: { cizgi: cizgiler.length, polyline: polylineler.length, text: noktalar.length }
      }
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /:id/dxf-metraj-kaydet — DXF dosyasına malzeme notları ekleyip Metraj adımına kaydet
router.post('/:id/dxf-metraj-kaydet', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const db = getDb();
    const dosya = dosyaService.dosyaGetir(parseInt(req.params.id));
    if (!dosya) return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });

    const { proje_id, notlar } = req.body;
    if (!proje_id || !notlar?.length) return res.status(400).json({ success: false, error: 'proje_id ve notlar gerekli' });

    const metrajAdim = db.prepare(
      `SELECT id FROM proje_adimlari WHERE proje_id = ? AND faz_kodu = 'hak_edis' AND adim_kodu = 'metraj' LIMIT 1`
    ).get(proje_id);
    if (!metrajAdim) return res.status(404).json({ success: false, error: 'Hakediş > Metraj adımı bulunamadı' });

    // ── Orijinal DXF'i satır satır oku ──
    const tamYol = dosyaService.dosyaYoluCozumle(dosya.dosya_yolu);
    const raw = fs.readFileSync(tamYol);
    const NL = raw.includes(Buffer.from('\r\n')) ? '\r\n' : '\n';
    const isAnsi = raw.toString('ascii', 0, Math.min(raw.length, 2000)).includes('ANSI_1254');

    // Türkçe → Windows-1254 byte dönüşümü
    const WIN1254 = {'\u011E':0xD0,'\u011F':0xF0,'\u0130':0xDD,'\u0131':0xFD,'\u015E':0xDE,'\u015F':0xFE,'\u00C7':0xC7,'\u00E7':0xE7,'\u00D6':0xD6,'\u00F6':0xF6,'\u00DC':0xDC,'\u00FC':0xFC};
    const encodeStr = (str) => {
      if (!isAnsi) return Buffer.from(str, 'utf-8');
      const out = [];
      for (const ch of str) {
        const m = WIN1254[ch];
        if (m !== undefined) out.push(m);
        else { const c = ch.charCodeAt(0); out.push(c <= 0xFF ? c : 0x3F); }
      }
      return Buffer.from(out);
    };

    // ── Orijinal dosyayı group code pair'lere ayır ──
    const lines = raw.toString('latin1').split(/\r?\n/);
    // Section yapısını tara, ENTITIES ENDSEC ve LAYER ENDTAB pozisyonlarını bul
    let entitiesEndsecLine = -1; // "0" satırının index'i (ENDSEC'ten hemen önce)
    let layerEndtabLine = -1;
    let inEntities = false, inLayerTable = false;
    for (let i = 0; i < lines.length - 1; i += 2) {
      const code = lines[i].trim();
      const val = lines[i + 1]?.trim();
      if (code === '2' && val === 'ENTITIES') inEntities = true;
      if (code === '2' && val === 'LAYER') inLayerTable = true;
      if (code === '0' && val === 'ENDTAB' && inLayerTable) { layerEndtabLine = i; inLayerTable = false; }
      if (code === '0' && val === 'ENDSEC' && inEntities) { entitiesEndsecLine = i; inEntities = false; break; }
    }
    if (entitiesEndsecLine < 0) return res.status(400).json({ success: false, error: 'DXF ENTITIES ENDSEC bulunamadı' });

    // ── $HANDSEED oku ve handle'ları sıralı oluştur ──
    let handleSeed = 0x900;
    for (let i = 0; i < lines.length - 1; i += 2) {
      if (lines[i].trim() === '5' || lines[i].trim() === '$HANDSEED') {
        const val = parseInt(lines[i + 1]?.trim(), 16);
        if (val > handleSeed) handleSeed = val;
      }
    }
    handleSeed += 10; // Güvenli başlangıç

    // ── Model Space owner handle'ı bul (genelde 1B veya 1F) ──
    let ownerHandle = '1B';
    for (let i = 0; i < lines.length - 3; i += 2) {
      if (lines[i].trim() === '2' && lines[i + 1]?.trim() === '*Model_Space') {
        // Önceki satırlarda 5 (handle) ara
        for (let j = i - 2; j >= Math.max(0, i - 10); j -= 2) {
          if (lines[j].trim() === '5') { ownerHandle = lines[j + 1].trim(); break; }
        }
        break;
      }
    }

    // ── AutoCAD uyumlu TEXT entity'leri oluştur ──
    const textBufParts = [];
    const nl = Buffer.from(NL, 'latin1');
    const addLine = (str) => { textBufParts.push(Buffer.from(str, 'latin1'), nl); };
    for (const not of notlar) {
      const { x, y, yukseklik, satirlar } = not;
      if (!satirlar?.length) continue;
      const h = yukseklik || 2;
      satirlar.forEach((satir, i) => {
        const handle = (handleSeed++).toString(16).toUpperCase();
        const py = (y - i * h * 1.3).toFixed(6);
        const xStr = x.toFixed(6);
        addLine('0'); addLine('TEXT');
        addLine('5'); addLine(handle);
        addLine('330'); addLine(ownerHandle);
        addLine('100'); addLine('AcDbEntity');
        addLine('67'); addLine('0');
        addLine('8'); addLine('MALZEME');
        addLine('62'); addLine('4');
        addLine('6'); addLine('ByLayer');
        addLine('370'); addLine('-1');
        addLine('48'); addLine('1.0');
        addLine('60'); addLine('0');
        addLine('100'); addLine('AcDbText');
        addLine('1'); textBufParts.push(encodeStr(satir), nl);
        addLine('10'); addLine(xStr);
        addLine('20'); addLine(py);
        addLine('30'); addLine('0.0');
        addLine('40'); addLine(h.toFixed(6));
        addLine('41'); addLine('1.0');
        addLine('50'); addLine('0.0');
        addLine('51'); addLine('0.0');
        addLine('7'); addLine('Standard');
        addLine('11'); addLine(xStr);
        addLine('21'); addLine(py);
        addLine('31'); addLine('0.0');
        addLine('210'); addLine('0.0');
        addLine('220'); addLine('0.0');
        addLine('230'); addLine('1.0');
        addLine('72'); addLine('0');
        addLine('100'); addLine('AcDbText');
        addLine('73'); addLine('0');
      });
    }
    const textBlokBuf = Buffer.concat(textBufParts);

    // ── $HANDSEED güncelle (header'daki değeri artır) ──
    for (let i = 0; i < lines.length - 1; i += 2) {
      if (lines[i].trim() === '9' && lines[i + 1]?.trim() === '$HANDSEED') {
        if (i + 3 < lines.length && lines[i + 2].trim() === '5') {
          lines[i + 3] = (handleSeed + 10).toString(16).toUpperCase();
        }
        break;
      }
    }

    // ── MALZEME layer satırları ──
    // LAYER table'ın handle'ını bul
    let layerTableHandle = '5';
    for (let i = 0; i < lines.length - 1; i += 2) {
      if (lines[i].trim() === '2' && lines[i + 1]?.trim() === 'LAYER') {
        // Önceki satırlarda handle'ı bul
        for (let j = i - 2; j >= Math.max(0, i - 10); j -= 2) {
          if (lines[j].trim() === '5') { layerTableHandle = lines[j + 1].trim(); break; }
        }
        // Layer sayacını artır (70 group code)
        for (let j = i + 2; j < Math.min(lines.length, i + 12); j += 2) {
          if (lines[j].trim() === '70') {
            const count = parseInt(lines[j + 1]?.trim()) || 0;
            lines[j + 1] = String(count + 1);
            break;
          }
        }
        break;
      }
    }
    const layerLines = [];
    if (layerEndtabLine > 0 && !raw.includes(Buffer.from('MALZEME'))) {
      const layerHandle = (handleSeed++).toString(16).toUpperCase();
      layerLines.push(
        '0', 'LAYER',
        '5', layerHandle,
        '330', layerTableHandle,
        '100', 'AcDbSymbolTableRecord',
        '100', 'AcDbLayerTableRecord',
        '2', 'MALZEME',
        '70', '0',
        '62', '4',
        '6', 'Continuous',
        '290', '1',
        '370', '-3',
        '390', '0',
      );
    }

    // ── Çıktı buffer'ı oluştur ──
    // Orijinal satırları yeniden birleştir, araya layer ve text ekle
    const outParts = [];
    const pushLine = (str) => outParts.push(Buffer.from(str + NL, 'latin1'));

    for (let i = 0; i < lines.length; i++) {
      // Layer ENDTAB'dan önce layer ekle
      if (i === layerEndtabLine && layerLines.length > 0) {
        for (const ll of layerLines) pushLine(ll);
      }
      // ENTITIES ENDSEC'den önce text buffer ekle
      if (i === entitiesEndsecLine && textBlokBuf.length > 0) {
        outParts.push(textBlokBuf);
      }
      // Orijinal satır
      if (i < lines.length - 1 || lines[i].trim() !== '') {
        outParts.push(Buffer.from(lines[i], 'latin1'));
        if (i < lines.length - 1) outParts.push(Buffer.from(NL, 'latin1'));
      }
    }
    const outBuf = Buffer.concat(outParts);

    // ── Dosya kaydet ──
    const proje = db.prepare('SELECT proje_no, proje_tipi FROM projeler WHERE id = ?').get(proje_id);
    const yil = new Date().getFullYear();
    const projeKlasor = proje ? `${yil}/${proje.proje_no}` : `${yil}/genel`;
    const yeniAdi = `${proje?.proje_no || 'proje'}_Metraj.dxf`;
    const goreceliYol = `projeler/${projeKlasor}/metraj/${yeniAdi}`;
    const yeniTamYol = dosyaService.dosyaYoluCozumle(goreceliYol);

    db.prepare(`UPDATE dosyalar SET durum = 'silindi' WHERE proje_adim_id = ? AND orijinal_adi = 'Metraj.dxf' AND durum = 'aktif'`).run(metrajAdim.id);

    fs.mkdirSync(path.dirname(yeniTamYol), { recursive: true });
    fs.writeFileSync(yeniTamYol, outBuf);

    const result = db.prepare(`
      INSERT INTO dosyalar (dosya_adi, orijinal_adi, dosya_yolu, dosya_boyutu, mime_tipi, kategori,
        alan, alt_alan, proje_id, proje_adim_id, durum, olusturma_tarihi)
      VALUES (?, ?, ?, ?, 'application/dxf', 'cizim', 'proje', ?, ?, ?, 'aktif', datetime('now'))
    `).run(yeniAdi, 'Metraj.dxf', goreceliYol, outBuf.length,
      proje ? `${proje.proje_tipi}/${proje.proje_no}/metraj` : 'metraj', proje_id, metrajAdim.id);

    res.json({ success: true, data: { dosya_id: result.lastInsertRowid, adim_id: metrajAdim.id, dosya_adi: 'Metraj.dxf' } });
  } catch (err) {
    console.error('DXF metraj kaydet hatası:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /:id/dxf-sprite-kaydet — DXF dosyasına TEXT entity ekle (orijinal dosyanın üzerine yazar)
router.post('/:id/dxf-sprite-kaydet', (req, res) => {
  try {
    const fs = require('fs');
    const dosya = dosyaService.dosyaGetir(parseInt(req.params.id));
    if (!dosya) return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });

    const { notlar } = req.body;
    if (!notlar?.length) return res.status(400).json({ success: false, error: 'notlar gerekli' });

    const tamYol = dosyaService.dosyaYoluCozumle(dosya.dosya_yolu);
    const raw = fs.readFileSync(tamYol);
    const NL = raw.includes(Buffer.from('\r\n')) ? '\r\n' : '\n';
    const isAnsi = raw.toString('ascii', 0, Math.min(raw.length, 2000)).includes('ANSI_1254');

    const WIN1254 = {'\u011E':0xD0,'\u011F':0xF0,'\u0130':0xDD,'\u0131':0xFD,'\u015E':0xDE,'\u015F':0xFE,'\u00C7':0xC7,'\u00E7':0xE7,'\u00D6':0xD6,'\u00F6':0xF6,'\u00DC':0xDC,'\u00FC':0xFC};
    const encodeStr = (str) => {
      if (!isAnsi) return Buffer.from(str, 'utf-8');
      const out = [];
      for (const ch of str) { const m = WIN1254[ch]; if (m !== undefined) out.push(m); else { const c = ch.charCodeAt(0); out.push(c <= 0xFF ? c : 0x3F); } }
      return Buffer.from(out);
    };

    const lines = raw.toString('latin1').split(/\r?\n/);

    // Önce eski METRAJ_SPRITE TEXT entity'lerini kaldır
    const cleanLines = [];
    let skipEntity = false;
    for (let i = 0; i < lines.length; i += 2) {
      if (i + 1 >= lines.length) { cleanLines.push(lines[i]); break; }
      const code = lines[i].trim(), val = lines[i + 1].trim();
      if (code === '0') {
        if (skipEntity) skipEntity = false; // önceki entity bitti
        if (val === 'TEXT') {
          // İleriye bak — METRAJ_SPRITE layer'ında mı?
          for (let j = i + 2; j < Math.min(i + 40, lines.length - 1); j += 2) {
            if (lines[j].trim() === '0') break;
            if (lines[j].trim() === '8' && lines[j + 1]?.trim() === 'METRAJ_SPRITE') { skipEntity = true; break; }
          }
        }
      }
      if (!skipEntity) { cleanLines.push(lines[i], lines[i + 1]); }
    }
    const cleanContent = cleanLines.join(NL);

    // Temizlenmiş dosyada ENDSEC byte pozisyonu bul
    let inEntities = false, endsecBytePos = -1, byteOffset = 0;
    const cLines = cleanContent.split(/\r?\n/);
    for (let i = 0; i < cLines.length - 1; i++) {
      const lineLen = Buffer.byteLength(cLines[i], 'latin1') + NL.length;
      if (i % 2 === 0) {
        const code = cLines[i].trim(), val = (i + 1 < cLines.length) ? cLines[i + 1].trim() : '';
        if (code === '2' && val === 'ENTITIES') inEntities = true;
        if (inEntities && code === '0' && val === 'ENDSEC') { endsecBytePos = byteOffset; break; }
      }
      byteOffset += lineLen;
    }
    if (endsecBytePos < 0) return res.status(400).json({ success: false, error: 'DXF ENTITIES ENDSEC bulunamadı' });

    // Handle seed
    // Temizlenmiş satırlardan handle seed ve owner handle al
    let handleSeed = 0x900;
    for (let i = 0; i < cLines.length - 1; i += 2) {
      if (cLines[i].trim() === '5' || cLines[i].trim() === '$HANDSEED') {
        const val = parseInt(cLines[i + 1]?.trim(), 16);
        if (val > handleSeed) handleSeed = val;
      }
    }
    handleSeed += 10;

    let ownerHandle = '1B';
    for (let i = 0; i < cLines.length - 3; i += 2) {
      if (cLines[i].trim() === '2' && cLines[i + 1]?.trim() === '*Model_Space') {
        for (let j = i - 2; j >= Math.max(0, i - 10); j -= 2) {
          if (cLines[j].trim() === '5') { ownerHandle = cLines[j + 1].trim(); break; }
        }
        break;
      }
    }

    // TEXT entity'leri oluştur
    const textBufParts = [];
    const nl = Buffer.from(NL, 'latin1');
    const addLine = (str) => { textBufParts.push(Buffer.from(str, 'latin1'), nl); };

    for (const not of notlar) {
      const { x, y, yukseklik, satirlar } = not;
      if (!satirlar?.length || x == null || y == null) continue;
      const h = yukseklik || 3.5;
      satirlar.forEach((satir, i) => {
        const handle = (handleSeed++).toString(16).toUpperCase();
        // Satır pozisyonu — sol-alt referans, sprite ile uyumlu
        const py = (y - i * h * 1.3).toFixed(6);
        const xStr = x.toFixed(6);
        addLine('0'); addLine('TEXT');
        addLine('5'); addLine(handle);
        addLine('330'); addLine(ownerHandle);
        addLine('100'); addLine('AcDbEntity');
        addLine('67'); addLine('0');
        addLine('8'); addLine('METRAJ_SPRITE');
        addLine('62'); addLine('3'); // yeşil
        addLine('6'); addLine('ByLayer');
        addLine('370'); addLine('-1');
        addLine('48'); addLine('1.0');
        addLine('60'); addLine('0');
        addLine('100'); addLine('AcDbText');
        addLine('10'); addLine(xStr);
        addLine('20'); addLine(py);
        addLine('30'); addLine('0.0');
        addLine('40'); addLine(h.toFixed(6));
        addLine('1'); textBufParts.push(encodeStr(satir), nl);
        addLine('7'); addLine('Standard');
        addLine('72'); addLine('0');
        addLine('100'); addLine('AcDbText');
        addLine('73'); addLine('0');
      });
    }
    const textBlokBuf = Buffer.concat(textBufParts);

    // Orijinal dosyayı byte pozisyonunda böl ve TEXT blok ekle
    const cleanBuf = Buffer.from(cleanContent, 'latin1');
    const beforeEndsec = cleanBuf.subarray(0, endsecBytePos);
    const afterEndsec = cleanBuf.subarray(endsecBytePos);
    const outBuf = Buffer.concat([beforeEndsec, textBlokBuf, afterEndsec]);

    // Orijinal dosyanın üzerine yaz
    fs.writeFileSync(tamYol, outBuf);

    // Dosya boyutunu güncelle
    const db = getDb();
    db.prepare('UPDATE dosyalar SET dosya_boyutu = ?, guncelleme_tarihi = datetime(\'now\') WHERE id = ?')
      .run(outBuf.length, parseInt(req.params.id));

    res.json({ success: true, data: { dosya_id: parseInt(req.params.id), eklenen_text: notlar.length } });
  } catch (err) {
    console.error('DXF sprite kaydet hatası:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// DEMONTAJ KROKİSİ — Mevcut/Yeni Durum DXF overlay & fark analizi
// ═══════════════════════════════════════════════════════════════

// GET /api/dosya/proje/:projeId/dxf-listesi — Projedeki tüm DXF dosyalarını listele
router.get('/proje/:projeId/dxf-listesi', (req, res) => {
  try {
    const db = getDb();
    const dosyalar = db.prepare(`
      SELECT d.id, d.dosya_adi, d.orijinal_adi, pa.adim_adi, pa.adim_kodu, pa.faz_adi, pa.faz_kodu
      FROM dosyalar d
      JOIN proje_adimlari pa ON d.proje_adim_id = pa.id
      WHERE pa.proje_id = ? AND d.durum = 'aktif' AND LOWER(d.dosya_adi) LIKE '%.dxf'
      ORDER BY pa.sira_global, d.olusturma_tarihi DESC
    `).all(parseInt(req.params.projeId));
    res.json({ success: true, data: dosyalar });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/dosya/proje/:projeId/hak-edis-krokisi-olustur — Yeni durum DXF'ini hak_edis_krokisi adımına kopyala
router.post('/proje/:projeId/hak-edis-krokisi-olustur', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const db = getDb();
    const projeId = parseInt(req.params.projeId);

    // hak_edis_krokisi adımını bul
    const hedefAdim = db.prepare(
      "SELECT id, adim_adi FROM proje_adimlari WHERE proje_id = ? AND adim_kodu = 'hak_edis_krokisi' LIMIT 1"
    ).get(projeId);
    if (!hedefAdim) return res.status(404).json({ success: false, error: 'Hak Ediş Krokisi adımı bulunamadı' });

    // Zaten DXF var mı?
    const mevcutDxf = db.prepare(
      "SELECT id FROM dosyalar WHERE proje_adim_id = ? AND durum = 'aktif' AND LOWER(dosya_adi) LIKE '%.dxf' LIMIT 1"
    ).get(hedefAdim.id);
    if (mevcutDxf) {
      // Varsa direkt döndür (güncelleme modu)
      return res.json({ success: true, data: { dosya_id: mevcutDxf.id, adim_id: hedefAdim.id, yeni: false } });
    }

    // yeni_durum_proje DXF'ini bul
    const kaynakDosya = db.prepare(`
      SELECT d.id, d.dosya_adi, d.dosya_yolu, d.dosya_boyutu, d.orijinal_adi
      FROM dosyalar d
      JOIN proje_adimlari pa ON d.proje_adim_id = pa.id
      WHERE pa.proje_id = ? AND pa.adim_kodu = 'yeni_durum_proje'
        AND d.durum = 'aktif' AND LOWER(d.dosya_adi) LIKE '%.dxf'
      ORDER BY d.olusturma_tarihi DESC LIMIT 1
    `).get(projeId);
    if (!kaynakDosya) return res.status(404).json({ success: false, error: 'Yeni Durum DXF dosyası bulunamadı' });

    // Proje bilgisi
    const proje = db.prepare('SELECT proje_no, proje_tipi FROM projeler WHERE id = ?').get(projeId);
    const projeKlasor = proje ? `${proje.proje_tipi}/${proje.proje_no}` : `proje_${projeId}`;

    // Dosyayı kopyala
    const kaynakYol = dosyaService.dosyaYoluCozumle(kaynakDosya.dosya_yolu);
    const yeniAdi = `${proje?.proje_no || 'proje'}_Hak-Edis-Krokisi.dxf`;
    const goreceliYol = `projeler/${projeKlasor}/hak_edis_krokisi/${yeniAdi}`;
    const hedefYol = dosyaService.dosyaYoluCozumle(goreceliYol);

    fs.mkdirSync(path.dirname(hedefYol), { recursive: true });
    fs.copyFileSync(kaynakYol, hedefYol);

    // DB kaydı
    const result = db.prepare(`
      INSERT INTO dosyalar (dosya_adi, orijinal_adi, dosya_yolu, dosya_boyutu, mime_tipi, kategori,
        alan, alt_alan, proje_id, proje_adim_id, durum, olusturma_tarihi)
      VALUES (?, ?, ?, ?, 'application/dxf', 'cizim', 'proje', ?, ?, ?, 'aktif', datetime('now'))
    `).run(yeniAdi, yeniAdi, goreceliYol, kaynakDosya.dosya_boyutu || 0,
      `${proje?.proje_tipi || ''}/${proje?.proje_no || ''}/hak_edis_krokisi`, projeId, hedefAdim.id);

    res.json({ success: true, data: { dosya_id: result.lastInsertRowid, adim_id: hedefAdim.id, yeni: true } });
  } catch (err) {
    console.error('Hak Ediş Krokisi oluşturma hatası:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/dosya/proje/:projeId/demontaj-kroki — Her iki DXF dosya bilgisini getir
router.get('/proje/:projeId/demontaj-kroki', (req, res) => {
  try {
    const db = getDb();
    const projeId = parseInt(req.params.projeId);

    const adimlar = db.prepare(`
      SELECT pa.id AS adim_id, pa.adim_kodu,
        (SELECT d.id FROM dosyalar d WHERE d.proje_adim_id = pa.id AND d.durum = 'aktif'
         AND LOWER(d.dosya_adi) LIKE '%.dxf' ORDER BY d.olusturma_tarihi DESC LIMIT 1) AS dosya_id,
        (SELECT d.dosya_adi FROM dosyalar d WHERE d.proje_adim_id = pa.id AND d.durum = 'aktif'
         AND LOWER(d.dosya_adi) LIKE '%.dxf' ORDER BY d.olusturma_tarihi DESC LIMIT 1) AS dosya_adi
      FROM proje_adimlari pa
      WHERE pa.proje_id = ? AND pa.adim_kodu IN ('mevcut_durum_proje', 'yeni_durum_proje')
    `).all(projeId);

    const mevcut = adimlar.find(a => a.adim_kodu === 'mevcut_durum_proje');
    const yeni = adimlar.find(a => a.adim_kodu === 'yeni_durum_proje');

    res.json({
      success: true,
      data: {
        mevcutDurum: mevcut?.dosya_id ? { id: mevcut.dosya_id, dosya_adi: mevcut.dosya_adi, adim_id: mevcut.adim_id } : null,
        yeniDurum: yeni?.dosya_id ? { id: yeni.dosya_id, dosya_adi: yeni.dosya_adi, adim_id: yeni.adim_id } : null,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DXF entity ayrıştırma yardımcıları ──

function _parseDxfEntities(content) {
  const SUPPORTED = ['LINE', 'CIRCLE', 'ARC', 'LWPOLYLINE', 'POLYLINE', 'INSERT', 'TEXT', 'MTEXT', 'POINT'];
  const lines = content.split(/\r?\n/);
  const entities = [];
  let inEntities = false;
  let cur = null, curType = null, vertices = [];

  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = parseInt(lines[i].trim());
    const val = lines[i + 1]?.trim();
    if (code === 2 && val === 'ENTITIES') { inEntities = true; continue; }
    if (code === 0 && val === 'ENDSEC' && inEntities) break;
    if (!inEntities) continue;

    if (code === 0) {
      if (cur && curType) {
        if ((curType === 'LWPOLYLINE' || curType === 'POLYLINE') && vertices.length > 0) cur.vertices = vertices;
        entities.push(cur);
      }
      curType = val; vertices = [];
      cur = SUPPORTED.includes(val) ? { type: val } : null;
      continue;
    }
    if (!cur) continue;

    switch (curType) {
      case 'LINE':
        if (code === 10) cur.x1 = parseFloat(val);
        if (code === 20) cur.y1 = parseFloat(val);
        if (code === 11) cur.x2 = parseFloat(val);
        if (code === 21) cur.y2 = parseFloat(val);
        if (code === 8) cur.layer = val;
        break;
      case 'CIRCLE':
      case 'ARC':
        if (code === 10) cur.cx = parseFloat(val);
        if (code === 20) cur.cy = parseFloat(val);
        if (code === 40) cur.r = parseFloat(val);
        if (code === 50) cur.startAngle = parseFloat(val);
        if (code === 51) cur.endAngle = parseFloat(val);
        if (code === 8) cur.layer = val;
        break;
      case 'LWPOLYLINE':
      case 'POLYLINE':
        if (code === 10) vertices.push({ x: parseFloat(val) });
        if (code === 20 && vertices.length > 0) vertices[vertices.length - 1].y = parseFloat(val);
        if (code === 8) cur.layer = val;
        break;
      case 'INSERT':
        if (code === 2) cur.block = val;      // Blok adı
        if (code === 10) cur.x = parseFloat(val);
        if (code === 20) cur.y = parseFloat(val);
        if (code === 41) cur.scaleX = parseFloat(val);
        if (code === 42) cur.scaleY = parseFloat(val);
        if (code === 50) cur.rotation = parseFloat(val);
        if (code === 8) cur.layer = val;
        break;
      case 'TEXT':
      case 'MTEXT':
        if (code === 1) cur.text = val;
        if (code === 7) cur.style = val;      // Stil adı (ör. "Direk")
        if (code === 10) cur.x = parseFloat(val);
        if (code === 20) cur.y = parseFloat(val);
        if (code === 40) cur.height = parseFloat(val);
        if (code === 8) cur.layer = val;
        break;
      case 'POINT':
        if (code === 10) cur.x = parseFloat(val);
        if (code === 20) cur.y = parseFloat(val);
        if (code === 8) cur.layer = val;
        break;
    }
  }
  if (cur && curType) {
    if ((curType === 'LWPOLYLINE' || curType === 'POLYLINE') && vertices.length > 0) cur.vertices = vertices;
    entities.push(cur);
  }
  return entities;
}

function _entityFingerprint(e) {
  const r = (n) => Math.round((n || 0) * 2) / 2;
  switch (e.type) {
    case 'LINE': return `L:${r(e.x1)},${r(e.y1)}-${r(e.x2)},${r(e.y2)}`;
    case 'CIRCLE': return `C:${r(e.cx)},${r(e.cy)},${r(e.r)}`;
    case 'ARC': return `A:${r(e.cx)},${r(e.cy)},${r(e.r)},${Math.round(e.startAngle || 0)},${Math.round(e.endAngle || 0)}`;
    case 'LWPOLYLINE':
    case 'POLYLINE': return `P:${(e.vertices || []).map(v => `${r(v.x)},${r(v.y)}`).join(';')}`;
    case 'INSERT': return `I:${e.block || ''},${r(e.x)},${r(e.y)}`;
    case 'TEXT':
    case 'MTEXT': return `T:${e.style || ''},${e.text || ''},${r(e.x)},${r(e.y)}`;
    case 'POINT': return `D:${r(e.x)},${r(e.y)}`;
    default: return null;
  }
}

// GET /api/dosya/:id/dxf-entity-list — Tek DXF dosyasındaki tüm geometrik entity'leri döndür
router.get('/:id/dxf-entity-list', (req, res) => {
  try {
    const fs = require('fs');
    const dosya = dosyaService.dosyaGetir(parseInt(req.params.id));
    if (!dosya) return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });
    const tamYol = dosyaService.dosyaYoluCozumle(dosya.dosya_yolu);
    const icerik = fs.readFileSync(tamYol, 'latin1');
    const entities = _parseDxfEntities(icerik);
    res.json({ success: true, data: { entities, toplam: entities.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/dosya/dxf-fark — İki DXF arasındaki çakışmayan entity'leri bul
router.post('/dxf-fark', (req, res) => {
  try {
    const fs = require('fs');
    const { mevcut_dosya_id, yeni_dosya_id } = req.body;
    if (!mevcut_dosya_id || !yeni_dosya_id) return res.status(400).json({ success: false, error: 'Her iki dosya ID gerekli' });

    const mevcutDosya = dosyaService.dosyaGetir(parseInt(mevcut_dosya_id));
    const yeniDosya = dosyaService.dosyaGetir(parseInt(yeni_dosya_id));
    if (!mevcutDosya || !yeniDosya) return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });

    const mevcutIcerik = fs.readFileSync(dosyaService.dosyaYoluCozumle(mevcutDosya.dosya_yolu), 'latin1');
    const yeniIcerik = fs.readFileSync(dosyaService.dosyaYoluCozumle(yeniDosya.dosya_yolu), 'latin1');

    const mevcutEntities = _parseDxfEntities(mevcutIcerik);
    const yeniEntities = _parseDxfEntities(yeniIcerik);

    // Fingerprint bazlı set karşılaştırması
    const yeniFpSet = new Set(yeniEntities.map(e => _entityFingerprint(e)).filter(Boolean));
    const mevcutFpSet = new Set(mevcutEntities.map(e => _entityFingerprint(e)).filter(Boolean));

    const sadeceMevcut = mevcutEntities.filter(e => {
      const fp = _entityFingerprint(e);
      return fp && !yeniFpSet.has(fp);
    });
    const sadeceYeni = yeniEntities.filter(e => {
      const fp = _entityFingerprint(e);
      return fp && !mevcutFpSet.has(fp);
    });

    res.json({
      success: true,
      data: {
        sadeceMevcut,
        sadeceYeni,
        mevcutToplam: mevcutEntities.length,
        yeniToplam: yeniEntities.length,
        ortakTahmini: mevcutEntities.length - sadeceMevcut.length,
      }
    });
  } catch (err) {
    console.error('DXF fark analizi hatası:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
