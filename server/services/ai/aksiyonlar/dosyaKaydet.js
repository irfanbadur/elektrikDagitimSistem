const { getDb } = require('../../../db/database');
const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'dosya_kaydet', etiket: 'Dosya Kaydet', ikon: '📁',
  kategori: 'dosya', riskSeviyesi: 'dusuk',
  aciklama: 'Dosyayı belirtilen klasöre/projeye kaydeder',

  dogrula(params) {
    const hatalar = [];
    if (!params.dosya_id && !params.dosya_ids) hatalar.push('Dosya belirtilmeli');
    if (!params.alan) hatalar.push('Hedef alan belirtilmeli (proje, personel, isg vb.)');
    return { gecerli: hatalar.length === 0, hatalar };
  },

  uygula(params) {
    const db = getDb();
    const dosyaIds = params.dosya_ids || [params.dosya_id];
    let kaydedilen = 0;

    for (const dosyaId of dosyaIds) {
      db.prepare(`
        UPDATE dosyalar SET
          alan = ?, alt_alan = ?, iliskili_kaynak_id = ?,
          guncelleme_tarihi = datetime('now')
        WHERE id = ?
      `).run(params.alan, params.alt_alan || null, params.iliskili_id || null, dosyaId);
      kaydedilen++;
    }

    return {
      basarili: true,
      sonuc: { dosya_ids: dosyaIds },
      mesaj: `${kaydedilen} dosya → ${params.alan}${params.alt_alan ? '/' + params.alt_alan : ''} klasörüne kaydedildi`,
    };
  },

  geriAl() { return { basarili: true }; },

  ozet(p) {
    const sayi = p.dosya_ids?.length || 1;
    return `${sayi} dosya → ${p.alan}${p.alt_alan ? '/' + p.alt_alan : ''}`;
  },
});
