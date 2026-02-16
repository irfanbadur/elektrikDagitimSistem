const { getDb } = require('../../db/database');

class AiBildirimService {

  /**
   * Periyodik kontrol — sorunları tespit et, bildirim üret
   */
  kontrol() {
    const bildirimler = [];

    // 1. Düşük stok uyarısı
    const dusukStok = getDb().prepare(
      'SELECT malzeme_adi as ad, stok_miktari, kritik_seviye as min_stok FROM malzemeler WHERE stok_miktari <= kritik_seviye AND kritik_seviye > 0'
    ).all();
    for (const m of dusukStok) {
      bildirimler.push({
        tip: 'stok_uyari', oncelik: 'yuksek',
        mesaj: `${m.ad}: ${m.stok_miktari} adet kaldı (minimum: ${m.min_stok})`,
      });
    }

    // 2. Aşılan topraklama değerleri
    const kotuTopraklama = getDb().prepare(
      'SELECT dk.direk_no, dk.topraklama_direnc, p.proje_no FROM direk_kayitlar dk JOIN projeler p ON p.id = dk.proje_id WHERE dk.topraklama_direnc > 10'
    ).all();
    for (const d of kotuTopraklama) {
      bildirimler.push({
        tip: 'topraklama_tehlike', oncelik: 'acil',
        mesaj: `${d.proje_no} Direk ${d.direk_no}: Topraklama ${d.topraklama_direnc}Ohm — standart aşıldı!`,
      });
    }

    // 3. Açık tespitler (3 günden eski)
    const eskiTespitler = getDb().prepare(`
      SELECT st.aciklama, st.tespit_tipi, p.proje_no,
        julianday('now') - julianday(st.olusturma_tarihi) as gun
      FROM saha_tespitler st
      JOIN projeler p ON p.id = st.proje_id
      WHERE st.durum = 'acik' AND julianday('now') - julianday(st.olusturma_tarihi) > 3
    `).all();
    for (const t of eskiTespitler) {
      bildirimler.push({
        tip: 'eski_tespit', oncelik: 'normal',
        mesaj: `${t.proje_no}: "${t.aciklama.substring(0, 40)}..." tespiti ${Math.round(t.gun)} gündür açık`,
      });
    }

    // 4. Yaklaşan bitiş tarihi
    const yaklasanProjeler = getDb().prepare(`
      SELECT proje_no, musteri_adi, bitis_tarihi,
        julianday(bitis_tarihi) - julianday('now') as kalan_gun
      FROM projeler
      WHERE durum = 'devam_eden' AND julianday(bitis_tarihi) - julianday('now') BETWEEN 0 AND 7
    `).all();
    for (const p of yaklasanProjeler) {
      bildirimler.push({
        tip: 'bitis_yaklasma', oncelik: 'yuksek',
        mesaj: `${p.proje_no} (${p.musteri_adi}): Bitiş tarihine ${Math.round(p.kalan_gun)} gün kaldı!`,
      });
    }

    // 5. İlerleme gecikmesi
    const gecikenProjeler = getDb().prepare(`
      SELECT p.proje_no, p.musteri_adi,
        (SELECT toplam_ilerleme_yuzde FROM gunluk_ilerleme WHERE proje_id = p.id ORDER BY tarih DESC LIMIT 1) as ilerleme,
        julianday(p.bitis_tarihi) - julianday('now') as kalan_gun,
        julianday('now') - julianday(p.baslama_tarihi) as gecen_gun,
        julianday(p.bitis_tarihi) - julianday(p.baslama_tarihi) as toplam_gun
      FROM projeler p WHERE p.durum = 'devam_eden'
    `).all();
    for (const p of gecikenProjeler) {
      if (!p.toplam_gun || !p.ilerleme) continue;
      const beklenenIlerleme = (p.gecen_gun / p.toplam_gun) * 100;
      if (p.ilerleme < beklenenIlerleme - 15) {
        bildirimler.push({
          tip: 'ilerleme_gecikme', oncelik: 'yuksek',
          mesaj: `${p.proje_no}: İlerleme %${Math.round(p.ilerleme)}, beklenen %${Math.round(beklenenIlerleme)} — geride`,
        });
      }
    }

    return bildirimler;
  }
}

module.exports = new AiBildirimService();
