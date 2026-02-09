const ollamaProvider = require('./providers/ollamaProvider');
const cloudProvider = require('./providers/cloudProvider');
const analysisService = require('../services/analysisService');
const config = require('../config');

class AIManager {
  async parseText(text) {
    const providers = config.ai.getActiveProviders();
    if (providers.katman1) {
      try { return await ollamaProvider.parseText(text); } catch (e) { console.error('Katman1 parseText hata:', e.message); }
    }
    if (providers.katman3) {
      try { return await cloudProvider.parseText(text); } catch (e) { console.error('Katman3 parseText hata:', e.message); }
    }
    return null;
  }

  async parseCaption(caption) {
    const providers = config.ai.getActiveProviders();
    if (providers.katman1) {
      try { return await ollamaProvider.parseCaption(caption); } catch (e) { console.error('Katman1 parseCaption hata:', e.message); }
    }
    if (providers.katman3) {
      try { return await cloudProvider.parseCaption(caption); } catch (e) { console.error('Katman3 parseCaption hata:', e.message); }
    }
    return null;
  }

  async analyzePhotoGeneral(imageBuffer) {
    const providers = config.ai.getActiveProviders();
    if (providers.katman2) {
      try {
        const imageBase64 = imageBuffer.toString('base64');
        return await ollamaProvider.analyzeImage(imageBase64, 'general');
      } catch (e) { console.error('Katman2 analiz hata:', e.message); }
    }
    if (providers.katman3) {
      try {
        const imageBase64 = imageBuffer.toString('base64');
        return await cloudProvider.analyzeImage(imageBase64, 'general');
      } catch (e) { console.error('Katman3 fallback analiz hata:', e.message); }
    }
    return null;
  }

  async analyzePhotoDetailed(imageBuffer, analizTipi, katalogVerisi = null) {
    const providers = config.ai.getActiveProviders();
    if (!providers.katman3) {
      return {
        error: true,
        message: 'Detayli analiz icin Cloud AI (Katman 3) aktif degil. Ayarlar > AI bolumunden Cloud API anahtari giriniz.'
      };
    }
    const imageBase64 = imageBuffer.toString('base64');
    return cloudProvider.analyzeImage(imageBase64, analizTipi, katalogVerisi);
  }

  async processPhotoAnalysis(mediaId, imageBuffer, autoLevel = null) {
    const level = autoLevel ?? config.dataBundle.autoAnalysisLevel;
    const results = [];

    if (level >= 2) {
      try {
        const generalResult = await this.analyzePhotoGeneral(imageBuffer);
        if (generalResult) {
          const savedId = await analysisService.saveAnalysis({
            medyaId: mediaId,
            katman: 2,
            analizTipi: 'genel_tanima',
            sonuc: generalResult
          });
          results.push({ katman: 2, id: savedId, sonuc: generalResult });
        }
      } catch (err) {
        console.error('Katman 2 analiz hatasi:', err.message);
      }
    }

    if (level >= 3) {
      try {
        const katalog = await analysisService.getRelevantCatalog();
        const detailResult = await this.analyzePhotoDetailed(imageBuffer, 'direk_analiz', katalog);
        if (detailResult && !detailResult.error) {
          const savedId = await analysisService.saveAnalysis({
            medyaId: mediaId,
            katman: 3,
            analizTipi: 'direk_analiz',
            sonuc: detailResult
          });
          results.push({ katman: 3, id: savedId, sonuc: detailResult });
        }
      } catch (err) {
        console.error('Katman 3 analiz hatasi:', err.message);
      }
    }

    return results;
  }

  async healthCheck() {
    const status = { katman1: false, katman2: false, katman3: false };
    try {
      const res = await fetch(`${config.ai.katman1.baseUrl()}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        const models = data.models?.map(m => m.name) || [];
        status.katman1 = models.some(m => m.includes(config.ai.katman1.model()));
        status.katman2 = models.some(m => m.includes('vision') || m.includes('llava'));
        status.ollama_running = true;
        status.ollama_models = models;
      }
    } catch {
      status.ollama_running = false;
    }
    try {
      const provider = config.ai.katman3.provider();
      if (provider === 'claude' && config.ai.katman3.claude.apiKey()) {
        status.katman3 = true;
        status.cloud_provider = 'claude';
      } else if (provider === 'openai' && config.ai.katman3.openai.apiKey()) {
        status.katman3 = true;
        status.cloud_provider = 'openai';
      }
    } catch {
      status.katman3 = false;
    }
    return status;
  }
}

module.exports = new AIManager();
