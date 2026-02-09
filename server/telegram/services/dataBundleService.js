const { getDb } = require('../../db/database');
const config = require('../config');

class DataBundleService {
  getActiveBundle(personelId) {
    const db = getDb();
    const timeout = config.dataBundle.autoCompleteMinutes;
    return db.prepare(`
      SELECT * FROM veri_paketleri
      WHERE personel_id = ?
        AND durum = 'devam_ediyor'
        AND datetime(olusturma_tarihi, '+${timeout} minutes') > datetime('now')
      ORDER BY olusturma_tarihi DESC
      LIMIT 1
    `).get(personelId);
  }

  createBundle({ paketTipi, personelId, ekipId, projeId, bolgeId, notlar }) {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO veri_paketleri
        (paket_tipi, personel_id, ekip_id, proje_id, bolge_id, notlar, durum)
      VALUES (?, ?, ?, ?, ?, ?, 'devam_ediyor')
    `).run(paketTipi, personelId, ekipId, projeId, bolgeId, notlar);
    return this.getBundleById(result.lastInsertRowid);
  }

  completeBundle(bundleId) {
    const db = getDb();

    // Eğer paketin konumu yoksa, medya kayıtlarından ilk GPS koordinatını al
    const bundle = this.getBundleById(bundleId);
    if (!bundle.latitude || !bundle.longitude) {
      const medyaWithGps = db.prepare(`
        SELECT latitude, longitude FROM medya
        WHERE veri_paketi_id = ? AND latitude IS NOT NULL AND longitude IS NOT NULL
        ORDER BY yukleme_tarihi ASC
        LIMIT 1
      `).get(bundleId);

      if (medyaWithGps) {
        db.prepare(`
          UPDATE veri_paketleri SET latitude = ?, longitude = ? WHERE id = ?
        `).run(medyaWithGps.latitude, medyaWithGps.longitude, bundleId);
      }
    }

    db.prepare(`
      UPDATE veri_paketleri
      SET durum = 'tamamlandi', tamamlanma_zamani = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(bundleId);
    return this.getBundleById(bundleId);
  }

  appendNote(bundleId, note) {
    const db = getDb();
    const bundle = this.getBundleById(bundleId);
    const existingNotes = bundle.notlar ? bundle.notlar + '\n' : '';
    db.prepare(`
      UPDATE veri_paketleri SET notlar = ? WHERE id = ?
    `).run(existingNotes + note, bundleId);
  }

  updateLocation(bundleId, latitude, longitude) {
    const db = getDb();
    db.prepare(`
      UPDATE veri_paketleri
      SET latitude = ?, longitude = ?
      WHERE id = ?
    `).run(latitude, longitude, bundleId);
  }

  getBundleById(bundleId) {
    const db = getDb();
    const bundle = db.prepare('SELECT * FROM veri_paketleri WHERE id = ?').get(bundleId);
    if (bundle) {
      bundle.medyalar = db.prepare(
        'SELECT * FROM medya WHERE veri_paketi_id = ? ORDER BY yukleme_tarihi'
      ).all(bundleId);
    }
    return bundle;
  }

  autoCompleteExpiredBundles() {
    const db = getDb();
    const timeout = config.dataBundle.autoCompleteMinutes;
    const expired = db.prepare(`
      SELECT * FROM veri_paketleri
      WHERE durum = 'devam_ediyor'
        AND datetime(olusturma_tarihi, '+${timeout} minutes') <= datetime('now')
    `).all();
    for (const bundle of expired) {
      this.completeBundle(bundle.id);
    }
    return expired;
  }

  getBundlesByPersonel(personelId, tarih = null) {
    const db = getDb();
    if (tarih) {
      return db.prepare(`
        SELECT * FROM veri_paketleri
        WHERE personel_id = ? AND date(olusturma_tarihi) = ?
        ORDER BY olusturma_tarihi DESC
      `).all(personelId, tarih);
    }
    return db.prepare(`
      SELECT * FROM veri_paketleri
      WHERE personel_id = ?
      ORDER BY olusturma_tarihi DESC
      LIMIT 20
    `).all(personelId);
  }
}

module.exports = new DataBundleService();
