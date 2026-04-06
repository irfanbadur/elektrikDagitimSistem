const path = require('path');

module.exports = {
  ai: {
    getActiveProviders: () => {
      const db = require('./db/database').getDb();
      const row = db.prepare(
        "SELECT deger FROM firma_ayarlari WHERE anahtar = 'ai_aktif_katmanlar'"
      ).get();
      return row?.deger ? JSON.parse(row.deger) : { katman1: true, katman2: true, katman3: false };
    },
    katman1: {
      provider: 'ollama',
      baseUrl: () => {
        const db = require('./db/database').getDb();
        const row = db.prepare(
          "SELECT deger FROM firma_ayarlari WHERE anahtar = 'ollama_base_url'"
        ).get();
        return row?.deger || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      },
      model: () => {
        const db = require('./db/database').getDb();
        const row = db.prepare(
          "SELECT deger FROM firma_ayarlari WHERE anahtar = 'ollama_text_model'"
        ).get();
        return row?.deger || 'qwen2.5:7b';
      },
      timeout: 120000
    },
    katman2: {
      provider: 'ollama',
      baseUrl: () => module.exports.ai.katman1.baseUrl(),
      model: () => {
        const db = require('./db/database').getDb();
        const row = db.prepare(
          "SELECT deger FROM firma_ayarlari WHERE anahtar = 'ollama_vision_model'"
        ).get();
        return row?.deger || 'gemma3:4b';
      },
      timeout: 300000
    },
    katman3: {
      provider: () => {
        const db = require('./db/database').getDb();
        const row = db.prepare(
          "SELECT deger FROM firma_ayarlari WHERE anahtar = 'cloud_ai_provider'"
        ).get();
        return row?.deger || 'claude';
      },
      claude: {
        apiKey: () => {
          const db = require('./db/database').getDb();
          const row = db.prepare(
            "SELECT deger FROM firma_ayarlari WHERE anahtar = 'claude_api_key'"
          ).get();
          return row?.deger || process.env.ANTHROPIC_API_KEY;
        },
        model: 'claude-sonnet-4-5-20250929'
      },
      openai: {
        apiKey: () => {
          const db = require('./db/database').getDb();
          const row = db.prepare(
            "SELECT deger FROM firma_ayarlari WHERE anahtar = 'openai_api_key'"
          ).get();
          return row?.deger || process.env.OPENAI_API_KEY;
        },
        model: 'gpt-4o'
      },
      timeout: 90000
    }
  },

  media: {
    basePath: path.join(__dirname, 'media'),
    photosDir: 'photos',
    thumbnailsDir: 'thumbnails',
    analysisDir: 'analysis',
    documentsDir: 'documents',
    maxPhotoSize: 10 * 1024 * 1024,
    thumbnailWidth: 400,
    thumbnailHeight: 400,
    analysisMaxWidth: 2048,
    analysisMaxHeight: 2048,
    analysisQuality: 90,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
  },

  catalog: {
    basePath: path.join(__dirname, 'catalog'),
    referenceImagesDir: 'reference-images',
    maxReferencePhotos: 3,
    minMatchConfidence: 0.6
  },

  dataBundle: {
    autoCompleteMinutes: 15,
    maxPhotosPerBundle: 20,
    maxBundlesPerDay: 50,
    autoAnalysisLevel: 2
  }
};
