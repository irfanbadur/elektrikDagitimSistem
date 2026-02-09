module.exports = {
  buildPrompt: () => `Bu fotograftaki elektrik dagitim ekipmaninin HASAR ANALIZINI yap.

JSON formatinda dondur:
{
  "hasar_var": true,
  "hasar_seviyesi": "yok|hafif|orta|agir|kritik",
  "risk_degerlendirmesi": {
    "can_guvenligi_riski": false,
    "elektrik_ariza_riski": true,
    "acil_mudahale": false
  },
  "hasarlar": [
    {
      "etkilenen_ekipman": "ekipman adi",
      "hasar_tipi": "kirik|egik|yanmis|paslanmis|kopmus|catlak|deformasyon|korozyon",
      "hasar_yeri": "fotograftaki konum",
      "siddet": "hafif|orta|agir|kritik",
      "aciklama": "detayli Turkce aciklama",
      "tahmini_neden": "mekanik zorlanma|yaslanma|vandalizm|hava_kosullari|asiri_yuk|bilinmiyor",
      "onerilen_aksiyon": "degisim|tamir|izleme|acil_mudahale"
    }
  ],
  "genel_degerlendirme": "Turkce genel ozet",
  "oncelikli_aksiyonlar": ["en acil aksiyon"],
  "tahmini_maliyet_etkisi": "dusuk|orta|yuksek",
  "guven_skoru": 0.82
}

ONEMLI:
1. Can guvenligi riski varsa mutlaka belirt
2. Kirik izolator, kopmus iletken, egilmis direk = kritik
3. Korozyon/pas, renk degisimi = orta seviye
4. Sadece JSON dondur`
};
