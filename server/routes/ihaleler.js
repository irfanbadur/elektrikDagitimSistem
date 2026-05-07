// İhaleler — çoklu ihale yönetimi + ilerleme/dağılım raporları
const router = require('express').Router();
const { getDb } = require('../db/database');
const { basarili, hata } = require('../utils/helpers');

// İhale listesi seçim sorgusu — KPI'ları join'le hesaplar
const IHALE_SELECT = `
  SELECT
    i.*,
    (SELECT GROUP_CONCAT(it.kod, ',')
       FROM ihale_is_tipleri iit JOIN is_tipleri it ON it.id = iit.is_tipi_id
      WHERE iit.ihale_id = i.id) AS is_tipi_kodlari,
    (SELECT COUNT(*) FROM projeler p WHERE p.ihale_id = i.id) AS proje_sayisi,
    (SELECT COALESCE(SUM(CAST(p.kesif_tutari AS REAL)), 0)
       FROM projeler p WHERE p.ihale_id = i.id) AS toplam_kesif,
    (SELECT COALESCE(SUM(CAST(p.ilerleme_miktari AS REAL)), 0)
       FROM projeler p WHERE p.ihale_id = i.id) AS toplam_ilerleme,
    (SELECT COALESCE(SUM(CAST(p.sozlesme_kesfi AS REAL)), 0)
       FROM projeler p WHERE p.ihale_id = i.id) AS toplam_sozlesme
  FROM ihaleler i
`;

// Yardımcı: yüzdeler ve kalan
function kpiZenginlestir(ihale) {
  const tutar = Number(ihale.sozlesme_bedeli) || 0;
  const kesif = Number(ihale.toplam_kesif) || 0;
  const ilerleme = Number(ihale.toplam_ilerleme) || 0;
  return {
    ...ihale,
    is_tipi_kodlari: (ihale.is_tipi_kodlari || '').split(',').filter(Boolean),
    kesif_yuzdesi: tutar > 0 ? (kesif / tutar) * 100 : 0,
    ilerleme_yuzdesi: tutar > 0 ? (ilerleme / tutar) * 100 : 0,
    kalan_tutar: Math.max(0, tutar - ilerleme),
  };
}

// GET /api/ihaleler — KPI'lı liste
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const ihaleler = db.prepare(IHALE_SELECT + " ORDER BY i.durum = 'aktif' DESC, i.id DESC").all();
    basarili(res, ihaleler.map(kpiZenginlestir));
  } catch (err) { hata(res, err.message, 500); }
});

// GET /api/ihaleler/:id — Detay
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const ihale = db.prepare(IHALE_SELECT + ' WHERE i.id = ?').get(id);
    if (!ihale) return hata(res, 'İhale bulunamadı', 404);
    const isTipiIdleri = db.prepare(`
      SELECT it.id, it.kod, it.ad
      FROM ihale_is_tipleri iit JOIN is_tipleri it ON it.id = iit.is_tipi_id
      WHERE iit.ihale_id = ?
    `).all(id);
    basarili(res, { ...kpiZenginlestir(ihale), is_tipleri: isTipiIdleri });
  } catch (err) { hata(res, err.message, 500); }
});

// GET /api/ihaleler/:id/projeler — Bağlı projeler
router.get('/:id/projeler', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const projeler = db.prepare(`
      SELECT p.*, b.bolge_adi, e.ekip_adi
      FROM projeler p
      LEFT JOIN bolgeler b ON b.id = p.bolge_id
      LEFT JOIN ekipler e ON e.id = p.ekip_id
      WHERE p.ihale_id = ?
      ORDER BY p.excel_sira IS NULL, p.excel_sira ASC, p.olusturma_tarihi DESC
    `).all(id);
    basarili(res, projeler);
  } catch (err) { hata(res, err.message, 500); }
});

// GET /api/ihaleler/:id/bolge-dagilimi — Bölge bazlı ilerleme
router.get('/:id/bolge-dagilimi', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const liste = db.prepare(`
      SELECT
        COALESCE(b.bolge_adi, 'Bölgesiz') AS bolge_adi,
        COUNT(p.id) AS proje_sayisi,
        COALESCE(SUM(CAST(p.kesif_tutari AS REAL)), 0) AS toplam_kesif,
        COALESCE(SUM(CAST(p.ilerleme_miktari AS REAL)), 0) AS toplam_ilerleme,
        COALESCE(SUM(CAST(p.sozlesme_kesfi AS REAL)), 0) AS toplam_sozlesme
      FROM projeler p
      LEFT JOIN bolgeler b ON b.id = p.bolge_id
      WHERE p.ihale_id = ?
      GROUP BY p.bolge_id
      ORDER BY toplam_kesif DESC
    `).all(id);
    basarili(res, liste);
  } catch (err) { hata(res, err.message, 500); }
});

