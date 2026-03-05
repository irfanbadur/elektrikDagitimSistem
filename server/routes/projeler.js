const router = require('express').Router();
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');
const donguService = require('../services/donguService');
const fazService = require('../services/fazService');

// Proje sorgularında tekrarlanan SELECT/JOIN bloğu
const PROJE_SELECT = `SELECT p.*, b.bolge_adi, e.ekip_adi,
  pa.asama_adi AS aktif_asama_adi, pa.renk AS aktif_asama_renk, pa.ikon AS aktif_asama_ikon,
  pad.adim_adi AS aktif_adim_adi, pad.faz_adi AS aktif_faz_adi,
  pad.faz_kodu AS aktif_faz_kodu, pad.adim_kodu AS aktif_adim_kodu,
  pad.renk AS aktif_adim_renk, pad.ikon AS aktif_adim_ikon,
  pad.durum AS aktif_adim_durum,
  COALESCE(r_faz_kod.rol_adi, r_faz_sira.rol_adi, r_adim.rol_adi) AS aktif_sorumlu_rol_adi,
  (SELECT k.ad_soyad FROM kullanici_rolleri kr JOIN kullanicilar k ON kr.kullanici_id = k.id
   WHERE kr.rol_id = COALESCE(itf_kod.sorumlu_rol_id, itf_sira.sorumlu_rol_id, pad.sorumlu_rol_id) AND k.durum = 'aktif'
   ORDER BY k.ad_soyad LIMIT 1) AS aktif_sorumlu_adi
  FROM projeler p
  LEFT JOIN bolgeler b ON p.bolge_id = b.id
  LEFT JOIN ekipler e ON p.ekip_id = e.id
  LEFT JOIN proje_asamalari pa ON p.aktif_asama_id = pa.id
  LEFT JOIN proje_adimlari pad ON p.aktif_adim_id = pad.id
  LEFT JOIN is_tipi_fazlari itf_kod ON itf_kod.is_tipi_id = p.is_tipi_id AND itf_kod.faz_kodu = pad.faz_kodu
  LEFT JOIN is_tipi_fazlari itf_sira ON itf_sira.is_tipi_id = p.is_tipi_id AND itf_sira.sira = pad.faz_sira AND itf_kod.id IS NULL
  LEFT JOIN roller r_faz_kod ON itf_kod.sorumlu_rol_id = r_faz_kod.id
  LEFT JOIN roller r_faz_sira ON itf_sira.sorumlu_rol_id = r_faz_sira.id
  LEFT JOIN roller r_adim ON pad.sorumlu_rol_id = r_adim.id`;

