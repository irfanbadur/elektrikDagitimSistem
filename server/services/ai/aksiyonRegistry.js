/**
 * Yeni aksiyon eklemek icin:
 * 1. aksiyonlar/ klasorune yeni dosya olustur
 * 2. Standart interface'i uygula (bilgi, dogrula, uygula, geriAl)
 * 3. Bu dosyada require() ile kaydet
 *
 * Her aksiyon su interface'i uygulamali:
 * {
 *   tip, etiket, ikon, kategori, riskSeviyesi, aciklama,
 *   dogrula(params, context): { gecerli, hatalar[] }
 *   uygula(params, context): { basarili, sonuc, mesaj }
 *   geriAl(uygulamaSonuc, context): { basarili }
 *   ozet(params): string
 * }
 */

class AksiyonRegistry {
  constructor() { this.aksiyonlar = new Map(); }

  kaydet(tanim) {
    if (!tanim.tip) throw new Error('Aksiyon tipi zorunlu');
    if (!tanim.uygula) throw new Error('uygula() fonksiyonu zorunlu');
    this.aksiyonlar.set(tanim.tip, tanim);
    console.log(`[AI] Aksiyon kaydedildi: ${tanim.tip} (${tanim.etiket})`);
  }

  getir(tip) { return this.aksiyonlar.get(tip); }

  tumunu() {
    return Array.from(this.aksiyonlar.values()).map(a => ({
      tip: a.tip, etiket: a.etiket, ikon: a.ikon,
      kategori: a.kategori, riskSeviyesi: a.riskSeviyesi, aciklama: a.aciklama,
    }));
  }
}

const registry = new AksiyonRegistry();

// Export ONCE, sonra aksiyonlari yukle (circular dependency onlemi)
module.exports = registry;

// Kayitlari yukle
require('./aksiyonlar/depoGiris');
require('./aksiyonlar/depoCikis');
require('./aksiyonlar/asamaIlerlet');
require('./aksiyonlar/belgeParse');
require('./aksiyonlar/tutanakOlustur');
require('./aksiyonlar/paketSiniflandir');
