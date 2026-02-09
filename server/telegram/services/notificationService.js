const { getDb } = require('../../db/database');
const config = require('../config');

class NotificationService {
  async notifyCoordinator(bot, message) {
    const db = getDb();
    const row = db.prepare(
      "SELECT deger FROM firma_ayarlari WHERE anahtar = 'koordinator_telegram_id'"
    ).get();
    const koordinatorId = row?.deger;
    if (koordinatorId && bot) {
      try {
        await bot.sendMessage(koordinatorId, message, { parse_mode: 'HTML' });
      } catch (err) {
        console.error('Koordinator bildirim hatasi:', err.message);
      }
    }
  }

  async notifyTeamLead(bot, ekipId, message) {
    const db = getDb();
    const ekipBasi = db.prepare(`
      SELECT tk.telegram_id
      FROM personel p
      JOIN telegram_kullanicilar tk ON tk.personel_id = p.id
      WHERE p.ekip_id = ? AND p.gorev = 'ekip_basi' AND tk.aktif = 1
    `).get(ekipId);
    if (ekipBasi?.telegram_id && bot) {
      try {
        await bot.sendMessage(ekipBasi.telegram_id, message, { parse_mode: 'HTML' });
      } catch (err) {
        console.error('Ekip basi bildirim hatasi:', err.message);
      }
    }
  }
}

module.exports = new NotificationService();
