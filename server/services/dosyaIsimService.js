const { v4: uuidv4 } = require('uuid');

/**
 * Saha fotoğrafı için dosya adı üret
 * @param {Object} bilgi - { aciklama, ekipKodu, uzanti }
 * @returns {string} "2026-02-12_D3-montaj_EK01_a1b2c3.jpg"
 */
function sahaFotoAdi({ aciklama, ekipKodu, uzanti = 'jpg' }) {
  const tarih = new Date().toISOString().slice(0, 10);
  const kisaAciklama = slugify(aciklama || 'foto');
  const kisaId = uuidv4().slice(0, 6);
  const ekip = ekipKodu || 'GENEL';

  return `${tarih}_${kisaAciklama}_${ekip}_${kisaId}.${uzanti}`;
}

/**
 * Proje dosyası için dosya adı üret
 * @param {Object} bilgi - { projeNo, aciklama, uzanti }
 * @returns {string} "YB-2025-001_kesin-proje.dwg"
 */
function projeDosyaAdi({ projeNo, aciklama, uzanti }) {
  const kisaAciklama = slugify(aciklama || 'dosya');
  return `${projeNo}_${kisaAciklama}.${uzanti}`;
}

/**
 * Dosyanın fiziksel yolunu hesapla
 * @param {Object} bilgi - { projeNo, kategori, dosyaAdi }
 * @returns {string} "2026/YB-2025-001/fotograf/2026-02-12_xxx.jpg"
 */
function dosyaYoluHesapla({ projeNo, kategori, dosyaAdi }) {
  const yil = new Date().getFullYear().toString();
  const projeKlasoru = projeNo || '_genel';
  const kategoriKlasoru = KATEGORI_KLASOR_ESLESMESI[kategori] || 'diger';

  return `${yil}/${projeKlasoru}/${kategoriKlasoru}/${dosyaAdi}`;
}

/**
 * Thumbnail yolunu hesapla
 */
function thumbnailYoluHesapla(dosyaYolu) {
  const dir = dosyaYolu.substring(0, dosyaYolu.lastIndexOf('/'));
  const adi = dosyaYolu.substring(dosyaYolu.lastIndexOf('/') + 1);
  const isim = adi.substring(0, adi.lastIndexOf('.'));
  return `${dir}/thumb/${isim}_thumb.jpg`;
}

