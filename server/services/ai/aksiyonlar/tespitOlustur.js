const { getDb } = require('../../../db/database');
const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'tespit_olustur', etiket: 'Saha Tespiti', ikon: '🔍',
  kategori: 'saha', riskSeviyesi: 'dusuk',
  aciklama: 'Eksiklik, arıza veya tehlike tespiti oluşturur',

  dogrula(params) {
    const hatalar = [];
    if (!params.aciklama) hatalar.push('Açıklama zorunlu');
    if (!params.tespit_tipi) hatalar.push('Tespit tipi belirtilmeli');
    return { gecerli: hatalar.length === 0, hatalar };
  },

  uygula(params, context) {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO saha_tespitler (proje_id, direk_kayit_id, tespit_tipi, aciklama,
        konum_lat, konum_lon, oncelik, raporlayan_id, atanan_ekip_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.proje_id, params.direk_kayit_id,
      params.tespit_tipi, params.aciklama,
      params.konum_lat, params.konum_lon,
      params.oncelik || 'normal',
      context.kullaniciId, params.ekip_id
    );

    return {
      basarili: true,
      sonuc: { tespit_id: result.lastInsertRowid },
      mesaj: `${params.tespit_tipi} tespiti oluşturuldu: ${params.aciklama.substring(0, 60)}`,
    };
  },

  geriAl(sonuc) {
    getDb().prepare("UPDATE saha_tespitler SET durum = 'iptal' WHERE id = ?").run(sonuc.tespit_id);
    return { basarili: true };
  },

  ozet(p) {
    return `${p.tespit_tipi}: ${(p.aciklama || '').substring(0, 50)}${p.direk_kayit_id ? ` (Direk #${p.direk_kayit_id})` : ''}`;
  },
});
