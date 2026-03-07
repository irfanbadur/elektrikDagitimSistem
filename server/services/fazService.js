const { getDb } = require('../db/database');

class FazService {

  // ═══════════════════════════════════════════════
  // İŞ TİPİ CRUD
  // ═══════════════════════════════════════════════

  isTipleriniListele() {
    const db = getDb();
    const tipler = db.prepare(`
      SELECT * FROM is_tipleri WHERE aktif = 1 ORDER BY sira, ad
    `).all();

    return tipler.map(t => ({
      ...t,
      fazlar: this._fazlariGetir(t.id)
    }));
  }

  isTipiGetir(id) {
    const db = getDb();
    const tip = db.prepare('SELECT * FROM is_tipleri WHERE id = ?').get(id);
    if (!tip) return null;

    tip.fazlar = this._fazlariGetir(id);
    return tip;
  }

  _fazlariGetir(isTipiId) {
    const db = getDb();
    const fazlar = db.prepare(`
      SELECT f.*, r.rol_adi as sorumlu_rol_adi
      FROM is_tipi_fazlari f
      LEFT JOIN roller r ON f.sorumlu_rol_id = r.id
      WHERE f.is_tipi_id = ?
      ORDER BY f.sira
    `).all(isTipiId);

    return fazlar.map(f => ({
      ...f,
      adimlar: db.prepare(`
        SELECT * FROM faz_adimlari WHERE faz_id = ? ORDER BY sira
      `).all(f.id)
    }));
  }

  isTipiOlustur({ kod, ad, aciklama }) {
    const db = getDb();

    const result = db.prepare(`
      INSERT INTO is_tipleri (kod, ad, aciklama, sira)
      VALUES (?, ?, ?, (SELECT COALESCE(MAX(sira), 0) + 1 FROM is_tipleri))
    `).run(kod.toUpperCase(), ad, aciklama || null);

    const tipId = result.lastInsertRowid;

    // Varsayılan 7 faz seed et
    this._varsayilanFazlarEkle(tipId);

    return this.isTipiGetir(tipId);
  }

  _varsayilanFazlarEkle(isTipiId) {
    const db = getDb();

    const getRolId = (kod) => {
      const rol = db.prepare('SELECT id FROM roller WHERE rol_kodu = ?').get(kod);
      return rol?.id || null;
    };

    const fazlar = [
      { sira: 1, faz_adi: 'Başlama', faz_kodu: 'baslama', ikon: '🚀', renk: '#6366f1', sorumlu: 'saha_muhendis', tahmini_gun: 5,
        adimlar: [
          { adim_adi: 'Krokinin hazırlanması', adim_kodu: 'kroki', tahmini_gun: 2 },
          { adim_adi: 'Koordinatların alınması', adim_kodu: 'koordinat', tahmini_gun: 3 },
        ]},
      { sira: 2, faz_adi: 'Teknik Hazırlık-Tasarım', faz_kodu: 'teknik_hazirlik', ikon: '📐', renk: '#8b5cf6', sorumlu: 'saha_muhendis', tahmini_gun: 15,
        adimlar: [
          { adim_adi: 'Proje', adim_kodu: 'proje', tahmini_gun: 7 },
          { adim_adi: 'Keşif', adim_kodu: 'kesif', tahmini_gun: 3 },
          { adim_adi: 'Malzeme listesi', adim_kodu: 'malzeme_listesi', tahmini_gun: 5 },
        ]},
      { sira: 3, faz_adi: 'Planlama', faz_kodu: 'planlama', ikon: '📋', renk: '#0ea5e9', sorumlu: 'koordinator', tahmini_gun: 10,
        adimlar: [
          { adim_adi: 'Malzeme Talep', adim_kodu: 'malzeme_talep', tahmini_gun: 3 },
          { adim_adi: 'İş programı', adim_kodu: 'is_programi', tahmini_gun: 3 },
          { adim_adi: 'Tutanaklar', adim_kodu: 'tutanaklar', tahmini_gun: 4 },
        ]},
      { sira: 4, faz_adi: 'Uygulama', faz_kodu: 'uygulama', ikon: '🔧', renk: '#f59e0b', sorumlu: 'saha_muhendis', tahmini_gun: 30,
        adimlar: [
          { adim_adi: 'Yapım', adim_kodu: 'yapim', tahmini_gun: 30 },
        ]},
      { sira: 5, faz_adi: 'Hak Ediş', faz_kodu: 'hak_edis', ikon: '💰', renk: '#3b82f6', sorumlu: 'koordinator', tahmini_gun: 15,
        adimlar: [
          { adim_adi: 'Metraj', adim_kodu: 'metraj', tahmini_gun: 5 },
          { adim_adi: 'Hesap', adim_kodu: 'hesap', tahmini_gun: 5 },
          { adim_adi: 'Kurum Şablon', adim_kodu: 'kurum_sablon', tahmini_gun: 5 },
        ]},
      { sira: 6, faz_adi: 'Kabul', faz_kodu: 'kabul', ikon: '✅', renk: '#14b8a6', sorumlu: 'koordinator', tahmini_gun: 30,
        adimlar: [
          { adim_adi: 'Tutanaklar', adim_kodu: 'kabul_tutanaklar', tahmini_gun: 5 },
          { adim_adi: 'Geçici Kabul', adim_kodu: 'gecici_kabul', tahmini_gun: 10 },
          { adim_adi: 'Eksiklerin giderilmesi', adim_kodu: 'eksik_giderim', tahmini_gun: 7 },
          { adim_adi: 'GK tamamlama', adim_kodu: 'gk_tamamlama', tahmini_gun: 5 },
          { adim_adi: 'Teminatlar', adim_kodu: 'teminatlar', tahmini_gun: 3 },
        ]},
      { sira: 7, faz_adi: 'Tamamlanma', faz_kodu: 'tamamlanma', ikon: '🏁', renk: '#10b981', sorumlu: 'koordinator', tahmini_gun: 10,
        adimlar: [
          { adim_adi: 'Kesin Kabul', adim_kodu: 'kesin_kabul', tahmini_gun: 10 },
        ]},
    ];

    const fazStmt = db.prepare(`
      INSERT INTO is_tipi_fazlari (is_tipi_id, sira, faz_adi, faz_kodu, ikon, renk, sorumlu_rol_id, tahmini_gun)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const adimStmt = db.prepare(`
      INSERT INTO faz_adimlari (faz_id, sira, adim_adi, adim_kodu, tahmini_gun)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const faz of fazlar) {
      const pozId = getRolId(faz.sorumlu);
      const r = fazStmt.run(isTipiId, faz.sira, faz.faz_adi, faz.faz_kodu, faz.ikon, faz.renk, pozId, faz.tahmini_gun);
      const fazId = r.lastInsertRowid;
      for (let i = 0; i < faz.adimlar.length; i++) {
        const a = faz.adimlar[i];
        adimStmt.run(fazId, i + 1, a.adim_adi, a.adim_kodu, a.tahmini_gun);
      }
    }
  }

