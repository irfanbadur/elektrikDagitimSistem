module.exports = {
  generalPrompt: `Bu bir elektrik dagitim sahasi fotografi. Asagidaki JSON formatinda analiz et:

{
  "fotograf_tipi": "direk|trafo|pano|kablo|genel_saha|diger",
  "genel_aciklama": "Kisa Turkce aciklama",
  "tespit_edilen_nesneler": [
    {"nesne": "beton direk", "durum": "iyi|orta|kotu", "not": ""}
  ],
  "hasar_var": false,
  "hasar_aciklama": "varsa kisa aciklama",
  "acil_durum": false,
  "oneriler": ["varsa kisa oneriler"]
}

Sadece JSON dondur. Kisa ve oz ol.`,

  damagePrompt: `Bu bir elektrik dagitim ekipmani fotografi. HASAR TESPITI yap:

{
  "hasar_var": true,
  "hasar_seviyesi": "yok|hafif|orta|agir|kritik",
  "hasarlar": [
    {
      "nesne": "etkilenen ekipman",
      "hasar_tipi": "kirik|egik|yanmis|paslanmis|kopmus|diger",
      "aciklama": "detayli aciklama",
      "acil_mudahale": false
    }
  ],
  "genel_degerlendirme": "Turkce ozet",
  "onerilen_aksiyonlar": ["aksiyon 1"]
}

Sadece JSON dondur.`,

  cloudPrompt: `Bu bir elektrik dagitim sahasi fotografi. Detayli analiz et.
Turkce yanit ver, sadece JSON formatinda.`
};
