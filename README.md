# STRIDE — Personal Fitness Intelligence

Personal fitness companion for a Garmin Forerunner 165. Pulls Garmin Connect Personal API data, stores history, and produces deterministic, explainable insights.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- MongoDB + Mongoose
- Vitest + Playwright

## Quick start

```bash
cp .env.example .env
# set AUTH_SECRET and ENCRYPTION_KEY (32-byte base64)
docker compose up -d mongo
npm install
npm run dev
```

Sign in with `APP_USERNAME` / `APP_PASSWORD` (defaults: `owner` / `change-me`).

### iPhone home screen

Safari → Share → **Add to Home Screen**. Opens as standalone STRIDE (`display: standalone`, safe-area aware). Use your LAN/`APP_URL` host if pinning from another device.

## Product modules (PRD v2)

Home · My Activities · Performance · Recovery · Coach · Goals & Races · My Journey · Settings & Garmin

Docs: `prd/stride-v2.md`, `DESIGN.md`

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local app |
| `npm run build` | Production build |
| `npm run start` | Standalone production server |
| `npm run worker:sync` | Scheduled Garmin activities + health sync |
| `npm test` | Unit tests |
| `npm run test:e2e` | Playwright regression |

API prefix: `/api/v1` (session required).
