/**
 * Yatırım Takip Excel aktarma servisi
 * Proje keşif verilerini Excel dosyasına yazar
 */
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { getDb, getCurrentTenantSlug } = require('../db/database');

const SABLON_DOSYA = path.join(__dirname, '../../doc/projeler/Yatırım Takip_2026 BATI  KETYB 10.04.2026.xlsm');

function getUploadsRoot() {
  const s = getCurrentTenantSlug();
  return s ? path.join(__dirname, '../../data/tenants', s, 'uploads') : path.join(__dirname, '../../uploads');
}

// Excel'deki projeleri bul (8 sütun aralıklarla)
function excelProjeleri(ws) {
  const range = XLSX.utils.decode_range(ws['!ref']);
  const projeler = [];
  for (let c = 30; c < range.e.c; c += 8) {
    const adi = ws[XLSX.utils.encode_cell({ r: 0, c: c + 4 })]?.v;
    const cbsId = ws[XLSX.utils.encode_cell({ r: 1, c })]?.v;
    if (!adi && !cbsId) continue;
    if (!cbsId && (!adi || !isNaN(adi))) continue;
    projeler.push({ col: c, adi: String(adi || ''), cbsId: cbsId ? String(cbsId) : null });
  }
  return projeler;
}

// Excel'deki malzeme satırlarını oku (poz → row index)
function excelMalzemeSatirlari(ws) {
  const range = XLSX.utils.decode_range(ws['!ref']);
  const satirlar = {};
  for (let r = 4; r <= range.e.r; r++) {
    const filtre = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    if (filtre && String(filtre).toUpperCase().includes('DEMONTAJ')) break;
    const poz = ws[XLSX.utils.encode_cell({ r, c: 1 })]?.v;
    if (poz) satirlar[String(poz)] = r;
  }
  return satirlar;
}

// DB projesini Excel projesiyle eşleştir
function projeEslestir(dbProje, excelProjeler) {
  // İsim eşleştirme
  const norm = (s) => (s || '').toUpperCase().replace(/KET\s*PROJE(Sİ)?/gi, '').replace(/YB\s*PROJE(Sİ)?/gi, '').replace(/\s+/g, ' ').trim();
  const dbNorm = norm(dbProje.musteri_adi);
  const kelimeler = dbNorm.split(' ').filter(w => w.length >= 3);
  if (kelimeler.length === 0) return null;

  let enIyi = null, enIyiSkor = 0;
  for (const ep of excelProjeler) {
    const excelNorm = norm(ep.adi);
    const skor = kelimeler.filter(w => excelNorm.includes(w)).length;
    if (skor > enIyiSkor && skor >= Math.ceil(kelimeler.length * 0.5)) {
      enIyi = ep;
      enIyiSkor = skor;
    }
  }
  return enIyi;
}

/**
 * Proje keşif verilerini Excel'e aktar
 * @param {number} projeId
 * @param {string} tip - 'miktar' (yer teslimi) veya 'ilerleme'
 * @returns {{ dosyaYolu: string, projeNo: string }}
 */
