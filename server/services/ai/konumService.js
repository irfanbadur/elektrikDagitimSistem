const { getDb } = require('../../db/database');

class KonumService {

  /**
   * GPS konumuna en yakın direği bul
   * Equirectangular approximation ile mesafe hesaplar.
   *
   * @param {number} lat
   * @param {number} lon
   * @param {number} [projeId] — Belirli projeyle sınırla
   * @param {number} [maxMesafe=50] — Metre cinsinden max mesafe
   * @returns {{ direk, mesafe, tahminGuven }} veya null
   */
  enYakinDirekBul(lat, lon, projeId = null, maxMesafe = 50) {
    const db = getDb();

    const direkler = db.prepare(`
      SELECT dk.*,
        p.proje_no, p.musteri_adi
      FROM direk_kayitlar dk
      JOIN projeler p ON p.id = dk.proje_id
      WHERE dk.konum_lat IS NOT NULL AND dk.konum_lon IS NOT NULL
      ${projeId ? 'AND dk.proje_id = ?' : ''}
    `).all(projeId ? [projeId] : []);

    if (direkler.length === 0) return null;

    // Equirectangular approximation (küçük mesafelerde yeterli)
    let enYakin = null;
    let enKucukMesafe = Infinity;

    for (const d of direkler) {
      const dLat = (d.konum_lat - lat) * 111320;
      const dLon = (d.konum_lon - lon) * 111320 * Math.cos(lat * Math.PI / 180);
      const mesafe = Math.sqrt(dLat * dLat + dLon * dLon);

      if (mesafe < enKucukMesafe) {
        enKucukMesafe = mesafe;
        enYakin = d;
      }
    }

    if (enKucukMesafe > maxMesafe) return null;

    const tahminGuven = Math.max(0, Math.min(1, 1 - (enKucukMesafe / maxMesafe)));

    return {
      direk: enYakin,
      mesafe: Math.round(enKucukMesafe * 10) / 10,
      tahminGuven: Math.round(tahminGuven * 100) / 100,
    };
  }

  /**
   * Projenin tüm direklerini konumlarıyla getir
   */
  projeDirekleriniGetir(projeId) {
    return getDb().prepare(`
      SELECT dk.*,
        (SELECT COUNT(*) FROM direk_fotograflar df WHERE df.direk_kayit_id = dk.id) as foto_sayisi,
        (SELECT COUNT(*) FROM saha_tespitler st WHERE st.direk_kayit_id = dk.id AND st.durum = 'acik') as acik_tespit_sayisi
      FROM direk_kayitlar dk
      WHERE dk.proje_id = ?
      ORDER BY dk.direk_no
    `).all(projeId);
  }

  /**
   * Projenin genel ilerleme özeti
   */
  projeIlerlemeOzeti(projeId) {
    const db = getDb();
    const toplam = db.prepare('SELECT COUNT(*) as c FROM direk_kayitlar WHERE proje_id = ?').get(projeId);
    const tamamlanan = db.prepare("SELECT COUNT(*) as c FROM direk_kayitlar WHERE proje_id = ? AND durum = 'tamamlandi'").get(projeId);
    const sorunlu = db.prepare("SELECT COUNT(*) as c FROM direk_kayitlar WHERE proje_id = ? AND durum = 'sorunlu'").get(projeId);
    const acikTespitler = db.prepare("SELECT COUNT(*) as c FROM saha_tespitler WHERE proje_id = ? AND durum = 'acik'").get(projeId);

    return {
      toplamDirek: toplam.c,
      tamamlanan: tamamlanan.c,
      sorunlu: sorunlu.c,
      ilerlemYuzde: toplam.c > 0 ? Math.round((tamamlanan.c / toplam.c) * 100) : 0,
      acikTespitler: acikTespitler.c,
    };
  }
}

module.exports = new KonumService();
