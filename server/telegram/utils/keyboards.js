module.exports = {
  // Paket tipi seçimi
  bundleTypeKeyboard: {
    inline_keyboard: [
      [
        { text: 'Direk Tespit', callback_data: 'bundle_direk_tespit' },
        { text: 'Montaj Oncesi', callback_data: 'bundle_montaj_oncesi' }
      ],
      [
        { text: 'Montaj Sonrasi', callback_data: 'bundle_montaj_sonrasi' },
        { text: 'Hasar Tespit', callback_data: 'bundle_hasar_tespit' }
      ],
      [
        { text: 'Malzeme Tespit', callback_data: 'bundle_malzeme_tespit' },
        { text: 'Ilerleme Raporu', callback_data: 'bundle_ilerleme_raporu' }
      ]
    ]
  },

  // Analiz seçenekleri
  analysisKeyboard: (mediaId) => ({
    inline_keyboard: [
      [
        { text: 'Detayli Analiz (Katman 3)', callback_data: `analyze_${mediaId}` }
      ],
      [
        { text: 'Hasar Analizi', callback_data: `damage_${mediaId}` },
        { text: 'Malzeme Sayimi', callback_data: `count_${mediaId}` }
      ]
    ]
  }),

  // Onay butonları
  approvalKeyboard: (analizId) => ({
    inline_keyboard: [
      [
        { text: 'Onayla', callback_data: `approve_${analizId}` },
        { text: 'Duzelt', callback_data: `correct_${analizId}` },
        { text: 'Reddet', callback_data: `reject_${analizId}` }
      ]
    ]
  })
};
