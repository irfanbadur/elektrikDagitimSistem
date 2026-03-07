export const PROJE_DURUMLARI = {
  teslim_alindi: { label: 'Teslim Alındı', renk: 'gray', emoji: '⚪' },
  tasarimda: { label: 'Tasarımda', renk: 'purple', emoji: '🟣' },
  onay_bekliyor: { label: 'Onay Bekliyor', renk: 'orange', emoji: '🟠' },
  malzeme_bekliyor: { label: 'Malzeme Bekliyor', renk: 'yellow', emoji: '🟡' },
  programda: { label: 'Programda', renk: 'blue', emoji: '🔵' },
  sahada: { label: 'Sahada', renk: 'green', emoji: '🟢' },
  montaj_tamam: { label: 'Montaj Tamam', renk: 'emerald', emoji: '✅' },
  tamamlandi: { label: 'Tamamlandı', renk: 'emerald', emoji: '✅' },
  askida: { label: 'Askıda', renk: 'red', emoji: '🔴' },
}

export const PROJE_DURUM_RENKLERI = {
  teslim_alindi: 'bg-gray-100 text-gray-700',
  tasarimda: 'bg-purple-100 text-purple-700',
  onay_bekliyor: 'bg-orange-100 text-orange-700',
  malzeme_bekliyor: 'bg-yellow-100 text-yellow-700',
  programda: 'bg-blue-100 text-blue-700',
  sahada: 'bg-green-100 text-green-700',
  montaj_tamam: 'bg-emerald-100 text-emerald-700',
  tamamlandi: 'bg-emerald-200 text-emerald-800',
  askida: 'bg-red-100 text-red-700',
}

export const ONCELIK_RENKLERI = {
  acil: 'bg-red-100 text-red-700',
  yuksek: 'bg-orange-100 text-orange-700',
  normal: 'bg-blue-100 text-blue-700',
  dusuk: 'bg-gray-100 text-gray-600',
}

export const ONCELIK_LABELS = {
  acil: 'Acil',
  yuksek: 'Yüksek',
  normal: 'Normal',
  dusuk: 'Düşük',
}

export const EKIP_DURUM_RENKLERI = {
  aktif: 'bg-green-100 text-green-700',
  izinli: 'bg-yellow-100 text-yellow-700',
  pasif: 'bg-gray-100 text-gray-600',
}

export const DEPARTMANLAR = {
  idari: { label: 'İdari', tooltip: 'Yönetim, muhasebe, satın alma vb.' },
  teknik_ofis: { label: 'Teknik-Ofis', tooltip: 'Mühendis, teknisyen vb.' },
  saha_operasyon: { label: 'Saha-Operasyon', tooltip: 'Ekip başı, işçiler, operatör vb.' },
  destek_lojistik: { label: 'Destek-Lojistik', tooltip: 'Aşçı, şoför, temizlikçi vb.' },
}

// Geriye uyumluluk
export const GOREV_TIPLERI = Object.fromEntries(
  Object.entries(DEPARTMANLAR).map(([k, v]) => [k, v.label])
)

export const TALEP_TIPLERI = {
  malzeme: 'Malzeme Talebi',
  enerji_kesintisi: 'Enerji Kesintisi',
  arac: 'Araç/Nakliye',
  teknik_destek: 'Teknik Destek',
  is_guvenligi: 'İş Güvenliği',
  diger: 'Diğer',
}

export const TALEP_DURUMLARI = {
  beklemede: { label: 'Beklemede', renk: 'bg-yellow-100 text-yellow-700' },
  isleniyor: { label: 'İşleniyor', renk: 'bg-blue-100 text-blue-700' },
  onaylandi: { label: 'Onaylandı', renk: 'bg-green-100 text-green-700' },
  reddedildi: { label: 'Reddedildi', renk: 'bg-red-100 text-red-700' },
  tamamlandi: { label: 'Tamamlandı', renk: 'bg-emerald-100 text-emerald-700' },
}

export const MALZEME_KATEGORILERI = {
  kablo: 'Kablo',
  direk: 'Direk',
  trafo: 'Trafo',
  klemens: 'Klemens',
  pano: 'Pano',
  diger: 'Diğer',
}

export const IS_KATEGORILERI = {
  kablo_cekimi: 'Kablo Çekimi',
  direk_dikimi: 'Direk Dikimi',
  trafo_montaj: 'Trafo Montajı',
  pano_montaj: 'Pano Montajı',
  test: 'Test',
  diger: 'Diğer',
}

export const HAVA_DURUMLARI = {
  acik: 'Açık',
  yagmurlu: 'Yağmurlu',
  karli: 'Karlı',
  ruzgarli: 'Rüzgarlı',
}

