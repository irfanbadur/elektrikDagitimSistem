const { getDb } = require('../../../db/database');
const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'paket_siniflandir', etiket: 'Paket Siniflandir', ikon: '🏷️',
  kategori: 'proje', riskSeviyesi: 'dusuk',
  aciklama: 'Veri paketini otomatik siniflandirir ve etiketler',

  dogrula(params) {
    return {
      gecerli: !!params.veri_paketi_id,
      hatalar: params.veri_paketi_id ? [] : ['Veri paketi ID gerekli'],
    };
  },

  uygula(params) {
    const db = getDb();
    const updates = {};
    if (params.paket_tipi) updates.paket_tipi = params.paket_tipi;
    if (params.etiketler) updates.etiketler = JSON.stringify(params.etiketler);
    if (params.baslik) updates.baslik = params.baslik;

    const setClauses = Object.keys(updates).map(k => `${k} = ?`);
    setClauses.push("guncelleme_tarihi = datetime('now')");
    db.prepare(`UPDATE veri_paketleri SET ${setClauses.join(', ')} WHERE id = ?`)
      .run(...Object.values(updates), params.veri_paketi_id);

    return {
      basarili: true,
      sonuc: { veri_paketi_id: params.veri_paketi_id },
      mesaj: `Paket siniflandirildi: ${params.paket_tipi || 'guncellendi'}`,
    };
  },

  geriAl() { return { basarili: true }; },
  ozet(p) { return `Paketi "${p.paket_tipi}" olarak siniflandir`; },
});
