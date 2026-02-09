const registrationService = require('../services/registrationService');
const messages = require('../utils/messages');

class CallbackHandler {
  async handle(bot, query) {
    const data = query.data;
    const chatId = query.message.chat.id;
    const telegramId = String(query.from.id);

    // Kayıt seçimi callback'i
    if (data.startsWith('reg_')) {
      const personelId = parseInt(data.replace('reg_', ''));
      registrationService.registerUser(
        telegramId,
        query.from.username || null,
        `${query.from.first_name || ''} ${query.from.last_name || ''}`.trim(),
        personelId
      );

      const user = registrationService.findByTelegramId(telegramId);
      await bot.answerCallbackQuery(query.id, { text: 'Kayit basarili!' });
      await bot.sendMessage(chatId,
        messages.registrationSuccess(user.ad_soyad, user.ekip_adi || 'Ekip atanmamis'),
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Analiz talep callback'i
    if (data.startsWith('analyze_')) {
      const mediaId = parseInt(data.replace('analyze_', ''));
      await bot.answerCallbackQuery(query.id, { text: 'Analiz baslatiliyor...' });
      await bot.sendMessage(chatId, 'Detayli analiz baslatildi. Sonuc birkaç saniye icinde gelecek...');
      // Analiz işlemi burada tetiklenebilir
      return;
    }

    await bot.answerCallbackQuery(query.id, { text: 'Islem tamamlandi' });
  }
}

module.exports = new CallbackHandler();
