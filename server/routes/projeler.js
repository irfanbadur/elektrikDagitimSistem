const router = require('express').Router();
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');
const donguService = require('../services/donguService');
const fazService = require('../services/fazService');

// Teslim eden kişiyi dis_kisiler tablosunda bul veya oluştur
function ensureDisKisi(db, adSoyad, unvan, kurum) {
  if (!adSoyad?.trim()) return null;
  const ad = adSoyad.trim();
  const existing = db.prepare(
    'SELECT id FROM dis_kisiler WHERE ad_soyad = ? COLLATE NOCASE AND aktif = 1'
  ).get(ad);
  if (existing) {
    // Unvan/kurum bilgisi eksikse güncelle
    if (unvan || kurum) {
      db.prepare(
        'UPDATE dis_kisiler SET unvan = COALESCE(unvan, ?), kurum = COALESCE(kurum, ?), guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(unvan || null, kurum || null, existing.id);
    }
    return existing.id;
  }
  const result = db.prepare(
    'INSERT INTO dis_kisiler (ad_soyad, unvan, kurum) VALUES (?, ?, ?)'
  ).run(ad, unvan || null, kurum || null);
  return Number(result.lastInsertRowid);
}

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
   ORDER BY k.ad_soyad LIMIT 1) AS aktif_sorumlu_adi,
  dk.ad_soyad AS teslim_eden_adi, dk.unvan AS teslim_eden_unvan, dk.kurum AS teslim_eden_kurum,
  (SELECT CASE WHEN SUM(pk.miktar) > 0 THEN ROUND(SUM(pk.ilerleme) * 100.0 / SUM(pk.miktar)) ELSE 0 END FROM proje_kesif pk WHERE pk.proje_id = p.id AND pk.kapsayici = 0) AS kesif_ilerleme_yuzdesi,
  (SELECT COUNT(*) FROM proje_kesif pk2 WHERE pk2.proje_id = p.id AND pk2.kapsayici = 0) AS kesif_kalem_sayisi,
  -- Proje keşif TOPLAM TUTAR (raw): 3 bölüm naive Σ(miktar × birim_fiyat)
  (
    COALESCE((SELECT SUM(miktar * birim_fiyat) FROM proje_kesif WHERE proje_id = p.id), 0)
    + COALESCE((SELECT SUM(miktar * birim_fiyat) FROM proje_demontaj WHERE proje_id = p.id), 0)
    + COALESCE((SELECT SUM(miktar * birim_fiyat) FROM proje_dmm WHERE proje_id = p.id), 0)
  ) AS kesif_toplam_tutar,
  -- Proje keşif TOPLAM TUTAR (artırımlı): Excel KET-YB özet sayfasındaki C17 (KEŞİF TUTARI 1.1x).
  -- Detay sayfa (Samsun Batı) ile özet sayfa (KET-YB PROJE İLERLEME) arasında bazı projelerde
  -- fark olabilir; user özet sayfayı referans alıyor — onu döndürürüz.
  COALESCE(p.kesif_tutari, 0) AS kesif_toplam_tutar_artirimli,
  -- İLERLEME (raw)
  (
    COALESCE((SELECT SUM(ilerleme * birim_fiyat) FROM proje_kesif WHERE proje_id = p.id), 0)
    + COALESCE((SELECT SUM(ilerleme * birim_fiyat) FROM proje_demontaj WHERE proje_id = p.id), 0)
    + COALESCE((SELECT SUM(ilerleme * birim_fiyat) FROM proje_dmm WHERE proje_id = p.id), 0)
  ) AS kesif_ilerleme_tutar,
  -- İLERLEME (artırımlı): Excel KET-YB özet sayfası C20 (İLERLEME MİKTARI 1.1x)
  COALESCE(p.ilerleme_miktari, 0) AS kesif_ilerleme_tutar_artirimli,
  -- Tüm adımların listesi (frontend'de adim_kodu ile eşleşip dosya_sayisi sütunlara dağıtılır)
  (SELECT json_group_array(json_object(
    'id', sub.id, 'adim_kodu', sub.adim_kodu, 'adim_adi', sub.adim_adi,
    'faz_adi', sub.faz_adi, 'durum', sub.durum, 'dosya_sayisi', sub.dosya_sayisi
  )) FROM (
    SELECT pa.id, pa.sira_global, pa.adim_kodu, pa.adim_adi, pa.faz_adi, pa.durum,
      (SELECT COUNT(*) FROM dosyalar d WHERE d.proje_adim_id = pa.id AND d.durum = 'aktif') AS dosya_sayisi
    FROM proje_adimlari pa WHERE pa.proje_id = p.id ORDER BY pa.sira_global
  ) sub) AS adimlar_json
  FROM projeler p
  LEFT JOIN bolgeler b ON p.bolge_id = b.id
  LEFT JOIN ekipler e ON p.ekip_id = e.id
  LEFT JOIN proje_asamalari pa ON p.aktif_asama_id = pa.id
  LEFT JOIN proje_adimlari pad ON p.aktif_adim_id = pad.id
  LEFT JOIN is_tipi_fazlari itf_kod ON itf_kod.is_tipi_id = p.is_tipi_id AND itf_kod.faz_kodu = pad.faz_kodu
  LEFT JOIN is_tipi_fazlari itf_sira ON itf_sira.is_tipi_id = p.is_tipi_id AND itf_sira.sira = pad.faz_sira AND itf_kod.id IS NULL
  LEFT JOIN dis_kisiler dk ON p.teslim_eden_id = dk.id
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
    sql += ' ORDER BY p.excel_sira IS NULL, p.excel_sira ASC, p.olusturma_tarihi DESC';
    const projeler = db.prepare(sql).all(...params);

    // Direk-bazlı metrajdan üretilen tutarı her projeye ekle ve POZ-bazlı tutarla topla.
    // proje_kesif_metraj: Yeni Durum'dan, hak_edis_metraj: Hak Ediş Krokisi'nden direk-bazlı keşif.
    try {
      const { malzemeOzetiUret } = require('../services/metrajOzetService');
      for (const p of projeler) {
        let metrajKesifTutar = 0;
        let metrajKesifIlerleme = 0;
        try {
          const ozetK = malzemeOzetiUret('proje_kesif_metraj', p.id);
          metrajKesifTutar += Number(ozetK.genel_toplam) || 0;
          metrajKesifIlerleme += Number(ozetK.genel_ilerleme_tutar) || 0;
        } catch {}
        try {
          const ozetH = malzemeOzetiUret('hak_edis_metraj', p.id);
          metrajKesifTutar += Number(ozetH.genel_toplam) || 0;
          metrajKesifIlerleme += Number(ozetH.genel_ilerleme_tutar) || 0;
        } catch {}
        p.metraj_kesif_tutar = metrajKesifTutar;
        p.metraj_ilerleme_tutar = metrajKesifIlerleme;
        // POZ-bazlı tutar metraj-bazlı ile birleştir (frontend'in tek "Fiyat" sütunu için)
        p.kesif_toplam_tutar = (Number(p.kesif_toplam_tutar) || 0) + metrajKesifTutar;
        p.kesif_ilerleme_tutar = (Number(p.kesif_ilerleme_tutar) || 0) + metrajKesifIlerleme;
        // Artırımlı (Excel) tutar boşsa metraj × 1.1 ile doldur — Projeler sayfası %10 modu için
        if (!p.kesif_toplam_tutar_artirimli && metrajKesifTutar > 0) {
          p.kesif_toplam_tutar_artirimli = Math.round(metrajKesifTutar * 110) / 100; // %10 + 2 ondalık
        }
        if (!p.kesif_ilerleme_tutar_artirimli && metrajKesifIlerleme > 0) {
          p.kesif_ilerleme_tutar_artirimli = Math.round(metrajKesifIlerleme * 110) / 100;
        }
      }
    } catch (err) {
      console.error('Metraj tutar hesabı hatası:', err.message);
    }

    basarili(res, projeler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PATCH /:id — Kısmi güncelleme (yalnızca gönderilen alanları yazar)
// Sütun-bazlı / inline edit için kullanılır; PUT'taki "tüm alanlar zorunlu" davranışından kaçınır.
router.patch('/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const mevcut = db.prepare('SELECT id FROM projeler WHERE id = ?').get(id);
    if (!mevcut) return hata(res, 'Proje bulunamadı', 404);

    const ALANLAR = new Set([
      'proje_no', 'proje_tipi', 'musteri_adi', 'bolge_id', 'mahalle', 'adres',
      'durum', 'oncelik', 'ekip_id', 'tahmini_sure_gun',
      'baslama_tarihi', 'bitis_tarihi', 'teslim_tarihi', 'gerceklesen_bitis',
      'tamamlanma_yuzdesi', 'notlar',
      'basvuru_no', 'il', 'ilce', 'ada_parsel', 'telefon', 'tesis', 'teknik_birim',
      'abone_kablosu', 'abone_kablosu_metre', 'enerji_alinan_direk_no',
      'kesinti_ihtiyaci', 'kesinti_suresi', 'izinler',
      'yil', 'pyp', 'ihale_no', 'ihale_adi', 'yuklenici', 'tur',
      'cbs_id', 'cbs_durum', 'is_durumu', 'demontaj_teslim_durumu',
      'sozlesme_kesfi', 'kesif_tutari', 'hakedis_miktari', 'hakedis_yuzdesi',
      'ilerleme_miktari', 'ilerleme_yuzdesi', 'proje_onay_durumu', 'is_grubu',
      'proje_baslangic_tarihi', 'enerjilenme_tarihi',
      'proje_asama', 'saha_asama', 'ihale_id',
    ]);
    // NOT NULL alanlar — boş gönderildiyse atla (mevcut değer korunsun)
    const NOT_NULL_ALANLAR = new Set(['proje_no', 'proje_tipi']);

    const setler = [];
    const degerler = [];
    for (const [alan, deger] of Object.entries(req.body)) {
      if (!ALANLAR.has(alan)) continue;
      const bos = deger === '' || deger === null || deger === undefined;
      if (bos && NOT_NULL_ALANLAR.has(alan)) continue;
      let v = bos ? null : deger;
      if (alan === 'kesinti_ihtiyaci' && v != null) v = v ? 1 : 0;
      if (alan === 'izinler' && v != null && typeof v !== 'string') v = JSON.stringify(v);
      setler.push(`${alan} = ?`);
      degerler.push(v);
    }
    if (setler.length === 0) {
      const yok = db.prepare(PROJE_SELECT + ' WHERE p.id = ?').get(id);
      return basarili(res, yok);
    }
    setler.push("guncelleme_tarihi = CURRENT_TIMESTAMP");
    degerler.push(id);

    db.prepare(`UPDATE projeler SET ${setler.join(', ')} WHERE id = ?`).run(...degerler);
    const yeni = db.prepare(PROJE_SELECT + ' WHERE p.id = ?').get(id);
    basarili(res, yeni);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return hata(res, 'Bu proje numarası zaten kullanımda');
    hata(res, err.message, 500);
  }
});

