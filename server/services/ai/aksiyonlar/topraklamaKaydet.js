const { getDb } = require('../../../db/database');
const registry = require('../aksiyonRegistry');

const STANDARD_SINIR = 5;
const UYARI_SINIR = 10;

registry.kaydet({
  tip: 'topraklama_kaydet', etiket: 'Topraklama Kaydı', ikon: '⚡',
  kategori: 'saha', riskSeviyesi: 'orta',
  aciklama: 'Direk topraklama ölçümünü kaydeder, standart kontrolü yapar',

  dogrula(params) {
    const hatalar = [];
    if (!params.direk_kayit_id && !params.direk_no) hatalar.push('Direk belirtilmeli');
    if (params.direnc === undefined || params.direnc === null) hatalar.push('Direnç değeri zorunlu');
    if (typeof params.direnc === 'number' && params.direnc < 0) hatalar.push('Direnç negatif olamaz');
    return { gecerli: hatalar.length === 0, hatalar };
  },

  uygula(params, context) {
    const db = getDb();

    let direkId = params.direk_kayit_id;
    if (!direkId && params.direk_no && params.proje_id) {
      const d = db.prepare('SELECT id FROM direk_kayitlar WHERE direk_no = ? AND proje_id = ?')
        .get(params.direk_no, params.proje_id);
      direkId = d?.id;
    }
    if (!direkId) return { basarili: false, mesaj: 'Direk bulunamadı' };

    db.prepare(`
      UPDATE direk_kayitlar SET
        topraklama_yapildi = 1,
        topraklama_direnc = ?,
        topraklama_tarihi = datetime('now'),
        topraklama_foto_id = ?,
        son_islem_yapan_id = ?,
        guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(params.direnc, params.foto_id || null, context.kullaniciId, direkId);

    db.prepare(`
      INSERT INTO direk_islem_gecmisi (direk_kayit_id, islem_tipi, yeni_deger, islem_yapan_id)
      VALUES (?, 'topraklama', ?, ?)
    `).run(direkId, JSON.stringify({ direnc: params.direnc }), context.kullaniciId);

    let durumMesaj;
    if (params.direnc <= STANDARD_SINIR) {
      durumMesaj = `${params.direnc} Ohm — Standart sinir icinde (≤${STANDARD_SINIR}Ohm)`;
    } else if (params.direnc <= UYARI_SINIR) {
      durumMesaj = `${params.direnc} Ohm — Sinira yakin, iyilestirme onerilir (standart: ≤${STANDARD_SINIR}Ohm)`;
    } else {
      durumMesaj = `${params.direnc} Ohm — Standart asildi! Tekrar calisma gerekli (max: ${UYARI_SINIR}Ohm)`;
    }

    return {
      basarili: true,
      sonuc: { direk_kayit_id: direkId, direnc: params.direnc },
      mesaj: `Direk ${params.direk_no || '#' + direkId} topraklama: ${durumMesaj}`,
    };
  },

  geriAl(sonuc) {
    getDb().prepare(`
      UPDATE direk_kayitlar SET topraklama_yapildi = 0, topraklama_direnc = NULL, topraklama_tarihi = NULL
      WHERE id = ?
    `).run(sonuc.direk_kayit_id);
    return { basarili: true };
  },

  ozet(p) {
    return `Topraklama: ${p.direnc}Ohm${p.direk_no ? ` — Direk ${p.direk_no}` : ''}`;
  },
});
