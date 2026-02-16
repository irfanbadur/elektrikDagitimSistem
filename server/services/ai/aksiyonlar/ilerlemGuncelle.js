const { getDb } = require('../../../db/database');
const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'ilerleme_guncelle', etiket: 'İlerleme Güncelle', ikon: '📊',
  kategori: 'saha', riskSeviyesi: 'dusuk',
  aciklama: 'Günlük ilerleme kaydı oluşturur/günceller',

  dogrula(params) {
    return { gecerli: !!params.proje_id, hatalar: params.proje_id ? [] : ['Proje gerekli'] };
  },

  uygula(params) {
    const db = getDb();
    const tarih = params.tarih || new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO gunluk_ilerleme (proje_id, tarih, ekip_id, tamamlanan_direk_sayisi, calisan_direk_ids, toplam_ilerleme_yuzde)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(proje_id, tarih, ekip_id) DO UPDATE SET
        tamamlanan_direk_sayisi = excluded.tamamlanan_direk_sayisi,
        calisan_direk_ids = excluded.calisan_direk_ids,
        toplam_ilerleme_yuzde = excluded.toplam_ilerleme_yuzde
    `).run(
      params.proje_id, tarih, params.ekip_id,
      params.tamamlanan_direk || 0,
      JSON.stringify(params.calisan_direkler || []),
      params.ilerleme_yuzde || 0
    );

    return {
      basarili: true,
      sonuc: { tarih },
      mesaj: `${tarih} ilerleme kaydı: ${params.tamamlanan_direk || 0} direk tamamlandı, toplam %${params.ilerleme_yuzde || 0}`,
    };
  },

  geriAl() { return { basarili: true }; },
  ozet(p) { return `Günlük ilerleme: ${p.tamamlanan_direk || 0} direk, %${p.ilerleme_yuzde || 0}`; },
});
