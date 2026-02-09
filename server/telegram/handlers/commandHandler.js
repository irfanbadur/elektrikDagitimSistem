const registrationService = require('../services/registrationService');
const dataBundleService = require('../services/dataBundleService');
const messages = require('../utils/messages');
const { getDb } = require('../../db/database');

// Kayıt akışında olan kullanıcılar (geçici state)
const pendingRegistrations = new Map();

class CommandHandler {
  async handleStart(bot, msg) {
    await bot.sendMessage(msg.chat.id, messages.welcomeMessage, { parse_mode: 'HTML' });
  }

  async handleRegister(bot, msg) {
    const telegramId = String(msg.from.id);
    const chatId = msg.chat.id;

    // Zaten kayıtlı mı?
    const existing = registrationService.findByTelegramId(telegramId);
    if (existing && existing.personel_id) {
      await bot.sendMessage(chatId,
        `Zaten kayitlisiniz: ${existing.ad_soyad} (${existing.ekip_adi || 'Ekip atanmamis'})`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Kayıt akışını başlat
    pendingRegistrations.set(telegramId, { step: 'awaiting_name', chatId });
    await bot.sendMessage(chatId, 'Adinizi ve soyadinizi yazin:');

    // Tek seferlik mesaj dinleyici
    const listener = async (response) => {
      if (String(response.from.id) !== telegramId || response.chat.id !== chatId) return;
      if (response.text?.startsWith('/')) return;

      const reg = pendingRegistrations.get(telegramId);
      if (!reg || reg.step !== 'awaiting_name') return;

      bot.removeListener('message', listener);
      pendingRegistrations.delete(telegramId);

      const adSoyad = response.text.trim();
      const results = registrationService.searchPersonel(adSoyad);

      if (results.length === 0) {
        await bot.sendMessage(chatId,
          'Bu isimde personel bulunamadi. Koordinatorunuzle iletisime gecin.'
        );
      } else if (results.length === 1) {
        // Direkt eşleştir
        registrationService.registerUser(
          telegramId,
          msg.from.username || null,
          `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim(),
          results[0].id
        );
        await bot.sendMessage(chatId,
          messages.registrationSuccess(results[0].ad_soyad, results[0].ekip_adi || 'Ekip atanmamis'),
          { parse_mode: 'HTML' }
        );
      } else {
        // Birden fazla sonuç - inline butonlarla seçtir
        const keyboard = results.slice(0, 5).map(p => ([{
          text: `${p.ad_soyad} (${p.ekip_adi || 'Ekipsiz'})`,
          callback_data: `reg_${p.id}`
        }]));
        await bot.sendMessage(chatId, 'Birden fazla sonuc bulundu. Kendinizi secin:', {
          reply_markup: { inline_keyboard: keyboard }
        });
      }
    };

    bot.on('message', listener);
    // 60 saniye sonra listener'ı temizle
    setTimeout(() => {
      bot.removeListener('message', listener);
      pendingRegistrations.delete(telegramId);
    }, 60000);
  }

  async handleStatus(bot, msg) {
    const telegramId = String(msg.from.id);
    const chatId = msg.chat.id;
    const auth = registrationService.authenticate(telegramId);
    if (!auth.authenticated) {
      return bot.sendMessage(chatId, messages.notRegistered);
    }

    const { user } = auth;
    const db = getDb();

    // Ekibin aktif projeleri
    const projeler = db.prepare(`
      SELECT proje_no, durum, tamamlanma_yuzdesi
      FROM projeler WHERE ekip_id = ? AND durum NOT IN ('tamamlandi', 'iptal')
      ORDER BY oncelik DESC LIMIT 5
    `).all(user.ekip_id);

    let statusMsg = `<b>Durum Ozeti</b>\n`;
    statusMsg += `Personel: ${user.ad_soyad}\n`;
    statusMsg += `Ekip: ${user.ekip_adi || '-'}\n\n`;

    if (projeler.length > 0) {
      statusMsg += '<b>Aktif Projeler:</b>\n';
      projeler.forEach(p => {
        statusMsg += `  ${p.proje_no} - %${p.tamamlanma_yuzdesi} (${p.durum})\n`;
      });
    } else {
      statusMsg += 'Aktif proje yok.\n';
    }

    // Bugünkü paketler
    const bugunPaketler = db.prepare(`
      SELECT COUNT(*) as c FROM veri_paketleri
      WHERE personel_id = ? AND date(olusturma_tarihi) = date('now')
    `).get(user.personel_id);
    statusMsg += `\nBugunun veri paketleri: ${bugunPaketler.c}`;

    await bot.sendMessage(chatId, statusMsg, { parse_mode: 'HTML' });
  }

  async handleTeamInfo(bot, msg) {
    const telegramId = String(msg.from.id);
    const chatId = msg.chat.id;
    const auth = registrationService.authenticate(telegramId);
    if (!auth.authenticated) {
      return bot.sendMessage(chatId, messages.notRegistered);
    }

    const { user } = auth;
    const db = getDb();

    const uyeler = db.prepare(`
      SELECT ad_soyad, gorev FROM personel
      WHERE ekip_id = ? AND aktif = 1
    `).all(user.ekip_id);

    let teamMsg = `<b>Ekip: ${user.ekip_adi || '-'}</b>\n\n`;
    uyeler.forEach(u => {
      teamMsg += `  ${u.ad_soyad} - ${u.gorev || 'Belirtilmemis'}\n`;
    });

    await bot.sendMessage(chatId, teamMsg, { parse_mode: 'HTML' });
  }

  async handleHelp(bot, msg) {
    await bot.sendMessage(msg.chat.id, messages.helpMessage, { parse_mode: 'HTML' });
  }

  async handleBundle(bot, msg) {
    const telegramId = String(msg.from.id);
    const chatId = msg.chat.id;
    const auth = registrationService.authenticate(telegramId);
    if (!auth.authenticated) {
      return bot.sendMessage(chatId, messages.notRegistered);
    }

    const { user } = auth;
    const text = msg.text.trim();
    const parts = text.split(/\s+/);

    // /paket tamam
    if (parts[1] === 'tamam') {
      const activeBundle = dataBundleService.getActiveBundle(user.personel_id);
      if (!activeBundle) {
        return bot.sendMessage(chatId, 'Aktif veri paketiniz yok.');
      }
      const completed = dataBundleService.completeBundle(activeBundle.id);
      return bot.sendMessage(chatId,
        messages.bundleCompleted(
          completed.paket_no,
          completed.foto_sayisi,
          !!(completed.latitude),
          !!(completed.notlar)
        ),
        { parse_mode: 'HTML' }
      );
    }

    // /paket (yardım)
    if (parts.length < 2) {
      return bot.sendMessage(chatId, messages.noBundleTypes, { parse_mode: 'HTML' });
    }

    // /paket <tip> [proje_no]
    const paketTipi = parts[1];
    const projeNo = parts[2] || null;
    let projeId = null;

    if (projeNo) {
      const db = getDb();
      const proje = db.prepare('SELECT id FROM projeler WHERE proje_no LIKE ?').get(`%${projeNo}%`);
      projeId = proje?.id || null;
    }

    // Aktif paket varsa uyar
    const activeBundle = dataBundleService.getActiveBundle(user.personel_id);
    if (activeBundle) {
      return bot.sendMessage(chatId,
        `Zaten aktif bir paketiniz var: ${activeBundle.paket_no}\nOnce /paket tamam ile tamamlayin veya /iptal ile iptal edin.`
      );
    }

    const bundle = dataBundleService.createBundle({
      paketTipi,
      personelId: user.personel_id,
      ekipId: user.ekip_id || null,
      projeId,
      bolgeId: null,
      notlar: null
    });

    await bot.sendMessage(chatId,
      messages.bundleStarted(bundle.paket_no, paketTipi, projeNo),
      { parse_mode: 'HTML' }
    );
  }

  async handleCancel(bot, msg) {
    const telegramId = String(msg.from.id);
    const chatId = msg.chat.id;
    const auth = registrationService.authenticate(telegramId);
    if (!auth.authenticated) {
      return bot.sendMessage(chatId, messages.notRegistered);
    }

    const { user } = auth;
    const activeBundle = dataBundleService.getActiveBundle(user.personel_id);
    if (!activeBundle) {
      return bot.sendMessage(chatId, 'Aktif veri paketiniz yok.');
    }

    const db = getDb();
    db.prepare(`
      UPDATE veri_paketleri SET durum = 'iptal' WHERE id = ?
    `).run(activeBundle.id);

    await bot.sendMessage(chatId, messages.bundleCancelled(activeBundle.paket_no));
  }
}

module.exports = new CommandHandler();
