const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const commandHandler = require('./handlers/commandHandler');
const messageHandler = require('./handlers/messageHandler');
const photoHandler = require('./handlers/photoHandler');
const locationHandler = require('./handlers/locationHandler');
const callbackHandler = require('./handlers/callbackHandler');
const dataBundleService = require('./services/dataBundleService');
const cron = require('node-cron');
const { getDb } = require('../db/database');

let bot = null;

function startBot() {
  const token = config.getBotToken();
  if (!token) {
    console.log('Telegram bot token tanimli degil. Bot baslatilmadi.');
    console.log('   Ayarlar > Telegram bolumunden token giriniz.');
    return null;
  }

  bot = new TelegramBot(token, { polling: true });
  console.log('Telegram bot baslatildi.');

  // --- KOMUTLAR ---
  bot.onText(/^\/start/, (msg) => commandHandler.handleStart(bot, msg));
  bot.onText(/^\/kayit/, (msg) => commandHandler.handleRegister(bot, msg));
  bot.onText(/^\/durum/, (msg) => commandHandler.handleStatus(bot, msg));
  bot.onText(/^\/ekip/, (msg) => commandHandler.handleTeamInfo(bot, msg));
  bot.onText(/^\/yardim/, (msg) => commandHandler.handleHelp(bot, msg));
  bot.onText(/^\/paket/, (msg) => commandHandler.handleBundle(bot, msg));
  bot.onText(/^\/iptal/, (msg) => commandHandler.handleCancel(bot, msg));

  // --- FOTOGRAF ---
  bot.on('photo', (msg) => {
    photoHandler.handlePhoto(bot, msg).catch(err => {
      console.error('Photo handler uncaught error:', err);
      bot.sendMessage(msg.chat.id, `Fotograf hatasi: ${err.message}`).catch(() => {});
    });
  });

  // --- KONUM ---
  bot.on('location', (msg) => {
    locationHandler.handleLocation(bot, msg).catch(err => {
      console.error('Location handler uncaught error:', err);
    });
  });

  // --- INLINE BUTON CALLBACK ---
  bot.on('callback_query', (query) => {
    callbackHandler.handle(bot, query).catch(err => {
      console.error('Callback handler uncaught error:', err);
    });
  });

  // --- METIN MESAJLARI (komut olmayanlar) ---
  bot.on('message', (msg) => {
    if (msg.text && !msg.text.startsWith('/') && !msg.photo && !msg.location) {
      messageHandler.handleText(bot, msg).catch(err => {
        console.error('Message handler uncaught error:', err);
      });
    }
  });

  // --- HATA YONETIMI ---
  bot.on('polling_error', (error) => {
    console.error('Telegram polling hatasi:', error.code);
  });

  // --- CRON GOREVLERI ---
  // Her 5 dakikada suresi dolmus paketleri tamamla
  cron.schedule('*/5 * * * *', () => {
    try {
      const expired = dataBundleService.autoCompleteExpiredBundles();
      if (expired.length > 0) {
        console.log(`${expired.length} veri paketi otomatik tamamlandi.`);
      }
    } catch (err) {
      console.error('Oto-tamamlama cron hatasi:', err.message);
    }
  });

  // Her gun 18:00'de rapor gondermeyenlere hatirlatma
  cron.schedule('0 18 * * 1-6', async () => {
    try {
      const db = getDb();
      const raporGondermeyenEkipler = db.prepare(`
        SELECT e.id, e.ekip_adi, tk.telegram_id
        FROM ekipler e
        JOIN personel p ON p.ekip_id = e.id AND p.gorev = 'ekip_basi'
        LEFT JOIN telegram_kullanicilar tk ON tk.personel_id = p.id
        WHERE e.durum = 'aktif'
          AND e.id NOT IN (
            SELECT DISTINCT ekip_id FROM gunluk_rapor
            WHERE tarih = date('now')
          )
      `).all();

      for (const ekip of raporGondermeyenEkipler) {
        if (ekip.telegram_id && bot) {
          await bot.sendMessage(ekip.telegram_id,
            `<b>Hatirlatma:</b> Bugun icin gunluk rapor gondermediniz.\nLutfen calisma durumunuzu bildirin.`,
            { parse_mode: 'HTML' }
          );
        }
      }
    } catch (err) {
      console.error('Hatirlatma cron hatasi:', err.message);
    }
  });

  // Her gun 08:00'de ekiplere gunun gorevleri
  cron.schedule('0 8 * * 1-6', async () => {
    try {
      const db = getDb();
      const ekipler = db.prepare(`
        SELECT e.id, e.ekip_adi, tk.telegram_id
        FROM ekipler e
        JOIN personel p ON p.ekip_id = e.id AND p.gorev = 'ekip_basi'
        LEFT JOIN telegram_kullanicilar tk ON tk.personel_id = p.id
        WHERE e.durum = 'aktif' AND tk.telegram_id IS NOT NULL
      `).all();

      for (const ekip of ekipler) {
        const gorevler = db.prepare(`
          SELECT g.gorev_basligi, p.proje_no
          FROM gorevler g
          LEFT JOIN projeler p ON g.proje_id = p.id
          WHERE g.ekip_id = ? AND g.durum IN ('atandi', 'devam_ediyor')
          ORDER BY g.oncelik DESC
        `).all(ekip.id);

        if (gorevler.length > 0) {
          let msg = `<b>Gunaydin ${ekip.ekip_adi}!</b>\n\nBugunku gorevler:\n`;
          gorevler.forEach((g, i) => {
            msg += `${i+1}. ${g.gorev_basligi}${g.proje_no ? ` (${g.proje_no})` : ''}\n`;
          });
          msg += '\nIyi calismalar!';
          await bot.sendMessage(ekip.telegram_id, msg, { parse_mode: 'HTML' });
        }
      }
    } catch (err) {
      console.error('Gunluk gorev cron hatasi:', err.message);
    }
  });

  return bot;
}

function stopBot() {
  if (bot) {
    bot.stopPolling();
    bot = null;
    console.log('Telegram bot durduruldu.');
  }
}

function getBot() {
  return bot;
}

module.exports = { startBot, stopBot, getBot };
