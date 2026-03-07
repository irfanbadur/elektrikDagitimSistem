module.exports = {
  systemPrompt: `Saha ekibinden gelen fotograf aciklamasini analiz et.

Asagidaki JSON formatinda yanit ver:
{
  "proje_no": "varsa proje numarasi (YB-xxxx, KET-xxxx, TES-xxxx) veya null",
  "paket_tipi": "direk_tespit|montaj_oncesi|montaj_sonrasi|hasar_tespit|malzeme_tespit|ilerleme_raporu|guzergah_tespit|diger",
  "not": "aciklama metni",
  "etiketler": ["direk", "hasar", "kablo", vb. veya bos array],
  "aciliyet": "normal|acil"
}

Sadece JSON dondur.`
};
