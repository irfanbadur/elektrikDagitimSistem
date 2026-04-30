const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { getDb } = require('../db/database');
const { basarili, hata } = require('../utils/helpers');

const { getCurrentTenantSlug } = require('../db/database');
const getUploadsRoot = () => { const s = getCurrentTenantSlug(); return s ? path.join(__dirname, '../../data/tenants', s, 'uploads') : path.join(__dirname, '../../uploads'); };

// GET /:projeId - Proje demontaj listesi
router.get('/:projeId', (req, res) => {
  try {
    const db = getDb();
    const demontajlar = db.prepare(`
      SELECT * FROM proje_demontaj WHERE proje_id = ? ORDER BY id
    `).all(req.params.projeId);
    basarili(res, demontajlar);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /:projeId/ozet - Demontaj özeti
router.get('/:projeId/ozet', (req, res) => {
  try {
    const db = getDb();
    const ozet = db.prepare(`
      SELECT
        COUNT(*) as toplam_kalem,
        SUM(CASE WHEN durum = 'tamamlandi' THEN 1 ELSE 0 END) as tamamlanan_kalem,
        SUM(CASE WHEN durum = 'planli' THEN 1 ELSE 0 END) as bekleyen_kalem,
        SUM(CASE WHEN durum = 'devam_ediyor' THEN 1 ELSE 0 END) as devam_eden_kalem,
        ROUND(SUM(miktar * birim_fiyat), 2) as toplam_tutar,
        ROUND(SUM(ilerleme * birim_fiyat), 2) as ilerleme_tutar
      FROM proje_demontaj WHERE proje_id = ?
    `).get(req.params.projeId);
    basarili(res, ozet);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /:projeId - Tekli demontaj ekle
router.post('/:projeId', (req, res) => {
  try {
    const db = getDb();
    const { malzeme_kodu, poz_no, malzeme_adi, birim, miktar, notlar } = req.body;
    if (!malzeme_adi) return hata(res, 'Malzeme adı zorunlu');

    const result = db.prepare(`
      INSERT INTO proje_demontaj (proje_id, malzeme_kodu, poz_no, malzeme_adi, birim, miktar, notlar)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.projeId, malzeme_kodu, poz_no, malzeme_adi, birim || 'Ad', miktar || 0, notlar);

    const yeni = db.prepare('SELECT * FROM proje_demontaj WHERE id = ?').get(result.lastInsertRowid);
    basarili(res, yeni, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /:projeId/toplu - Toplu demontaj ekle
router.post('/:projeId/toplu', (req, res) => {
  try {
    const db = getDb();
    const { kalemler } = req.body;
    if (!kalemler || !kalemler.length) return hata(res, 'Kalemler listesi boş');

    const stmt = db.prepare(`
      INSERT INTO proje_demontaj (proje_id, malzeme_kodu, poz_no, malzeme_adi, birim, miktar, notlar)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const eklenen = db.transaction(() => {
      return kalemler.map(k => {
        const r = stmt.run(req.params.projeId, k.malzeme_kodu || null, k.poz_no || null, k.malzeme_adi, k.birim || 'Ad', k.miktar || 0, k.notlar || null);
        return r.lastInsertRowid;
      });
    })();

    basarili(res, { eklenen_sayi: eklenen.length }, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PUT /:projeId/:id - Demontaj güncelle
router.put('/:projeId/:id', (req, res) => {
  try {
    const db = getDb();
    const { malzeme_kodu, poz_no, malzeme_adi, birim, miktar, durum, notlar } = req.body;

    db.prepare(`
      UPDATE proje_demontaj SET malzeme_kodu=?, poz_no=?, malzeme_adi=?, birim=?, miktar=?, durum=?, notlar=?, guncelleme_tarihi=CURRENT_TIMESTAMP
      WHERE id=? AND proje_id=?
    `).run(malzeme_kodu, poz_no, malzeme_adi, birim, miktar, durum, notlar, req.params.id, req.params.projeId);

    const guncellenen = db.prepare('SELECT * FROM proje_demontaj WHERE id = ?').get(req.params.id);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// DELETE /:projeId/:id - Demontaj sil
router.delete('/:projeId/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM proje_demontaj WHERE id = ? AND proje_id = ?').run(req.params.id, req.params.projeId);
    basarili(res, { message: 'Silindi' });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// POST /:projeId/tutanak-olustur — Demontaj tutanağı Excel oluştur/güncelle
// ════════════════════════════════════════════════════════════════
const SABLON_YOLU = path.join(__dirname, '../../doc/tutanaklar/F.641_0 YAPIM İŞLERİ MEVCUT DURUM VE DEMONTAJ TESPİT TUTANAĞI FORMU.XLSX');

// Malzeme grubunu belirle
function malzemeGrubuBelirle(adi) {
  const ad = (adi || '').toUpperCase();
  // Direk tipleri
  if (/\b(10I|12I|9A|K1|K2|K3|14A|16A|DİREK|DIREK|T-200|T-150|T-300|AĞAÇ|AGAC)\b/.test(ad) || /DİREK|DIREK/i.test(ad)) return 'direk';
  // İletken tipleri
  if (/\b(ROSE|PANSY|ASTER|TULIP|SWAN|HAWK|KABLO|NYY|NYRY|İLETKEN|ILETKEN|AER|XLPE|ACSR|OPGW|OPT)\b/.test(ad)) return 'iletken';
  return 'diger';
}

router.post('/:projeId/tutanak-olustur', async (req, res) => {
  try {
    const db = getDb();
    const projeId = req.params.projeId;
    const kullaniciDosyaAdi = req.body?.dosya_adi; // kullanıcı özel dosya adı

    // 1) Proje bilgilerini al
    const proje = db.prepare(`
      SELECT p.*, b.bolge_adi
      FROM projeler p
      LEFT JOIN bolgeler b ON b.id = p.bolge_id
      WHERE p.id = ?
    `).get(projeId);
    if (!proje) return hata(res, 'Proje bulunamadı', 404);

    // 2) Demontaj listesini al
    const demontajlar = db.prepare('SELECT * FROM proje_demontaj WHERE proje_id = ? ORDER BY id').all(projeId);

    // 3) Şablon dosyasını ExcelJS ile oku (biçimlendirmeyi korur)
    if (!fs.existsSync(SABLON_YOLU)) return hata(res, 'Tutanak şablonu bulunamadı', 500);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(SABLON_YOLU);

    // Hücre değerini stil/biçim koruyarak güncelle, opsiyonel referans font uygula
    const setCellVal = (ws, addr, val, refFont) => {
      if (val == null || val === '') return;
      const cell = ws.getCell(addr);
      cell.value = val;
      if (refFont) cell.font = { ...cell.font, size: refFont.size };
      cell.alignment = { ...cell.alignment, horizontal: 'left', vertical: 'middle' };
    };

    // ── "Tutanak Yeni Durum Yapım İşleri" sayfasını doldur ──
    const ws = wb.getWorksheet('Tutanak Yeni Durum Yapım İşleri');
    if (!ws) return hata(res, 'Şablonda "Tutanak Yeni Durum Yapım İşleri" sayfası bulunamadı', 500);

    // Proje bilgileri (G sütunu, merged G:K)
    setCellVal(ws, 'G10', proje.proje_no);                             // İşin PYP Numarası
    setCellVal(ws, 'G11', proje.musteri_adi || proje.proje_no);        // Proje Adı
    setCellVal(ws, 'G12', [proje.il, proje.ilce, proje.mahalle].filter(Boolean).join(' / '));
    setCellVal(ws, 'G14', proje.ada_parsel);                           // Ada/Parsel
    setCellVal(ws, 'G15', proje.enerji_alinan_direk_no);               // Enerji Alınan Direk No
    setCellVal(ws, 'G16', proje.tesis);                                // Edaş/Müşteri Tesis
    if (proje.abone_kablosu) {
      setCellVal(ws, 'G17', `${proje.abone_kablosu}${proje.abone_kablosu_metre ? ` - ${proje.abone_kablosu_metre}m` : ''}`);
    }
    if (proje.kesinti_ihtiyaci != null) {
      setCellVal(ws, 'G19', proje.kesinti_ihtiyaci ? 'Var' : 'Yok');
    }

    // Tarihler (D sütunu, merged D:E)
    setCellVal(ws, 'D17', proje.teslim_tarihi);   // Yer Teslim Tarihi
    setCellVal(ws, 'D18', proje.baslama_tarihi);   // İşe Başlama Tarihi
    setCellVal(ws, 'D19', proje.bitis_tarihi);     // İş Bitirme Tarihi

    // ── Demontaj kalemlerini gruplara ayır ──
    const gruplar = { direk: [], iletken: [], diger: [] };
    for (const d of demontajlar) {
      gruplar[malzemeGrubuBelirle(d.malzeme_adi)].push(d);
    }

    // Satır aralıkları: DİREK 22-33, İLETKEN 34-42, DİĞER 43-51
    const GRUP_SATIRLARI = {
      direk:   { baslangic: 22, bitis: 33 },
      iletken: { baslangic: 34, bitis: 42 },
      diger:   { baslangic: 43, bitis: 51 },
    };

    for (const [grupAdi, satirlar] of Object.entries(GRUP_SATIRLARI)) {
      const kalemler = gruplar[grupAdi];
      for (let i = 0; i < kalemler.length && i < (satirlar.bitis - satirlar.baslangic + 1); i++) {
        const r = satirlar.baslangic + i;
        const k = kalemler[i];
        // Sıra no (C sütunu) fontunu referans al — veri hücrelerine aynı punto uygula
        const refFont = ws.getCell(`C${r}`).font;
        setCellVal(ws, `D${r}`, k.malzeme_kodu || '', refFont);  // MALZEME KODU
        setCellVal(ws, `E${r}`, k.malzeme_adi, refFont);          // MALZEME TANIMI
        setCellVal(ws, `G${r}`, k.birim || 'Ad', refFont);        // ÖLÇÜ BİRİMİ
        const miktarCell = ws.getCell(`I${r}`);
        miktarCell.value = k.miktar || 0;                          // MİKTAR (sayı)
        if (refFont) miktarCell.font = { ...miktarCell.font, size: refFont.size };
        miktarCell.alignment = { ...miktarCell.alignment, horizontal: 'left', vertical: 'middle' };
        setCellVal(ws, `J${r}`, k.notlar || '', refFont);          // AÇIKLAMA
      }
    }

    // ── "Kroki Demontaj Yapım İşleri" sayfasını da doldur ──
    const wsKroki = wb.getWorksheet('Kroki Demontaj Yapım İşleri');
    if (wsKroki) {
      setCellVal(wsKroki, 'G9', proje.proje_no);
      setCellVal(wsKroki, 'G10', proje.musteri_adi || proje.proje_no);
      setCellVal(wsKroki, 'G11', [proje.il, proje.ilce, proje.mahalle].filter(Boolean).join(' / '));
      setCellVal(wsKroki, 'G13', proje.ada_parsel);
      setCellVal(wsKroki, 'G14', proje.enerji_alinan_direk_no);
      setCellVal(wsKroki, 'G15', proje.tesis);
      setCellVal(wsKroki, 'G16', proje.abone_kablosu);
      setCellVal(wsKroki, 'D16', proje.teslim_tarihi);
      setCellVal(wsKroki, 'D17', proje.baslama_tarihi);
      setCellVal(wsKroki, 'D18', proje.bitis_tarihi);
    }

    // 4) Dosya yolunu belirle ve kaydet
    const isTipi = (proje.proje_tipi || 'PROJE').toUpperCase();
    const varsayilanAd = `${proje.proje_no}_demontaj-tutanagi.xlsx`;
    const dosyaAdi = (kullaniciDosyaAdi && kullaniciDosyaAdi.trim())
      ? (kullaniciDosyaAdi.trim().endsWith('.xlsx') ? kullaniciDosyaAdi.trim() : kullaniciDosyaAdi.trim() + '.xlsx')
      : varsayilanAd;
    const relDir = `projeler/${isTipi}/${proje.proje_no}`;
    const absDir = path.join(getUploadsRoot(), relDir);
    if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });

    const dosyaYolu = `${relDir}/${dosyaAdi}`;
    const absYol = path.join(getUploadsRoot(), dosyaYolu);

    // ExcelJS ile diske yaz (biçimlendirme, birleştirmeler, ölçüler korunur)
    await wb.xlsx.writeFile(absYol);
    const stat = fs.statSync(absYol);

    // 5) dosyalar tablosunda oluştur veya güncelle
    const mevcutDosya = db.prepare(`
      SELECT id FROM dosyalar
      WHERE proje_id = ? AND dosya_adi = ? AND durum = 'aktif'
    `).get(projeId, dosyaAdi);

    let dosyaId;
    if (mevcutDosya) {
      db.prepare(`
        UPDATE dosyalar SET dosya_boyutu = ?, guncelleme_tarihi = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(stat.size, mevcutDosya.id);
      dosyaId = mevcutDosya.id;
    } else {
      const result = db.prepare(`
        INSERT INTO dosyalar (dosya_adi, orijinal_adi, dosya_yolu, dosya_boyutu, mime_tipi, kategori, proje_id, alan, alt_alan, kaynak, baslik)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        dosyaAdi,
        'F.641_0 YAPIM İŞLERİ MEVCUT DURUM VE DEMONTAJ TESPİT TUTANAĞI FORMU.XLSX',
        dosyaYolu,
        stat.size,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'tablo',
        projeId,
        'proje',
        `${isTipi}/${proje.proje_no}`,
        'sistem',
        'Demontaj Tespit Tutanağı'
      );
      dosyaId = result.lastInsertRowid;
    }

    basarili(res, {
      dosya_id: dosyaId,
      dosya_adi: dosyaAdi,
      dosya_yolu: dosyaYolu,
      guncellendi: !!mevcutDosya,
      demontaj_sayisi: demontajlar.length,
    });
  } catch (err) {
    console.error('[Tutanak] HATA:', err.message);
    hata(res, err.message, 500);
  }
});

module.exports = router;
