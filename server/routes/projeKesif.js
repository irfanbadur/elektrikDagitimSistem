const router = require('express').Router();
const path = require('path');
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');
const { metinTabanliAI } = require('../services/aiParseService');
const kesifParsePrompt = require('../services/ai-engine/prompts/kesifParsePrompt');
const XLSX = require('xlsx');

const { getCurrentTenantSlug } = require('../db/database');
const getUploadsRoot = () => { const s = getCurrentTenantSlug(); return s ? path.join(__dirname, '../../data/tenants', s, 'uploads') : path.join(__dirname, '../../uploads'); };

// Excel dosyasını oku (.xls ve .xlsx desteği - xlsx paketi ile)
function excelOku(tamYol) {
  try {
    const workbook = XLSX.readFile(tamYol);
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return null;
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    // Boş satırları filtrele
    const rows = data.filter(row => row && row.some(c => c != null && c !== ''));
    return rows.length >= 2 ? rows.map(r => r.map(c => c != null ? String(c) : '')) : null;
  } catch (err) {
    console.error('Excel okuma hatası:', err.message);
    return null;
  }
}

// GET /:projeId - proje keşif listesi
router.get('/:projeId', (req, res) => {
  try {
    const db = getDb();
    const { depo_id } = req.query;
    let sql, params;
    if (depo_id) {
      sql = `
        SELECT pk.*,
          (SELECT SUM(bk.miktar) FROM bono_kalemleri bk WHERE bk.proje_kesif_id = pk.id) as alinan_miktar,
          COALESCE(ds.miktar, 0) as depo_stok
        FROM proje_kesif pk
        LEFT JOIN malzemeler m ON m.malzeme_kodu = pk.malzeme_kodu AND pk.malzeme_kodu IS NOT NULL AND pk.malzeme_kodu != ''
        LEFT JOIN depo_stok ds ON ds.malzeme_id = m.id AND ds.depo_id = ?
        WHERE pk.proje_id = ?
        ORDER BY pk.id
      `;
      params = [depo_id, req.params.projeId];
    } else {
      sql = `
        SELECT pk.*,
          (SELECT SUM(bk.miktar) FROM bono_kalemleri bk WHERE bk.proje_kesif_id = pk.id) as alinan_miktar
        FROM proje_kesif pk
        WHERE pk.proje_id = ?
        ORDER BY pk.id
      `;
      params = [req.params.projeId];
    }
    const kesifler = db.prepare(sql).all(...params);
    basarili(res, kesifler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /:projeId/ozet - keşif özet istatistikleri
router.get('/:projeId/ozet', (req, res) => {
  try {
    const db = getDb();
    const ozet = db.prepare(`
      SELECT
        COUNT(*) as toplam_kalem,
        SUM(miktar) as toplam_miktar,
        SUM(miktar * birim_fiyat) as toplam_tutar,
        SUM(CASE WHEN durum = 'alindi' THEN 1 ELSE 0 END) as alinan_kalem,
        SUM(CASE WHEN durum = 'planli' THEN 1 ELSE 0 END) as planli_kalem,
        SUM(CASE WHEN durum = 'depoda_var' THEN 1 ELSE 0 END) as depoda_var_kalem
      FROM proje_kesif WHERE proje_id = ?
    `).get(req.params.projeId);
    basarili(res, ozet);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /:projeId/parse-xls - XLS dosyasından keşif parse
router.post('/:projeId/parse-xls', async (req, res) => {
  try {
    const db = getDb();
    const { dosya_id } = req.body;
    if (!dosya_id) return hata(res, 'dosya_id zorunludur', 400);

    // Dosya bilgisini al
    const dosya = db.prepare('SELECT * FROM dosyalar WHERE id = ?').get(dosya_id);
    if (!dosya) return hata(res, 'Dosya bulunamadı', 404);

    const ext = (dosya.orijinal_adi || dosya.dosya_adi || '').split('.').pop().toLowerCase();
    if (!['xls', 'xlsx'].includes(ext)) return hata(res, 'Sadece XLS/XLSX dosyalar desteklenir', 400);

    const tamYol = path.join(getUploadsRoot(), dosya.dosya_yolu);

    // Excel dosyasını oku
    const rows = excelOku(tamYol);
    const excelBasarili = rows !== null;

    let kalemler = [];
    let parseKaynak = 'ai';

    // ExcelJS ile okunabildi ise deterministik parse dene
    if (excelBasarili) {
      const HEADER_KEYWORDS = {
        malzeme_kodu: ['malzeme kodu', 'sap kodu', 'malzeme no', 'stok kodu', 'stok no'],
        poz_no: ['pozno', 'poz no', 'poz birlesik', 'poz numarasi', 'poz birleşik', 'poz'],
        malzeme_adi: ['malzemenin cinsi', 'malzeme cinsi', 'malzeme adi', 'malzeme tanımı', 'malzeme tanimi', 'malzeme adı', 'malzeme', 'tanımı', 'tanimi', 'aciklama', 'açıklama'],
        birim: ['birim', 'ölçü birimi', 'olcu birimi', 'ölçü', 'olcu'],
        miktar: ['miktar', 'adet', 'toplam miktar'],
        birim_fiyat: ['birim fiyat', 'birim fiyatı', 'br fiyat', 'fiyat'],
      };

      let headerRowIdx = -1;
      let columnMap = {};

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i].map(c => c.toLowerCase().replace(/[^\wğüşıöça-z\s]/gi, '').trim());
      const tempMap = {};
      let eslesen = 0;

      for (const [alan, keywords] of Object.entries(HEADER_KEYWORDS)) {
        for (let j = 0; j < row.length; j++) {
          if (keywords.some(kw => row[j].includes(kw))) {
            tempMap[alan] = j;
            eslesen++;
            break;
          }
        }
      }

      // malzeme_adi + en az 2 alan daha eşleşmeli (birim veya miktar zorunlu)
      const birimVeyaMiktarVar = tempMap.birim !== undefined || tempMap.miktar !== undefined;
      if (tempMap.malzeme_adi !== undefined && birimVeyaMiktarVar && eslesen >= 3 && eslesen > Object.keys(columnMap).length) {
        headerRowIdx = i;
        columnMap = tempMap;
        // Yeterince iyi bir header bulunduysa dur
        if (eslesen >= 4) break;
      }
    }

      if (headerRowIdx >= 0 && columnMap.malzeme_adi !== undefined) {
        // Deterministik parse
        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          const malzemeAdi = (row[columnMap.malzeme_adi] || '').trim();
          if (!malzemeAdi) continue;

          // Türkçe sayı formatını parse et (1.904,00 → 1904.00)
          const parseTR = (val) => parseFloat(String(val || '').replace(/\./g, '').replace(',', '.')) || 0;
          kalemler.push({
            sira_no: kalemler.length + 1,
            malzeme_kodu: columnMap.malzeme_kodu !== undefined ? (row[columnMap.malzeme_kodu] || '').trim() || null : null,
            poz_no: columnMap.poz_no !== undefined ? (row[columnMap.poz_no] || '').trim() || null : null,
            malzeme_adi: malzemeAdi,
            birim: columnMap.birim !== undefined ? (row[columnMap.birim] || '').trim().replace(/\.$/, '') || 'Ad' : 'Ad',
            miktar: columnMap.miktar !== undefined ? parseTR(row[columnMap.miktar]) || 1 : 1,
            birim_fiyat: columnMap.birim_fiyat !== undefined ? parseTR(row[columnMap.birim_fiyat]) : 0,
          });
        }
        if (kalemler.length > 0) parseKaynak = 'deterministik';
      }

      // Deterministik yetersizse tablo metnini AI'a gönder
      if (kalemler.length === 0) {
        const tabloMetni = rows.map(row => row.join(' | ')).join('\n');
        const kisaltilmis = tabloMetni.length > 15000 ? tabloMetni.substring(0, 15000) + '\n...(kesildi)' : tabloMetni;

        const aiSonuc = await metinTabanliAI(
          kesifParsePrompt.buildPrompt(),
          `Aşağıdaki Excel tablosunu analiz et:\n\n${kisaltilmis}`
        );

        if (aiSonuc && !aiSonuc.parse_error && aiSonuc.kalemler) {
          kalemler = aiSonuc.kalemler;
        }
      }
    } // excelBasarili kapanış

    if (!excelBasarili && kalemler.length === 0) {
      return hata(res, 'Excel dosyası okunamadı. Dosya formatını kontrol edin.', 400);
    }

    if (kalemler.length === 0) {
      return hata(res, 'XLS parse edilemedi. Dosya formatını kontrol edin.', 400);
    }

    basarili(res, { kalemler, kaynak: parseKaynak, toplam_kalem: kalemler.length });
  } catch (err) {
    console.error('Kesif XLS parse hatası:', err);
    hata(res, err.message || 'XLS parse sırasında hata oluştu', 500);
  }
});

// POST /:projeId - keşif kalemi ekle
router.post('/:projeId', (req, res) => {
  try {
    const db = getDb();
    const { malzeme_kodu, poz_no, malzeme_adi, birim, miktar, birim_fiyat, notlar, okunan_deger } = req.body;
    if (!malzeme_adi && !okunan_deger) return hata(res, 'Malzeme adı veya okunan değer zorunludur');

    const result = db.prepare(`
      INSERT INTO proje_kesif (proje_id, malzeme_kodu, poz_no, malzeme_adi, birim, miktar, birim_fiyat, notlar, okunan_deger)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.projeId, malzeme_kodu, poz_no, malzeme_adi || '', birim || 'Ad', miktar || 0, birim_fiyat || 0, notlar, okunan_deger || null);

    const yeni = db.prepare('SELECT * FROM proje_kesif WHERE id = ?').get(result.lastInsertRowid);
    aktiviteLogla('proje_kesif', 'olusturma', yeni.id, `Kesif kalemi: ${malzeme_adi} (Proje: ${req.params.projeId})`);
    basarili(res, yeni, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /:projeId/toplu - katalogdan toplu ekleme
router.post('/:projeId/toplu', (req, res) => {
  try {
    const db = getDb();
    const { kalemler } = req.body;
    if (!kalemler || !kalemler.length) return hata(res, 'Kalem listesi bos');

    const stmt = db.prepare(`
      INSERT INTO proje_kesif (proje_id, malzeme_kodu, poz_no, malzeme_adi, birim, miktar, birim_fiyat, okunan_deger)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      for (const k of kalemler) {
        stmt.run(req.params.projeId, k.malzeme_kodu, k.poz_no, k.malzeme_adi, k.birim || 'Ad', k.miktar || 0, k.birim_fiyat || 0, k.okunan_deger || null);
      }
    });
    transaction();

    aktiviteLogla('proje_kesif', 'toplu_ekleme', req.params.projeId, `${kalemler.length} kalem eklendi`);
    basarili(res, { eklenen: kalemler.length }, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PUT /:projeId/:id - keşif kalemi güncelle
router.put('/:projeId/:id', (req, res) => {
  try {
    const db = getDb();
    const { malzeme_kodu, poz_no, malzeme_adi, birim, miktar, birim_fiyat, durum, notlar } = req.body;

    db.prepare(`
      UPDATE proje_kesif SET malzeme_kodu=?, poz_no=?, malzeme_adi=?, birim=?, miktar=?, birim_fiyat=?, durum=?, notlar=?, guncelleme_tarihi=CURRENT_TIMESTAMP
      WHERE id=? AND proje_id=?
    `).run(malzeme_kodu, poz_no, malzeme_adi, birim, miktar, birim_fiyat, durum, notlar, req.params.id, req.params.projeId);

    const guncellenen = db.prepare('SELECT * FROM proje_kesif WHERE id = ?').get(req.params.id);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// DELETE /:projeId/:id - keşif kalemi sil
router.delete('/:projeId/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM proje_kesif WHERE id = ? AND proje_id = ?').run(req.params.id, req.params.projeId);
    basarili(res, { silindi: true });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
