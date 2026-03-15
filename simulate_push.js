'use strict';

/**
 * simulate_push.js
 *
 * Sends a fake GitHub push payload directly to the Layer 1 webhook,
 * bypassing HMAC signature verification, to test the full Layer1→Layer2 pipeline.
 *
 * Usage:
 *   node simulate_push.js
 */

const crypto = require('crypto');
const http = require('http');

const LAYER1_URL = 'http://localhost:5000';
const WEBHOOK_SECRET = 'test-secret';

const payload = {
  ref: 'refs/heads/main',
  after: 'abc1234567890abcdef',
  installation: { id: 116156991 }, // Replace with your real installation ID from github.com/settings/installations/XXXXXXXX
  repository: {
    name: 'short_url_generator',
    owner: { login: 'Saksham-hacked' },
  },
  head_commit: {
    id: 'abc1234567890abcdef',
    message: 'feat: add GET /settings route',
  },
  commits: [
    {
      id: 'abc1234567890abcdef',
      added: ['src/routes/settings.js'],
      modified: [],
      removed: [],
    },
  ],
};

const body = JSON.stringify(payload);

// Compute valid HMAC so the webhook verifier accepts it
const sig = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/webhook/github',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'x-github-event': 'push',
    'x-github-delivery': 'test-delivery-001',
    'x-hub-signature-256': sig,
  },
};

console.log('Sending simulated push to Layer 1...');
console.log('Payload:', JSON.stringify(payload, null, 2));
console.log('');

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    console.log(`Layer 1 response: ${res.statusCode}`);
    try {
      console.log(JSON.stringify(JSON.parse(data), null, 2));
    } catch {
      console.log(data);
    }
    console.log('');
    console.log('Layer 1 acknowledged. Processing continues async in Layer 1.');
    console.log('Watch both terminal windows for the full pipeline logs.');
  });
});

req.on('error', (e) => {
  console.error('Could not reach Layer 1:', e.message);
  console.error('Make sure Layer 1 is running: npm run dev (in autoDocsBackend/)');
});

req.write(body);
req.end();
