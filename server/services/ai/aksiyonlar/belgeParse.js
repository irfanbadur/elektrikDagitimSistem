const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'belge_parse', etiket: 'Belge Parse', ikon: '📋',
  kategori: 'belge', riskSeviyesi: 'dusuk',
  aciklama: 'Fotograf/PDF belgesini AI ile parse eder',

  dogrula(params) {
    const hatalar = [];
    if (!params.dosya_id && !params.gorsel_url) hatalar.push('Dosya veya gorsel gerekli');
    return { gecerli: hatalar.length === 0, hatalar };
  },

  async uygula(params) {
    return {
      basarili: true,
      sonuc: { parse_tipi: params.belge_tipi, parse_veri: params.parse_sonuc },
      mesaj: `${params.belge_tipi || 'Belge'} parse edildi`,
    };
  },

  geriAl() { return { basarili: true }; },
  ozet(p) { return `${p.belge_tipi || 'Belge'} parse et`; },
});
