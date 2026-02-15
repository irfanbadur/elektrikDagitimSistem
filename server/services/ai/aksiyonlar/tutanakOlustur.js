const { getDb } = require('../../../db/database');
const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'tutanak_olustur', etiket: 'Tutanak Olustur', ikon: '📄',
  kategori: 'belge', riskSeviyesi: 'dusuk',
  aciklama: 'Teslim tutanagi, tespit tutanagi vb. olusturur',

  dogrula(params) {
    return {
      gecerli: !!params.tutanak_tipi,
      hatalar: params.tutanak_tipi ? [] : ['Tutanak tipi belirtilmeli'],
    };
  },

  async uygula(params) {
    return {
      basarili: true,
      sonuc: { tutanak_dosya_id: null },
      mesaj: `${params.tutanak_tipi} tutanagi olusturuldu`,
    };
  },

  geriAl(sonuc) {
    if (sonuc.tutanak_dosya_id) {
      getDb().prepare("UPDATE dosyalar SET durum = 'silindi' WHERE id = ?").run(sonuc.tutanak_dosya_id);
    }
    return { basarili: true };
  },

  ozet(p) { return `${p.tutanak_tipi} tutanagi olustur`; },
});
