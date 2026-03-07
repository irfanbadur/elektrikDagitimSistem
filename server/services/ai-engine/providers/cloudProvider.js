const config = require('../../../config');
const polePrompts = require('../prompts/poleAnalysisPrompt');
const damagePrompts = require('../prompts/damageAnalysisPrompt');
const generalPrompts = require('../prompts/generalVisionPrompt');

class CloudProvider {
  async parseText(text) {
    const provider = config.ai.katman3.provider();
    if (provider === 'claude') {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: config.ai.katman3.claude.apiKey() });
      const response = await client.messages.create({
        model: config.ai.katman3.claude.model,
        max_tokens: 1000,
        system: require('../prompts/textParsePrompt').systemPrompt,
        messages: [{ role: 'user', content: text }]
      });
      const cleaned = response.content[0].text.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned);
    }
    throw new Error(`Bilinmeyen provider: ${provider}`);
  }

  async parseCaption(caption) {
    return this.parseText(caption);
  }

  async analyzeImage(imageBase64, analysisType, katalogVerisi = null) {
    const provider = config.ai.katman3.provider();
    let prompt;
    switch (analysisType) {
      case 'direk_analiz': prompt = polePrompts.buildPrompt(katalogVerisi); break;
      case 'hasar_tespit': prompt = damagePrompts.buildPrompt(); break;
      case 'malzeme_sayim': prompt = polePrompts.buildCountPrompt(katalogVerisi); break;
      default: prompt = generalPrompts.cloudPrompt;
    }
    if (provider === 'claude') {
      return this._analyzeWithClaude(imageBase64, prompt);
    } else if (provider === 'openai') {
      return this._analyzeWithOpenAI(imageBase64, prompt);
    }
    throw new Error(`Bilinmeyen provider: ${provider}`);
  }

  async _analyzeWithClaude(imageBase64, prompt) {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: config.ai.katman3.claude.apiKey() });
    const response = await client.messages.create({
      model: config.ai.katman3.claude.model,
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
          { type: 'text', text: prompt }
        ]
      }]
    });
    const text = response.content[0].text;
    const cleaned = text.replace(/```json|```/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return { genel_aciklama: text, structured: false };
    }
  }

  async _analyzeWithOpenAI(imageBase64, prompt) {
    const apiKey = config.ai.katman3.openai.apiKey();
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: config.ai.katman3.openai.model,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            { type: 'text', text: prompt }
          ]
        }],
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      })
    });
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  }
}

module.exports = new CloudProvider();
