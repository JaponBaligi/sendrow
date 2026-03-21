# sendrow

Small **Express** service that copies an Airtable row from one table to another. Use a **Button → Open URL** with a **static token** + `RECORD_ID()` (recommended for many rows), or a **signed URL** from `npm run generate-copy-link`. Optional **Airtable Blocks** frontend for local development.

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
| `AIRTABLE_PAT` | Personal access token (data read/write for your base). |
| `AIRTABLE_BASE_ID` | Base id (`app…`). |
| `COPY_STATIC_TOKEN` | Long random secret: same value in Railway and in the button URL formula (Option 1). |
| `COPY_LINK_SECRET` | Secret for HMAC-signed links from `generate-copy-link` (Option 2). You can set **both** token types. |
| `COPY_FIELD_MAP` | Optional. Comma-separated `SourceField:TargetField` pairs. Default: `Title:Name,Content:Text,Title:Caption`. |

### Airtable button (Option 1)

1. Generate a long random value (e.g. `openssl rand -hex 32`) and set it as **`COPY_STATIC_TOKEN`** on Railway (and locally if you test).
2. Edit the **Button** field → **Open URL** → use a **formula** like:

   `"https://YOUR_RAILWAY_HOST/api/copy?recordId=" & RECORD_ID() & "&token=" & "PASTE_TOKEN_HERE"`

   Use the **same** string as `COPY_STATIC_TOKEN`. Keep the token URL-safe (letters/numbers; avoid `&` in the token).

3. Every row uses the same formula; `RECORD_ID()` picks the current row.

### `INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND`

Usually one of:

1. **Personal access token** — At [airtable.com/create/tokens](https://airtable.com/create/tokens), enable **data.records:read** and **data.records:write**, and under access add **this base** (or the whole workspace).
2. **`AIRTABLE_BASE_ID`** — Must be the `app…` id of the base that contains **News** and **Create** (from the browser URL when the base is open).
3. **Table name** — Must match **exactly** (case, spaces). Safer: set **`SOURCE_TABLE_ID`** and **`TARGET_TABLE_ID`** to the `tbl…` values from the URL when you open each table in Airtable.
4. **Wrong record** — `RECORD_ID()` must be a row in the **source** table (News).

## Scripts

| Script | Purpose |
|--------|--------|
| `npm start` | Run the copy API (`server/index.js`). Uses `PORT` if set. |
| `npm run generate-copy-link -- <recordId>` | Print a signed `/api/copy` URL (needs `COPY_LINK_SECRET`, optional `PUBLIC_BASE_URL`). |
| `npm run block:dev` | Local Airtable extension via Blocks CLI (requires `.block/remote.json` or env — see `scripts/write-remote-config.js`). |
| `npm run lint` | ESLint on `frontend/`, `server/`, `scripts/`. |

## License

See [LICENSE.md](LICENSE.md).
