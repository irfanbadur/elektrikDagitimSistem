const { getDb } = require('../db/database');

class DonguService {

  // ═══════════════════════════════════════════════
  // ŞABLON YÖNETİMİ
  // ═══════════════════════════════════════════════

  sablonlariListele() {
    const db = getDb();
    const sablonlar = db.prepare(`
      SELECT * FROM dongu_sablonlari WHERE durum = 'aktif' ORDER BY sablon_adi
    `).all();

    return sablonlar.map(s => ({
      ...s,
      asamalar: db.prepare(`
        SELECT * FROM dongu_sablon_asamalari
        WHERE sablon_id = ? ORDER BY sira
      `).all(s.id)
    }));
  }

  sablonGetir(sablonId) {
    const db = getDb();
    const sablon = db.prepare('SELECT * FROM dongu_sablonlari WHERE id = ?').get(sablonId);
    if (!sablon) return null;

    sablon.asamalar = db.prepare(`
      SELECT * FROM dongu_sablon_asamalari
      WHERE sablon_id = ? ORDER BY sira
    `).all(sablonId);

    return sablon;
  }

  sablonOlustur({ sablonAdi, sablonKodu, aciklama, olusturanId, asamalar }) {
    const db = getDb();

    const result = db.prepare(`
      INSERT INTO dongu_sablonlari (sablon_adi, sablon_kodu, aciklama, olusturan_id)
      VALUES (?, ?, ?, ?)
    `).run(sablonAdi, sablonKodu.toUpperCase(), aciklama, olusturanId);

    const sablonId = result.lastInsertRowid;

    const stmt = db.prepare(`
      INSERT INTO dongu_sablon_asamalari
        (sablon_id, sira, asama_adi, asama_kodu, renk, ikon, aciklama, tahmini_gun)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const a of asamalar) {
      stmt.run(
        sablonId, a.sira, a.asama_adi, a.asama_kodu,
        a.renk || '#6b7280', a.ikon || '📋',
        a.aciklama || null, a.tahmini_gun || null
      );
    }

    return this.sablonGetir(sablonId);
  }

  sablonGuncelle(sablonId, { sablonAdi, aciklama, asamalar }) {
    const db = getDb();

    if (sablonAdi || aciklama !== undefined) {
      const updates = [];
      const params = [];
      if (sablonAdi) { updates.push('sablon_adi = ?'); params.push(sablonAdi); }
      if (aciklama !== undefined) { updates.push('aciklama = ?'); params.push(aciklama); }
      updates.push("guncelleme_tarihi = datetime('now')");
      params.push(sablonId);
      db.prepare(`UPDATE dongu_sablonlari SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    if (asamalar && asamalar.length > 0) {
      db.prepare('DELETE FROM dongu_sablon_asamalari WHERE sablon_id = ?').run(sablonId);

      const stmt = db.prepare(`
        INSERT INTO dongu_sablon_asamalari
          (sablon_id, sira, asama_adi, asama_kodu, renk, ikon, aciklama, tahmini_gun)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const a of asamalar) {
        stmt.run(
          sablonId, a.sira, a.asama_adi, a.asama_kodu,
          a.renk || '#6b7280', a.ikon || '📋',
          a.aciklama || null, a.tahmini_gun || null
        );
      }
    }

    return this.sablonGetir(sablonId);
  }

  // ═══════════════════════════════════════════════
  // PROJE AŞAMA YÖNETİMİ
  // ═══════════════════════════════════════════════

  projeDonguAta(projeId, sablonId) {
    const db = getDb();

    const sablonAsamalar = db.prepare(`
      SELECT * FROM dongu_sablon_asamalari
      WHERE sablon_id = ? ORDER BY sira
    `).all(sablonId);

    if (sablonAsamalar.length === 0) {
      throw new Error('Şablonda aşama tanımlı değil');
    }

    const mevcutSayi = db.prepare(
      'SELECT COUNT(*) as sayi FROM proje_asamalari WHERE proje_id = ?'
    ).get(projeId).sayi;

    if (mevcutSayi > 0) {
      throw new Error('Bu projenin zaten aşamaları var. Önce mevcut aşamaları silmeniz gerekir.');
    }

    const stmt = db.prepare(`
      INSERT INTO proje_asamalari (
        proje_id, sablon_asama_id, sira, asama_adi, asama_kodu,
        renk, ikon, tahmini_gun, durum
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'bekliyor')
    `);

    for (const a of sablonAsamalar) {
      stmt.run(projeId, a.id, a.sira, a.asama_adi, a.asama_kodu, a.renk, a.ikon, a.tahmini_gun);
    }

    db.prepare(`
      UPDATE projeler SET dongu_sablon_id = ?, guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(sablonId, projeId);

    return this.projeAsamalariGetir(projeId);
  }

  projeDonguSil(projeId) {
    const db = getDb();
    db.prepare('DELETE FROM proje_asamalari WHERE proje_id = ?').run(projeId);
    db.prepare(`
      UPDATE projeler SET dongu_sablon_id = NULL, aktif_asama_id = NULL, guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(projeId);
  }

  projeAsamalariGetir(projeId) {
    const db = getDb();
    return db.prepare(`
      SELECT pa.*,
        (SELECT COUNT(*) FROM veri_paketleri vp WHERE vp.proje_asama_id = pa.id) as paket_sayisi,
        (SELECT COUNT(*) FROM dosyalar d WHERE d.proje_asama_id = pa.id AND d.durum = 'aktif') as dosya_sayisi
      FROM proje_asamalari pa
      WHERE pa.proje_id = ?
      ORDER BY pa.sira
    `).all(projeId);
  }

  aktifAsamaGetir(projeId) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM proje_asamalari
      WHERE proje_id = ? AND durum = 'devam_ediyor'
      ORDER BY sira
      LIMIT 1
    `).get(projeId);
  }

  asamaBaslat(asamaId, { baslatanId, notlar } = {}) {
    const db = getDb();

    const asama = db.prepare('SELECT * FROM proje_asamalari WHERE id = ?').get(asamaId);
    if (!asama) throw new Error('Aşama bulunamadı');

    const devamEden = db.prepare(`
      SELECT * FROM proje_asamalari
      WHERE proje_id = ? AND durum = 'devam_ediyor' AND sira < ?
    `).get(asama.proje_id, asama.sira);

    db.prepare(`
      UPDATE proje_asamalari SET
        durum = 'devam_ediyor',
        baslangic_tarihi = date('now'),
        baslatan_id = ?,
        notlar = CASE WHEN ? IS NOT NULL THEN COALESCE(notlar || char(10), '') || ? ELSE notlar END,
        guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(baslatanId || null, notlar || null, notlar || null, asamaId);

    db.prepare(`
      UPDATE projeler SET aktif_asama_id = ?, guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(asamaId, asama.proje_id);

    return {
      asama: db.prepare('SELECT * FROM proje_asamalari WHERE id = ?').get(asamaId),
      uyari: devamEden ? `"${devamEden.asama_adi}" aşaması henüz tamamlanmamış.` : null
    };
  }

  asamaTamamla(asamaId, { tamamlayanId, tamamlanmaNotu } = {}) {
    const db = getDb();

    const asama = db.prepare('SELECT * FROM proje_asamalari WHERE id = ?').get(asamaId);
    if (!asama) throw new Error('Aşama bulunamadı');

    db.prepare(`
      UPDATE proje_asamalari SET
        durum = 'tamamlandi',
        bitis_tarihi = date('now'),
        tamamlayan_id = ?,
        tamamlanma_notu = ?,
        guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(tamamlayanId || null, tamamlanmaNotu || null, asamaId);

    const sonraki = db.prepare(`
      SELECT id FROM proje_asamalari
      WHERE proje_id = ? AND sira > ? AND durum = 'bekliyor'
      ORDER BY sira LIMIT 1
    `).get(asama.proje_id, asama.sira);

    if (sonraki) {
      db.prepare(`
        UPDATE projeler SET aktif_asama_id = ?, guncelleme_tarihi = datetime('now')
        WHERE id = ?
      `).run(sonraki.id, asama.proje_id);
    } else {
      db.prepare(`
        UPDATE projeler SET aktif_asama_id = NULL, guncelleme_tarihi = datetime('now')
        WHERE id = ?
      `).run(asama.proje_id);
    }

    return {
      tamamlanan: db.prepare('SELECT * FROM proje_asamalari WHERE id = ?').get(asamaId),
      sonraki_asama: sonraki
        ? db.prepare('SELECT * FROM proje_asamalari WHERE id = ?').get(sonraki.id)
        : null,
      tum_tamamlandi: !sonraki
    };
  }

  asamaAtla(asamaId, { notu } = {}) {
    const db = getDb();
    db.prepare(`
      UPDATE proje_asamalari SET
        durum = 'atlandi',
        tamamlanma_notu = ?,
        guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(notu || 'Aşama atlandı', asamaId);
  }

  asamaTarihGuncelle(asamaId, { planBas, planBit, gercekBas, gercekBit }) {
    const db = getDb();
    const updates = [];
    const params = [];

    if (planBas !== undefined) { updates.push('planlanan_baslangic = ?'); params.push(planBas); }
    if (planBit !== undefined) { updates.push('planlanan_bitis = ?'); params.push(planBit); }
    if (gercekBas !== undefined) { updates.push('baslangic_tarihi = ?'); params.push(gercekBas); }
    if (gercekBit !== undefined) { updates.push('bitis_tarihi = ?'); params.push(gercekBit); }

    if (updates.length === 0) return;

    updates.push("guncelleme_tarihi = datetime('now')");
    params.push(asamaId);

    db.prepare(`UPDATE proje_asamalari SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  // ═══════════════════════════════════════════════
  // VERİ PAKETİ + DOSYA ENTEGRASYONU
  // ═══════════════════════════════════════════════

  aktifAsamaIdGetir(projeId) {
    if (!projeId) return null;

    const db = getDb();
    const asama = db.prepare(`
      SELECT id FROM proje_asamalari
      WHERE proje_id = ? AND durum = 'devam_ediyor'
      ORDER BY sira LIMIT 1
    `).get(projeId);

    return asama?.id || null;
  }

  // ═══════════════════════════════════════════════
  // PROJE İLERLEME HESAPLAMA
  // ═══════════════════════════════════════════════

  projeIlerleme(projeId) {
    const asamalar = this.projeAsamalariGetir(projeId);

    const toplam = asamalar.length;
    if (toplam === 0) return { yuzde: 0, aktif: null, asamalar: [] };

    const tamamlanan = asamalar.filter(a => a.durum === 'tamamlandi').length;
    const atlanan = asamalar.filter(a => a.durum === 'atlandi').length;
    const devamEden = asamalar.find(a => a.durum === 'devam_ediyor');

    const yuzde = Math.round(((tamamlanan + atlanan) / toplam) * 100);

    const bugun = new Date().toISOString().slice(0, 10);
    const gecikenler = asamalar.filter(a => {
      return a.durum === 'devam_ediyor' && a.planlanan_bitis && a.planlanan_bitis < bugun;
    });

    return {
      yuzde,
      toplam_asama: toplam,
      tamamlanan,
      devam_eden: devamEden ? devamEden.asama_adi : null,
      aktif_asama: devamEden || null,
      geciken_asamalar: gecikenler,
      asamalar,
    };
  }
}

module.exports = new DonguService();