  isTipiTopluKaydet(id, { ad, aciklama, fazlar }) {
    const db = getDb();

    const updateTip = db.transaction(() => {
      // İş tipi bilgilerini güncelle
      db.prepare(`
        UPDATE is_tipleri SET ad = ?, aciklama = ?, guncelleme_tarihi = datetime('now') WHERE id = ?
      `).run(ad, aciklama || null, id);

      // proje_adimlari FK referanslarını NULL yap (proje adımları korunur, sadece şablon bağı kopar)
      const eskiFazIds = db.prepare('SELECT id FROM is_tipi_fazlari WHERE is_tipi_id = ?').all(id).map(r => r.id);
      if (eskiFazIds.length > 0) {
        const placeholders = eskiFazIds.map(() => '?').join(',');
        db.prepare(`UPDATE proje_adimlari SET faz_tanim_id = NULL WHERE faz_tanim_id IN (${placeholders})`).run(...eskiFazIds);
        const eskiAdimIds = db.prepare(`SELECT id FROM faz_adimlari WHERE faz_id IN (${placeholders})`).all(...eskiFazIds).map(r => r.id);
        if (eskiAdimIds.length > 0) {
          const adimPlaceholders = eskiAdimIds.map(() => '?').join(',');
          db.prepare(`UPDATE proje_adimlari SET adim_tanim_id = NULL WHERE adim_tanim_id IN (${adimPlaceholders})`).run(...eskiAdimIds);
        }
      }

      // Mevcut fazları ve adımları sil (CASCADE ile adımlar da silinir)
      db.prepare('DELETE FROM is_tipi_fazlari WHERE is_tipi_id = ?').run(id);

      // Yeni fazları ve adımları ekle
      if (fazlar && fazlar.length > 0) {
        const fazStmt = db.prepare(`
          INSERT INTO is_tipi_fazlari (is_tipi_id, sira, faz_adi, faz_kodu, ikon, renk, sorumlu_rol_id, tahmini_gun)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const adimStmt = db.prepare(`
          INSERT INTO faz_adimlari (faz_id, sira, adim_adi, adim_kodu, tahmini_gun)
          VALUES (?, ?, ?, ?, ?)
        `);

        for (const faz of fazlar) {
          const r = fazStmt.run(
            id, faz.sira, faz.faz_adi, faz.faz_kodu,
            faz.ikon || '📋', faz.renk || '#6b7280',
            faz.sorumlu_rol_id || null, faz.tahmini_gun || null
          );
          const fazId = r.lastInsertRowid;

          if (faz.adimlar && faz.adimlar.length > 0) {
            for (const a of faz.adimlar) {
              adimStmt.run(fazId, a.sira, a.adim_adi, a.adim_kodu, a.tahmini_gun || null);
            }
          }
        }
      }
    });

    updateTip();
    return this.isTipiGetir(id);
  }

  isTipiSil(id) {
    const db = getDb();
    db.prepare("UPDATE is_tipleri SET aktif = 0, guncelleme_tarihi = datetime('now') WHERE id = ?").run(id);
  }

  // ═══════════════════════════════════════════════
  // PROJE YAŞAM DÖNGÜSÜ
  // ═══════════════════════════════════════════════

  projeAdimAta(projeId, isTipiId) {
    const db = getDb();

    const mevcutSayi = db.prepare(
      'SELECT COUNT(*) as sayi FROM proje_adimlari WHERE proje_id = ?'
    ).get(projeId).sayi;

    if (mevcutSayi > 0) {
      throw new Error('Bu projenin zaten adımları var. Önce mevcut adımları silmeniz gerekir.');
    }

    const fazlar = this._fazlariGetir(isTipiId);
    if (fazlar.length === 0) {
      throw new Error('İş tipinde faz tanımlı değil');
    }

    const stmt = db.prepare(`
      INSERT INTO proje_adimlari (
        proje_id, faz_tanim_id, adim_tanim_id,
        sira_global, faz_sira, adim_sira,
        faz_adi, faz_kodu, adim_adi, adim_kodu,
        renk, ikon, tahmini_gun, durum,
        sorumlu_rol_id, sorumlu_kullanici_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bekliyor', ?, ?)
    `);

    let siraGlobal = 0;
    for (const faz of fazlar) {
      for (const adim of faz.adimlar) {
        siraGlobal++;
        stmt.run(
          projeId, faz.id, adim.id,
          siraGlobal, faz.sira, adim.sira,
          faz.faz_adi, faz.faz_kodu, adim.adim_adi, adim.adim_kodu,
          faz.renk, faz.ikon, adim.tahmini_gun,
          faz.sorumlu_rol_id || null, faz.sorumlu_kullanici_id || null
        );
      }
    }

    // İlk fazın kodunu proje durumu olarak ayarla
    const ilkFazKodu = fazlar[0]?.faz_kodu || 'baslama';
    db.prepare(`
      UPDATE projeler SET is_tipi_id = ?, durum = ?, guncelleme_tarihi = datetime('now') WHERE id = ?
    `).run(isTipiId, ilkFazKodu, projeId);

    return this.projeAdimGetir(projeId);
  }

  projeAdimGetir(projeId) {
    const db = getDb();
    const adimlar = db.prepare(`
      SELECT pa.*,
        r.rol_adi as sorumlu_rol_adi,
        (SELECT COUNT(*) FROM veri_paketleri vp WHERE vp.proje_adim_id = pa.id) as paket_sayisi,
        (SELECT COUNT(*) FROM dosyalar d WHERE d.proje_adim_id = pa.id AND d.durum = 'aktif') as dosya_sayisi
      FROM proje_adimlari pa
      LEFT JOIN roller r ON pa.sorumlu_rol_id = r.id
      WHERE pa.proje_id = ?
      ORDER BY pa.sira_global
    `).all(projeId);

    // Faz bazlı gruplama
    const fazMap = new Map();
    for (const adim of adimlar) {
      const key = `${adim.faz_sira}-${adim.faz_kodu}`;
      if (!fazMap.has(key)) {
        fazMap.set(key, {
          faz_sira: adim.faz_sira,
          faz_adi: adim.faz_adi,
          faz_kodu: adim.faz_kodu,
          renk: adim.renk,
          ikon: adim.ikon,
          sorumlu_rol_adi: adim.sorumlu_rol_adi,
          sorumlu_rol_id: adim.sorumlu_rol_id,
          adimlar: []
        });
      }
      fazMap.get(key).adimlar.push(adim);
    }

    return Array.from(fazMap.values());
  }

  projeIlerlemeFaz(projeId) {
    const db = getDb();
    const adimlar = db.prepare(`
      SELECT pa.*,
        (SELECT COUNT(*) FROM dosyalar d WHERE d.proje_adim_id = pa.id AND d.durum = 'aktif') as dosya_sayisi,
        (SELECT COUNT(*) FROM veri_paketleri vp WHERE vp.proje_adim_id = pa.id) as paket_sayisi
      FROM proje_adimlari pa WHERE pa.proje_id = ? ORDER BY pa.sira_global
    `).all(projeId);

    const toplam = adimlar.length;
    if (toplam === 0) return { yuzde: 0, aktif_faz: null, fazlar: [] };

    const tamamlanan = adimlar.filter(a => a.durum === 'tamamlandi').length;
    const atlanan = adimlar.filter(a => a.durum === 'atlandi').length;
    const devamEden = adimlar.find(a => a.durum === 'devam_ediyor');
    const yuzde = Math.round(((tamamlanan + atlanan) / toplam) * 100);

    // Faz bazlı ilerleme
    const fazIlerleme = new Map();
    for (const a of adimlar) {
      const key = a.faz_kodu;
      if (!fazIlerleme.has(key)) {
        fazIlerleme.set(key, { faz_adi: a.faz_adi, faz_kodu: a.faz_kodu, renk: a.renk, ikon: a.ikon, toplam: 0, tamamlanan: 0 });
      }
      const f = fazIlerleme.get(key);
      f.toplam++;
      if (a.durum === 'tamamlandi' || a.durum === 'atlandi') f.tamamlanan++;
    }

    return {
      yuzde,
      toplam_adim: toplam,
      tamamlanan,
      aktif_faz: devamEden ? devamEden.faz_adi : null,
      aktif_adim: devamEden ? devamEden.adim_adi : null,
      fazlar: Array.from(fazIlerleme.values()),
      adimlar,
    };
  }

  adimBaslat(adimId, { baslatanId } = {}) {
    const db = getDb();

    const adim = db.prepare('SELECT * FROM proje_adimlari WHERE id = ?').get(adimId);
    if (!adim) throw new Error('Adım bulunamadı');

    db.prepare(`
      UPDATE proje_adimlari SET
        durum = 'devam_ediyor',
        baslangic_tarihi = date('now'),
        baslatan_id = ?,
        guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(baslatanId || null, adimId);

    db.prepare(`
      UPDATE projeler SET aktif_adim_id = ?, durum = ?, guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(adimId, adim.faz_kodu, adim.proje_id);

    return db.prepare('SELECT * FROM proje_adimlari WHERE id = ?').get(adimId);
  }

  adimTamamla(adimId, { tamamlayanId, notu } = {}) {
    const db = getDb();

    const adim = db.prepare('SELECT * FROM proje_adimlari WHERE id = ?').get(adimId);
    if (!adim) throw new Error('Adım bulunamadı');

    db.prepare(`
      UPDATE proje_adimlari SET
        durum = 'tamamlandi',
        bitis_tarihi = date('now'),
        tamamlayan_id = ?,
        tamamlanma_notu = ?,
        guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(tamamlayanId || null, notu || null, adimId);

    // Sonraki bekleyen adımı bul
    const sonraki = db.prepare(`
      SELECT id, faz_kodu FROM proje_adimlari
      WHERE proje_id = ? AND sira_global > ? AND durum = 'bekliyor'
      ORDER BY sira_global LIMIT 1
    `).get(adim.proje_id, adim.sira_global);

    if (sonraki) {
      db.prepare(`
        UPDATE projeler SET aktif_adim_id = ?, durum = ?, guncelleme_tarihi = datetime('now')
        WHERE id = ?
      `).run(sonraki.id, sonraki.faz_kodu, adim.proje_id);
    } else {
      db.prepare(`
        UPDATE projeler SET aktif_adim_id = NULL, durum = 'tamamlandi', tamamlanma_yuzdesi = 100, gerceklesen_bitis = date('now'), guncelleme_tarihi = datetime('now')
        WHERE id = ?
      `).run(adim.proje_id);
    }

    return {
      tamamlanan: db.prepare('SELECT * FROM proje_adimlari WHERE id = ?').get(adimId),
      sonraki_adim: sonraki ? db.prepare('SELECT * FROM proje_adimlari WHERE id = ?').get(sonraki.id) : null,
      tum_tamamlandi: !sonraki
    };
  }

  adimAtla(adimId, { notu } = {}) {
    const db = getDb();
    db.prepare(`
      UPDATE proje_adimlari SET
        durum = 'atlandi',
        tamamlanma_notu = ?,
        guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(notu || 'Adım atlandı', adimId);
  }

  // Aktif adım ID getir (veri paketi entegrasyonu için)
  aktifAdimIdGetir(projeId) {
    if (!projeId) return null;
    const db = getDb();
    const adim = db.prepare(`
      SELECT id FROM proje_adimlari
      WHERE proje_id = ? AND durum = 'devam_ediyor'
      ORDER BY sira_global LIMIT 1
    `).get(projeId);
    return adim?.id || null;
  }
}

module.exports = new FazService();
