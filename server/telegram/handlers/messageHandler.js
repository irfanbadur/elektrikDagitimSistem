const registrationService = require('../services/registrationService');
const dataBundleService = require('../services/dataBundleService');
const aiManager = require('../ai/aiManager');
const messages = require('../utils/messages');
const { getDb } = require('../../db/database');

class MessageHandler {
  async handleText(bot, msg) {
    const telegramId = String(msg.from.id);
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    const auth = registrationService.authenticate(telegramId);
    if (!auth.authenticated) {
      return bot.sendMessage(chatId, messages.notRegistered);
    }

    const { user } = auth;
    const startTime = Date.now();

    try {
      // Aktif veri paketi varsa, mesajı not olarak ekle
      const activeBundle = dataBundleService.getActiveBundle(user.personel_id);
      if (activeBundle) {
        dataBundleService.appendNote(activeBundle.id, text);
        await bot.sendMessage(chatId, `Not eklendi. Paket: ${activeBundle.paket_no}`);
        this.logMessage(telegramId, text, { action: 'note_to_bundle', bundleId: activeBundle.id }, Date.now() - startTime);
        return;
      }

      // AI ile mesajı analiz et
      const parsed = await aiManager.parseText(text);

      if (!parsed || !parsed.islemler || parsed.islemler.length === 0) {
        await bot.sendMessage(chatId,
          'Mesajinizi anlayamadim. Lutfen daha acik yazin veya /yardim komutunu kullanin.'
        );
        this.logMessage(telegramId, text, null, Date.now() - startTime);
        return;
      }

      // Her işlemi sırayla yürüt
      const results = [];
      for (const islem of parsed.islemler) {
        const result = await this.processIslem(islem, user);
        results.push(result);
      }

      const summary = results.map(r => r.message).join('\n');
      await bot.sendMessage(chatId, summary, { parse_mode: 'HTML' });

      if (parsed.anlasilamayan) {
        await bot.sendMessage(chatId, `Su kisim anlasilamadi: "${parsed.anlasilamayan}"`);
      }

      this.logMessage(telegramId, text, parsed, Date.now() - startTime);

    } catch (error) {
      console.error('Metin isleme hatasi:', error);
      await bot.sendMessage(chatId, messages.processingError);
      this.logMessage(telegramId, text, null, Date.now() - startTime, error.message);
    }
  }

  async processIslem(islem, user) {
    const db = getDb();

    switch (islem.tip) {
      case 'gunluk_rapor': {
        let projeId = null;
        if (islem.proje_no) {
          const proje = db.prepare('SELECT id FROM projeler WHERE proje_no = ?').get(islem.proje_no);
          projeId = proje?.id;
        }
        db.prepare(`
          INSERT INTO gunluk_rapor
            (ekip_id, proje_id, bolge_id, kisi_sayisi, yapilan_is, kaynak)
          VALUES (?, ?, ?, ?, ?, 'telegram')
        `).run(user.ekip_id, projeId, null, islem.detay?.kisi_sayisi || 0, islem.detay?.yapilan_is || '');
        return {
          success: true,
          message: `<b>Gunluk rapor kaydedildi</b>\n${islem.detay?.kisi_sayisi || '?'} kisi | ${islem.proje_no || 'Proje belirtilmedi'}`
        };
      }
      case 'malzeme_kullanim': {
        const malzemeler = islem.detay?.malzemeler || [];
        let msg = '<b>Malzeme kullanimi kaydedildi:</b>\n';
        for (const mlz of malzemeler) {
          const malzeme = db.prepare('SELECT id FROM malzemeler WHERE malzeme_adi LIKE ?').get(`%${mlz.adi}%`);
          if (malzeme) {
            db.prepare(`INSERT INTO malzeme_hareketleri (malzeme_id, miktar, hareket_tipi, ekip_id, kaynak) VALUES (?, ?, 'cikis', ?, 'telegram')`).run(malzeme.id, mlz.miktar, user.ekip_id);
            msg += `  ${mlz.adi}: ${mlz.miktar} ${mlz.birim || ''}\n`;
          } else {
            msg += `  ${mlz.adi}: tanimsiz malzeme\n`;
          }
        }
        return { success: true, message: msg };
      }
      case 'malzeme_talep': {
        const talep = islem.detay;
        const malzemeListesi = (talep?.malzemeler || []).map(m => `${m.adi}: ${m.miktar} ${m.birim || ''}`).join(', ');
        db.prepare(`INSERT INTO talepler (ekip_id, talep_eden_id, talep_tipi, aciklama, talep_detay, oncelik, kaynak) VALUES (?, ?, 'malzeme', ?, ?, ?, 'telegram')`).run(user.ekip_id, user.personel_id, `Malzeme talebi: ${malzemeListesi}`, JSON.stringify(talep?.malzemeler), talep?.aciliyet === 'acil' ? 'acil' : 'normal');
        return { success: true, message: `<b>Malzeme talebi olusturuldu</b>\n${malzemeListesi}` };
      }
      case 'enerji_kesintisi': {
        db.prepare(`INSERT INTO talepler (ekip_id, talep_eden_id, talep_tipi, aciklama, talep_detay, oncelik, kaynak) VALUES (?, ?, 'enerji_kesintisi', ?, ?, 'yuksek', 'telegram')`).run(user.ekip_id, user.personel_id, 'Enerji kesintisi talebi', JSON.stringify(islem.detay));
        return { success: true, message: `<b>Enerji kesintisi talebi kaydedildi</b>\n${islem.detay?.tarih || ''} ${islem.detay?.baslama || ''}-${islem.detay?.bitis || ''}` };
      }
      case 'ariza_bildirim': {
        db.prepare(`INSERT INTO talepler (ekip_id, talep_eden_id, talep_tipi, aciklama, oncelik, kaynak) VALUES (?, ?, 'teknik_destek', ?, ?, 'telegram')`).run(user.ekip_id, user.personel_id, islem.detay?.aciklama || 'Ariza bildirimi', islem.detay?.aciliyet === 'acil' ? 'acil' : 'normal');
        return { success: true, message: `<b>Ariza bildirimi kaydedildi</b>\n${islem.detay?.aciklama || ''}` };
      }
      default:
        return { success: true, message: `Mesaj kaydedildi: "${islem.detay?.mesaj || ''}"` };
    }
  }

  logMessage(telegramId, text, parsed, duration, error = null) {
    const db = getDb();
    db.prepare(`INSERT INTO telegram_mesaj_log (telegram_id, mesaj_tipi, yon, ham_mesaj, ai_parse_sonucu, islem_durumu, hata_detay, islem_suresi_ms) VALUES (?, 'text', 'gelen', ?, ?, ?, ?, ?)`).run(telegramId, text, parsed ? JSON.stringify(parsed) : null, error ? 'hata' : 'islendi', error, duration);
  }
}

module.exports = new MessageHandler();