function projeKesifExceleAktar(projeId, tip = 'ilerleme') {
  const db = getDb();
  const proje = db.prepare('SELECT * FROM projeler WHERE id = ?').get(projeId);
  if (!proje) throw new Error('Proje bulunamadı');

  // Sheet belirle
  const sheetAdi = proje.proje_tipi === 'YB' ? 'Samsun Batı YB1' : 'Samsun Batı Ket';

  // Güncel Excel dosyasını bul veya şablondan başla
  const uploadsRoot = getUploadsRoot();
  const aktarKlasor = path.join(uploadsRoot, 'ihale', 'YB-KET');
  fs.mkdirSync(aktarKlasor, { recursive: true });

  // En son kaydedilen dosyayı bul
  let kaynakDosya = SABLON_DOSYA;
  const mevcutDosyalar = fs.existsSync(aktarKlasor) ? fs.readdirSync(aktarKlasor).filter(f => f.endsWith('.xlsm') || f.endsWith('.xlsx')).sort().reverse() : [];
  if (mevcutDosyalar.length > 0) {
    kaynakDosya = path.join(aktarKlasor, mevcutDosyalar[0]);
  }

  // Excel'i oku
  const wb = XLSX.readFile(kaynakDosya);
  const ws = wb.Sheets[sheetAdi];
  if (!ws) throw new Error(`Sheet bulunamadı: ${sheetAdi}`);

  // Proje eşleştir
  const excelProjeler = excelProjeleri(ws);
  const eslesen = projeEslestir(proje, excelProjeler);
  if (!eslesen) throw new Error(`Proje Excel'de bulunamadı: ${proje.musteri_adi}`);

  // Keşif kalemlerini çek
  const kesifler = db.prepare('SELECT * FROM proje_kesif WHERE proje_id = ? ORDER BY excel_satir').all(projeId);
  if (kesifler.length === 0) throw new Error('Proje keşif listesi boş');

  // Malzeme satır haritası
  const malzemeSatirlari = excelMalzemeSatirlari(ws);

  // Sütun offset: AF=col+1 (yer teslimi), AG=col+2 (ilerleme)
  const yazSutun = tip === 'ilerleme' ? eslesen.col + 2 : eslesen.col + 1;
  let yazilanSatir = 0;

  for (const k of kesifler) {
    if (k.kapsayici) continue; // Kapsayıcı satırları atla (Excel'de formülle hesaplanır)
    const poz = k.poz_no || k.okunan_deger;
    if (!poz) continue;
    const excelRow = malzemeSatirlari[poz];
    if (excelRow === undefined) continue;

    const deger = tip === 'ilerleme' ? (k.ilerleme || 0) : (k.miktar || 0);
    if (deger > 0) {
      ws[XLSX.utils.encode_cell({ r: excelRow, c: yazSutun })] = { v: deger, t: 'n' };
      yazilanSatir++;
    }
  }

  // Yeni dosya olarak kaydet (tarih damgalı)
  const tarih = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const saat = new Date().toTimeString().split(' ')[0].replace(/:/g, '').substring(0, 4);
  const yeniAdi = `Yatirim_Takip_${tarih}_${saat}.xlsx`;
  const yeniYol = path.join(aktarKlasor, yeniAdi);

  XLSX.writeFile(wb, yeniYol);

  // DB'de son aktarma tarihini kaydet
  db.prepare('UPDATE projeler SET guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?').run(projeId);

  // Dosya yönetimine kaydet
  const goreceliYol = `ihale/YB-KET/${yeniAdi}`;
  const boyut = fs.statSync(yeniYol).size;

  // Mevcut aktif dosyayı pasife çekme — her seferinde yeni versiyon
  db.prepare(`
    INSERT INTO dosyalar (dosya_adi, orijinal_adi, dosya_yolu, dosya_boyutu, mime_tipi, kategori,
      alan, alt_alan, durum, olusturma_tarihi)
    VALUES (?, ?, ?, ?, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'tablo',
      'ihale', 'YB-KET', 'aktif', datetime('now'))
  `).run(yeniAdi, `Yatırım Takip ${tarih}.xlsx`, goreceliYol, boyut);

  return { dosyaYolu: goreceliYol, projeNo: proje.proje_no, yazilanSatir, tip };
}

/**
 * Projenin Excel'e son aktarılma durumunu kontrol et
 */
function projeAktarimDurumu(projeId) {
  const db = getDb();
  const kesifler = db.prepare('SELECT miktar, ilerleme FROM proje_kesif WHERE proje_id = ? AND kapsayici = 0').all(projeId);
  const toplamMiktar = kesifler.reduce((t, k) => t + (k.miktar || 0), 0);
  const toplamIlerleme = kesifler.reduce((t, k) => t + (k.ilerleme || 0), 0);
  const ilerlemeYuzdesi = toplamMiktar > 0 ? Math.round(toplamIlerleme / toplamMiktar * 100) : 0;
  return { toplamMiktar, toplamIlerleme, ilerlemeYuzdesi, kesifSayisi: kesifler.length };
}

module.exports = { projeKesifExceleAktar, projeAktarimDurumu };
