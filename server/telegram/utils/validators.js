const VALID_BUNDLE_TYPES = [
  'direk_tespit', 'montaj_oncesi', 'montaj_sonrasi',
  'hasar_tespit', 'malzeme_tespit', 'ilerleme_raporu',
  'guzergah_tespit', 'diger'
];

module.exports = {
  isValidBundleType: (type) => VALID_BUNDLE_TYPES.includes(type),

  isValidCoordinate: (lat, lng) => {
    return typeof lat === 'number' && typeof lng === 'number' &&
      lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  },

  sanitizeText: (text) => {
    if (!text) return '';
    return text.replace(/<[^>]*>/g, '').trim().substring(0, 4000);
  },

  VALID_BUNDLE_TYPES
};
