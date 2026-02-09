const { getDb } = require('../../db/database');

class AnalysisService {
  async saveAnalysis({ medyaId, veriPaketiId, katman, analizTipi, sonuc, aiProvider, aiModel, suresi }) {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO foto_analiz (
        medya_id, veri_paketi_id, analiz_katmani, ai_saglayici, ai_model,
        analiz_tipi, genel_aciklama, guven_skoru, isleme_suresi_ms,
        tespit_edilen_nesneler, hasar_tespit, direk_durumu
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      medyaId,
      veriPaketiId || null,
      katman,
      aiProvider || (katman <= 2 ? 'ollama' : 'claude'),
      aiModel || null,
      analizTipi,
      sonuc.genel_aciklama || sonuc.analiz_notlari || null,
      sonuc.guven_skoru || null,
      suresi || null,
      sonuc.ekipmanlar ? JSON.stringify(sonuc.ekipmanlar) : (sonuc.tespit_edilen_nesneler ? JSON.stringify(sonuc.tespit_edilen_nesneler) : null),
      sonuc.hasar_tespiti ? JSON.stringify(sonuc.hasar_tespiti) : (sonuc.hasarlar ? JSON.stringify(sonuc) : null),
      sonuc.direk_bilgisi ? JSON.stringify(sonuc.direk_bilgisi) : null
    );

    const analizId = result.lastInsertRowid;

    if (sonuc.ekipmanlar && Array.isArray(sonuc.ekipmanlar)) {
      for (const ekipman of sonuc.ekipmanlar) {
        let katalogId = null;
        if (ekipman.eslesen_katalog_kodu) {
          const katalog = db.prepare(
            'SELECT id FROM ekipman_katalogu WHERE ekipman_kodu = ?'
          ).get(ekipman.eslesen_katalog_kodu);
          katalogId = katalog?.id || null;
        }
        db.prepare(`
          INSERT INTO analiz_ekipman_eslesmesi
            (foto_analiz_id, ekipman_katalog_id, nesne_tipi, tespit_detay, miktar, guven_skoru)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          analizId,
          katalogId,
          ekipman.kategori || ekipman.nesne || 'bilinmiyor',
          `${ekipman.tip || ''} ${ekipman.alt_tip || ''}`.trim(),
          ekipman.miktar || 1,
          (ekipman.guven_yuzdesi || 0) / 100
        );
      }
    }

    if (sonuc.toplam_malzeme_ozeti && Array.isArray(sonuc.toplam_malzeme_ozeti)) {
      for (const mlz of sonuc.toplam_malzeme_ozeti) {
        const katalog = db.prepare(
          'SELECT id FROM ekipman_katalogu WHERE ekipman_adi LIKE ?'
        ).get(`%${mlz.malzeme}%`);
        db.prepare(`
          INSERT INTO analiz_ekipman_eslesmesi
            (foto_analiz_id, ekipman_katalog_id, nesne_tipi, tespit_detay, miktar, guven_skoru)
          VALUES (?, ?, 'malzeme_ozeti', ?, ?, ?)
        `).run(
          analizId,
          katalog?.id || null,
          mlz.malzeme,
          mlz.miktar,
          sonuc.guven_skoru || null
        );
      }
    }

    return analizId;
  }

  async getRelevantCatalog(kategori = null) {
    const db = getDb();
    if (kategori) {
      return db.prepare(
        'SELECT * FROM ekipman_katalogu WHERE kategori = ? AND aktif = 1'
      ).all(kategori);
    }
    return db.prepare(
      'SELECT * FROM ekipman_katalogu WHERE aktif = 1 ORDER BY kategori'
    ).all();
  }

  getAnalysesByMedia(medyaId) {
    const db = getDb();
    return db.prepare(`
      SELECT fa.*,
        (SELECT COUNT(*) FROM analiz_ekipman_eslesmesi WHERE foto_analiz_id = fa.id) as eslesmis_ekipman_sayisi
      FROM foto_analiz fa
      WHERE fa.medya_id = ?
      ORDER BY fa.analiz_katmani, fa.olusturma_tarihi DESC
    `).all(medyaId);
  }

  getEquipmentMatches(analizId) {
    const db = getDb();
    return db.prepare(`
      SELECT ae.*, ek.ekipman_kodu, ek.ekipman_adi, ek.kategori as katalog_kategori
      FROM analiz_ekipman_eslesmesi ae
      LEFT JOIN ekipman_katalogu ek ON ae.ekipman_katalog_id = ek.id
      WHERE ae.foto_analiz_id = ?
    `).all(analizId);
  }

  approveAnalysis(analizId, personelId, durum, duzeltmeNotlari = null) {
    const db = getDb();
    db.prepare(`
      UPDATE foto_analiz
      SET onay_durumu = ?, onaylayan_personel_id = ?, onay_tarihi = CURRENT_TIMESTAMP,
          duzeltme_notlari = ?
      WHERE id = ?
    `).run(durum, personelId, duzeltmeNotlari, analizId);
  }

  correctEquipmentMatch(eslesmeId, duzeltmeNotu, dogruKatalogId = null) {
    const db = getDb();
    db.prepare(`
      UPDATE analiz_ekipman_eslesmesi
      SET onay_durumu = 'duzeltildi', duzeltme_notu = ?,
          ekipman_katalog_id = COALESCE(?, ekipman_katalog_id)
      WHERE id = ?
    `).run(duzeltmeNotu, dogruKatalogId, eslesmeId);
  }

  getAccuracyStats() {
    const db = getDb();
    return db.prepare(`
      SELECT
        analiz_katmani,
        COUNT(*) as toplam,
        SUM(CASE WHEN onay_durumu = 'onaylandi' THEN 1 ELSE 0 END) as onaylanan,
        SUM(CASE WHEN onay_durumu = 'duzeltildi' THEN 1 ELSE 0 END) as duzeltilen,
        ROUND(AVG(guven_skoru), 2) as ort_guven
      FROM foto_analiz
      WHERE onay_durumu != 'beklemede'
      GROUP BY analiz_katmani
    `).all();
  }
}

module.exports = new AnalysisService();