// GET /api/ihaleler/:id/ekip-dagilimi
router.get('/:id/ekip-dagilimi', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const liste = db.prepare(`
      SELECT
        COALESCE(e.ekip_adi, 'Atanmamış') AS ekip_adi,
        COUNT(p.id) AS proje_sayisi,
        COUNT(CASE WHEN p.saha_asama IS NOT NULL AND p.saha_asama != 'tamamlandi' THEN 1 END) AS aktif_proje,
        COALESCE(SUM(CAST(p.ilerleme_miktari AS REAL)), 0) AS toplam_ilerleme,
        COALESCE(SUM(CAST(p.kesif_tutari AS REAL)), 0) AS toplam_kesif
      FROM projeler p
      LEFT JOIN ekipler e ON e.id = p.ekip_id
      WHERE p.ihale_id = ?
      GROUP BY p.ekip_id
      ORDER BY proje_sayisi DESC
    `).all(id);
    basarili(res, liste);
  } catch (err) { hata(res, err.message, 500); }
});

// GET /api/ihaleler/:id/asama-dagilimi — proje + saha aşamaları
router.get('/:id/asama-dagilimi', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const proje = db.prepare(`
      SELECT COALESCE(proje_asama, '(boş)') AS asama, COUNT(*) AS sayi
      FROM projeler WHERE ihale_id = ? GROUP BY proje_asama
    `).all(id);
    const saha = db.prepare(`
      SELECT COALESCE(saha_asama, '(boş)') AS asama, COUNT(*) AS sayi
      FROM projeler WHERE ihale_id = ? GROUP BY saha_asama
    `).all(id);
    basarili(res, { proje, saha });
  } catch (err) { hata(res, err.message, 500); }
});

