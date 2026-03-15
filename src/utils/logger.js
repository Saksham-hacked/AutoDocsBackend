'use strict';

const { config } = require('../config');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = config.nodeEnv === 'production' ? LEVELS.info : LEVELS.debug;

function format(level, context, message, meta) {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] [${context}] ${message}`;
  if (meta && Object.keys(meta).length > 0) {
    return `${base} ${JSON.stringify(meta)}`;
  }
  return base;
}

function createLogger(context) {
  return {
    info: (msg, meta = {}) => {
      if (CURRENT_LEVEL >= LEVELS.info) console.log(format('info', context, msg, meta));
    },
    warn: (msg, meta = {}) => {
      if (CURRENT_LEVEL >= LEVELS.warn) console.warn(format('warn', context, msg, meta));
    },
    error: (msg, meta = {}) => {
      if (CURRENT_LEVEL >= LEVELS.error) console.error(format('error', context, msg, meta));
    },
    debug: (msg, meta = {}) => {
      if (CURRENT_LEVEL >= LEVELS.debug) console.debug(format('debug', context, msg, meta));
    },
  };
}

module.exports = { createLogger };
