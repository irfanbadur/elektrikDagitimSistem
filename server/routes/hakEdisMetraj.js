const router = require('express').Router();
const { getDb } = require('../db/database');
const { basarili, hata } = require('../utils/helpers');

// GET /:projeId — Şebeke metraj listesi
router.get('/:projeId', (req, res) => {
  try {
    const db = getDb();
    const satirlar = db.prepare(
      'SELECT * FROM hak_edis_metraj WHERE proje_id = ? ORDER BY sira, id'
    ).all(parseInt(req.params.projeId));
    basarili(res, satirlar);
  } catch (err) { hata(res, err.message, 500); }
});

// GET /:projeId/ozet — Özet bilgileri
router.get('/:projeId/ozet', (req, res) => {
  try {
    const db = getDb();
    const ozet = db.prepare(`
      SELECT
        COUNT(*) as toplam_satir,
        SUM(ara_mesafe) as toplam_mesafe,
        COUNT(CASE WHEN nokta_durum = 'Yeni' THEN 1 END) as yeni_nokta,
        COUNT(CASE WHEN nokta_durum = 'Mevcut' THEN 1 END) as mevcut_nokta,
        COUNT(CASE WHEN nokta_durum = 'Demontaj' THEN 1 END) as demontaj_nokta
      FROM hak_edis_metraj WHERE proje_id = ?
    `).get(parseInt(req.params.projeId));
    basarili(res, ozet);
  } catch (err) { hata(res, err.message, 500); }
});

