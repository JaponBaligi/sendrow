const crypto = require('crypto');
const express = require('express');

const DEFAULT_FIELD_MAP =
    'Title:Name,Content:Text,Title:Caption';

const PORT = Number(process.env.PORT) || 3000;
const PAT = process.env.AIRTABLE_PAT;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const SECRET = process.env.COPY_LINK_SECRET;
const SOURCE_TABLE = process.env.SOURCE_TABLE_NAME || 'News';
const TARGET_TABLE = process.env.TARGET_TABLE_NAME || 'Create';

/**
 * @returns {{ from: string, to: string }[]}
 */
function parseFieldMap(str) {
    return str
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((pair) => {
            const i = pair.indexOf(':');
            if (i < 1) return null;
            const from = pair.slice(0, i).trim();
            const to = pair.slice(i + 1).trim();
            if (!from || !to) return null;
            return { from, to };
        })
        .filter(Boolean);
}

const FIELD_MAP = parseFieldMap(process.env.COPY_FIELD_MAP || DEFAULT_FIELD_MAP);

function requiredEnv() {
    const missing = [];
    if (!PAT) missing.push('AIRTABLE_PAT');
    if (!BASE_ID) missing.push('AIRTABLE_BASE_ID');
    if (!SECRET) missing.push('COPY_LINK_SECRET');
    return missing;
}

function sign(recordId, exp) {
    return crypto.createHmac('sha256', SECRET).update(`${recordId}:${exp}`).digest('hex');
}

function verifySig(recordId, exp, sig) {
    const expected = sign(recordId, exp);
    try {
        const a = Buffer.from(sig, 'hex');
        const b = Buffer.from(expected, 'hex');
        return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

function html(body, title = 'Copy row') {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;padding:1.5rem;">${body}</body></html>`;
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function airtableGet(path) {
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}${path}`, {
        headers: { Authorization: `Bearer ${PAT}` },
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(text || res.statusText);
    }
    return JSON.parse(text);
}

async function airtablePost(tableName, body) {
    const path = `/${encodeURIComponent(tableName)}`;
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${PAT}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(text || res.statusText);
    }
    return JSON.parse(text);
}

const app = express();

app.get('/health', (req, res) => {
    res.type('text').send('ok');
});

app.get('/', (req, res) => {
    res.type('html').send(html('<p>Copy API. Use <code>/api/copy</code> with a signed link from <code>npm run generate-copy-link</code>.</p>'));
});

app.get('/api/copy', async (req, res) => {
    const missing = requiredEnv();
    if (missing.length) {
        return res.status(500).type('html').send(html(`<p>Server misconfigured: missing ${missing.join(', ')}</p>`));
    }

    const recordId = req.query.recordId;
    const exp = req.query.exp;
    const sig = req.query.sig;

    if (!recordId || exp === undefined || !sig) {
        return res.status(400).type('html').send(html('<p>Missing <code>recordId</code>, <code>exp</code>, or <code>sig</code>.</p>'));
    }

    const now = Math.floor(Date.now() / 1000);
    if (parseInt(String(exp), 10) < now) {
        return res.status(400).type('html').send(html('<p>This link has expired. Generate a new one.</p>'));
    }

    if (!verifySig(String(recordId), String(exp), String(sig))) {
        return res.status(403).type('html').send(html('<p>Invalid signature.</p>'));
    }

    try {
        const path = `/${encodeURIComponent(SOURCE_TABLE)}/${encodeURIComponent(recordId)}`;
        const data = await airtableGet(path);
        const src = data.fields || {};
        const fields = {};
        for (const { from, to } of FIELD_MAP) {
            if (Object.prototype.hasOwnProperty.call(src, from)) {
                fields[to] = src[from];
            }
        }
        await airtablePost(TARGET_TABLE, { fields });
        return res
            .status(200)
            .type('html')
            .send(
                html(
                    `<p>Copied to table <strong>${escapeHtml(TARGET_TABLE)}</strong>.</p><p>You can close this tab.</p>`,
                    'Done',
                ),
            );
    } catch (e) {
        console.error(e);
        return res
            .status(500)
            .type('html')
            .send(html(`<p>Error: ${escapeHtml(e.message)}</p>`));
    }
});

const miss = requiredEnv();
if (miss.length && process.env.NODE_ENV !== 'test') {
    console.warn(`Warning: missing env: ${miss.join(', ')} — /api/copy will error until set.`);
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Listening on ${PORT}`);
});
