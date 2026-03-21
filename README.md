# sendrow

Small **Express** service that copies an Airtable row from one table to another via a **signed URL** (for use with an Airtable **Button → Open URL** field). Includes an optional **Airtable Blocks** frontend for local development.

## Requirements

- Node 18+
- An Airtable [personal access token](https://airtable.com/create/tokens) with access to the base and tables you use

## Setup

```bash
npm install
cp .env.example .env
```

## Configuration (env)

| Variable | Meaning |
|----------|--------|
| `COPY_FIELD_MAP` | Optional. Comma-separated `SourceField:TargetField` pairs. Default: `Title:Name,Content:Text,Title:Caption` (News → Create field names). |

## Scripts

| Script | Purpose |
|--------|--------|
| `npm start` | Run the copy API (`server/index.js`). Uses `PORT` if set. |
| `npm run generate-copy-link -- <recordId>` | Print a signed `/api/copy` URL (needs `COPY_LINK_SECRET`, optional `PUBLIC_BASE_URL`). |
| `npm run block:dev` | Local Airtable extension via Blocks CLI (requires `.block/remote.json` or env — see `scripts/write-remote-config.js`). |
| `npm run lint` | ESLint on `frontend/`, `server/`, `scripts/`. |

