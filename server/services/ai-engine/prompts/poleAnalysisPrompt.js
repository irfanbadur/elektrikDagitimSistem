module.exports = {
  buildPrompt: (katalogVerisi = null) => {
    let prompt = `Sen bir elektrik dagitim hatti muhendisisin.
Bu fotografta bir elektrik direginin tepesi gorunuyor.

FOTOGRAFTAKİ TUM EKİPMANLARI TESPİT ET ve asagidaki JSON formatinda dondur:

{
  "direk_bilgisi": {
    "direk_tipi": "beton|ahsap|celik|kompozit",
    "tahmini_boy_m": 10,
    "gerilim_sinifi": "AG|OG",
    "hat_tipi": "havai_hat|yeralti_cikis|dagitim",
    "genel_durum": "iyi|orta|kotu|tehlikeli"
  },
  "ekipmanlar": [
    {
      "kategori": "konsol|izolator|iletken|armatur|ayirici|trafo|pano|topraklama|aksesuar",
      "tip": "detayli tip adi",
      "alt_tip": "varsa alt tip",
      "miktar": 2,
      "konum": "ust_sol|ust_sag|ust_orta|orta|alt|yan",
      "durum": "yeni|iyi|orta|kotu|hasarli",
      "guven_yuzdesi": 85,
      "notlar": "ek aciklama varsa"
    }
  ],
  "hat_bilgisi": {
    "faz_sayisi": 3,
    "notr_var": true,
    "aydinlatma_hatti_var": false,
    "iletken_tipi_tahmini": "ACSR/AAC/bakir",
    "iletken_kesit_tahmini": "50-95mm2"
  },
  "ek_elemanlar": {
    "topraklama_inis_iletkeni": true,
    "direk_plakasi": true,
    "uyari_levhasi": false,
    "bosluk_cubugu": false,
    "kus_koruyucu": false,
    "tirmanma_engeli": false
  },
  "hasar_tespiti": {
    "hasar_var": false,
    "hasarlar": [],
    "acil_mudahale_gerekli": false
  },
  "toplam_malzeme_ozeti": [
    {"malzeme": "L Konsol 1200mm", "miktar": 2, "birim": "adet"}
  ],
  "guven_skoru": 0.78,
  "analiz_notlari": "Genel degerlendirme ve belirsizlikler"
}

ONEMLI KURALLAR:
1. Emin olmadigin ekipmanlar icin guven_yuzdesi dusuk ver (<%60)
2. Iletken kesitini fotograftan kesin tespit etmek zordur, tahmini yaz
3. Izolator sayisini dikkatli say
4. Konsol tipini sekline gore belirle: L (tek kol), T (cift kol, simetrik), V (capraz)
5. Sadece JSON dondur`;

    if (katalogVerisi && katalogVerisi.length > 0) {
      prompt += `\n\n--- SISTEMDEKI MALZEME KATALOGU (Referans) ---\n`;
      for (const item of katalogVerisi) {
        prompt += `- [${item.ekipman_kodu}] ${item.ekipman_adi}`;
        if (item.gorsel_ozellikler) {
          try {
            const ozellik = JSON.parse(item.gorsel_ozellikler);
            prompt += ` | Gorsel: ${Object.values(ozellik).join(', ')}`;
          } catch {}
        }
        prompt += '\n';
      }
    }
    return prompt;
  },

  buildCountPrompt: (katalogVerisi = null) => {
    let prompt = `Bu fotograftaki elektrik diregindeki TUM MALZEMELERI say.

JSON formatinda dondur:
{
  "malzemeler": [
    {"malzeme": "isim", "tip": "detay", "miktar": 2, "birim": "adet", "guven": 80}
  ],
  "toplam_cesit": 5,
  "notlar": "belirsizlikler"
}

Sadece JSON dondur.`;

    if (katalogVerisi && katalogVerisi.length > 0) {
      prompt += '\n\nReferans katalog:\n';
      for (const item of katalogVerisi) {
        prompt += `- [${item.ekipman_kodu}] ${item.ekipman_adi}\n`;
      }
    }
    return prompt;
  }
};