/**
 * Türkçe karakterleri temizle, slug oluştur
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ş/g, 'S')
    .replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
    .replace(/[^a-z0-9\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

// Kategori → Fiziksel klasör eşleşmesi
const KATEGORI_KLASOR_ESLESMESI = {
  fotograf:  'fotograf',
  cizim:     'cizim',
  belge:     'belge',
  tablo:     'tablo',
  harita:    'harita',
  arsiv:     'arsiv',
  diger:     'diger',
};

// Uzantı → Kategori otomatik eşleşmesi
const UZANTI_KATEGORI_ESLESMESI = {
  // Fotoğraf
  jpg: 'fotograf', jpeg: 'fotograf', png: 'fotograf',
  heic: 'fotograf', webp: 'fotograf', gif: 'fotograf',
  // Çizim
  dwg: 'cizim', dxf: 'cizim', dgn: 'cizim',
  // Belge
  pdf: 'belge', doc: 'belge', docx: 'belge', txt: 'belge',
  // Tablo
  xls: 'tablo', xlsx: 'tablo', csv: 'tablo', tsv: 'tablo',
  // Harita
  kml: 'harita', kmz: 'harita', geojson: 'harita', gpx: 'harita',
  // Arşiv
  zip: 'arsiv', rar: 'arsiv', '7z': 'arsiv',
};

function uzantidanKategori(dosyaAdi) {
  const uzanti = dosyaAdi.split('.').pop().toLowerCase();
  return UZANTI_KATEGORI_ESLESMESI[uzanti] || 'diger';
}

// ═══════════════════════════════════════════════════
// V2 — ALAN BAZLI DOSYA YOLU
// ═══════════════════════════════════════════════════

const ALAN_KLASOR = {
  proje:     'projeler',
  personel:  'personel',
  ekipman:   'ekipman',
  ihale:     'ihale',
  isg:       'isg',
  firma:     'firma',
  muhasebe:  'muhasebe',
  kurum:     'kurum',
  depo:      'depo',
  sablon:    'sablon',
  diger:     'diger',
};

const ALT_ALAN_KLASOR = {
  // Proje
  fotograf: 'fotograf', cizim: 'cizim', belge: 'belge',
  tablo: 'tablo', harita: 'harita',
  // Personel
  kimlik: 'kimlik', saglik: 'saglik', sertifika: 'sertifika',
  sgk: 'sgk', isg_egitim: 'isg_egitim', sozlesme: 'sozlesme',
  // Ekipman
  ruhsat: 'ruhsat', sigorta: 'sigorta', muayene: 'muayene',
  bakim: 'bakim', kalibrasyon: 'kalibrasyon', kaza: 'kaza',
  // İhale
  sartname: 'sartname', kesif: 'kesif', teklif: 'teklif',
  // İSG
  risk_degerlendirme: 'risk_degerlendirme', egitim: 'egitim',
  denetim: 'denetim', kaza_raporu: 'kaza_raporu', form: 'formlar',
  // Firma
  resmi_belge: 'resmi_belgeler', yetki_belgesi: 'yetki_belgeleri',
  // Muhasebe
  fatura_gelen: 'fatura/gelen', fatura_giden: 'fatura/giden',
  hak_edis: 'hak_edis', banka: 'banka', vergi: 'vergi',
  // Kurum
  yedas: 'yedas', belediye: 'belediye', tedas: 'tedas',
  // Depo
  gelen_malzeme_bono: 'gelen_malzeme/bono', gelen_malzeme_irsaliye: 'gelen_malzeme/irsaliye',
  giden_malzeme: 'giden_malzeme',
  gelen: 'gelen', giden: 'giden',
};

/**
 * Dosyanın fiziksel yolunu hesapla (v2 — alan bazlı)
 */
function dosyaYoluHesaplaV2({
  alan, altAlan, dosyaAdi,
  projeNo, personelKodu, ekipmanKodu, ihaleNo, kurumAdi
}) {
  const yil = new Date().getFullYear().toString();
  const kokKlasor = ALAN_KLASOR[alan] || 'diger';
  const altKlasor = ALT_ALAN_KLASOR[altAlan] || altAlan || 'diger';

  switch (alan) {
    case 'proje':
      return `${kokKlasor}/${yil}/${projeNo || '_genel'}/${altKlasor}/${dosyaAdi}`;
    case 'personel':
      return `${kokKlasor}/${personelKodu || '_genel'}/${altKlasor}/${dosyaAdi}`;
    case 'ekipman':
      return `${kokKlasor}/${altKlasor}/${ekipmanKodu || '_genel'}/${dosyaAdi}`;
    case 'ihale':
      return `${kokKlasor}/${yil}/${ihaleNo || '_genel'}/${altKlasor}/${dosyaAdi}`;
    case 'isg':
      return `${kokKlasor}/${yil}/${altKlasor}/${dosyaAdi}`;
    case 'firma':
      return `${kokKlasor}/${altKlasor}/${dosyaAdi}`;
    case 'muhasebe':
      return `${kokKlasor}/${yil}/${altKlasor}/${dosyaAdi}`;
    case 'kurum':
      return `${kokKlasor}/${kurumAdi || 'diger'}/${yil}/${dosyaAdi}`;
    case 'depo':
      return `${kokKlasor}/${yil}/${altKlasor}/${dosyaAdi}`;
    case 'sablon':
      return `${kokKlasor}/${dosyaAdi}`;
    default:
      return `diger/${yil}/${dosyaAdi}`;
  }
}

module.exports = {
  sahaFotoAdi,
  projeDosyaAdi,
  dosyaYoluHesapla,
  dosyaYoluHesaplaV2,
  thumbnailYoluHesapla,
  slugify,
  uzantidanKategori,
  KATEGORI_KLASOR_ESLESMESI,
  UZANTI_KATEGORI_ESLESMESI,
  ALAN_KLASOR,
  ALT_ALAN_KLASOR,
};
