const registrationService = require('../services/registrationService');
const dataBundleService = require('../services/dataBundleService');
const messages = require('../utils/messages');
const { getDb } = require('../../db/database');

class LocationHandler {
  async handleLocation(bot, msg) {
    const telegramId = String(msg.from.id);
    const chatId = msg.chat.id;

    const auth = registrationService.authenticate(telegramId);
    if (!auth.authenticated) {
      return bot.sendMessage(chatId, messages.notRegistered);
    }

    const { user } = auth;
    const { latitude, longitude } = msg.location;

    // Aktif paket varsa konumu ekle
    const activeBundle = dataBundleService.getActiveBundle(user.personel_id);
    if (activeBundle) {
      dataBundleService.updateLocation(activeBundle.id, latitude, longitude);
      await bot.sendMessage(chatId,
        `Konum kaydedildi: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}\nPaket: ${activeBundle.paket_no}`
      );
    } else {
      // Paket yoksa yeni bir paket oluşturup konumu ekle
      const bundle = dataBundleService.createBundle({
        paketTipi: 'diger',
        personelId: user.personel_id,
        ekipId: user.ekip_id || null,
        projeId: null,
        bolgeId: null,
        notlar: null
      });
      dataBundleService.updateLocation(bundle.id, latitude, longitude);
      await bot.sendMessage(chatId,
        `Konum kaydedildi: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}\nYeni paket olusturuldu: ${bundle.paket_no}`
      );
    }

    // Logla
    const db = getDb();
    db.prepare(`INSERT INTO telegram_mesaj_log (telegram_id, mesaj_tipi, yon, ham_mesaj, islem_durumu) VALUES (?, 'location', 'gelen', ?, 'islendi')`).run(telegramId, JSON.stringify({ latitude, longitude }));
  }
}

module.exports = new LocationHandler();
