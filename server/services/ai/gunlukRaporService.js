const { getDb } = require('../../db/database');
const providerManager = require('./providerManager');
const konumService = require('./konumService');

class GunlukRaporService {

  /**
   * Projenin bugünkü aktivitelerinden otomatik rapor üret
   */
  async raporUret(projeId) {
    const db = getDb();
    const bugun = new Date().toISOString().split('T')[0];

    const direkGuncellemeleri = db.prepare(`
      SELECT dk.direk_no, dig.islem_tipi, dig.yeni_deger, k.ad_soyad
      FROM direk_islem_gecmisi dig
      JOIN direk_kayitlar dk ON dk.id = dig.direk_kayit_id
      LEFT JOIN kullanicilar k ON k.id = dig.islem_yapan_id
      WHERE dk.proje_id = ? AND date(dig.olusturma_tarihi) = ?
    `).all(projeId, bugun);

    const yeniTespitler = db.prepare(`
      SELECT tespit_tipi, aciklama, oncelik
      FROM saha_tespitler
      WHERE proje_id = ? AND date(olusturma_tarihi) = ?
    `).all(projeId, bugun);

    const malzemeHareketleri = db.prepare(`
      SELECT m.malzeme_adi as ad, mh.hareket_tipi, mh.miktar, m.birim
      FROM malzeme_hareketleri mh
      JOIN malzemeler m ON m.id = mh.malzeme_id
      WHERE mh.proje_id = ? AND date(mh.tarih) = ?
    `).all(projeId, bugun);

    const ilerleme = konumService.projeIlerlemeOzeti(projeId);

    const prompt = `Bu günkü aktivite özeti:
Proje ilerleme: %${ilerleme.ilerlemYuzde} (${ilerleme.tamamlanan}/${ilerleme.toplamDirek} direk)
Açık tespit sayısı: ${ilerleme.acikTespitler}

Direk güncellemeleri (${direkGuncellemeleri.length}):
${JSON.stringify(direkGuncellemeleri)}

Yeni tespitler (${yeniTespitler.length}):
${JSON.stringify(yeniTespitler)}

Malzeme hareketleri (${malzemeHareketleri.length}):
${JSON.stringify(malzemeHareketleri)}

Bu verileri kullanarak kısa, profesyonel bir günlük saha raporu yaz. Önemli noktaları vurgula, sorunları belirt, yarın için önerilerde bulun.`;

    const yanit = await providerManager.metinGonder(
      'Sen saha mühendisi raporlama asistanısın. Kısa, net, profesyonel raporlar yazarsın.',
      prompt
    );

    db.prepare(`
      INSERT INTO gunluk_ilerleme (proje_id, tarih, toplam_ilerleme_yuzde, tamamlanan_direk_sayisi, ai_rapor, ai_rapor_tarihi)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(proje_id, tarih, ekip_id) DO UPDATE SET
        ai_rapor = excluded.ai_rapor, ai_rapor_tarihi = excluded.ai_rapor_tarihi
    `).run(projeId, bugun, ilerleme.ilerlemYuzde, ilerleme.tamamlanan, yanit.metin);

    return { tarih: bugun, rapor: yanit.metin, ilerleme };
  }
}

module.exports = new GunlukRaporService();
