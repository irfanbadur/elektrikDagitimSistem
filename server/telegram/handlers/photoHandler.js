const registrationService = require('../services/registrationService');
const mediaService = require('../services/mediaService');
const dataBundleService = require('../services/dataBundleService');
const aiManager = require('../ai/aiManager');
const messages = require('../utils/messages');
const { getDb } = require('../../db/database');

class PhotoHandler {
  async handlePhoto(bot, msg) {
    const telegramId = String(msg.from.id);
    const chatId = msg.chat.id;

    const auth = registrationService.authenticate(telegramId);
    if (!auth.authenticated) {
      return bot.sendMessage(chatId, messages.notRegistered);
    }

    const { user } = auth;
    const startTime = Date.now();

    try {
      const photoResult = await mediaService.processPhoto(bot, msg);

      let latitude = null, longitude = null, konumKaynagi = null, altitude = null;
      if (photoResult.exif?.gps) {
        latitude = photoResult.exif.gps.latitude;
        longitude = photoResult.exif.gps.longitude;
        altitude = photoResult.exif.gps.altitude;
        konumKaynagi = 'exif';
      }
      if (!latitude && msg.location) {
        latitude = msg.location.latitude;
        longitude = msg.location.longitude;
        konumKaynagi = 'telegram_konum';
      }

      let parsedCaption = null;
      let projeId = null;
      let paketTipi = 'diger';

      if (photoResult.caption) {
        try {
          parsedCaption = await aiManager.parseCaption(photoResult.caption);
          if (parsedCaption?.proje_no) {
            const proje = getDb().prepare('SELECT id FROM projeler WHERE proje_no = ?').get(parsedCaption.proje_no);
            projeId = proje?.id || null;
          }
          if (parsedCaption?.paket_tipi) {
            paketTipi = parsedCaption.paket_tipi;
          }
        } catch (e) {
          console.error('Caption parse hatasi:', e.message);
        }
      }

      let bundle = dataBundleService.getActiveBundle(user.personel_id);
      if (!bundle) {
        bundle = dataBundleService.createBundle({
          paketTipi,
          personelId: user.personel_id,
          ekipId: user.ekip_id || null,
          projeId,
          bolgeId: null,
          notlar: parsedCaption?.not || null
        });
      } else {
        if (parsedCaption?.not) {
          dataBundleService.appendNote(bundle.id, parsedCaption.not);
        }
      }

      if (latitude && !bundle.latitude) {
        dataBundleService.updateLocation(bundle.id, latitude, longitude);
      }

      const mediaId = mediaService.saveMediaRecord({
        fileName: photoResult.fileName,
        fullPath: photoResult.fullPath,
        thumbPath: photoResult.thumbPath,
        fileSize: photoResult.fileSize,
        width: photoResult.width,
        height: photoResult.height,
        latitude, longitude, konumKaynagi, altitude,
        cekimTarihi: photoResult.exif?.dateTime || null,
        personelId: user.personel_id,
        telegramId,
        projeId: projeId || bundle.proje_id,
        ekipId: user.ekip_id,
        veriPaketiId: bundle.id,
        aciklama: parsedCaption?.not || photoResult.caption,
        etiketler: parsedCaption?.etiketler || null
      });

      const updatedBundle = dataBundleService.getBundleById(bundle.id);

      let confirmMsg = `Fotograf #${updatedBundle.foto_sayisi} kaydedildi.`;
      if (latitude) {
        confirmMsg += `\nGPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      } else {
        confirmMsg += `\nGPS bilgisi bulunamadi. Konum gonderin veya fotograftaki GPS'i acin.`;
      }
      confirmMsg += `\nPaket: ${updatedBundle.paket_no}`;

      await bot.sendMessage(chatId, confirmMsg);

      this.logMessage(telegramId, 'photo', msg, { mediaId, bundleId: bundle.id }, Date.now() - startTime);

    } catch (error) {
      console.error('Fotograf isleme hatasi:', error.message, error.stack);
      await bot.sendMessage(chatId, `Fotograf isleme hatasi: ${error.message}`);
      this.logMessage(telegramId, 'photo', msg, null, Date.now() - startTime, error.message);
    }
  }

  logMessage(telegramId, type, msg, result, duration, error = null) {
    const db = getDb();
    db.prepare(`INSERT INTO telegram_mesaj_log (telegram_id, mesaj_tipi, yon, ham_mesaj, ai_parse_sonucu, islem_durumu, hata_detay, islem_suresi_ms) VALUES (?, ?, 'gelen', ?, ?, ?, ?, ?)`).run(telegramId, type, JSON.stringify({ caption: msg.caption, photo_count: msg.photo?.length }), result ? JSON.stringify(result) : null, error ? 'hata' : 'islendi', error, duration);
  }
}

module.exports = new PhotoHandler();
