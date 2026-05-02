/**
 * Metraj Geçmiş Servisi — hak_edis_metraj ve proje_kesif_metraj için undo/redo.
 *
 * Çalışma mantığı:
 *   - Her ekle/güncelle/sil işlemi metraj_islem_gecmisi tablosuna log'lanır.
 *   - Aynı kullanıcı işlemi (örn. Otomatik Tespit) batch_id ile gruplanır;
 *     bir undo tüm gruba uygulanır.
 *   - undo: en son geri_alindi=0 kaydı/grubu bul → ters işlem uygula → geri_alindi=1.
 *   - redo: en son geri_alindi=1 kaydı/grubu bul → tekrar uygula → geri_alindi=0.
 *   - Yeni bir işlem (manuel ekle/sil/güncelle) yapıldığında ileri yöndeki
 *     redo zinciri kesilir (geri_alindi=1 olan kayıtlar silinir).
 */
const { getDb } = require('../db/database');

const TABLOLAR = ['hak_edis_metraj', 'proje_kesif_metraj'];
const ISLEM_TIPLERI = ['ekle', 'guncelle', 'sil'];

// Tablo şeması — her iki tabloda da aynı kolonlar var (id, olusturma/guncelleme tarihleri hariç insert için)
const KOLONLAR = [
  'id','proje_id','sira','nokta1','nokta2','nokta_durum',
  'direk_tur','direk_tip','traversler',
  'ara_mesafe','ag_iletken_durum','og_iletken_durum',
  'ag_iletken','og_iletken',
  'yeni_iletken','dmm_iletken',
  'kaynak','kaynak_direk_x','kaynak_direk_y',
  'sprite_veri','notlar',
];

function tabloDogrula(tablo) {
  if (!TABLOLAR.includes(tablo)) {
    throw new Error(`Geçersiz tablo: ${tablo}`);
  }
}

// İşlem kayıt et — route handler'ı tarafından çağrılır
function kayit({ proje_id, tablo, islem_tipi, satir_id, eski_satir, yeni_satir, batch_id, aciklama }) {
  tabloDogrula(tablo);
  if (!ISLEM_TIPLERI.includes(islem_tipi)) {
    throw new Error(`Geçersiz işlem tipi: ${islem_tipi}`);
  }
  const db = getDb();

  // Yeni bir işlem yapıldı — ileri zincirde (geri_alindi=1) olan kayıtları temizle (redo zinciri kesilir)
  db.prepare(`
    DELETE FROM metraj_islem_gecmisi
    WHERE proje_id = ? AND tablo = ? AND geri_alindi = 1
  `).run(proje_id, tablo);

  db.prepare(`
    INSERT INTO metraj_islem_gecmisi
      (proje_id, tablo, islem_tipi, satir_id, eski_satir, yeni_satir, batch_id, aciklama, tarih)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    proje_id, tablo, islem_tipi,
    satir_id || null,
    eski_satir ? JSON.stringify(eski_satir) : null,
    yeni_satir ? JSON.stringify(yeni_satir) : null,
    batch_id || null,
    aciklama || null,
    Date.now()
  );

  // Eski kayıtları temizle — proje × tablo başına en son 200 işlemi tut
  db.prepare(`
    DELETE FROM metraj_islem_gecmisi
    WHERE id IN (
      SELECT id FROM metraj_islem_gecmisi
      WHERE proje_id = ? AND tablo = ?
      ORDER BY tarih DESC, id DESC
      LIMIT -1 OFFSET 200
    )
  `).run(proje_id, tablo);
}

// Bir işlem kaydını ters çevirip uygulayan iç yardımcı (batch içinde çağrılır)
function tersUygula(db, kayit) {
  const tablo = kayit.tablo;
  const islem = kayit.islem_tipi;
  const eski = kayit.eski_satir ? JSON.parse(kayit.eski_satir) : null;
  const yeni = kayit.yeni_satir ? JSON.parse(kayit.yeni_satir) : null;

  if (islem === 'ekle') {
    // ters: satırı sil
    db.prepare(`DELETE FROM ${tablo} WHERE id = ?`).run(kayit.satir_id);
  } else if (islem === 'sil') {
    // ters: eski satırı eski id ile geri ekle
    insertEskiSatir(db, tablo, eski);
  } else if (islem === 'guncelle') {
    // ters: eski değerlerle güncelle
    updateSatir(db, tablo, kayit.satir_id, eski);
  }
}

// İleri (redo) — orijinal işlemi tekrar uygula
function ileriUygula(db, kayit) {
  const tablo = kayit.tablo;
  const islem = kayit.islem_tipi;
  const yeni = kayit.yeni_satir ? JSON.parse(kayit.yeni_satir) : null;

  if (islem === 'ekle') {
    insertEskiSatir(db, tablo, yeni);
  } else if (islem === 'sil') {
    db.prepare(`DELETE FROM ${tablo} WHERE id = ?`).run(kayit.satir_id);
  } else if (islem === 'guncelle') {
    updateSatir(db, tablo, kayit.satir_id, yeni);
  }
}

function insertEskiSatir(db, tablo, satir) {
  if (!satir) return;
  // Tüm kolon listesinden id dahil, olusturma_tarihi/guncelleme_tarihi hariç
  const sutunlar = KOLONLAR.filter(k => satir[k] !== undefined);
  const placeholders = sutunlar.map(() => '?').join(', ');
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO ${tablo} (${sutunlar.join(', ')}) VALUES (${placeholders})`
  );
  stmt.run(...sutunlar.map(k => satir[k] === undefined ? null : satir[k]));
}

