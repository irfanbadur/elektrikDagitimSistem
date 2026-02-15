const { getDb } = require('../../../db/database');
const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'asama_ilerlet', etiket: 'Asama Ilerlet', ikon: '⏭️',
  kategori: 'proje', riskSeviyesi: 'orta',
  aciklama: 'Proje asamasini baslatir veya tamamlar',

  dogrula(params) {
    const hatalar = [];
    if (!params.proje_id) hatalar.push('Proje belirtilmeli');
    if (!params.islem || !['baslat', 'tamamla'].includes(params.islem)) hatalar.push('"baslat" veya "tamamla" olmali');
    return { gecerli: hatalar.length === 0, hatalar };
  },

  uygula(params) {
    const db = getDb();

    if (params.islem === 'tamamla') {
      // Aktif asamayi bul
      const aktif = db.prepare(
        "SELECT * FROM proje_asamalari WHERE proje_id = ? AND durum = 'aktif' LIMIT 1"
      ).get(params.proje_id);
      if (!aktif) return { basarili: false, mesaj: 'Aktif asama bulunamadi' };

      // Tamamla: bitis_tarihi (gercek schema kolonu)
      db.prepare(
        "UPDATE proje_asamalari SET durum = 'tamamlandi', bitis_tarihi = date('now'), guncelleme_tarihi = datetime('now') WHERE id = ?"
      ).run(aktif.id);

      // Siradaki asamayi bul
      const sonraki = db.prepare(
        "SELECT * FROM proje_asamalari WHERE proje_id = ? AND durum = 'bekliyor' ORDER BY sira LIMIT 1"
      ).get(params.proje_id);

      return {
        basarili: true,
        sonuc: { tamamlanan_id: aktif.id, sonraki_id: sonraki?.id },
        mesaj: `"${aktif.asama_adi}" tamamlandi${sonraki ? `, siradaki: "${sonraki.asama_adi}"` : ' - tum asamalar bitti!'}`,
      };
    } else {
      // Baslat: bekleyen ilk asamayi aktif yap
      const hedef = db.prepare(
        "SELECT * FROM proje_asamalari WHERE proje_id = ? AND durum = 'bekliyor' ORDER BY sira LIMIT 1"
      ).get(params.proje_id);
      if (!hedef) return { basarili: false, mesaj: 'Baslatilacak asama yok' };

      // Baslat: baslangic_tarihi (gercek schema kolonu)
      db.prepare(
        "UPDATE proje_asamalari SET durum = 'aktif', baslangic_tarihi = date('now'), guncelleme_tarihi = datetime('now') WHERE id = ?"
      ).run(hedef.id);

      return {
        basarili: true,
        sonuc: { baslayan_id: hedef.id },
        mesaj: `"${hedef.asama_adi}" baslatildi`,
      };
    }
  },

  geriAl() { return { basarili: false, mesaj: 'Asama ilerletme geri alinamaz' }; },
  ozet(p) { return p.islem === 'tamamla' ? 'Aktif asamayi tamamla' : 'Siradaki asamayi baslat'; },
});
