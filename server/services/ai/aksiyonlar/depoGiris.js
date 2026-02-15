const { getDb } = require('../../../db/database');
const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'depo_giris', etiket: 'Depo Giris', ikon: '📥',
  kategori: 'depo', riskSeviyesi: 'dusuk',
  aciklama: 'Depoya malzeme girisi yapar, stok artar',

  dogrula(params) {
    const hatalar = [];
    if (!params.malzeme_adi && !params.malzeme_kodu) hatalar.push('Malzeme belirtilmeli');
    if (!params.miktar || params.miktar <= 0) hatalar.push('Miktar pozitif olmali');
    return { gecerli: hatalar.length === 0, hatalar };
  },

  uygula(params, context) {
    const db = getDb();

    // Malzeme var mi kontrol et
    let malzeme = db.prepare('SELECT id FROM malzemeler WHERE malzeme_kodu = ?')
      .get(params.malzeme_kodu);

    // Yoksa yeni malzeme olustur
    if (!malzeme) {
      const ins = db.prepare(
        'INSERT INTO malzemeler (malzeme_kodu, malzeme_adi, birim, kategori, stok_miktari) VALUES (?, ?, ?, ?, 0)'
      ).run(params.malzeme_kodu, params.malzeme_adi, params.birim || 'adet', params.kategori || 'genel');
      malzeme = { id: ins.lastInsertRowid };
    }

    // malzeme_hareketleri'ne INSERT — trg_malzeme_giris trigger'i stoku otomatik artirir
    const result = db.prepare(`
      INSERT INTO malzeme_hareketleri (malzeme_id, miktar, hareket_tipi, ekip_id, proje_id, belge_no, notlar, kaynak)
      VALUES (?, ?, 'giris', ?, ?, ?, ?, 'ai')
    `).run(malzeme.id, params.miktar, params.ekip_id || null, params.proje_id || null,
      params.irsaliye_no || null, params.notlar || `AI operasyon #${context.aiIslemId}`);

    return {
      basarili: true,
      sonuc: { hareket_id: result.lastInsertRowid, malzeme_id: malzeme.id },
      mesaj: `${params.miktar} ${params.birim || 'adet'} ${params.malzeme_adi} depoya giris${params.irsaliye_no ? ` (Irs: ${params.irsaliye_no})` : ''}`,
    };
  },

  geriAl(sonuc) {
    const db = getDb();
    const h = db.prepare('SELECT * FROM malzeme_hareketleri WHERE id = ?').get(sonuc.hareket_id);
    if (h) {
      // Stogu geri dusur (trigger giriste artirmisti)
      db.prepare('UPDATE malzemeler SET stok_miktari = stok_miktari - ? WHERE id = ?')
        .run(h.miktar, h.malzeme_id);
      // Hareketi sil
      db.prepare('DELETE FROM malzeme_hareketleri WHERE id = ?').run(h.id);
    }
    return { basarili: true };
  },

  ozet(p) {
    return `${p.malzeme_adi} x ${p.miktar} ${p.birim || 'adet'} -> depoya giris${p.irsaliye_no ? ` (Irs: ${p.irsaliye_no})` : ''}`;
  },
});