// POST /:projeId — Yeni satır ekle
router.post('/:projeId', (req, res) => {
  try {
    const db = getDb();
    const projeId = parseInt(req.params.projeId);
    const {
      nokta1, nokta2, nokta_durum,
      direk_tur, direk_tip, traversler,
      ara_mesafe, ag_iletken_durum, og_iletken_durum,
      ag_iletken, og_iletken,
      yeni_iletken, dmm_iletken,
      kaynak, kaynak_direk_x, kaynak_direk_y, notlar,
    } = req.body;

    // Sıra numarası
    const maxSira = db.prepare('SELECT COALESCE(MAX(sira), 0) as m FROM hak_edis_metraj WHERE proje_id = ?').get(projeId);

    const result = db.prepare(`
      INSERT INTO hak_edis_metraj (
        proje_id, sira, nokta1, nokta2, nokta_durum,
        direk_tur, direk_tip, traversler,
        ara_mesafe, ag_iletken_durum, og_iletken_durum,
        ag_iletken, og_iletken,
        yeni_iletken, dmm_iletken,
        kaynak, kaynak_direk_x, kaynak_direk_y, notlar
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projeId, maxSira.m + 1,
      nokta1 || null, nokta2 || null, nokta_durum || null,
      direk_tur || null, direk_tip || null,
      traversler ? (typeof traversler === 'string' ? traversler : JSON.stringify(traversler)) : null,
      ara_mesafe || 0, ag_iletken_durum || null, og_iletken_durum || null,
      ag_iletken || null, og_iletken || null,
      yeni_iletken ? (typeof yeni_iletken === 'string' ? yeni_iletken : JSON.stringify(yeni_iletken)) : null,
      dmm_iletken ? (typeof dmm_iletken === 'string' ? dmm_iletken : JSON.stringify(dmm_iletken)) : null,
      kaynak || 'manuel', kaynak_direk_x || null, kaynak_direk_y || null, notlar || null
    );

    const yeni = db.prepare('SELECT * FROM hak_edis_metraj WHERE id = ?').get(result.lastInsertRowid);
    basarili(res, yeni);
  } catch (err) { hata(res, err.message, 500); }
});

// POST /:projeId/toplu — Toplu satır ekle (DXF'ten aktarım)
router.post('/:projeId/toplu', (req, res) => {
  try {
    const db = getDb();
    const projeId = parseInt(req.params.projeId);
    const { satirlar } = req.body;
    if (!satirlar?.length) return hata(res, 'Satır listesi boş', 400);

    let maxSira = db.prepare('SELECT COALESCE(MAX(sira), 0) as m FROM hak_edis_metraj WHERE proje_id = ?').get(projeId).m;

    const stmt = db.prepare(`
      INSERT INTO hak_edis_metraj (
        proje_id, sira, nokta1, nokta2, nokta_durum,
        direk_tur, direk_tip, traversler,
        ara_mesafe, ag_iletken_durum, og_iletken_durum,
        ag_iletken, og_iletken,
        yeni_iletken, dmm_iletken,
        kaynak, kaynak_direk_x, kaynak_direk_y, notlar
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const eklenen = [];
    const transaction = db.transaction(() => {
      for (const s of satirlar) {
        maxSira++;
        const r = stmt.run(
          projeId, maxSira,
          s.nokta1 || null, s.nokta2 || null, s.nokta_durum || null,
          s.direk_tur || null, s.direk_tip || null,
          s.traversler ? JSON.stringify(s.traversler) : null,
          s.ara_mesafe || 0, s.ag_iletken_durum || null, s.og_iletken_durum || null,
          s.ag_iletken || null, s.og_iletken || null,
          s.yeni_iletken ? JSON.stringify(s.yeni_iletken) : null,
          s.dmm_iletken ? JSON.stringify(s.dmm_iletken) : null,
          s.kaynak || 'kroki', s.kaynak_direk_x || null, s.kaynak_direk_y || null, s.notlar || null
        );
        eklenen.push(r.lastInsertRowid);
      }
    });
    transaction();

    basarili(res, { eklenen_sayi: eklenen.length, idler: eklenen });
  } catch (err) { hata(res, err.message, 500); }
});

// PUT /:projeId/:id — Satır güncelle
router.put('/:projeId/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const {
      nokta1, nokta2, nokta_durum,
      direk_tur, direk_tip, traversler,
      ara_mesafe, ag_iletken_durum, og_iletken_durum,
      ag_iletken, og_iletken,
      yeni_iletken, dmm_iletken, notlar,
    } = req.body;

    db.prepare(`
      UPDATE hak_edis_metraj SET
        nokta1 = ?, nokta2 = ?, nokta_durum = ?,
        direk_tur = ?, direk_tip = ?, traversler = ?,
        ara_mesafe = ?, ag_iletken_durum = ?, og_iletken_durum = ?,
        ag_iletken = ?, og_iletken = ?,
        yeni_iletken = ?, dmm_iletken = ?, notlar = ?,
        guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(
      nokta1 || null, nokta2 || null, nokta_durum || null,
      direk_tur || null, direk_tip || null,
      traversler ? (typeof traversler === 'string' ? traversler : JSON.stringify(traversler)) : null,
      ara_mesafe || 0, ag_iletken_durum || null, og_iletken_durum || null,
      ag_iletken || null, og_iletken || null,
      yeni_iletken ? (typeof yeni_iletken === 'string' ? yeni_iletken : JSON.stringify(yeni_iletken)) : null,
      dmm_iletken ? (typeof dmm_iletken === 'string' ? dmm_iletken : JSON.stringify(dmm_iletken)) : null,
      notlar || null, id
    );

    const guncellenmis = db.prepare('SELECT * FROM hak_edis_metraj WHERE id = ?').get(id);
    basarili(res, guncellenmis);
  } catch (err) { hata(res, err.message, 500); }
});

// DELETE /:projeId/:id — Satır sil
router.delete('/:projeId/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM hak_edis_metraj WHERE id = ? AND proje_id = ?')
      .run(parseInt(req.params.id), parseInt(req.params.projeId));
    basarili(res, { silindi: true });
  } catch (err) { hata(res, err.message, 500); }
});

// DELETE /:projeId — Tüm satırları sil
router.delete('/:projeId', (req, res) => {
  try {
    const db = getDb();
    const r = db.prepare('DELETE FROM hak_edis_metraj WHERE proje_id = ?')
      .run(parseInt(req.params.projeId));
    basarili(res, { silinen: r.changes });
  } catch (err) { hata(res, err.message, 500); }
});

// ═══════════════════════════════════════════════
// EXCEL ŞABLON & AKTARIM
// ═══════════════════════════════════════════════

// POST /:projeId/sablon-kopyala — PYP Hakkediş şablonunu kurum_sablon adımına kopyala
router.post('/:projeId/sablon-kopyala', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const db = getDb();
    const projeId = parseInt(req.params.projeId);
    const dosyaService = require('../services/dosyaService');

    // kurum_sablon adımını bul
    const hedefAdim = db.prepare(
      "SELECT id FROM proje_adimlari WHERE proje_id = ? AND adim_kodu = 'kurum_sablon' LIMIT 1"
    ).get(projeId);
    if (!hedefAdim) return hata(res, 'Kurum Şablon adımı bulunamadı', 404);

    // Zaten Excel var mı?
    const mevcut = db.prepare(
      "SELECT id FROM dosyalar WHERE proje_adim_id = ? AND durum = 'aktif' AND LOWER(dosya_adi) LIKE '%.xlsm' LIMIT 1"
    ).get(hedefAdim.id);
    if (mevcut) return basarili(res, { dosya_id: mevcut.id, adim_id: hedefAdim.id, yeni: false });

    // Şablon dosyasını bul
    const sablonYol = path.join(__dirname, '../../doc/hakediş/+PYP Hakkediş Formatı_2026_v15.13.04.2026.xlsm');
    if (!fs.existsSync(sablonYol)) return hata(res, 'Hakkediş şablon dosyası bulunamadı', 404);

    // Proje bilgisi
    const proje = db.prepare('SELECT proje_no, proje_tipi FROM projeler WHERE id = ?').get(projeId);
    const projeKlasor = proje ? `${proje.proje_tipi}/${proje.proje_no}` : `proje_${projeId}`;
    const yeniAdi = `${proje?.proje_no || 'proje'}_Hakedis.xlsm`;

    // Kopyala
    const uploadsRoot = dosyaService.dosyaYoluCozumle ? null : null;
    const goreceliYol = `projeler/${projeKlasor}/kurum_sablon/${yeniAdi}`;
    const hedefYol = dosyaService.dosyaYoluCozumle(goreceliYol);

    fs.mkdirSync(path.dirname(hedefYol), { recursive: true });
    fs.copyFileSync(sablonYol, hedefYol);

    const boyut = fs.statSync(hedefYol).size;
    const result = db.prepare(`
      INSERT INTO dosyalar (dosya_adi, orijinal_adi, dosya_yolu, dosya_boyutu, mime_tipi, kategori,
        alan, alt_alan, proje_id, proje_adim_id, durum, olusturma_tarihi)
      VALUES (?, ?, ?, ?, 'application/vnd.ms-excel.sheet.macroEnabled.12', 'tablo', 'proje', ?, ?, ?, 'aktif', datetime('now'))
    `).run(yeniAdi, yeniAdi, goreceliYol, boyut,
      `${proje?.proje_tipi || ''}/${proje?.proje_no || ''}/kurum_sablon`, projeId, hedefAdim.id);

    basarili(res, { dosya_id: result.lastInsertRowid, adim_id: hedefAdim.id, yeni: true });
  } catch (err) {
    console.error('Şablon kopyalama hatası:', err);
    hata(res, err.message, 500);
  }
});

// POST /:projeId/excel-aktar — Metraj verisini kurum_sablon Excel'inin Şebeke Metrajı sayfasına yaz
router.post('/:projeId/excel-aktar', (req, res) => {
  try {
    const fs = require('fs');
    const XLSX = require('xlsx');
    const db = getDb();
    const dosyaService = require('../services/dosyaService');
    const projeId = parseInt(req.params.projeId);

    // kurum_sablon adımındaki Excel'i bul
    const hedefAdim = db.prepare(
      "SELECT id FROM proje_adimlari WHERE proje_id = ? AND adim_kodu = 'kurum_sablon' LIMIT 1"
    ).get(projeId);
    if (!hedefAdim) return hata(res, 'Kurum Şablon adımı bulunamadı', 404);

    const dosya = db.prepare(
      "SELECT id, dosya_yolu FROM dosyalar WHERE proje_adim_id = ? AND durum = 'aktif' AND LOWER(dosya_adi) LIKE '%.xlsm' ORDER BY olusturma_tarihi DESC LIMIT 1"
    ).get(hedefAdim.id);
    if (!dosya) return hata(res, 'Hakkediş Excel dosyası bulunamadı. Önce şablonu kopyalayın.', 404);

    const excelYol = dosyaService.dosyaYoluCozumle(dosya.dosya_yolu);

    // Metraj verilerini al
    const satirlar = db.prepare(
      'SELECT * FROM hak_edis_metraj WHERE proje_id = ? ORDER BY sira, id'
    ).all(projeId);

    if (!satirlar.length) return hata(res, 'Aktarılacak metraj verisi yok', 400);

    // Excel'i oku
    const wb = XLSX.readFile(excelYol, { type: 'file' });
    const ws = wb.Sheets['Şebeke Metrajı'];
    if (!ws) return hata(res, 'Şebeke Metrajı sayfası bulunamadı', 404);

    // Veri başlangıç satırı (satır 5 = index 4, 0-bazlı)
    const BASLANGIC_SATIR = 4;

    // Sütun haritası — Excel sütun indexleri (0-bazlı)
    const COL = {
      nokta1: 1,         // B: 1.Nokta
      nokta2: 2,         // C: 2.Nokta
      nokta_durum: 3,    // D: Nokta Durum
      direk_tur: 4,      // E: Tür
      direk_tip: 5,      // F: Tip
      ara_mesafe: 15,     // P: Ara Mesafe
      ag_iletken_durum: 16, // Q: AG İletken Durum
      og_iletken_durum: 17, // R: OG İletken Durum
      ag_iletken: 18,    // S: AG İletken
      og_iletken: 19,    // T: OG İletken
    };

    // Satırları yaz
    for (let i = 0; i < satirlar.length; i++) {
      const s = satirlar[i];
      const r = BASLANGIC_SATIR + i;

      const setCel = (c, v) => {
        if (v == null || v === '') return;
        const addr = XLSX.utils.encode_cell({ r, c });
        ws[addr] = { t: typeof v === 'number' ? 'n' : 's', v };
      };

      setCel(COL.nokta1, s.nokta1);
      setCel(COL.nokta2, s.nokta2);
      setCel(COL.nokta_durum, s.nokta_durum);
      setCel(COL.direk_tur, s.direk_tur);
      setCel(COL.direk_tip, s.direk_tip);
      setCel(COL.ara_mesafe, s.ara_mesafe || 0);
      setCel(COL.ag_iletken_durum, s.ag_iletken_durum);
      setCel(COL.og_iletken_durum, s.og_iletken_durum);
      setCel(COL.ag_iletken, s.ag_iletken);
      setCel(COL.og_iletken, s.og_iletken);
    }

    // Sheet range güncelle
    const range = XLSX.utils.decode_range(ws['!ref']);
    const yeniSonSatir = BASLANGIC_SATIR + satirlar.length - 1;
    if (yeniSonSatir > range.e.r) range.e.r = yeniSonSatir;
    ws['!ref'] = XLSX.utils.encode_range(range);

    // Kaydet
    XLSX.writeFile(wb, excelYol, { type: 'file', bookType: 'xlsm' });

    // Dosya boyutunu güncelle
    const yeniBoyut = fs.statSync(excelYol).size;
    db.prepare('UPDATE dosyalar SET dosya_boyutu = ?, guncelleme_tarihi = datetime(\'now\') WHERE id = ?').run(yeniBoyut, dosya.id);

    basarili(res, { dosya_id: dosya.id, aktarilan_satir: satirlar.length });
  } catch (err) {
    console.error('Excel aktarım hatası:', err);
    hata(res, err.message, 500);
  }
});

module.exports = router;
