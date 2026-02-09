const config = require('../../config');
const prompts = require('../prompts/textParsePrompt');
const captionPrompts = require('../prompts/photoCaptionPrompt');
const visionPrompts = require('../prompts/generalVisionPrompt');

class OllamaProvider {
  async parseText(text) {
    const baseUrl = config.ai.katman1.baseUrl();
    const model = config.ai.katman1.model();
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: prompts.systemPrompt },
          { role: 'user', content: text }
        ],
        format: 'json',
        stream: false,
        options: { temperature: 0.1 }
      }),
      signal: AbortSignal.timeout(config.ai.katman1.timeout)
    });
    const data = await response.json();
    return JSON.parse(data.message.content);
  }

  async parseCaption(caption) {
    const baseUrl = config.ai.katman1.baseUrl();
    const model = config.ai.katman1.model();
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: captionPrompts.systemPrompt },
          { role: 'user', content: caption }
        ],
        format: 'json',
        stream: false,
        options: { temperature: 0.1 }
      }),
      signal: AbortSignal.timeout(config.ai.katman1.timeout)
    });
    const data = await response.json();
    return JSON.parse(data.message.content);
  }

  async analyzeImage(imageBase64, analysisType = 'general') {
    const baseUrl = config.ai.katman2.baseUrl();
    const model = config.ai.katman2.model();
    let prompt;
    switch (analysisType) {
      case 'general': prompt = visionPrompts.generalPrompt; break;
      case 'damage': prompt = visionPrompts.damagePrompt; break;
      default: prompt = visionPrompts.generalPrompt;
    }
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt, images: [imageBase64] }],
        format: 'json',
        stream: false,
        options: { temperature: 0.2 }
      }),
      signal: AbortSignal.timeout(config.ai.katman2.timeout)
    });
    const data = await response.json();
    try {
      return JSON.parse(data.message.content);
    } catch {
      return { genel_aciklama: data.message.content, structured: false };
    }
  }
}

module.exports = new OllamaProvider();
