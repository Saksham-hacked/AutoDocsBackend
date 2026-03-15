# AutoDocs — Integration Layer

Node.js backend that orchestrates GitHub webhooks and delegates documentation generation to a Python AI service.

---

## How it works

```
GitHub Push → POST /webhook/github
                │
                ▼
    Verify HMAC-SHA256 signature
                │
                ▼
    Extract repo / diff metadata
                │
                ▼
    POST → Python AI Service /process-change
                │
                ▼
    Receive updated docs files
                │
                ▼
    Create branch → Commit files → Open PR
```

---

## Local setup

**1. Install dependencies**
```bash
npm install
```

**2. Configure environment**
```bash
cp .env.example .env
# Fill in the values (see below)
```

**3. Start dev server**
```bash
npm run dev
# Server runs on http://localhost:5000
```

**4. Health check**
```bash
curl http://localhost:5000/
```

---

## Environment variables

| Variable | Description |
|---|---|
| `PORT` | HTTP port (default `5000`) |
| `GITHUB_APP_ID` | Your GitHub App's numeric ID |
| `GITHUB_PRIVATE_KEY` | PEM private key (escape newlines as `\n` in `.env`) |
| `GITHUB_WEBHOOK_SECRET` | Secret you set when creating the GitHub App webhook |
| `PYTHON_AI_URL` | Base URL of the Python AI service |
| `NODE_ENV` | `development` or `production` |

**Private key format in `.env`:**
```
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"
```
Replace real newlines with `\n` — the app converts them back automatically.

---

## GitHub App setup

1. Go to **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**
2. Set webhook URL to: `https://your-domain.com/webhook/github`
3. Set a strong webhook secret and copy it to `GITHUB_WEBHOOK_SECRET`
4. Grant **Repository contents** (read/write) and **Pull requests** (read/write) permissions
5. Subscribe to **Push** events
6. After creation, download the private key and paste it into `.env`
7. Install the App on the target repository and note the installation ID

---

## Connecting the Python AI service

The backend calls `POST {PYTHON_AI_URL}/process-change` with:

```json
{
  "repo": "my-repo",
  "owner": "my-org",
  "branch": "main",
  "installationId": 12345678,
  "commitMessage": "feat: add new endpoint",
  "commitId": "abc123",
  "changedFiles": ["src/api/users.js"]
}
```

Expected response:

```json
{
  "files_to_update": [
    { "path": "docs/api.md", "content": "# API\n..." }
  ],
  "pr_title": "📝 AutoDocs: Documentation Updated",
  "pr_body": "Automated documentation update..."
}
```

If the Python service is unreachable, the backend falls back to a mock response so the rest of the pipeline can still be tested end-to-end.

---

## Project structure

```
src/
├── config/         Environment + validation
├── controllers/    Webhook event handler + pipeline
├── middleware/     HMAC-SHA256 signature verifier
├── routes/         Express route definitions
├── services/
│   ├── githubService.js   GitHub App auth + Git operations
│   ├── aiService.js       Python AI service client
│   └── prService.js       PR creation orchestration
├── utils/          Structured logger
└── server.js       App entry point + graceful shutdown
```
