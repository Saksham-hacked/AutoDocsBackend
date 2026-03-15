'use strict';
require('dotenv').config();
const key = process.env.GITHUB_PRIVATE_KEY;
console.log('Raw key first 60 chars:', JSON.stringify(key?.substring(0, 60)));
console.log('Contains real newlines:', key?.includes('\n'));
console.log('Contains literal \\n:', key?.includes('\\n'));
const parsed = key?.replace(/\\n/g, '\n');
console.log('After replace, contains real newlines:', parsed?.includes('\n'));
console.log('Starts with header:', parsed?.startsWith('-----BEGIN'));
