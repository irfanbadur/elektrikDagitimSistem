const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');

const UPLOADS_ROOT = process.env.UPLOADS_PATH || path.join(__dirname, '../../uploads');

// Admin kontrolü: admin kullanıcı veya malzeme silme izni olan kullanıcı
function adminGerekli(req, res, next) {
  if (!req.kullanici) {
    return res.status(403).json({ success: false, error: 'Bu işlem için yetki gerekli' });
  }
  // admin kullanıcı adı veya Genel Müdür / Koordinatör rolü (id 1,2)
  const yetkilendirmeService = require('../services/yetkilendirmeService');
  const { izinVar } = yetkilendirmeService.izinKontrol(req.kullanici.id, 'malzeme', 'silme');
  if (req.kullanici.kullanici_adi === 'admin' || izinVar) {
    return next();
  }
  return res.status(403).json({ success: false, error: 'Bu işlem için admin yetkisi gerekli' });
}

// GET / - tüm depolar
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const depolar = db.prepare(`
      SELECT d.*,
        (SELECT COUNT(DISTINCT ds.malzeme_id) FROM depo_stok ds WHERE ds.depo_id = d.id AND ds.miktar > 0) as malzeme_cesidi,
        (SELECT COALESCE(SUM(ds.miktar), 0) FROM depo_stok ds WHERE ds.depo_id = d.id) as toplam_stok
      FROM depolar d
      WHERE d.aktif = 1
      ORDER BY d.depo_tipi = 'ana_depo' DESC, d.depo_adi
    `).all();
    basarili(res, depolar);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /:id - depo detay
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const depo = db.prepare('SELECT * FROM depolar WHERE id = ?').get(req.params.id);
    if (!depo) return hata(res, 'Depo bulunamadı', 404);
    basarili(res, depo);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /:id/stok - deponun stok listesi
