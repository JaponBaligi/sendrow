const crypto = require('crypto');
const express = require('express');

const DEFAULT_FIELD_MAP =
    'Title:Name,Content:Text,Title:Caption';

const PORT = Number(process.env.PORT) || 3000;
const PAT = process.env.AIRTABLE_PAT;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const SECRET = process.env.COPY_LINK_SECRET;
const STATIC_TOKEN = process.env.COPY_STATIC_TOKEN;
/** Prefer table ids (`tbl…`) — names must match exactly and are easier to get wrong. */
const SOURCE_TABLE = process.env.SOURCE_TABLE_ID || process.env.SOURCE_TABLE_NAME || 'News';
const TARGET_TABLE = process.env.TARGET_TABLE_ID || process.env.TARGET_TABLE_NAME || 'Create';

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
    return missing;
}

function hasCopyAuth() {
    return !!(STATIC_TOKEN || SECRET);
}

/** @param {string} provided */
function verifyStaticToken(provided) {
    if (!STATIC_TOKEN || typeof provided !== 'string') return false;
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(STATIC_TOKEN, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
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
    res.type('html').send(
        html(
            '<p>Copy API. <code>GET /api/copy</code>: use <code>recordId</code> + <code>token</code> (Airtable button formula), or signed <code>exp</code> + <code>sig</code> from <code>npm run generate-copy-link</code>.</p>',
        ),
    );
});

app.get('/api/copy', async (req, res) => {
    const missing = requiredEnv();
    if (missing.length) {
        return res.status(500).type('html').send(html(`<p>Server misconfigured: missing ${missing.join(', ')}</p>`));
    }

    if (!hasCopyAuth()) {
        return res
            .status(500)
            .type('html')
            .send(
                html(
                    '<p>Set <code>COPY_STATIC_TOKEN</code> (button URLs) and/or <code>COPY_LINK_SECRET</code> (signed links).</p>',
                ),
            );
    }

    const recordId = req.query.recordId;
    if (!recordId) {
        return res.status(400).type('html').send(html('<p>Missing <code>recordId</code>.</p>'));
    }

    const token = req.query.token;
    const exp = req.query.exp;
    const sig = req.query.sig;

    let authorized = false;

    if (STATIC_TOKEN && token) {
        if (!verifyStaticToken(String(token))) {
            return res.status(403).type('html').send(html('<p>Invalid <code>token</code>.</p>'));
        }
        authorized = true;
    } else if (SECRET && exp !== undefined && sig) {
        const now = Math.floor(Date.now() / 1000);
        if (parseInt(String(exp), 10) < now) {
            return res.status(400).type('html').send(html('<p>This link has expired. Generate a new one.</p>'));
        }
        if (!verifySig(String(recordId), String(exp), String(sig))) {
            return res.status(403).type('html').send(html('<p>Invalid signature.</p>'));
        }
        authorized = true;
    } else if (STATIC_TOKEN && !SECRET) {
        return res.status(400).type('html').send(html('<p>Missing <code>token</code> query parameter.</p>'));
    } else if (SECRET && !STATIC_TOKEN) {
        if (exp === undefined || !sig) {
            return res.status(400).type('html').send(html('<p>Missing <code>exp</code> or <code>sig</code>.</p>'));
        }
    }

    if (!authorized) {
        return res
            .status(400)
            .type('html')
            .send(
                html(
                    '<p>Use <code>token=…</code> (static) or <code>exp</code> + <code>sig</code> (signed). See README.</p>',
                ),
            );
    }

    let data;
    try {
        const path = `/${encodeURIComponent(SOURCE_TABLE)}/${encodeURIComponent(recordId)}`;
        data = await airtableGet(path);
    } catch (e) {
        console.error('airtable GET source', e);
        return res.status(500).type('html').send(
            html(
                `<p><strong>Could not read the source row</strong> (table <code>${escapeHtml(SOURCE_TABLE)}</code>, record <code>${escapeHtml(String(recordId))}</code>).</p>` +
                    `<p>${escapeHtml(e.message)}</p>` +
                    '<p>Check: <code>AIRTABLE_BASE_ID</code> is this base; PAT has <strong>data.records:read</strong> and access to the base; <code>SOURCE_TABLE_ID</code> or <code>SOURCE_TABLE_NAME</code> matches the News table (open table in Airtable — URL contains <code>tbl…</code>).</p>',
            ),
        );
    }

    const src = data.fields || {};
    const fields = {};
    for (const { from, to } of FIELD_MAP) {
        if (Object.prototype.hasOwnProperty.call(src, from)) {
            fields[to] = src[from];
        }
    }

    try {
        await airtablePost(TARGET_TABLE, { fields });
    } catch (e) {
        console.error('airtable POST target', e);
        return res.status(500).type('html').send(
            html(
                `<p><strong>Could not create row in Create table</strong> (<code>${escapeHtml(TARGET_TABLE)}</code>).</p>` +
                    `<p>${escapeHtml(e.message)}</p>` +
                    '<p>Check: PAT has <strong>data.records:write</strong>; <code>TARGET_TABLE_ID</code> or <code>TARGET_TABLE_NAME</code> matches Create; field names in <code>COPY_FIELD_MAP</code> exist on the Create table.</p>',
            ),
        );
    }

    return res
        .status(200)
        .type('html')
        .send(
            html(
                `<p>Copied to table <strong>${escapeHtml(TARGET_TABLE)}</strong>.</p><p>You can close this tab.</p>`,
                'Done',
            ),
        );
});

const miss = requiredEnv();
if (miss.length && process.env.NODE_ENV !== 'test') {
    console.warn(`Warning: missing env: ${miss.join(', ')} — /api/copy will error until set.`);
} else if (!hasCopyAuth() && process.env.NODE_ENV !== 'test') {
    console.warn('Warning: set COPY_STATIC_TOKEN and/or COPY_LINK_SECRET for /api/copy.');
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Listening on ${PORT}`);
});
