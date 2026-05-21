// Environment Configuration Loader
require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  apiKey: process.env.API_KEY || 'dev-key-change-in-production',

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    ownerId: process.env.TELEGRAM_OWNER_ID || '',
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: 'gemini-2.0-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },

  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
  },

  facebook: {
    appId: process.env.FB_APP_ID || '',
    appSecret: process.env.FB_APP_SECRET || '',
    pageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN || '',
    pageId: process.env.FB_PAGE_ID || '',
    graphApiVersion: 'v21.0',
    get baseUrl() {
      return `https://graph.facebook.com/${this.graphApiVersion}`;
    },
  },

  db: {
    path: './data/commandcenter.db',
  },
};

// Validate critical config
config.validate = function () {
  const warnings = [];
  if (!this.telegram.botToken) warnings.push('TELEGRAM_BOT_TOKEN not set — bot will not start');
  if (!this.gemini.apiKey) warnings.push('GEMINI_API_KEY not set — AI features limited');
  if (!this.groq.apiKey) warnings.push('GROQ_API_KEY not set — fast AI fallback unavailable');
  if (!this.facebook.pageAccessToken) warnings.push('FB_PAGE_ACCESS_TOKEN not set — Facebook features disabled');
  return warnings;
};

module.exports = config;
