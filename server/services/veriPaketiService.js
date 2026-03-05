const { getDb } = require('../db/database');
const dosyaService = require('./dosyaService');
const donguService = require('./donguService');
const fazService = require('./fazService');

class VeriPaketiService {

  /**
   * Yeni veri paketi oluştur
   * Aktif aşama otomatik bağlanır
   */
  olustur({ paketTipi, personelId, ekipId, projeId, bolgeId, baslik, notlar, kaynak = 'web' }) {
    const db = getDb();

    // Aktif aşama ve adımı otomatik bağla
    const aktifAsamaId = donguService.aktifAsamaIdGetir(projeId);
    const aktifAdimId = fazService.aktifAdimIdGetir(projeId);

    const result = db.prepare(`
      INSERT INTO veri_paketleri (
        paket_tipi, personel_id, ekip_id, proje_id, bolge_id,
        baslik, notlar, kaynak, proje_asama_id, proje_adim_id, durum
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'devam_ediyor')
    `).run(paketTipi, personelId, ekipId, projeId, bolgeId, baslik, notlar, kaynak, aktifAsamaId, aktifAdimId);

    // Paket no otomatik trigger ile oluşur
    const paket = db.prepare('SELECT * FROM veri_paketleri WHERE id = ?').get(result.lastInsertRowid);
    return paket;
  }

  /**
   * Pakete dosya ekle
   */
  async dosyaEkle(paketId, buffer, dosyaBilgisi) {
    const paket = this.getir(paketId);
    if (!paket) throw new Error('Paket bulunamadı');

    const db = getDb();
    let projeNo = null;
    if (paket.proje_id) {
      const proje = db.prepare('SELECT proje_no FROM projeler WHERE id = ?').get(paket.proje_id);
      projeNo = proje?.proje_no;
    }

    let ekipKodu = null;
    if (paket.ekip_id) {
      const ekip = db.prepare('SELECT ekip_kodu FROM ekipler WHERE id = ?').get(paket.ekip_id);
      ekipKodu = ekip?.ekip_kodu;
    }

    const dosya = await dosyaService.dosyaYukle(buffer, {
      ...dosyaBilgisi,
      projeNo,
      projeId: paket.proje_id,
      ekipId: paket.ekip_id,
      ekipKodu,
      yukleyenId: dosyaBilgisi.yukleyenId || paket.personel_id,
      veriPaketiId: paketId,
      kaynak: paket.kaynak,
    });

    // Paketin konumunu ilk GPS'li dosyadan al
    if (!paket.latitude && dosya.latitude) {
      db.prepare(`
        UPDATE veri_paketleri SET latitude = ?, longitude = ?, guncelleme_tarihi = datetime('now')
        WHERE id = ? AND latitude IS NULL
      `).run(dosya.latitude, dosya.longitude, paketId);
    }

    return dosya;
  }

  /**
   * Pakete not ekle
   */
  notEkle(paketId, notMetni) {
    const db = getDb();
    const paket = this.getir(paketId);
    if (!paket) throw new Error('Paket bulunamadı');

    const mevcutNot = paket.notlar ? paket.notlar + '\n' : '';
    db.prepare(`
      UPDATE veri_paketleri SET
        notlar = ?,
        guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(mevcutNot + notMetni, paketId);
  }

  /**
   * Paketi tamamla
   */
  tamamla(paketId) {
    const db = getDb();
    db.prepare(`
      UPDATE veri_paketleri SET
        durum = 'tamamlandi',
        tamamlanma_zamani = datetime('now'),
        guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(paketId);
  }

  /**
   * Tek paket getir
   */
  getir(paketId) {
    const db = getDb();
    return db.prepare('SELECT * FROM veri_paketleri WHERE id = ?').get(paketId);
  }

  getirDetayli(paketId) {
    const db = getDb();
    const paket = db.prepare(`
      SELECT vp.*,
        p.proje_no, p.musteri_adi AS proje_adi,
        e.ekip_adi, e.ekip_kodu,
        pr.ad_soyad AS personel_adi
      FROM veri_paketleri vp
      LEFT JOIN projeler p ON vp.proje_id = p.id
      LEFT JOIN ekipler e ON vp.ekip_id = e.id
      LEFT JOIN personel pr ON vp.personel_id = pr.id
      WHERE vp.id = ?
    `).get(paketId);

    if (!paket) return null;

    const dosyalar = dosyaService.dosyalariGetir({ veriPaketiId: paketId });
    return { ...paket, dosyalar };
  }

  /**
   * Paketleri listele (filtreli)
   */
  listele({ projeId, ekipId, paketTipi, durum, projeDurum, dosyaKategori, siralama, limit = 50, offset = 0 } = {}) {
    const db = getDb();
    let where = [];
    let params = [];

    if (projeId) { where.push('vp.proje_id = ?'); params.push(projeId); }
    if (ekipId) { where.push('vp.ekip_id = ?'); params.push(ekipId); }
    if (paketTipi) { where.push('vp.paket_tipi = ?'); params.push(paketTipi); }
    if (durum) { where.push('vp.durum = ?'); params.push(durum); }
    if (projeDurum) { where.push('p.durum = ?'); params.push(projeDurum); }
    if (dosyaKategori) {
      where.push('vp.id IN (SELECT veri_paketi_id FROM dosyalar WHERE kategori = ? AND durum = \'aktif\')');
      params.push(dosyaKategori);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const SIRALAMA_MAP = {
      tarih_yeni: 'vp.olusturma_tarihi DESC',
      tarih_eski: 'vp.olusturma_tarihi ASC',
      alfabe_az: 'vp.paket_no ASC',
      alfabe_za: 'vp.paket_no DESC',
    };
    const orderBy = SIRALAMA_MAP[siralama] || 'vp.olusturma_tarihi DESC';

    return db.prepare(`
      SELECT vp.*,
        p.proje_no, p.musteri_adi AS proje_adi,
        e.ekip_adi, e.ekip_kodu,
        pr.ad_soyad AS personel_adi
      FROM veri_paketleri vp
      LEFT JOIN projeler p ON vp.proje_id = p.id
      LEFT JOIN ekipler e ON vp.ekip_id = e.id
      LEFT JOIN personel pr ON vp.personel_id = pr.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
  }

  /**
   * Personelin aktif (devam eden) paketini bul
   */
  aktifPaketBul(personelId, timeoutDakika = 15) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM veri_paketleri
      WHERE personel_id = ?
        AND durum = 'devam_ediyor'
        AND datetime(guncelleme_tarihi, '+' || ? || ' minutes') > datetime('now')
      ORDER BY olusturma_tarihi DESC
      LIMIT 1
    `).get(personelId, timeoutDakika);
  }

  /**
   * Koordinatör onay/red
   */
  onayla(paketId, { durum, onaylayanId, onayNotu }) {
    const db = getDb();
    db.prepare(`
      UPDATE veri_paketleri SET
        durum = ?,
        onaylayan_id = ?,
        onay_tarihi = datetime('now'),
        onay_notu = ?,
        guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(durum, onaylayanId, onayNotu, paketId);
  }
}

module.exports = new VeriPaketiService();