// GET /api/projeler/ad-kontrol?ad=...&hariç_id=... — Aynı ad ile başka proje var mı?
// Türkçe karakter normalize ederek case-insensitive arar.
router.get('/ad-kontrol', (req, res) => {
  try {
    const db = getDb();
    const ad = (req.query.ad || '').trim();
    if (ad.length < 3) return basarili(res, { tam: [], benzer: [] });
    const haricId = parseInt(req.query.haric_id) || 0;

    // SQLite'da Türkçe normalize için iki ayrı pattern: ı/i, ğ/g, ş/s, ö/o, ü/u, ç/c
    // Pratik: hem orijinal hem normalize edilmiş karşılaştır.
    const tr = (s) => String(s || '').toUpperCase()
      .replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ş/g, 'S')
      .replace(/I/g, 'I').replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ç/g, 'C');
    const adNorm = tr(ad);

    // Aday listesi (yaklaşık LIKE) — sonra JS'de tam normalize karşılaştırma
    const adayLike = `%${ad.toUpperCase().replace(/_/g, '\\_').replace(/%/g, '\\%')}%`;
    const adaylar = db.prepare(`
      SELECT id, proje_no, proje_tipi, musteri_adi, durum
      FROM projeler
      WHERE id != ?
      LIMIT 1000
    `).all(haricId);

    const tam = [];
    const benzer = [];
    for (const p of adaylar) {
      const mNorm = tr(p.musteri_adi || '');
      if (!mNorm) continue;
      if (mNorm === adNorm) {
        tam.push(p);
      } else if (mNorm.includes(adNorm) || adNorm.includes(mNorm)) {
        benzer.push(p);
      }
    }
    basarili(res, { tam, benzer: benzer.slice(0, 5) });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /api/projeler/sonraki-no?tip=KET&bolge=1 — Otomatik proje no öner
// Format: {YIL2}.{TIP}.{BOLGE}.{SIRA3}  → ör. 26.KET.1.064
// `BEKLEYEN-…` ve suffix'li (`26.KET.1.026-33`) numaralar hariç tutulur.
router.get('/sonraki-no', (req, res) => {
  try {
    const db = getDb();
    const tip = (req.query.tip || '').toUpperCase().trim();
    if (!tip) return hata(res, 'tip parametresi gerekli', 400);
    const yil2 = String(new Date().getFullYear()).slice(-2);
    const bolge = String(req.query.bolge || '1').trim();
    const prefix = `${yil2}.${tip}.${bolge}.`;

    const kayitlar = db.prepare(
      `SELECT proje_no FROM projeler WHERE proje_no LIKE ?`
    ).all(`${prefix}%`);

    const desen = new RegExp(`^${prefix.replace(/\./g, '\\.')}(\\d{3})$`);
    let maxSira = 0;
    for (const k of kayitlar) {
      const m = (k.proje_no || '').match(desen);
      if (m) {
        const s = parseInt(m[1], 10);
        if (!isNaN(s) && s > maxSira) maxSira = s;
      }
    }
    const yeni = maxSira + 1;
    const projeNo = `${prefix}${String(yeni).padStart(3, '0')}`;
    basarili(res, { proje_no: projeNo, son_sira: maxSira });
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
    const { proje_no, proje_tipi, musteri_adi, bolge_id, mahalle, adres, durum, oncelik, ekip_id, tahmini_sure_gun, baslama_tarihi, bitis_tarihi, teslim_tarihi, tamamlanma_yuzdesi, notlar, teslim_eden, teslim_alan_id, basvuru_no, il, ilce, ada_parsel, telefon, tesis, teknik_birim, abone_kablosu, abone_kablosu_metre, enerji_alinan_direk_no, kesinti_ihtiyaci, kesinti_suresi, izinler, teslim_eden_unvan, teslim_eden_kurum, yil, pyp, ihale_no, ihale_adi, yuklenici, tur, cbs_id, cbs_durum, is_durumu, demontaj_teslim_durumu, sozlesme_kesfi, kesif_tutari, hakedis_miktari, hakedis_yuzdesi, ilerleme_miktari, ilerleme_yuzdesi, proje_onay_durumu, is_grubu, proje_baslangic_tarihi, enerjilenme_tarihi, proje_asama, saha_asama, ihale_id } = req.body;
    if (!proje_no || !proje_tipi) return hata(res, 'Proje no ve tipi zorunludur');
    const teslimEdenId = ensureDisKisi(db, teslim_eden, teslim_eden_unvan, teslim_eden_kurum);
    const result = db.prepare(`INSERT INTO projeler (proje_no, proje_tipi, musteri_adi, bolge_id, mahalle, adres, durum, oncelik, ekip_id, tahmini_sure_gun, baslama_tarihi, bitis_tarihi, teslim_tarihi, tamamlanma_yuzdesi, notlar, teslim_eden, teslim_alan_id, teslim_eden_id, basvuru_no, il, ilce, ada_parsel, telefon, tesis, teknik_birim, abone_kablosu, abone_kablosu_metre, enerji_alinan_direk_no, kesinti_ihtiyaci, kesinti_suresi, izinler, yil, pyp, ihale_no, ihale_adi, yuklenici, tur, cbs_id, cbs_durum, is_durumu, demontaj_teslim_durumu, sozlesme_kesfi, kesif_tutari, hakedis_miktari, hakedis_yuzdesi, ilerleme_miktari, ilerleme_yuzdesi, proje_onay_durumu, is_grubu, proje_baslangic_tarihi, enerjilenme_tarihi, proje_asama, saha_asama, ihale_id) VALUES (${Array(54).fill('?').join(',')})`).run(proje_no, proje_tipi, musteri_adi, bolge_id||null, mahalle, adres, durum||'teslim_alindi', oncelik||'normal', ekip_id||null, tahmini_sure_gun, baslama_tarihi, bitis_tarihi, teslim_tarihi, tamamlanma_yuzdesi||0, notlar, teslim_eden||null, teslim_alan_id||null, teslimEdenId, basvuru_no||null, il||null, ilce||null, ada_parsel||null, telefon||null, tesis||null, teknik_birim||null, abone_kablosu||null, abone_kablosu_metre||null, enerji_alinan_direk_no||null, kesinti_ihtiyaci!=null?kesinti_ihtiyaci?1:0:null, kesinti_suresi||null, izinler?JSON.stringify(izinler):null, yil||null, pyp||null, ihale_no||null, ihale_adi||null, yuklenici||null, tur||null, cbs_id||null, cbs_durum||null, is_durumu||null, demontaj_teslim_durumu||null, sozlesme_kesfi||null, kesif_tutari||null, hakedis_miktari||null, hakedis_yuzdesi||null, ilerleme_miktari||null, ilerleme_yuzdesi||null, proje_onay_durumu||null, is_grubu||null, proje_baslangic_tarihi||null, enerjilenme_tarihi||null, proje_asama||null, saha_asama||null, ihale_id ? parseInt(ihale_id) : null);
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

    // Dosya yönetiminde proje klasörü oluştur: projeler/{İŞ_TİPİ}/{proje_no}/
    try {
      const fs = require('fs');
      const path = require('path');
      const { getCurrentTenantSlug } = require('../db/database');
      const slug = getCurrentTenantSlug();
      const uploadsRoot = slug ? path.join(__dirname, '../../data/tenants', slug, 'uploads') : path.join(__dirname, '../../uploads');
      const projeKlasoru = path.join(uploadsRoot, 'projeler', proje_tipi.toUpperCase(), proje_no);
      fs.mkdirSync(projeKlasoru, { recursive: true });
    } catch (err) {
      console.error('Proje klasörü oluşturulamadı:', err.message);
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
    const { proje_no, proje_tipi, musteri_adi, bolge_id, mahalle, adres, durum, oncelik, ekip_id, tahmini_sure_gun, baslama_tarihi, bitis_tarihi, teslim_tarihi, gerceklesen_bitis, tamamlanma_yuzdesi, notlar, teslim_eden, teslim_alan_id, basvuru_no, il, ilce, ada_parsel, telefon, tesis, teknik_birim, abone_kablosu, abone_kablosu_metre, enerji_alinan_direk_no, kesinti_ihtiyaci, kesinti_suresi, izinler, teslim_eden_unvan, teslim_eden_kurum, yil, pyp, ihale_no, ihale_adi, yuklenici, tur, cbs_id, cbs_durum, is_durumu, demontaj_teslim_durumu, sozlesme_kesfi, kesif_tutari, hakedis_miktari, hakedis_yuzdesi, ilerleme_miktari, ilerleme_yuzdesi, proje_onay_durumu, is_grubu, proje_baslangic_tarihi, enerjilenme_tarihi, proje_asama, saha_asama, ihale_id } = req.body;
    const teslimEdenId = ensureDisKisi(db, teslim_eden, teslim_eden_unvan, teslim_eden_kurum);
    db.prepare(`UPDATE projeler SET proje_no=?, proje_tipi=?, musteri_adi=?, bolge_id=?, mahalle=?, adres=?, durum=?, oncelik=?, ekip_id=?, tahmini_sure_gun=?, baslama_tarihi=?, bitis_tarihi=?, teslim_tarihi=?, gerceklesen_bitis=?, tamamlanma_yuzdesi=?, notlar=?, teslim_eden=?, teslim_alan_id=?, teslim_eden_id=?, basvuru_no=?, il=?, ilce=?, ada_parsel=?, telefon=?, tesis=?, teknik_birim=?, abone_kablosu=?, abone_kablosu_metre=?, enerji_alinan_direk_no=?, kesinti_ihtiyaci=?, kesinti_suresi=?, izinler=?, yil=?, pyp=?, ihale_no=?, ihale_adi=?, yuklenici=?, tur=?, cbs_id=?, cbs_durum=?, is_durumu=?, demontaj_teslim_durumu=?, sozlesme_kesfi=?, kesif_tutari=?, hakedis_miktari=?, hakedis_yuzdesi=?, ilerleme_miktari=?, ilerleme_yuzdesi=?, proje_onay_durumu=?, is_grubu=?, proje_baslangic_tarihi=?, enerjilenme_tarihi=?, proje_asama=?, saha_asama=?, ihale_id=?, guncelleme_tarihi=CURRENT_TIMESTAMP WHERE id=?`).run(proje_no, proje_tipi, musteri_adi, bolge_id||null, mahalle, adres, durum, oncelik, ekip_id||null, tahmini_sure_gun, baslama_tarihi, bitis_tarihi, teslim_tarihi, gerceklesen_bitis, tamamlanma_yuzdesi, notlar, teslim_eden||null, teslim_alan_id||null, teslimEdenId, basvuru_no||null, il||null, ilce||null, ada_parsel||null, telefon||null, tesis||null, teknik_birim||null, abone_kablosu||null, abone_kablosu_metre||null, enerji_alinan_direk_no||null, kesinti_ihtiyaci!=null?kesinti_ihtiyaci?1:0:null, kesinti_suresi||null, izinler?JSON.stringify(izinler):null, yil||null, pyp||null, ihale_no||null, ihale_adi||null, yuklenici||null, tur||null, cbs_id||null, cbs_durum||null, is_durumu||null, demontaj_teslim_durumu||null, sozlesme_kesfi||null, kesif_tutari||null, hakedis_miktari||null, hakedis_yuzdesi||null, ilerleme_miktari||null, ilerleme_yuzdesi||null, proje_onay_durumu||null, is_grubu||null, proje_baslangic_tarihi||null, enerjilenme_tarihi||null, proje_asama||null, saha_asama||null, ihale_id ? parseInt(ihale_id) : null, req.params.id);
    const guncellenen = db.prepare('SELECT * FROM projeler WHERE id = ?').get(req.params.id);
    aktiviteLogla('proje', 'guncelleme', guncellenen.id, `Proje güncellendi: ${proje_no}`);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PATCH /:id/yer-teslim-dosya
router.patch('/:id/yer-teslim-dosya', (req, res) => {
  try {
    const db = getDb();
    const { yer_teslim_dosya_id } = req.body;
    if (!yer_teslim_dosya_id) return hata(res, 'Dosya ID zorunludur');
    db.prepare('UPDATE projeler SET yer_teslim_dosya_id = ?, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?').run(yer_teslim_dosya_id, req.params.id);
    basarili(res, { ok: true });
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

// Tek proje silme yardımcısı (transaction içinde)
function projeSilIslem(db, projeId) {
  const projeTablolari = [
    'proje_durum_gecmisi', 'proje_notlari', 'proje_kesifler',
    'proje_dokumanlari', 'proje_kesif', 'proje_demontaj',
    'proje_direkler', 'proje_kroki_kesif', 'proje_asamalari',
    'proje_adimlari', 'gunluk_ilerleme', 'direk_kayitlar',
    'saha_tespitler',
  ];
  for (const tablo of projeTablolari) {
    try { db.prepare(`DELETE FROM ${tablo} WHERE proje_id = ?`).run(projeId); } catch {}
  }
  const paylasimliTablolar = [
    'hareketler', 'puantajlar', 'talepler', 'gorevler',
    'sahadan_fotograflar', 'dosyalar', 'ai_analizler',
    'kullanici_gorevler', 'bono_kalemleri', 'veri_paketleri',
  ];
  for (const tablo of paylasimliTablolar) {
    try { db.prepare(`UPDATE ${tablo} SET proje_id = NULL WHERE proje_id = ?`).run(projeId); } catch {}
  }
  db.prepare('DELETE FROM projeler WHERE id = ?').run(projeId);
}

// DELETE /:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const projeId = parseInt(req.params.id);
    const proje = db.prepare('SELECT * FROM projeler WHERE id = ?').get(projeId);
    if (!proje) return hata(res, 'Proje bulunamadı', 404);

    const silTransaction = db.transaction(() => {
      projeSilIslem(db, projeId);
    });

    silTransaction();
    aktiviteLogla('proje', 'silme', proje.id, `Proje silindi: ${proje.proje_no}`);
    basarili(res, { message: 'Proje silindi' });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// DELETE /toplu-sil - Toplu proje silme
router.post('/toplu-sil', (req, res) => {
  try {
    const db = getDb();
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return hata(res, 'Silinecek proje ID listesi gerekli');

    const projeler = ids.map(id => db.prepare('SELECT id, proje_no FROM projeler WHERE id = ?').get(parseInt(id))).filter(Boolean);
    if (projeler.length === 0) return hata(res, 'Silinecek proje bulunamadı', 404);

    const topluSilTransaction = db.transaction(() => {
      for (const proje of projeler) {
        projeSilIslem(db, proje.id);
      }
    });

    topluSilTransaction();
    const silinen = projeler.map(p => p.proje_no).join(', ');
    aktiviteLogla('proje', 'toplu_silme', null, `${projeler.length} proje toplu silindi: ${silinen}`);
    basarili(res, { message: `${projeler.length} proje silindi`, silinen: projeler.length });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /excel-export — Seçili projeleri seçili sütunlarla XLSX olarak indir
//   Body: { ids: number[], kolonlar: [{ accessor, baslik }] }
//   Dönüş: Excel binary (blob)
router.post('/excel-export', async (req, res) => {
  try {
    const db = getDb();
    const { ids, kolonlar, baslik } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return hata(res, 'Proje ID listesi gerekli');
    if (!Array.isArray(kolonlar) || kolonlar.length === 0) return hata(res, 'Sütun listesi gerekli');
    const dosyaBaslik = (typeof baslik === 'string' ? baslik.trim() : '');

    // PROJE_SELECT ile aynı projection — tüm zenginleştirilmiş alanlar
    const placeholders = ids.map(() => '?').join(',');
    const projeler = db.prepare(`${PROJE_SELECT} WHERE p.id IN (${placeholders}) ORDER BY p.excel_sira IS NULL, p.excel_sira ASC, p.olusturma_tarihi DESC`).all(...ids.map(Number));

    // Metraj tutarını da ekle (liste endpoint'iyle aynı)
    try {
      const { malzemeOzetiUret } = require('../services/metrajOzetService');
      for (const p of projeler) {
        let t = 0, i = 0;
        try { const o = malzemeOzetiUret('proje_kesif_metraj', p.id); t += Number(o.genel_toplam) || 0; i += Number(o.genel_ilerleme_tutar) || 0; } catch {}
        try { const o = malzemeOzetiUret('hak_edis_metraj', p.id); t += Number(o.genel_toplam) || 0; i += Number(o.genel_ilerleme_tutar) || 0; } catch {}
        p.metraj_kesif_tutar = t;
        p.metraj_ilerleme_tutar = i;
      }
    } catch {}

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Projeler');
    // Kolon tanımları (ws.columns header default header satırı kullanır; biz manuel
    // başlık+kolon satırlarını yazacağız, bu yüzden sadece key ve width veriyoruz)
    ws.columns = kolonlar.map(k => ({
      key: k.accessor,
      width: Math.max(12, (k.baslik || k.accessor).length + 2),
    }));

    let baslikRowOff = 0;
    if (dosyaBaslik) {
      // 1. satıra başlık (merge edilmiş)
      const r = ws.addRow([dosyaBaslik]);
      r.height = 26;
      r.font = { bold: true, size: 14 };
      r.alignment = { horizontal: 'center', vertical: 'middle' };
      // Tüm kolonlar boyunca merge
      ws.mergeCells(1, 1, 1, kolonlar.length);
      baslikRowOff = 1;
    }

    // Sütun başlıkları satırı
    const headerRow = ws.addRow(kolonlar.map(k => k.baslik || k.accessor));
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7EFFA' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Veri satırları
    const dateFields = new Set(['baslama_tarihi','bitis_tarihi','teslim_tarihi','olusturma_tarihi','guncelleme_tarihi']);
    for (const p of projeler) {
      const row = {};
      for (const k of kolonlar) {
        let v = p[k.accessor];
        if (v != null && dateFields.has(k.accessor)) v = String(v).slice(0, 10);
        if (v == null) v = '';
        row[k.accessor] = v;
      }
      ws.addRow(row);
    }
    // Sayı kolonlarına biçim ver (kesif, metraj, ilerleme, tutar içerenler)
    for (const k of kolonlar) {
      const a = k.accessor || '';
      if (/tutar|miktar|ilerleme|kesif/i.test(a)) {
        const col = ws.getColumn(a);
        col.numFmt = '#,##0.00';
        col.alignment = { horizontal: 'right' };
      }
    }
    // Freeze: başlık + sütun başlıkları üstte sabit kalsın
    ws.views = [{ state: 'frozen', ySplit: 1 + baslikRowOff }];

    const buf = await wb.xlsx.writeBuffer();
    const tarih = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="projeler-${tarih}.xlsx"`);
    res.send(Buffer.from(buf));
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

// ════════════════════════════════════════════════════════════════
// POST /yer-teslim-xlsx — Seçili projelerden Yer Teslim Tutanağı XLSX oluştur
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { getCurrentTenantSlug: _gts } = require('../db/database');
const _getUploadsRoot = () => { const s = _gts(); return s ? path.join(__dirname, '../../data/tenants', s, 'uploads') : path.join(__dirname, '../../uploads'); };
const YER_TESLIM_SABLON = path.join(__dirname, '../../doc/tutanaklar/F.411_4 YER TESLİM TUTANAĞI.xlsx');

router.post('/yer-teslim-xlsx', async (req, res) => {
  try {
    const db = getDb();
    const { satirlar, dosya_adi: kullaniciDosyaAdi } = req.body;
    if (!satirlar || !satirlar.length) return hata(res, 'En az bir proje satırı gerekli');

    // Şablon dosyasını oku (biçim korunur)
    if (!fs.existsSync(YER_TESLIM_SABLON)) return hata(res, 'Yer teslim tutanağı şablonu bulunamadı', 500);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(YER_TESLIM_SABLON);

    const ws = wb.getWorksheet('YER TESLİM TUTANAĞI');
    if (!ws) return hata(res, 'Şablonda "YER TESLİM TUTANAĞI" sayfası bulunamadı', 500);

    // Veri satırları: Row 11-30 (max 20 proje)
    const MAX_SATIR = 20;
    const BASLANGIC = 11;

    // Referans font: sıra no hücresi (B sütunu) fontunu al, veri hücrelerine uygula
    const setWithFont = (cell, val, refFont) => {
      cell.value = val;
      if (refFont?.size) cell.font = { ...cell.font, size: refFont.size };
    };

    for (let i = 0; i < Math.min(satirlar.length, MAX_SATIR); i++) {
      const r = BASLANGIC + i;
      const s = satirlar[i];
      const refFont = ws.getCell(`B${r}`).font; // sıra no referans font
      setWithFont(ws.getCell(`B${r}`), i + 1, refFont);                  // SIRA NO
      setWithFont(ws.getCell(`C${r}`), s.il || '', refFont);              // İL
      setWithFont(ws.getCell(`D${r}`), s.ilce || '', refFont);            // İLÇE
      setWithFont(ws.getCell(`E${r}`), s.mahalle || '', refFont);         // MAHALLE
      setWithFont(ws.getCell(`F${r}`), s.proje_adi || '', refFont);       // PROJE ADI
      setWithFont(ws.getCell(`G${r}`), s.teknik_birim || '', refFont);    // TEKNİK BİRİM
      setWithFont(ws.getCell(`H${r}`), s.pyp_id || '', refFont);          // PYP ID
      setWithFont(ws.getCell(`I${r}`), s.kesinti || '', refFont);         // KESİNTİ SAYISI
      setWithFont(ws.getCell(`J${r}`), s.yer_teslim_tarihi || '', refFont);  // YER TESLİM TARİHİ
      setWithFont(ws.getCell(`K${r}`), s.ise_baslama_tarihi || '', refFont); // İŞE BAŞLAMA TARİHİ
      setWithFont(ws.getCell(`L${r}`), s.is_bitirme_tarihi || '', refFont);  // İŞ BİTİRME TARİHİ
    }

    // Dosya yolunu belirle
    const tarih = new Date().toISOString().slice(0, 10);
    const varsayilanAd = `Yer_Teslim_Tutanagi_${tarih}.xlsx`;
    const dosyaAdi = (kullaniciDosyaAdi && kullaniciDosyaAdi.trim())
      ? (kullaniciDosyaAdi.trim().endsWith('.xlsx') ? kullaniciDosyaAdi.trim() : kullaniciDosyaAdi.trim() + '.xlsx')
      : varsayilanAd;
    const relDir = 'projeler/teslim-tutanaklari';
    const absDir = path.join(_getUploadsRoot(), relDir);
    if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });

    const dosyaYolu = `${relDir}/${dosyaAdi}`;
    const absYol = path.join(_getUploadsRoot(), dosyaYolu);

    await wb.xlsx.writeFile(absYol);
    const stat = fs.statSync(absYol);

    // dosyalar tablosunda oluştur veya güncelle
    const mevcutDosya = db.prepare(`
      SELECT id FROM dosyalar WHERE dosya_adi = ? AND alan = 'proje' AND alt_alan = 'teslim-tutanaklari' AND durum = 'aktif'
    `).get(dosyaAdi);

    let dosyaId;
    if (mevcutDosya) {
      db.prepare('UPDATE dosyalar SET dosya_boyutu = ?, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?').run(stat.size, mevcutDosya.id);
      dosyaId = mevcutDosya.id;
    } else {
      const result = db.prepare(`
        INSERT INTO dosyalar (dosya_adi, orijinal_adi, dosya_yolu, dosya_boyutu, mime_tipi, kategori, alan, alt_alan, kaynak, baslik)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        dosyaAdi,
        'F.411_4 YER TESLİM TUTANAĞI.xlsx',
        dosyaYolu,
        stat.size,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'tablo',
        'proje',
        'teslim-tutanaklari',
        'sistem',
        'Yer Teslim Tutanağı'
      );
      dosyaId = result.lastInsertRowid;
    }

    basarili(res, {
      dosya_id: dosyaId,
      dosya_adi: dosyaAdi,
      dosya_yolu: dosyaYolu,
      proje_sayisi: satirlar.length,
    });
  } catch (err) {
    console.error('[YerTeslimXLSX] HATA:', err.message);
    hata(res, err.message, 500);
  }
});

module.exports = router;