router.get('/:id/stok', (req, res) => {
  try {
    const db = getDb();
    const { kategori } = req.query;
    let sql = `
      SELECT ds.*, m.malzeme_kodu, m.malzeme_adi, m.kategori, m.birim, m.birim_fiyat
      FROM depo_stok ds
      JOIN malzemeler m ON ds.malzeme_id = m.id
      WHERE ds.depo_id = ?
    `;
    const params = [req.params.id];
    if (kategori) {
      sql += ' AND m.kategori = ?';
      params.push(kategori);
    }
    sql += ' ORDER BY m.kategori, m.malzeme_adi';
    const stok = db.prepare(sql).all(...params);
    basarili(res, stok);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST / - yeni depo oluştur
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { depo_adi, depo_tipi, sorumlu, telefon, adres, notlar } = req.body;
    if (!depo_adi) return hata(res, 'Depo adı zorunludur');
    const result = db.prepare(
      'INSERT INTO depolar (depo_adi, depo_tipi, sorumlu, telefon, adres, notlar) VALUES (?,?,?,?,?,?)'
    ).run(depo_adi, depo_tipi || 'taseron', sorumlu, telefon, adres, notlar);
    const yeni = db.prepare('SELECT * FROM depolar WHERE id = ?').get(result.lastInsertRowid);
    aktiviteLogla('depo', 'olusturma', yeni.id, `Yeni depo: ${depo_adi}`);
    basarili(res, yeni, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PUT /:id - depo güncelle
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { depo_adi, depo_tipi, sorumlu, telefon, adres, aktif, notlar } = req.body;
    db.prepare(
      'UPDATE depolar SET depo_adi=?, depo_tipi=?, sorumlu=?, telefon=?, adres=?, aktif=?, notlar=? WHERE id=?'
    ).run(depo_adi, depo_tipi, sorumlu, telefon, adres, aktif ?? 1, notlar, req.params.id);
    const guncellenen = db.prepare('SELECT * FROM depolar WHERE id = ?').get(req.params.id);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// DELETE /:id - Depo sil (stokları ile birlikte) — sadece admin
router.delete('/:id', authMiddleware, adminGerekli, (req, res) => {
  try {
    const db = getDb();
    const depo = db.prepare('SELECT * FROM depolar WHERE id = ?').get(req.params.id);
    if (!depo) return hata(res, 'Depo bulunamadı', 404);

    db.transaction(() => {
      db.prepare('DELETE FROM depo_stok WHERE depo_id = ?').run(req.params.id);
      db.prepare('UPDATE hareketler SET kaynak_depo_id = NULL WHERE kaynak_depo_id = ?').run(req.params.id);
      db.prepare('UPDATE hareketler SET hedef_depo_id = NULL WHERE hedef_depo_id = ?').run(req.params.id);
      db.prepare('DELETE FROM depolar WHERE id = ?').run(req.params.id);
    })();

    basarili(res, { message: `${depo.depo_adi} silindi` });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// DELETE /:depoId/stok/toplu - Toplu stok satırı silme — sadece admin
router.post('/:depoId/stok/toplu-sil', authMiddleware, adminGerekli, (req, res) => {
  try {
    const db = getDb();
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return hata(res, 'Silinecek stok ID listesi gerekli');

    const stmt = db.prepare('DELETE FROM depo_stok WHERE id = ? AND depo_id = ?');
    const silinen = db.transaction(() => {
      let count = 0;
      for (const id of ids) {
        const r = stmt.run(id, req.params.depoId);
        count += r.changes;
      }
      return count;
    })();

    basarili(res, { silinen_sayi: silinen });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /:id/excel-aktar — Depo stok + hareket geçmişi Excel oluştur/güncelle
router.post('/:id/excel-aktar', async (req, res) => {
  try {
    const db = getDb();
    const depo = db.prepare('SELECT * FROM depolar WHERE id = ?').get(req.params.id);
    if (!depo) return hata(res, 'Depo bulunamadı', 404);

    // Stok verisi
    const stoklar = db.prepare(`
      SELECT ds.*, m.malzeme_kodu, m.malzeme_adi, m.birim, m.kategori
      FROM depo_stok ds
      JOIN malzemeler m ON m.id = ds.malzeme_id
      WHERE ds.depo_id = ?
      ORDER BY m.malzeme_kodu
    `).all(req.params.id);

    // Hareketler (bu depoya giren veya çıkan)
    const hareketler = db.prepare(`
      SELECT h.id, h.hareket_tipi, h.tarih, h.belge_no, h.teslim_alan, h.teslim_eden, h.aciklama,
        kd.depo_adi as kaynak_depo, hd.depo_adi as hedef_depo
      FROM hareketler h
      LEFT JOIN depolar kd ON h.kaynak_depo_id = kd.id
      LEFT JOIN depolar hd ON h.hedef_depo_id = hd.id
      WHERE (h.kaynak_depo_id = ? OR h.hedef_depo_id = ?) AND h.durum = 'aktif'
      ORDER BY h.tarih, h.id
    `).all(req.params.id, req.params.id);

    // Her hareketin kalemlerini çek
    const hareketKalemleri = {};
    for (const h of hareketler) {
      hareketKalemleri[h.id] = db.prepare(`
        SELECT hk.malzeme_kodu, hk.malzeme_adi, hk.miktar, hk.birim
        FROM hareket_kalemleri hk WHERE hk.hareket_id = ?
      `).all(h.id);
    }

    // Excel oluştur
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Stok');

    // ─── Başlık satırları ───
    // Sabit sütunlar: A=No, B=Kod, C=Malzeme, D=Birim, E=Kategori, F=Stok
    // Hareket sütunları: G'den itibaren her hareket bir sütun
    const headerStyle = { font: { bold: true, size: 10 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }, border: { bottom: { style: 'thin' } }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } };
    const sabitBasliklar = ['No', 'Malzeme Kodu', 'Malzeme Adı', 'Birim', 'Kategori', 'Mevcut Stok'];

    // Satır 1: Hareket tipi (GİRİŞ/ÇIKIŞ)
    // Satır 2: Tarih
    // Satır 3: Belge No
    // Satır 4: Kaynak → Hedef (depo yönü)
    // Satır 5: Teslim Eden / Teslim Alan
    // Satır 6: Açıklama
    // Satır 7: Sütun başlıkları
    // Satır 8+: Veri
    const HEADER_ROWS = 7;

    const infoFont = { size: 8 };
    const infoAlign = { horizontal: 'center', wrapText: true };
    const girisRenk = 'FF16A34A';
    const cikisRenk = 'FFDC2626';

    // Sabit sütun başlıklarını satır 1-6 boyunca depo adı olarak birleştir
    ws.mergeCells('A1:A6'); ws.getCell('A1').value = '';
    ws.mergeCells('B1:B6'); ws.getCell('B1').value = '';
    ws.mergeCells('C1:C6'); ws.getCell('C1').value = depo.depo_adi;
    ws.getCell('C1').font = { bold: true, size: 12 };
    ws.getCell('C1').alignment = { horizontal: 'left', vertical: 'middle' };

    // Satır etiketleri (F sütununa)
    const satirEtiketleri = ['İşlem', 'Tarih', 'Belge No', 'Depo Yönü', 'Teslim', 'Açıklama'];
    satirEtiketleri.forEach((e, i) => {
      const cell = ws.getRow(i + 1).getCell(sabitBasliklar.length);
      cell.value = e;
      cell.font = { bold: true, size: 8, color: { argb: 'FF64748B' } };
      cell.alignment = { horizontal: 'right' };
    });

    // Hareket başlık satırları (1-6)
    hareketler.forEach((h, i) => {
      const col = sabitBasliklar.length + 1 + i;
      const isGiris = h.hedef_depo_id == req.params.id;
      const renk = isGiris ? girisRenk : cikisRenk;
      const tipLabel = isGiris ? 'GİRİŞ' : 'ÇIKIŞ';

      // Satır 1: İşlem tipi
      const c1 = ws.getRow(1).getCell(col);
      c1.value = tipLabel;
      c1.font = { bold: true, size: 9, color: { argb: renk } };
      c1.alignment = infoAlign;
      c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isGiris ? 'FFF0FDF4' : 'FFFFF1F2' } };

      // Satır 2: Tarih
      const c2 = ws.getRow(2).getCell(col);
      c2.value = h.tarih || '';
      c2.font = { bold: true, size: 9 };
      c2.alignment = infoAlign;

      // Satır 3: Belge No
      const c3 = ws.getRow(3).getCell(col);
      c3.value = h.belge_no || '-';
      c3.font = { ...infoFont, name: 'Consolas' };
      c3.alignment = infoAlign;

      // Satır 4: Kaynak → Hedef
      const c4 = ws.getRow(4).getCell(col);
      c4.value = `${h.kaynak_depo || 'Dış'} → ${h.hedef_depo || 'Dış'}`;
      c4.font = { size: 8, color: { argb: renk } };
      c4.alignment = infoAlign;

      // Satır 5: Teslim Eden / Alan
      const c5 = ws.getRow(5).getCell(col);
      const teslimParts = [h.teslim_eden ? `V: ${h.teslim_eden}` : '', h.teslim_alan ? `A: ${h.teslim_alan}` : ''].filter(Boolean);
      c5.value = teslimParts.join('\n') || '-';
      c5.font = infoFont;
      c5.alignment = infoAlign;

      // Satır 6: Açıklama
      const c6 = ws.getRow(6).getCell(col);
      c6.value = h.aciklama || '';
      c6.font = infoFont;
      c6.alignment = infoAlign;
    });

    // Satır yükseklikleri
    ws.getRow(1).height = 18;
    ws.getRow(2).height = 16;
    ws.getRow(3).height = 16;
    ws.getRow(4).height = 18;
    ws.getRow(5).height = 24;
    ws.getRow(6).height = 16;

    // Satır 7: Sütun başlıkları
    const headerRow = ws.getRow(HEADER_ROWS);
    sabitBasliklar.forEach((b, i) => {
      headerRow.getCell(i + 1).value = b;
      headerRow.getCell(i + 1).style = headerStyle;
    });
    hareketler.forEach((h, i) => {
      const col = sabitBasliklar.length + 1 + i;
      const isGiris = h.hedef_depo_id == req.params.id;
      headerRow.getCell(col).value = isGiris ? 'Giriş Mkt' : 'Çıkış Mkt';
      headerRow.getCell(col).style = { ...headerStyle, font: { ...headerStyle.font, color: { argb: isGiris ? girisRenk : cikisRenk } } };
    });

    // Sütun genişlikleri
    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 14;
    ws.getColumn(3).width = 35;
    ws.getColumn(4).width = 8;
    ws.getColumn(5).width = 14;
    ws.getColumn(6).width = 12;
    for (let i = 0; i < hareketler.length; i++) ws.getColumn(sabitBasliklar.length + 1 + i).width = 10;

    // ─── Veri satırları ───
    const DATA_START = HEADER_ROWS + 1;
    stoklar.forEach((s, idx) => {
      const row = ws.getRow(DATA_START + idx);
      row.getCell(1).value = idx + 1;
      row.getCell(2).value = s.malzeme_kodu || '';
      row.getCell(2).font = { size: 9, name: 'Consolas' };
      row.getCell(3).value = s.malzeme_adi || '';
      row.getCell(3).font = { size: 9 };
      row.getCell(4).value = s.birim || 'Ad';
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).value = s.kategori || '';
      row.getCell(5).font = { size: 8 };
      row.getCell(6).value = s.miktar || 0;
      row.getCell(6).font = { bold: true, size: 10 };
      row.getCell(6).alignment = { horizontal: 'center' };

      // Hareket sütunları — bu malzemenin her hareketteki miktarı
      hareketler.forEach((h, hi) => {
        const col = sabitBasliklar.length + 1 + hi;
        const kalemler = hareketKalemleri[h.id] || [];
        const kalem = kalemler.find(k => k.malzeme_kodu === s.malzeme_kodu);
        if (kalem) {
          const isGiris = h.hedef_depo_id == req.params.id;
          const miktar = isGiris ? kalem.miktar : -kalem.miktar;
          row.getCell(col).value = miktar;
          row.getCell(col).font = { size: 9, color: { argb: isGiris ? 'FF16A34A' : 'FFDC2626' } };
          row.getCell(col).alignment = { horizontal: 'center' };
        }
      });
    });

    // Dosya kaydet
    const dosyaAdi = `${depo.depo_adi.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s-]/g, '').trim()}_stok.xlsx`;
    const relDir = 'depo/excel';
    const absDir = path.join(UPLOADS_ROOT, relDir);
    if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });
    const dosyaYolu = `${relDir}/${dosyaAdi}`;
    const absYol = path.join(UPLOADS_ROOT, dosyaYolu);

    await wb.xlsx.writeFile(absYol);
    const stat = fs.statSync(absYol);

    // dosyalar tablosunda oluştur veya güncelle
    const mevcutDosya = db.prepare(`SELECT id FROM dosyalar WHERE dosya_adi = ? AND alan = 'depo' AND alt_alan = 'excel' AND durum = 'aktif'`).get(dosyaAdi);
    let dosyaId;
    if (mevcutDosya) {
      db.prepare('UPDATE dosyalar SET dosya_boyutu = ?, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?').run(stat.size, mevcutDosya.id);
      dosyaId = mevcutDosya.id;
    } else {
      const result = db.prepare(`INSERT INTO dosyalar (dosya_adi, orijinal_adi, dosya_yolu, dosya_boyutu, mime_tipi, kategori, alan, alt_alan, kaynak, baslik) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
        dosyaAdi, dosyaAdi, dosyaYolu, stat.size,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'tablo', 'depo', 'excel', 'sistem', `${depo.depo_adi} Stok Raporu`
      );
      dosyaId = result.lastInsertRowid;
    }

    basarili(res, {
      dosya_id: dosyaId,
      dosya_adi: dosyaAdi,
      dosya_yolu: dosyaYolu,
      stok_sayisi: stoklar.length,
      hareket_sayisi: hareketler.length,
    });
  } catch (err) {
    console.error('[DepoExcel] HATA:', err.message);
    hata(res, err.message, 500);
  }
});

module.exports = router;
