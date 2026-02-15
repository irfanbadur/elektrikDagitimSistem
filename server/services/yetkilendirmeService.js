const { getDb } = require('../db/database');

class YetkilendirmeService {

  /**
   * Kullanıcının tüm izinlerini getir (tüm rollerinden birleştirilmiş)
   */
  kullaniciIzinleri(kullaniciId) {
    const db = getDb();
    return db.prepare(`
      SELECT DISTINCT
        i.modul,
        i.aksiyon,
        ri.veri_kapsami
      FROM kullanici_rolleri kr
      JOIN rol_izinleri ri ON kr.rol_id = ri.rol_id
      JOIN izinler i ON ri.izin_id = i.id
      JOIN roller r ON kr.rol_id = r.id
      WHERE kr.kullanici_id = ? AND r.durum = 'aktif'
    `).all(kullaniciId);
  }

  /**
   * Kullanıcının rollerini getir
   */
  kullaniciRolleri(kullaniciId) {
    const db = getDb();
    return db.prepare(`
      SELECT r.* FROM roller r
      JOIN kullanici_rolleri kr ON r.id = kr.rol_id
      WHERE kr.kullanici_id = ? AND r.durum = 'aktif'
      ORDER BY r.seviye DESC
    `).all(kullaniciId);
  }

  /**
   * Kullanıcının belirli bir izne sahip olup olmadığını kontrol et
   * @returns { izinVar: boolean, kapsam: string }
   */
  izinKontrol(kullaniciId, modul, aksiyon) {
    const db = getDb();

    const izin = db.prepare(`
      SELECT ri.veri_kapsami FROM kullanici_rolleri kr
      JOIN rol_izinleri ri ON kr.rol_id = ri.rol_id
      JOIN izinler i ON ri.izin_id = i.id
      JOIN roller r ON kr.rol_id = r.id
      WHERE kr.kullanici_id = ?
        AND r.durum = 'aktif'
        AND i.modul = ?
        AND (i.aksiyon = ? OR i.aksiyon = 'tam')
      ORDER BY
        CASE ri.veri_kapsami
          WHEN 'tum' THEN 1
          WHEN 'kendi_santiye' THEN 2
          WHEN 'kendi_ekip' THEN 3
          WHEN 'kendi' THEN 4
        END
      LIMIT 1
    `).get(kullaniciId, modul, aksiyon);

    return {
      izinVar: !!izin,
      kapsam: izin?.veri_kapsami || null,
    };
  }

  /**
   * Kullanıcının tüm izinlerini yapılandırılmış nesne olarak döndür
   */
  izinHaritasi(kullaniciId) {
    const izinler = this.kullaniciIzinleri(kullaniciId);
    const harita = {};

    for (const izin of izinler) {
      if (!harita[izin.modul]) harita[izin.modul] = {};

      const mevcutKapsam = harita[izin.modul][izin.aksiyon];
      if (!mevcutKapsam || kapsamOncelik(izin.veri_kapsami) < kapsamOncelik(mevcutKapsam)) {
        harita[izin.modul][izin.aksiyon] = izin.veri_kapsami;
      }
    }

    return harita;
  }

  /**
   * Kullanıcının en yüksek rol seviyesini döndür
   */
  enYuksekSeviye(kullaniciId) {
    const db = getDb();
    const row = db.prepare(`
      SELECT MAX(r.seviye) as max_seviye FROM roller r
      JOIN kullanici_rolleri kr ON r.id = kr.rol_id
      WHERE kr.kullanici_id = ? AND r.durum = 'aktif'
    `).get(kullaniciId);
    return row?.max_seviye || 0;
  }
}

function kapsamOncelik(kapsam) {
  const oncelikler = { tum: 1, kendi_santiye: 2, kendi_ekip: 3, kendi: 4 };
  return oncelikler[kapsam] || 5;
}

module.exports = new YetkilendirmeService();
