const { getDb } = require('../../../db/database');
const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'depo_cikis', etiket: 'Depo Cikis', ikon: '📤',
  kategori: 'depo', riskSeviyesi: 'orta',
  aciklama: 'Depodan malzeme cikisi yapar, stok duser',

  dogrula(params) {
    const hatalar = [];
    if (!params.malzeme_adi && !params.malzeme_kodu) hatalar.push('Malzeme belirtilmeli');
    if (!params.miktar || params.miktar <= 0) hatalar.push('Miktar pozitif olmali');

    if (params.malzeme_kodu) {
      const malzeme = getDb().prepare('SELECT id, stok_miktari FROM malzemeler WHERE malzeme_kodu = ?')
        .get(params.malzeme_kodu);
      if (!malzeme) hatalar.push(`"${params.malzeme_kodu}" depoda bulunamadi`);
      else if (malzeme.stok_miktari < params.miktar) hatalar.push(`Yetersiz stok: ${malzeme.stok_miktari} var, ${params.miktar} isteniyor`);
    }
    return { gecerli: hatalar.length === 0, hatalar };
  },

  uygula(params, context) {
    const db = getDb();

    // Malzemeyi bul
    const malzeme = db.prepare('SELECT id, stok_miktari FROM malzemeler WHERE malzeme_kodu = ?')
      .get(params.malzeme_kodu);
    if (!malzeme) return { basarili: false, mesaj: `Malzeme bulunamadi: ${params.malzeme_kodu}` };

    // malzeme_hareketleri'ne INSERT — trg_malzeme_cikis trigger'i stoku otomatik duser
    const result = db.prepare(`
      INSERT INTO malzeme_hareketleri (malzeme_id, miktar, hareket_tipi, ekip_id, proje_id, notlar, kaynak)
      VALUES (?, ?, 'cikis', ?, ?, ?, 'ai')
    `).run(malzeme.id, params.miktar, params.ekip_id || null, params.proje_id || null,
      params.notlar || `AI operasyon #${context.aiIslemId}`);

    return {
      basarili: true,
      sonuc: { hareket_id: result.lastInsertRowid, malzeme_id: malzeme.id },
      mesaj: `${params.miktar} ${params.birim || 'adet'} ${params.malzeme_adi} depodan cikis${params.hedef_konum ? ` -> ${params.hedef_konum}` : ''}`,
    };
  },

  geriAl(sonuc) {
    const db = getDb();
    const h = db.prepare('SELECT * FROM malzeme_hareketleri WHERE id = ?').get(sonuc.hareket_id);
    if (h) {
      // Stogu geri yukle (trigger cikista dusurmustu)
      db.prepare('UPDATE malzemeler SET stok_miktari = stok_miktari + ? WHERE id = ?')
        .run(h.miktar, h.malzeme_id);
      // Hareketi sil
      db.prepare('DELETE FROM malzeme_hareketleri WHERE id = ?').run(h.id);
    }
    return { basarili: true };
  },

  ozet(p) {
    return `${p.malzeme_adi} x ${p.miktar} ${p.birim || 'adet'} -> depodan cikis${p.hedef_konum ? ` -> ${p.hedef_konum}` : ''}`;
  },
});
