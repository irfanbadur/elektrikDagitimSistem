module.exports = {
  notRegistered:
    'Kayitli degilsiniz.\n' +
    'Sistemi kullanmak icin /kayit komutunu gonderin.',

  welcomeMessage:
    '<b>ElektraTrack Saha Asistanina Hos Geldiniz!</b>\n\n' +
    'Sisteme kayit olmak icin /kayit komutunu kullanin.\n' +
    'Komut listesi icin /yardim yazin.',

  registrationSuccess: (name, team) =>
    `<b>Kayit basarili!</b>\n` +
    `${name}\n` +
    `${team}\n\n` +
    `Artik mesaj, fotograf ve konum gonderebilirsiniz.`,

  helpMessage:
    '<b>Kullanilabilir Komutlar:</b>\n\n' +
    '/kayit - Sisteme kayit ol\n' +
    '/durum - Ekip ve proje durumu\n' +
    '/ekip - Ekip bilgileri\n' +
    '/paket [tip] [proje] - Veri paketi baslat\n' +
    '/paket tamam - Paketi tamamla\n' +
    '/iptal - Aktif paketi iptal et\n' +
    '/yardim - Bu mesaj\n\n' +
    '<b>Fotograf Gonderme:</b>\n' +
    'Fotograf + aciklama gonderin, otomatik kaydedilir.\n' +
    'GPS acik cekilen fotograflarda konum otomatik alinir.\n\n' +
    '<b>Konum Gonderme:</b>\n' +
    'Telegram\'dan konum paylasin.\n\n' +
    '<b>Serbest Mesaj:</b>\n' +
    'Gunluk rapor, malzeme bildirimi vb. serbest yazin.\n' +
    'Yapay zeka mesajinizi anlayip islem yapar.\n\n' +
    '<b>Ornek mesajlar:</b>\n' +
    '<i>"Bugun 4 kisi Bafra\'da YB-2025-001 uzerinde kablo cekimi yaptik"</i>\n' +
    '<i>"Depodan 120m 3x150 kablo ve 30 klemens aldik"</i>\n' +
    '<i>"Yarin icin 50 adet klemens lazim, acil"</i>',

  processingError:
    'Mesajiniz islenirken bir hata olustu.\n' +
    'Lutfen tekrar deneyin veya koordinatorunuze bildirin.',

  bundleStarted: (paketNo, tip, proje) =>
    `<b>Veri paketi olusturuldu: ${paketNo}</b>\n` +
    `Tip: ${tip}${proje ? ` | Proje: ${proje}` : ''}\n\n` +
    `Simdi fotograf, konum ve notlarinizi gonderin.\n` +
    `Bitirdiginizde /paket tamam yazin.\n` +
    `15 dakika mesaj gelmezse otomatik tamamlanir.`,

  bundleCompleted: (paketNo, fotoSayisi, hasLocation, hasNotes) =>
    `<b>Veri paketi tamamlandi: ${paketNo}</b>\n` +
    `${fotoSayisi} fotograf` +
    `${hasLocation ? ' | Konum var' : ' | Konum yok'}` +
    `${hasNotes ? ' | Not var' : ''}\n` +
    `Koordinatore bildirildi.`,

  bundleCancelled: (paketNo) =>
    `Veri paketi iptal edildi: ${paketNo}`,

  noBundleTypes:
    '<b>Paket Tipleri:</b>\n' +
    'direk_tespit - Direk fotografi + konum\n' +
    'montaj_oncesi - Montaj oncesi durum\n' +
    'montaj_sonrasi - Montaj sonrasi durum\n' +
    'hasar_tespit - Hasar/ariza bildirimi\n' +
    'malzeme_tespit - Malzeme durumu\n' +
    'ilerleme_raporu - Ilerleme fotografi\n' +
    'guzergah_tespit - Kablo guzergahi\n\n' +
    'Kullanim: /paket direk_tespit YB-2025-001'
};