// GET /api/projeler
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { durum, bolge_id, tip, ekip_id } = req.query;
    let sql = PROJE_SELECT + ` WHERE 1=1`;
    const params = [];
    if (durum) { sql += ' AND p.durum = ?'; params.push(durum); }
    if (bolge_id) { sql += ' AND p.bolge_id = ?'; params.push(bolge_id); }
    if (tip) { sql += ' AND p.proje_tipi = ?'; params.push(tip); }
    if (ekip_id) { sql += ' AND p.ekip_id = ?'; params.push(ekip_id); }
    sql += ' ORDER BY p.olusturma_tarihi DESC';
    const projeler = db.prepare(sql).all(...params);
    basarili(res, projeler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /api/projeler/istatistikler - MUST be before /:id
router.get('/istatistikler', (req, res) => {
  try {
    const db = getDb();
    const durumBazli = db.prepare('SELECT durum, COUNT(*) as sayi FROM projeler GROUP BY durum').all();
    const tipBazli = db.prepare('SELECT proje_tipi, COUNT(*) as sayi FROM projeler GROUP BY proje_tipi').all();
    const bolgeBazli = db.prepare(`SELECT b.bolge_adi, COUNT(*) as sayi FROM projeler p LEFT JOIN bolgeler b ON p.bolge_id = b.id GROUP BY p.bolge_id`).all();
    basarili(res, { durum_bazli: durumBazli, tip_bazli: tipBazli, bolge_bazli: bolgeBazli });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const proje = db.prepare(PROJE_SELECT + ` WHERE p.id = ?`).get(req.params.id);
    if (!proje) return hata(res, 'Proje bulunamadı', 404);
    basarili(res, proje);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { proje_no, proje_tipi, musteri_adi, bolge_id, mahalle, adres, durum, oncelik, ekip_id, tahmini_sure_gun, baslama_tarihi, bitis_tarihi, teslim_tarihi, tamamlanma_yuzdesi, notlar } = req.body;
    if (!proje_no || !proje_tipi) return hata(res, 'Proje no ve tipi zorunludur');
    const result = db.prepare('INSERT INTO projeler (proje_no, proje_tipi, musteri_adi, bolge_id, mahalle, adres, durum, oncelik, ekip_id, tahmini_sure_gun, baslama_tarihi, bitis_tarihi, teslim_tarihi, tamamlanma_yuzdesi, notlar) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(proje_no, proje_tipi, musteri_adi, bolge_id||null, mahalle, adres, durum||'teslim_alindi', oncelik||'normal', ekip_id||null, tahmini_sure_gun, baslama_tarihi, bitis_tarihi, teslim_tarihi, tamamlanma_yuzdesi||0, notlar);
    const projeId = result.lastInsertRowid;

    // Yeni faz sistemi: İş tipine uygun faz/adım şablonu ata
    try {
      const isTipi = db.prepare(`SELECT id FROM is_tipleri WHERE UPPER(kod) = UPPER(?) AND aktif = 1 LIMIT 1`).get(proje_tipi);
      if (isTipi) {
        const fazlar = fazService.projeAdimAta(projeId, isTipi.id);
        // İlk adımı başlat
        if (fazlar && fazlar.length > 0 && fazlar[0].adimlar && fazlar[0].adimlar.length > 0) {
          fazService.adimBaslat(fazlar[0].adimlar[0].id);
        }
      } else {
        // Fallback: eski döngü sistemi
        const sablon = db.prepare(`SELECT id FROM dongu_sablonlari WHERE UPPER(sablon_kodu) = UPPER(?) AND durum = 'aktif' AND varsayilan = 1 LIMIT 1`).get(proje_tipi);
        if (sablon) {
          const asamalar = donguService.projeDonguAta(projeId, sablon.id);
          if (asamalar && asamalar.length > 0) {
            donguService.asamaBaslat(asamalar[0].id);
          }
        }
      }
    } catch (donguHata) {
      // Döngü ataması başarısız olsa da proje oluşturulmuş olsun
      console.error('Döngü otomatik ataması başarısız:', donguHata.message);
    }

    const yeni = db.prepare(`SELECT p.*, b.bolge_adi, e.ekip_adi, pa.asama_adi AS aktif_asama_adi, pa.renk AS aktif_asama_renk, pa.ikon AS aktif_asama_ikon, pad.adim_adi AS aktif_adim_adi, pad.faz_adi AS aktif_faz_adi, pad.renk AS aktif_adim_renk, pad.ikon AS aktif_adim_ikon FROM projeler p LEFT JOIN bolgeler b ON p.bolge_id = b.id LEFT JOIN ekipler e ON p.ekip_id = e.id LEFT JOIN proje_asamalari pa ON p.aktif_asama_id = pa.id LEFT JOIN proje_adimlari pad ON p.aktif_adim_id = pad.id WHERE p.id = ?`).get(projeId);
    aktiviteLogla('proje', 'olusturma', yeni.id, `Yeni proje: ${proje_no} (${proje_tipi})`);
    basarili(res, yeni, 201);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return hata(res, 'Bu proje numarası zaten kullanımda');
    hata(res, err.message, 500);
  }
});

// PUT /:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { proje_no, proje_tipi, musteri_adi, bolge_id, mahalle, adres, durum, oncelik, ekip_id, tahmini_sure_gun, baslama_tarihi, bitis_tarihi, teslim_tarihi, gerceklesen_bitis, tamamlanma_yuzdesi, notlar } = req.body;
    db.prepare('UPDATE projeler SET proje_no=?, proje_tipi=?, musteri_adi=?, bolge_id=?, mahalle=?, adres=?, durum=?, oncelik=?, ekip_id=?, tahmini_sure_gun=?, baslama_tarihi=?, bitis_tarihi=?, teslim_tarihi=?, gerceklesen_bitis=?, tamamlanma_yuzdesi=?, notlar=?, guncelleme_tarihi=CURRENT_TIMESTAMP WHERE id=?').run(proje_no, proje_tipi, musteri_adi, bolge_id||null, mahalle, adres, durum, oncelik, ekip_id||null, tahmini_sure_gun, baslama_tarihi, bitis_tarihi, teslim_tarihi, gerceklesen_bitis, tamamlanma_yuzdesi, notlar, req.params.id);
    const guncellenen = db.prepare('SELECT * FROM projeler WHERE id = ?').get(req.params.id);
    aktiviteLogla('proje', 'guncelleme', guncellenen.id, `Proje güncellendi: ${proje_no}`);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PATCH /:id/durum
router.patch('/:id/durum', (req, res) => {
  try {
    const db = getDb();
    const { durum, notlar } = req.body;
    if (!durum) return hata(res, 'Durum zorunludur');
    const proje = db.prepare('SELECT * FROM projeler WHERE id = ?').get(req.params.id);
    if (!proje) return hata(res, 'Proje bulunamadı', 404);

    // Döngü aşaması entegrasyonu
    if (proje.aktif_asama_id) {
      // Projenin döngüsü var — aşama bazlı durum değişikliği
      const hedefAsama = db.prepare(`SELECT * FROM proje_asamalari WHERE proje_id = ? AND asama_kodu = ?`).get(req.params.id, durum);
      if (hedefAsama) {
        // Hedef aşamaya kadar olanları tamamla
        const oncekiAsamalar = db.prepare(`SELECT id FROM proje_asamalari WHERE proje_id = ? AND sira < ? AND durum != 'tamamlandi' AND durum != 'atlandi'`).all(req.params.id, hedefAsama.sira);
        for (const oa of oncekiAsamalar) {
          donguService.asamaTamamla(oa.id);
        }
        // Hedef aşamayı başlat
        donguService.asamaBaslat(hedefAsama.id);
      }
    }

    // Update durum - trigger will auto-log to proje_durum_gecmisi
    db.prepare('UPDATE projeler SET durum = ?, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?').run(durum, req.params.id);
    // If notlar provided, update the auto-created gecmis entry
    if (notlar) {
      db.prepare('UPDATE proje_durum_gecmisi SET notlar = ?, degistiren = ? WHERE proje_id = ? AND yeni_durum = ? ORDER BY tarih DESC LIMIT 1').run(notlar, 'koordinator', req.params.id, durum);
    }
    if (durum === 'tamamlandi') {
      db.prepare("UPDATE projeler SET tamamlanma_yuzdesi = 100, gerceklesen_bitis = date('now') WHERE id = ?").run(req.params.id);
    }
    const guncellenen = db.prepare(PROJE_SELECT + ` WHERE p.id = ?`).get(req.params.id);
    aktiviteLogla('proje', 'durum_degisikligi', guncellenen.id, `${proje.proje_no}: ${proje.durum} → ${durum}`);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// DELETE /:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const proje = db.prepare('SELECT * FROM projeler WHERE id = ?').get(req.params.id);
    if (!proje) return hata(res, 'Proje bulunamadı', 404);
    db.prepare('DELETE FROM projeler WHERE id = ?').run(req.params.id);
    aktiviteLogla('proje', 'silme', proje.id, `Proje silindi: ${proje.proje_no}`);
    basarili(res, { message: 'Proje silindi' });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /:id/durum-gecmisi
router.get('/:id/durum-gecmisi', (req, res) => {
  try {
    const db = getDb();
    const gecmis = db.prepare('SELECT * FROM proje_durum_gecmisi WHERE proje_id = ? ORDER BY tarih DESC').all(req.params.id);
    basarili(res, gecmis);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