// POST /api/ihaleler — Yeni ihale
// Body: { ihale_adi, is_adi, sozlesme_no, il, ilce, yuklenici, sozlesme_bedeli,
//         artirim_orani, baslangic_tarihi, bitis_tarihi, durum, notlar,
//         is_tipi_idleri: [...], otomatik_proje_bagla: true/false }
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const {
      ihale_adi, is_adi, sozlesme_no, il, ilce, yuklenici,
      sozlesme_bedeli, artirim_orani, baslangic_tarihi, bitis_tarihi,
      durum, notlar, is_tipi_idleri, otomatik_proje_bagla,
    } = req.body;
    if (!ihale_adi) return hata(res, 'İhale adı zorunlu', 400);

    const tx = db.transaction(() => {
      const r = db.prepare(`
        INSERT INTO ihaleler (
          ihale_adi, is_adi, sozlesme_no, il, ilce, yuklenici,
          sozlesme_bedeli, artirim_orani, baslangic_tarihi, bitis_tarihi,
          durum, notlar
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ihale_adi, is_adi || null, sozlesme_no || null, il || null, ilce || null, yuklenici || null,
        Number(sozlesme_bedeli) || 0, Number(artirim_orani) || 10,
        baslangic_tarihi || null, bitis_tarihi || null,
        durum || 'aktif', notlar || null
      );
      const ihaleId = r.lastInsertRowid;
      // İş tipi bağlantıları
      if (Array.isArray(is_tipi_idleri) && is_tipi_idleri.length) {
        const baglaStmt = db.prepare('INSERT OR IGNORE INTO ihale_is_tipleri (ihale_id, is_tipi_id) VALUES (?, ?)');
        for (const tid of is_tipi_idleri) {
          if (tid) baglaStmt.run(ihaleId, parseInt(tid));
        }
      }
      // Otomatik proje bağlama
      if (otomatik_proje_bagla && Array.isArray(is_tipi_idleri) && is_tipi_idleri.length) {
        const kodlar = db.prepare(
          `SELECT kod FROM is_tipleri WHERE id IN (${is_tipi_idleri.map(() => '?').join(',')})`
        ).all(...is_tipi_idleri).map(x => x.kod);
        if (kodlar.length) {
          const placeholder = kodlar.map(() => '?').join(',');
          db.prepare(
            `UPDATE projeler SET ihale_id = ? WHERE ihale_id IS NULL AND proje_tipi IN (${placeholder})`
          ).run(ihaleId, ...kodlar);
        }
      }
      return ihaleId;
    });
    const ihaleId = tx();
    const yeni = db.prepare(IHALE_SELECT + ' WHERE i.id = ?').get(ihaleId);
    basarili(res, kpiZenginlestir(yeni), 201);
  } catch (err) { hata(res, err.message, 500); }
});

// PUT /api/ihaleler/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const mevcut = db.prepare('SELECT id FROM ihaleler WHERE id = ?').get(id);
    if (!mevcut) return hata(res, 'İhale bulunamadı', 404);
    const {
      ihale_adi, is_adi, sozlesme_no, il, ilce, yuklenici,
      sozlesme_bedeli, artirim_orani, baslangic_tarihi, bitis_tarihi,
      durum, notlar, is_tipi_idleri,
    } = req.body;

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE ihaleler SET
          ihale_adi = COALESCE(?, ihale_adi),
          is_adi = ?,
          sozlesme_no = ?,
          il = ?,
          ilce = ?,
          yuklenici = ?,
          sozlesme_bedeli = COALESCE(?, sozlesme_bedeli),
          artirim_orani = COALESCE(?, artirim_orani),
          baslangic_tarihi = ?,
          bitis_tarihi = ?,
          durum = COALESCE(?, durum),
          notlar = ?,
          guncelleme_tarihi = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        ihale_adi || null, is_adi || null, sozlesme_no || null, il || null, ilce || null, yuklenici || null,
        sozlesme_bedeli != null ? Number(sozlesme_bedeli) : null,
        artirim_orani != null ? Number(artirim_orani) : null,
        baslangic_tarihi || null, bitis_tarihi || null,
        durum || null, notlar || null, id
      );
      if (Array.isArray(is_tipi_idleri)) {
        db.prepare('DELETE FROM ihale_is_tipleri WHERE ihale_id = ?').run(id);
        const baglaStmt = db.prepare('INSERT OR IGNORE INTO ihale_is_tipleri (ihale_id, is_tipi_id) VALUES (?, ?)');
        for (const tid of is_tipi_idleri) {
          if (tid) baglaStmt.run(id, parseInt(tid));
        }
      }
    });
    tx();
    const yeni = db.prepare(IHALE_SELECT + ' WHERE i.id = ?').get(id);
    basarili(res, kpiZenginlestir(yeni));
  } catch (err) { hata(res, err.message, 500); }
});

// DELETE /api/ihaleler/:id (projeler.ihale_id NULL'a düşer)
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    db.prepare('UPDATE projeler SET ihale_id = NULL WHERE ihale_id = ?').run(id);
    db.prepare('DELETE FROM ihaleler WHERE id = ?').run(id);
    basarili(res, { silindi: true });
  } catch (err) { hata(res, err.message, 500); }
});

// POST /api/ihaleler/:id/projeleri-bagla — toplu proje atama
// Body: { proje_idleri: [...] } veya { is_tipi_kodlari: ['YB','KET'], yalniz_bagsizlar: true }
router.post('/:id/projeleri-bagla', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const { proje_idleri, is_tipi_kodlari, yalniz_bagsizlar } = req.body;
    let etkilenen = 0;
    if (Array.isArray(proje_idleri) && proje_idleri.length) {
      const placeholder = proje_idleri.map(() => '?').join(',');
      const r = db.prepare(`UPDATE projeler SET ihale_id = ? WHERE id IN (${placeholder})`)
        .run(id, ...proje_idleri);
      etkilenen += r.changes;
    }
    if (Array.isArray(is_tipi_kodlari) && is_tipi_kodlari.length) {
      const placeholder = is_tipi_kodlari.map(() => '?').join(',');
      const sart = yalniz_bagsizlar ? 'AND ihale_id IS NULL' : '';
      const r = db.prepare(
        `UPDATE projeler SET ihale_id = ? WHERE proje_tipi IN (${placeholder}) ${sart}`
      ).run(id, ...is_tipi_kodlari);
      etkilenen += r.changes;
    }
    basarili(res, { etkilenen });
  } catch (err) { hata(res, err.message, 500); }
});

// POST /api/ihaleler/:id/projeyi-cikar — tek proje çıkar (ihale_id = NULL)
router.post('/:id/projeyi-cikar', (req, res) => {
  try {
    const db = getDb();
    const { proje_id } = req.body;
    if (!proje_id) return hata(res, 'proje_id gerekli', 400);
    db.prepare('UPDATE projeler SET ihale_id = NULL WHERE id = ?').run(parseInt(proje_id));
    basarili(res, { cikarildi: true });
  } catch (err) { hata(res, err.message, 500); }
});

module.exports = router;