export const PAKET_TIP_LABELS = {
  direk_tespit: 'Direk Tespit',
  montaj_oncesi: 'Montaj Öncesi',
  montaj_sonrasi: 'Montaj Sonrası',
  ariza_tespit: 'Arıza Tespit',
  kesif: 'Keşif',
  denetim: 'Denetim',
  malzeme: 'Malzeme',
  genel: 'Genel',
}

export const PAKET_DURUM_LABELS = {
  devam_ediyor: { label: 'Devam Ediyor', renk: 'bg-blue-100 text-blue-700' },
  tamamlandi: { label: 'Tamamlandı', renk: 'bg-green-100 text-green-700' },
  iptal: { label: 'İptal', renk: 'bg-red-100 text-red-700' },
}

export const DOSYA_KATEGORI_LABELS = {
  tumu: 'Tümü',
  fotograf: 'Fotoğraf',
  belge: 'Belge',
  cizim: 'Çizim',
  tablo: 'Tablo',
  harita: 'Harita',
  arsiv: 'Arşiv',
  diger: 'Diğer',
}

export const SIRALAMA_SECENEKLERI = {
  tarih_yeni: 'Tarihe Göre (Yeni)',
  tarih_eski: 'Tarihe Göre (Eski)',
  alfabe_az: 'Alfabetik (A-Z)',
  alfabe_za: 'Alfabetik (Z-A)',
}

// ═══════════════════════════════════════════
// ORGANİZASYON — Pozisyon, Görev, Belge, Yetkinlik
// ═══════════════════════════════════════════

export const POZISYON_KATEGORILERI = {
  yonetim: 'Yönetim',
  koordinasyon: 'Koordinasyon',
  teknik: 'Teknik',
  saha: 'Saha',
  destek: 'Destek',
}

export const GOREV_KATEGORILERI = {
  proje_bazli: 'Proje Bazlı',
  firma_geneli: 'Firma Geneli',
  gecici: 'Geçici / Dönemsel',
}

export const BELGE_KATEGORILERI = {
  mesleki: 'Mesleki',
  isg: 'İSG',
  ehliyet: 'Ehliyet / Operatör',
  diger: 'Diğer',
}

export const BELGE_DURUM_RENKLERI = {
  gecerli: 'bg-green-100 text-green-700',
  suresiz: 'bg-blue-100 text-blue-700',
  yakinda_dolacak: 'bg-yellow-100 text-yellow-700',
  suresi_dolmus: 'bg-red-100 text-red-700',
}

export const YETKINLIK_SEVIYELERI = {
  baslangic: { label: 'Başlangıç', puan: 1 },
  orta: { label: 'Orta', puan: 2 },
  ileri: { label: 'İleri', puan: 3 },
  uzman: { label: 'Uzman', puan: 4 },
}

export const KAN_GRUPLARI = ['A Rh+', 'A Rh-', 'B Rh+', 'B Rh-', 'AB Rh+', 'AB Rh-', '0 Rh+', '0 Rh-']

// ═══════════════════════════════════════════
// FAZ / ADIM — Yaşam Döngüsü
// ═══════════════════════════════════════════

export const ADIM_DURUMLARI = {
  bekliyor: { label: 'Bekliyor', renk: 'bg-gray-100 text-gray-500', emoji: '\u23F3' },
  devam_ediyor: { label: 'Devam Ediyor', renk: 'bg-blue-100 text-blue-700', emoji: '\uD83D\uDD04' },
  tamamlandi: { label: 'Tamamland\u0131', renk: 'bg-green-100 text-green-700', emoji: '\u2705' },
  atlandi: { label: 'Atland\u0131', renk: 'bg-yellow-100 text-yellow-700', emoji: '\u23ED\uFE0F' },
}

export const VARSAYILAN_FAZ_RENKLER = [
  '#6366f1', '#8b5cf6', '#0ea5e9', '#f59e0b', '#3b82f6', '#14b8a6', '#10b981',
  '#f43f5e', '#ec4899', '#84cc16',
]

export const VARSAYILAN_FAZ_IKONLAR = [
  '\uD83D\uDE80', '\uD83D\uDCD0', '\uD83D\uDCCB', '\uD83D\uDD27', '\uD83D\uDCB0', '\u2705', '\uD83C\uDFC1',
  '\uD83D\uDCCD', '\uD83D\uDCE6', '\uD83D\uDDFA\uFE0F', '\uD83D\uDD34', '\uD83D\uDCCA', '\uD83D\uDD0D', '\uD83D\uDCDD',
]
