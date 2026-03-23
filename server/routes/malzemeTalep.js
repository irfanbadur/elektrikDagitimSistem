const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const path = require('path');
const { getDb } = require('../db/database');

const SABLON_YOL = path.join(__dirname, '../../doc/malzeme/Keşifler KET-YB.xlsx');
const SABLON_SAYFA = 'KET GRUP OLUŞTURMA';

// Header satırı index (0-tabanlı) = row 5 → index 4
const HEADER_ROW = 4;
const VERI_BASLANGIC = 5; // row 6 → index 5
const TOPLAM_KOLON = 8;   // I sütunu (index 8) = Grup Toplam
const PROJE_KOLON_BASLANGIC = 9; // J sütunu (index 9)

function normalize(str) {
  return String(str || '').toUpperCase().trim().replace(/\s+/g, ' ');
}

// ─── GET /api/malzeme-talep/sablon-bilgi ──────────────────────────
// Şablondaki mevcut proje sütunlarını ve malzeme satırlarını döner
router.get('/sablon-bilgi', (req, res) => {
  try {
    const wb = XLSX.readFile(SABLON_YOL);
    const ws = wb.Sheets[SABLON_SAYFA];
    const range = XLSX.utils.decode_range(ws['!ref']);

    // Proje sütunları (J ve sonrası)
    const projKolonlar = [];
    for (let c = PROJE_KOLON_BASLANGIC; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: HEADER_ROW, c })];
      if (cell && cell.v) {
        projKolonlar.push({
          kolon: XLSX.utils.encode_col(c),
          kolon_idx: c,
          ad: String(cell.v),
        });
      }
    }

    // Malzeme satırları (veri olan satırlar)
    const malzemeSatirlari = [];
    for (let r = VERI_BASLANGIC; r <= range.e.r; r++) {
      const cellE = ws[XLSX.utils.encode_cell({ r, c: 4 })]; // E = Malzeme Cinsi
      const cellB = ws[XLSX.utils.encode_cell({ r, c: 1 })]; // B = Malzeme Kodu
      const cellD = ws[XLSX.utils.encode_cell({ r, c: 3 })]; // D = EDVARDS PS POZ NO
      if (cellE && cellE.v && String(cellE.v).trim()) {
        malzemeSatirlari.push({
          satir_idx: r,
          malzeme_kodu: cellB ? String(cellB.v) : null,
          edvards_poz: cellD && cellD.v ? String(cellD.v) : null,
          malzeme_cinsi: String(cellE.v),
        });
      }
    }

    res.json({
      success: true,
      data: { projKolonlar, malzemeSayisi: malzemeSatirlari.length },
    });
  } catch (err) {
    console.error('Şablon bilgi hatası:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/malzeme-talep/olustur ─────────────────────────────
// Body: { proje_idler: [1, 2] }
// Seçili projelerin keşif verilerini şablona yazıp Excel indirir
router.post('/olustur', (req, res) => {
  try {
    const { proje_idler } = req.body;
    if (!proje_idler || !proje_idler.length) {
      return res.status(400).json({ success: false, error: 'Proje seçilmedi' });
    }

    const db = getDb();

    // Proje bilgileri
    const placeholders = proje_idler.map(() => '?').join(',');
    const projeler = db
      .prepare(`SELECT id, proje_no, musteri_adi FROM projeler WHERE id IN (${placeholders})`)
      .all(...proje_idler);

    // Her proje için keşif kalemlerini topla (malzeme_kodu ve poz_no bazında)
    const kesifMap = {}; // { proje_id: { 'kod_5100143932': 6, 'poz_85.105.1901.2': 6 } }
    for (const proje of projeler) {
      const items = db
        .prepare(
          `SELECT poz_no, malzeme_kodu, SUM(CAST(miktar AS REAL)) as toplam
           FROM proje_kesif
           WHERE proje_id = ?
           GROUP BY COALESCE(malzeme_kodu, poz_no), poz_no`
        )
        .all(proje.id);

      kesifMap[proje.id] = {};
      for (const item of items) {
        if (item.malzeme_kodu) {
          kesifMap[proje.id]['kod_' + item.malzeme_kodu] = item.toplam;
        }
        if (item.poz_no) {
          kesifMap[proje.id]['poz_' + item.poz_no] = item.toplam;
        }
      }
    }

    // Şablonu oku
    const wb = XLSX.readFile(SABLON_YOL);
    const ws = wb.Sheets[SABLON_SAYFA];
    const range = XLSX.utils.decode_range(ws['!ref']);

    // Mevcut proje sütunlarını tara
    const mevcutKolonlar = {}; // { 'AHMET ŞİMŞEK': 17 }
    let sonKolonIdx = TOPLAM_KOLON; // en az I sütunu
    for (let c = PROJE_KOLON_BASLANGIC; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: HEADER_ROW, c })];
      if (cell && cell.v) {
        mevcutKolonlar[normalize(String(cell.v))] = c;
        sonKolonIdx = c;
      }
    }

    // Her projeye sütun ata (mevcut eşleş veya yeni sütun ekle)
    const projeKolonMap = {}; // { proje_id: kolon_idx }
    for (const proje of projeler) {
      const normMusteri = normalize(proje.musteri_adi || '');
      const normProjeNo = normalize(proje.proje_no || '');

      let kolonIdx =
        mevcutKolonlar[normMusteri] ||
        mevcutKolonlar[normProjeNo] ||
        null;

      if (!kolonIdx) {
        // Yeni sütun
        sonKolonIdx++;
        kolonIdx = sonKolonIdx;
        ws[XLSX.utils.encode_cell({ r: HEADER_ROW, c: kolonIdx })] = {
          v: proje.musteri_adi || proje.proje_no,
          t: 's',
        };
      }

      projeKolonMap[proje.id] = kolonIdx;
    }

    // Malzeme satırlarına miktarları yaz
    for (let r = VERI_BASLANGIC; r <= range.e.r; r++) {
      const cellB = ws[XLSX.utils.encode_cell({ r, c: 1 })]; // B = Malzeme Kodu
      const cellD = ws[XLSX.utils.encode_cell({ r, c: 3 })]; // D = EDVARDS PS POZ NO

      const malzemeKodu = cellB && cellB.v ? String(cellB.v) : null;
      const edvardsPoz = cellD && cellD.v ? String(cellD.v) : null;

      if (!malzemeKodu && !edvardsPoz) continue;

      for (const proje of projeler) {
        const kolonIdx = projeKolonMap[proje.id];
        const kesifler = kesifMap[proje.id];

        let miktar = null;
        if (malzemeKodu && kesifler['kod_' + malzemeKodu] !== undefined) {
          miktar = kesifler['kod_' + malzemeKodu];
        } else if (edvardsPoz && kesifler['poz_' + edvardsPoz] !== undefined) {
          miktar = kesifler['poz_' + edvardsPoz];
        }

        if (miktar !== null && miktar > 0) {
          ws[XLSX.utils.encode_cell({ r, c: kolonIdx })] = { v: miktar, t: 'n' };
        }
      }
    }

    // Aralığı güncelle
    if (sonKolonIdx > range.e.c) {
      range.e.c = sonKolonIdx;
      ws['!ref'] = XLSX.utils.encode_range(range);
    }

    // Excel buffer oluştur
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const tarih = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''Kesifler-Malzeme-Talep-${tarih}.xlsx`
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.send(buffer);
  } catch (err) {
    console.error('Malzeme talep oluşturma hatası:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
