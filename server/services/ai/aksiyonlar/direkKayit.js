const { getDb } = require('../../../db/database');
const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'direk_kayit', etiket: 'Direk Kayıt', ikon: '🔩',
  kategori: 'saha', riskSeviyesi: 'dusuk',
  aciklama: 'Direk üzerindeki malzeme durumunu ve notları günceller',

  dogrula(params) {
    const hatalar = [];
    if (!params.direk_kayit_id && !params.direk_no) hatalar.push('Direk belirtilmeli');
    if (!params.malzeme_durum && !params.notlar && !params.durum) hatalar.push('En az bir güncelleme olmalı');
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

    if (!direkId) {
      return { basarili: false, mesaj: `Direk bulunamadı: ${params.direk_no}` };
    }

    const eskiDeger = db.prepare('SELECT malzeme_durum, durum, notlar FROM direk_kayitlar WHERE id = ?').get(direkId);

    const updates = [];
    const values = [];

    if (params.malzeme_durum) {
      let mevcutMalzeme = {};
      try { mevcutMalzeme = JSON.parse(eskiDeger?.malzeme_durum || '{}'); } catch { /* ignore */ }
      const yeniMalzeme = { ...mevcutMalzeme, ...params.malzeme_durum };
      updates.push('malzeme_durum = ?');
      values.push(JSON.stringify(yeniMalzeme));

      const toplam = Object.values(yeniMalzeme).reduce((s, m) => s + (m.proje || 0), 0);
      const mevcut = Object.values(yeniMalzeme).reduce((s, m) => s + (m.mevcut || 0), 0);
      const yuzde = toplam > 0 ? Math.round((mevcut / toplam) * 100) : 0;
      updates.push('tamamlanma_yuzdesi = ?');
      values.push(yuzde);
    }

    if (params.durum) {
      updates.push('durum = ?');
      values.push(params.durum);
    }

    if (params.notlar) {
      updates.push('notlar = CASE WHEN notlar IS NULL THEN ? ELSE notlar || char(10) || ? END');
      values.push(params.notlar, params.notlar);
    }

    updates.push('son_islem_yapan_id = ?');
    values.push(context.kullaniciId);
    updates.push("guncelleme_tarihi = datetime('now')");

    db.prepare(`UPDATE direk_kayitlar SET ${updates.join(', ')} WHERE id = ?`)
      .run(...values, direkId);

    db.prepare(`
      INSERT INTO direk_islem_gecmisi (direk_kayit_id, islem_tipi, eski_deger, yeni_deger, islem_yapan_id)
      VALUES (?, 'malzeme_guncelle', ?, ?, ?)
    `).run(direkId, JSON.stringify(eskiDeger), JSON.stringify(params), context.kullaniciId);

    return {
      basarili: true,
      sonuc: { direk_kayit_id: direkId },
      mesaj: `Direk ${params.direk_no || '#' + direkId} güncellendi`,
    };
  },

  geriAl(sonuc) {
    const db = getDb();
    const son = db.prepare(
      'SELECT * FROM direk_islem_gecmisi WHERE direk_kayit_id = ? ORDER BY id DESC LIMIT 1'
    ).get(sonuc.direk_kayit_id);
    if (son?.eski_deger) {
      const eski = JSON.parse(son.eski_deger);
      db.prepare('UPDATE direk_kayitlar SET malzeme_durum = ?, durum = ?, notlar = ? WHERE id = ?')
        .run(eski.malzeme_durum, eski.durum, eski.notlar, sonuc.direk_kayit_id);
    }
    return { basarili: true };
  },

  ozet(p) {
    const parcalar = [];
    if (p.direk_no) parcalar.push(`Direk ${p.direk_no}`);
    if (p.malzeme_durum) {
      const items = Object.entries(p.malzeme_durum).map(([k, v]) => `${k}: ${v.mevcut}/${v.proje}`);
      parcalar.push(items.join(', '));
    }
    if (p.durum) parcalar.push(`→ ${p.durum}`);
    return parcalar.join(' — ');
  },
});