function updateSatir(db, tablo, id, yeniDeger) {
  if (!yeniDeger || !id) return;
  const sutunlar = KOLONLAR.filter(k => k !== 'id' && k !== 'proje_id' && yeniDeger[k] !== undefined);
  const setStr = sutunlar.map(k => `${k} = ?`).join(', ');
  const stmt = db.prepare(`UPDATE ${tablo} SET ${setStr}, guncelleme_tarihi = datetime('now') WHERE id = ?`);
  stmt.run(...sutunlar.map(k => yeniDeger[k] === undefined ? null : yeniDeger[k]), id);
}

// Undo — son geri-alınmamış kayıt/grubu bul, ters uygula
function undo({ proje_id, tablo }) {
  tabloDogrula(tablo);
  const db = getDb();

  const son = db.prepare(`
    SELECT * FROM metraj_islem_gecmisi
    WHERE proje_id = ? AND tablo = ? AND geri_alindi = 0
    ORDER BY tarih DESC, id DESC LIMIT 1
  `).get(proje_id, tablo);
  if (!son) return { undone: 0, mesaj: 'Geri alınacak işlem yok' };

  let kayitlar;
  if (son.batch_id) {
    kayitlar = db.prepare(`
      SELECT * FROM metraj_islem_gecmisi
      WHERE proje_id = ? AND tablo = ? AND batch_id = ? AND geri_alindi = 0
      ORDER BY tarih DESC, id DESC
    `).all(proje_id, tablo, son.batch_id);
  } else {
    kayitlar = [son];
  }

  const tx = db.transaction(() => {
    for (const k of kayitlar) {
      tersUygula(db, k);
      db.prepare('UPDATE metraj_islem_gecmisi SET geri_alindi = 1 WHERE id = ?').run(k.id);
    }
  });
  tx();

  return {
    undone: kayitlar.length,
    batch_id: son.batch_id,
    aciklama: son.aciklama || `${kayitlar.length} işlem geri alındı`,
  };
}

// Redo — son geri-alınmış kayıt/grubu bul, tekrar uygula
function redo({ proje_id, tablo }) {
  tabloDogrula(tablo);
  const db = getDb();

  // Geri_alindi=1 olan en eski (zaman olarak en yakın geri alınan) kayıt grubu
  const ilk = db.prepare(`
    SELECT * FROM metraj_islem_gecmisi
    WHERE proje_id = ? AND tablo = ? AND geri_alindi = 1
    ORDER BY tarih ASC, id ASC LIMIT 1
  `).get(proje_id, tablo);
  if (!ilk) return { redone: 0, mesaj: 'Tekrar uygulanacak işlem yok' };

  let kayitlar;
  if (ilk.batch_id) {
    kayitlar = db.prepare(`
      SELECT * FROM metraj_islem_gecmisi
      WHERE proje_id = ? AND tablo = ? AND batch_id = ? AND geri_alindi = 1
      ORDER BY tarih ASC, id ASC
    `).all(proje_id, tablo, ilk.batch_id);
  } else {
    kayitlar = [ilk];
  }

  const tx = db.transaction(() => {
    for (const k of kayitlar) {
      ileriUygula(db, k);
      db.prepare('UPDATE metraj_islem_gecmisi SET geri_alindi = 0 WHERE id = ?').run(k.id);
    }
  });
  tx();

  return {
    redone: kayitlar.length,
    batch_id: ilk.batch_id,
    aciklama: ilk.aciklama || `${kayitlar.length} işlem tekrar uygulandı`,
  };
}

// Geçmiş listesi — UI'da göstermek için
function gecmisListele({ proje_id, tablo, limit = 30 }) {
  tabloDogrula(tablo);
  const db = getDb();
  const kayitlar = db.prepare(`
    SELECT id, islem_tipi, satir_id, batch_id, aciklama, geri_alindi, tarih
    FROM metraj_islem_gecmisi
    WHERE proje_id = ? AND tablo = ?
    ORDER BY tarih DESC, id DESC
    LIMIT ?
  `).all(proje_id, tablo, limit);

  // Batch'leri grupla
  const gruplar = [];
  const batchSet = new Set();
  for (const k of kayitlar) {
    if (k.batch_id) {
      if (batchSet.has(k.batch_id)) continue;
      batchSet.add(k.batch_id);
      const ayniBatch = kayitlar.filter(x => x.batch_id === k.batch_id);
      gruplar.push({
        tip: 'batch',
        batch_id: k.batch_id,
        islem_sayisi: ayniBatch.length,
        aciklama: k.aciklama,
        geri_alindi: ayniBatch.every(x => x.geri_alindi === 1),
        tarih: k.tarih,
      });
    } else {
      gruplar.push({
        tip: 'tek',
        id: k.id,
        islem_tipi: k.islem_tipi,
        satir_id: k.satir_id,
        aciklama: k.aciklama,
        geri_alindi: k.geri_alindi === 1,
        tarih: k.tarih,
      });
    }
  }
  return gruplar;
}

// Undo/Redo butonlarının enable/disable durumu için sayım
function durum({ proje_id, tablo }) {
  tabloDogrula(tablo);
  const db = getDb();
  const undoVar = db.prepare(`
    SELECT EXISTS(SELECT 1 FROM metraj_islem_gecmisi WHERE proje_id = ? AND tablo = ? AND geri_alindi = 0) as v
  `).get(proje_id, tablo).v;
  const redoVar = db.prepare(`
    SELECT EXISTS(SELECT 1 FROM metraj_islem_gecmisi WHERE proje_id = ? AND tablo = ? AND geri_alindi = 1) as v
  `).get(proje_id, tablo).v;
  return { undo: !!undoVar, redo: !!redoVar };
}

module.exports = { kayit, undo, redo, gecmisListele, durum };
