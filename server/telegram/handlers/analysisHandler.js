const aiManager = require('../ai/aiManager');
const analysisService = require('../services/analysisService');
const { getDb } = require('../../db/database');
const fs = require('fs');

class AnalysisHandler {
  async requestAnalysis(bot, chatId, mediaId, analizTipi = 'direk_analiz') {
    try {
      const db = getDb();
      const medya = db.prepare('SELECT * FROM medya WHERE id = ?').get(mediaId);
      if (!medya) {
        return bot.sendMessage(chatId, 'Medya bulunamadi.');
      }

      const imageBuffer = fs.readFileSync(medya.dosya_yolu);
      const startTime = Date.now();

      const katalog = await analysisService.getRelevantCatalog();
      const result = await aiManager.analyzePhotoDetailed(imageBuffer, analizTipi, katalog);

      if (result.error) {
        return bot.sendMessage(chatId, result.message);
      }

      const suresi = Date.now() - startTime;
      const analizId = await analysisService.saveAnalysis({
        medyaId: mediaId,
        veriPaketiId: medya.veri_paketi_id,
        katman: 3,
        analizTipi,
        sonuc: result,
        suresi
      });

      // Sonucu formatla ve gönder
      let msg = `<b>Detayli Analiz Sonucu</b>\n`;
      if (result.direk_bilgisi) {
        const d = result.direk_bilgisi;
        msg += `Direk: ${d.direk_tipi} ~${d.tahmini_boy_m}m ${d.gerilim_sinifi}\n`;
      }
      if (result.toplam_malzeme_ozeti) {
        msg += '\n<b>Malzeme Ozeti:</b>\n';
        for (const mlz of result.toplam_malzeme_ozeti) {
          msg += `  ${mlz.malzeme}: ${mlz.miktar} ${mlz.birim}\n`;
        }
      }
      if (result.hasar_tespiti?.hasar_var) {
        msg += `\n<b>Hasar:</b> ${result.hasar_tespiti.hasarlar?.length || 0} adet tespit\n`;
      }
      msg += `\nGuven: %${Math.round((result.guven_skoru || 0) * 100)}`;
      msg += ` | Sure: ${(suresi/1000).toFixed(1)}sn`;

      await bot.sendMessage(chatId, msg, { parse_mode: 'HTML' });
      return analizId;

    } catch (error) {
      console.error('Analiz hatasi:', error);
      await bot.sendMessage(chatId, 'Analiz sirasinda hata olustu.');
    }
  }
}

module.exports = new AnalysisHandler();
