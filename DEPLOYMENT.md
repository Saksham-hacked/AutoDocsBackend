# AutoDocs — Deployment Guide

## Option 1: Railway / Render / Fly.io (recommended for quick deploys)

1. Push this repo to GitHub
2. Connect your repo in the platform dashboard
3. Set all environment variables from `.env.example` in the platform's secrets UI
4. Set the start command to: `npm start`
5. The platform auto-detects Node.js and runs `npm install`

---

## Option 2: Docker

**Build image**
```bash
docker build -t autodocs-integration .
```

**Run container**
```bash
docker run -d \
  --name autodocs \
  -p 5000:5000 \
  --env-file .env \
  autodocs-integration
```

**Dockerfile** (create in project root if needed):
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
EXPOSE 5000
CMD ["node", "src/server.js"]
```

---

## Option 3: PM2 on a VPS

```bash
npm install -g pm2
npm install

# Start
pm2 start src/server.js --name autodocs-integration

# Persist across reboots
pm2 save
pm2 startup

# Monitor
pm2 logs autodocs-integration
pm2 monit
```

---

## Webhook tunneling for local development

Use [ngrok](https://ngrok.com) or [smee.io](https://smee.io) to expose your local server to GitHub:

```bash
# ngrok
ngrok http 5000
# Copy the https URL → set as webhook URL in your GitHub App settings

# smee (no account needed)
npx smee-client --url https://smee.io/YOUR_CHANNEL --target http://localhost:5000/webhook/github
```

---

## Health check endpoint

```
GET /
→ 200 { service, status, version, timestamp }
```

Use this for uptime monitors (UptimeRobot, BetterUptime, etc.).

---

## Environment checklist before deploying

- [ ] `GITHUB_APP_ID` — numeric ID from GitHub App settings page
- [ ] `GITHUB_PRIVATE_KEY` — PEM key with real newlines replaced by `\n`
- [ ] `GITHUB_WEBHOOK_SECRET` — strong random string (use `openssl rand -hex 32`)
- [ ] `PYTHON_AI_URL` — reachable URL of your Python AI service
- [ ] `NODE_ENV=production`
- [ ] `PORT` — set to `5000` or whatever your host expects
