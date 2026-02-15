const providerManager = require('./providerManager');

class AiParseService {

  /**
   * ANA PARSE — Metin ve/veya gorselleri analiz et, aksiyon plani dondur
   * Provider-agnostic: .env'deki AI_PROVIDER'a gore Ollama/Gemini/Groq kullanir
   */
  async parseEt({ metin, gorseller = [], belgeler = [], context = {} }) {
    const sistemPromptu = this._sistemPromptu(context);
    let sonuc;

    if (gorseller.length > 0) {
      const mesaj = metin
        ? `${metin}\n\nEklenen gorselleri analiz et ve mesajla birlikte degerlendir.`
        : 'Bu gorseli analiz et ve icerigini yapilandirilmis JSON olarak dondur.';
      const aiYanit = await providerManager.gorselGonder(sistemPromptu, mesaj, gorseller);
      sonuc = this._yanitParsele(aiYanit.metin);
      sonuc._provider = aiYanit.provider;
      sonuc._fallback = aiYanit.fallback;
    } else {
      const aiYanit = await providerManager.metinGonder(sistemPromptu, metin);
      sonuc = this._yanitParsele(aiYanit.metin);
      sonuc._provider = aiYanit.provider;
      sonuc._fallback = aiYanit.fallback;
    }

    return sonuc;
  }

  /** Sistem promptu — AI'nin ElektraTrack'i anlamasi */
  _sistemPromptu(context) {
    return `Sen ElektraTrack adli elektrik dagitim muteahhitligi proje takip sisteminin AI asistanisin.

GOREV: Kullanicinin mesajini (metin ve/veya gorsel) analiz et, yapilmasi gereken sistem aksiyonlarini belirle.

SISTEM BILGISI:
- Depo stok yonetimi var (malzeme giris/cikis/transfer)
- Proje yasam dongusu var (asama baslat/tamamla)
- Veri paketleri var (saha raporlari, tespit paketleri)
- Dosya yonetimi var (8 alan: proje, personel, ekipman, ihale, isg, firma, muhasebe, kurum)
- Personel ve ekip yonetimi var

MEVCUT BAGLAM:
- Kullanici: ${context.kullaniciAdi || 'bilinmiyor'}
- Rol: ${context.rol || 'bilinmiyor'}
- Aktif proje: ${context.projeNo || 'yok'}
- Ekip: ${context.ekipAdi || 'yok'}

KULLANILABILIR AKSIYON TIPLERI:
${context.aksiyonTipleri || '(yukleniyor)'}

DEPODAKI MALZEMELER (malzeme_kodu | adi | stok):
${context.malzemeListesi || '(bos)'}
ONEMLI: Malzeme kodu olarak SADECE yukaridaki listedeki kodlari kullan. Eger eslesme bulamazsan en yakin eslesen kodu sec.

CIKTI FORMATI — KESINLIKLE bu JSON formatinda yanitla, baska metin ekleme:

{
  "anlama": {
    "ozet": "Kullanicinin ne istediginin kisa aciklamasi",
    "guven": 0.95,
    "belirsizlikler": ["varsa belirsiz noktalar"]
  },
  "aksiyonlar": [
    {
      "tip": "depo_cikis",
      "oncelik": 1,
      "params": {
        "malzeme_kodu": "12I_A_DIREK",
        "malzeme_adi": "12I A tipi direk",
        "miktar": 3,
        "birim": "adet",
        "hedef_konum": "Elalan koyu",
        "ekip_id": 1
      }
    }
  ],
  "uyarilar": ["Stok kontrolu yapilmali"],
  "sorular": []
}

KURALLAR:
1. Belirsiz durumlarda "sorular"a soru ekle, aksiyon ekleme
2. Birden fazla aksiyon gerekiyorsa hepsini listele (sirali)
3. Stok azaltma + lokasyon + tutanak gibi iliskili aksiyonlari birlikte planla
4. Gorsel parse ediyorsan tum satirlari yapilandirilmis dondur
5. Guven 0.7 altindaysa sorular dizisine ne sorulmali ekle
6. Malzeme kodlarini standardize et (buyuk harf, alt cizgi)`;
  }

  /** AI yanitini JSON'a parse et */
  _yanitParsele(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON bulunamadi');
      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      return {
        anlama: { ozet: 'Parse hatasi', guven: 0, belirsizlikler: [err.message] },
        aksiyonlar: [], uyarilar: ['AI yaniti parse edilemedi'], sorular: [],
      };
    }
  }
}

module.exports = new AiParseService();
