'use strict';

require('dotenv').config();

const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',

  github: {
    appId: process.env.GITHUB_APP_ID,
    // Support both inline \n and real newlines in the key
    privateKey: process.env.GITHUB_PRIVATE_KEY
      ? process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n')
      : null,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  },

  pythonAI: {
    baseUrl: process.env.PYTHON_AI_URL || 'http://localhost:8000',
    timeoutMs: parseInt(process.env.PYTHON_AI_TIMEOUT_MS || '0', 10), // 0 = no timeout
    sharedSecret: process.env.AUTODOCS_SHARED_SECRET || 'changeme',
  },
};

function validateConfig() {
  const required = [
    ['GITHUB_APP_ID', config.github.appId],
    ['GITHUB_PRIVATE_KEY', config.github.privateKey],
    ['GITHUB_WEBHOOK_SECRET', config.github.webhookSecret],
  ];

  const missing = required.filter(([, val]) => !val).map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = { config, validateConfig };
