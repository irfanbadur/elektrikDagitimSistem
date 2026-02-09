const { getDb } = require('../../db/database');

class RegistrationService {
  findByTelegramId(telegramId) {
    const db = getDb();
    return db.prepare(`
      SELECT tk.*, p.ad_soyad, p.gorev, e.ekip_adi, e.ekip_kodu, p.ekip_id
      FROM telegram_kullanicilar tk
      LEFT JOIN personel p ON tk.personel_id = p.id
      LEFT JOIN ekipler e ON p.ekip_id = e.id
      WHERE tk.telegram_id = ? AND tk.aktif = 1
    `).get(String(telegramId));
  }

  searchPersonel(adSoyad) {
    const db = getDb();
    return db.prepare(`
      SELECT p.*, e.ekip_adi
      FROM personel p
      LEFT JOIN ekipler e ON p.ekip_id = e.id
      WHERE p.ad_soyad LIKE ? AND p.aktif = 1
    `).all(`%${adSoyad}%`);
  }

  registerUser(telegramId, telegramUsername, telegramName, personelId) {
    const db = getDb();
    return db.prepare(`
      INSERT INTO telegram_kullanicilar
        (telegram_id, telegram_kullanici_adi, telegram_ad, personel_id)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(telegram_id) DO UPDATE SET
        personel_id = excluded.personel_id,
        telegram_kullanici_adi = excluded.telegram_kullanici_adi,
        telegram_ad = excluded.telegram_ad
    `).run(String(telegramId), telegramUsername, telegramName, personelId);
  }

  updateLastMessage(telegramId) {
    const db = getDb();
    db.prepare(`
      UPDATE telegram_kullanicilar
      SET son_mesaj_tarihi = CURRENT_TIMESTAMP
      WHERE telegram_id = ?
    `).run(String(telegramId));
  }

  authenticate(telegramId) {
    const user = this.findByTelegramId(telegramId);
    if (!user) return { authenticated: false, reason: 'not_registered' };
    if (!user.personel_id) return { authenticated: false, reason: 'not_linked' };
    this.updateLastMessage(telegramId);
    return { authenticated: true, user };
  }
}

module.exports = new RegistrationService();
